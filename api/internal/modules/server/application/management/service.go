package managementapp

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type contextKey string

const actorRoleContextKey contextKey = "actor_role"

func WithActorRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, actorRoleContextKey, strings.ToLower(strings.TrimSpace(role)))
}

func ActorRoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(actorRoleContextKey).(string)
	if role == "" {
		return "viewer"
	}
	return role
}

type AgentInfoReader interface {
	GetByServerID(serverID string) (*agent.AgentInfo, error)
}

type OnlineChecker interface {
	IsAnyTransportOnline(serverID string) bool
}

type Service struct {
	servers domain.ServerRepository
	agents  AgentInfoReader
	hub     OnlineChecker
}

func NewService(servers domain.ServerRepository, agents AgentInfoReader, hub OnlineChecker) *Service {
	return &Service{
		servers: servers,
		agents:  agents,
		hub:     hub,
	}
}

func (s *Service) RegisterServer(ctx context.Context, server *domain.Server) error {
	if err := validateServer(server); err != nil {
		return err
	}

	if !isLocalServerAddress(server.IPAddress) {
		if existing, err := s.servers.GetByIPAddress(ctx, server.IPAddress); err == nil && existing != nil {
			return fmt.Errorf("server with ip %s already exists", server.IPAddress)
		}
	}

	if server.ID == "" {
		server.ID = uuid.NewString()
	}
	server.Name = strings.TrimSpace(server.Name)
	server.Description = strings.TrimSpace(server.Description)
	server.Hostname = strings.TrimSpace(server.Hostname)
	if server.Environment == "" {
		server.Environment = domain.ServerEnvironmentProduction
	}
	if server.ConnectionMode == "" {
		server.ConnectionMode = domain.ServerConnectionModeAgent
	}
	server.Status = domain.ServerStatusOffline
	server.OnboardingStatus = domain.ServerOnboardingStatusPending
	if server.SSHPort == 0 {
		server.SSHPort = 22
	}
	now := time.Now().UTC()
	server.CreatedAt = now
	server.UpdatedAt = now
	return s.servers.Create(ctx, server)
}

func (s *Service) ListServers(ctx context.Context, filter domain.ServerFilter) ([]*domain.Server, int64, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	return s.servers.List(ctx, filter)
}

func (s *Service) GetServer(ctx context.Context, id string) (*domain.Server, error) {
	if id == "" {
		return nil, errors.New("server id is required")
	}
	return s.servers.GetByID(ctx, id)
}

func (s *Service) UpdateServer(ctx context.Context, server *domain.Server) error {
	if server.ID == "" {
		return errors.New("server id is required")
	}
	if err := validateServer(server); err != nil {
		return err
	}

	existing, err := s.servers.GetByID(ctx, server.ID)
	if err != nil {
		return err
	}
	if !isLocalServerAddress(server.IPAddress) {
		if conflict, err := s.servers.GetByIPAddress(ctx, server.IPAddress); err == nil && conflict != nil && conflict.ID != server.ID {
			return fmt.Errorf("server with ip %s already exists", server.IPAddress)
		}
	}
	server.CreatedAt = existing.CreatedAt
	if server.OnboardingStatus == "" {
		server.OnboardingStatus = existing.OnboardingStatus
	}
	if server.Status == "" {
		server.Status = existing.Status
	}
	if server.SSHPort == 0 {
		server.SSHPort = existing.SSHPort
	}
	server.UpdatedAt = time.Now().UTC()
	return s.servers.Update(ctx, server)
}

func isLocalServerAddress(raw string) bool {
	candidate := strings.TrimSpace(strings.ToLower(raw))
	if candidate == "" {
		return false
	}
	if candidate == "localhost" {
		return true
	}
	ip := net.ParseIP(candidate)
	if ip == nil {
		return false
	}
	return ip.IsLoopback()
}

func (s *Service) DeleteServer(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("server id is required")
	}
	return s.servers.Delete(ctx, id)
}

func (s *Service) GetRuntimeStatus(ctx context.Context, serverID string) (map[string]any, error) {
	server, err := s.GetServer(ctx, serverID)
	if err != nil {
		return nil, err
	}

	response := map[string]any{
		"server_id":        server.ID,
		"name":             server.Name,
		"ip_address":       server.IPAddress,
		"inventory_status": server.Status,
		"online":           s.hub.IsAnyTransportOnline(serverID),
	}

	if info, err := s.agents.GetByServerID(serverID); err == nil && info != nil {
		response["last_seen"] = info.LastSeen
		response["agent_version"] = info.Version
		response["has_docker"] = info.HasDocker
		response["has_k8s"] = info.HasK8s
		response["os"] = info.OS
		response["arch"] = info.Arch
	}
	return response, nil
}

func (s *Service) GetMetrics(ctx context.Context, serverID string) (*domain.ServerMetrics, error) {
	if _, err := s.GetServer(ctx, serverID); err != nil {
		return nil, err
	}

	metrics := &domain.ServerMetrics{
		ServerID:    serverID,
		LoadAverage: []float64{0, 0, 0},
	}

	info, err := s.agents.GetByServerID(serverID)
	if err != nil || info == nil {
		return metrics, nil
	}

	metrics.CPUUsage = info.CPUPercent
	metrics.MemoryUsage = info.MemPercent
	metrics.DiskUsage = info.DiskPercent
	return metrics, nil
}

func (s *Service) GetPlatformOverview(ctx context.Context) (map[string]any, error) {
	servers, total, err := s.ListServers(ctx, domain.ServerFilter{Page: 1, PageSize: 10000})
	if err != nil {
		return nil, err
	}

	online := 0
	dockerEnabled := 0
	k8sEnabled := 0
	for _, server := range servers {
		if s.hub.IsAnyTransportOnline(server.ID) {
			online++
		}
		if info, err := s.agents.GetByServerID(server.ID); err == nil && info != nil {
			if info.HasDocker {
				dockerEnabled++
			}
			if info.HasK8s {
				k8sEnabled++
			}
		}
	}

	return map[string]any{
		"bounded_contexts": []string{
			"server-management",
			"agent-control",
		},
		"servers_total":          total,
		"servers_online":         online,
		"servers_offline":        total - int64(online),
		"agent_capable_docker":   dockerEnabled,
		"agent_capable_k8s":      k8sEnabled,
		"architecture_readiness": "ddd-bootstrap",
	}, nil
}

func validateServer(server *domain.Server) error {
	if server == nil {
		return errors.New("server payload is required")
	}
	if strings.TrimSpace(server.Name) == "" {
		return errors.New("server name is required")
	}
	if strings.TrimSpace(server.IPAddress) == "" {
		return errors.New("server ip_address is required")
	}
	if server.ConnectionMode == domain.ServerConnectionModeSSH || server.ConnectionMode == domain.ServerConnectionModeHybrid || server.ConnectionMode == domain.ServerConnectionModeBastion {
		if strings.TrimSpace(server.SSHUser) == "" {
			return errors.New("ssh_user is required for ssh or hybrid connection modes")
		}
	}
	if server.ConnectionMode == domain.ServerConnectionModeBastion && strings.TrimSpace(server.TunnelHost) == "" {
		return errors.New("tunnel_host is required for bastion connection mode")
	}
	if server.CPUCores < 0 || server.MemoryGB < 0 || server.DiskGB < 0 {
		return errors.New("resource capacity values must be non-negative")
	}
	return nil
}
