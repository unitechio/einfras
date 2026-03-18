package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/ssh"
)

type serverUsecase struct {
	serverRepo    domain.ServerRepository
	tunnelManager *ssh.TunnelManager
	sshClients    map[string]*ssh.Client // Cache SSH clients
}

func NewServerUsecase(serverRepo domain.ServerRepository, tunnelManager *ssh.TunnelManager) domain.ServerUsecase {
	return &serverUsecase{
		serverRepo:    serverRepo,
		tunnelManager: tunnelManager,
		sshClients:    make(map[string]*ssh.Client),
	}
}

func (u *serverUsecase) CreateServer(ctx context.Context, server *domain.Server) error {
	if server.Name == "" {
		return errors.New("server name is required")
	}
	if server.IPAddress == "" {
		return errors.New("server IP address is required")
	}
	if server.CPUCores < 1 {
		return errors.New("CPU cores must be at least 1")
	}
	if server.MemoryGB < 0.1 {
		return errors.New("memory must be at least 0.1 GB")
	}
	if server.DiskGB < 1 {
		return errors.New("disk space must be at least 1 GB")
	}

	existing, err := u.serverRepo.GetByIPAddress(ctx, server.IPAddress)
	if err == nil && existing != nil {
		return fmt.Errorf("server with IP address %s already exists", server.IPAddress)
	}

	if server.Status == "" {
		server.Status = domain.ServerStatusOffline
	}

	return u.serverRepo.Create(ctx, server)
}

func (u *serverUsecase) GetServer(ctx context.Context, id string) (*domain.Server, error) {
	if id == "" {
		return nil, errors.New("server ID is required")
	}
	return u.serverRepo.GetByID(ctx, id)
}

func (u *serverUsecase) ListServers(ctx context.Context, filter domain.ServerFilter) ([]*domain.Server, int64, error) {
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	return u.serverRepo.List(ctx, filter)
}

func (u *serverUsecase) UpdateServer(ctx context.Context, server *domain.Server) error {
	if server.ID == "" {
		return errors.New("server ID is required")
	}

	existing, err := u.serverRepo.GetByID(ctx, server.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("server not found")
	}

	return u.serverRepo.Update(ctx, server)
}

func (u *serverUsecase) DeleteServer(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("server ID is required")
	}

	existing, err := u.serverRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("server not found")
	}

	return u.serverRepo.Delete(ctx, id)
}

func (u *serverUsecase) GetServerMetrics(ctx context.Context, serverID string) (*domain.ServerMetrics, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	// For now, return mock data
	metrics := &domain.ServerMetrics{
		ServerID:       serverID,
		CPUUsage:       0,
		MemoryUsage:    0,
		DiskUsage:      0,
		NetworkInMbps:  0,
		NetworkOutMbps: 0,
		Uptime:         0,
		LoadAverage:    []float64{0, 0, 0},
	}

	return metrics, nil
}

// HealthCheck performs a health check on a server
func (u *serverUsecase) HealthCheck(ctx context.Context, serverID string) (bool, error) {
	if serverID == "" {
		return false, errors.New("server ID is required")
	}

	// Verify server exists
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return false, err
	}
	if server == nil {
		return false, errors.New("server not found")
	}

	// Perform actual health check via SSH connection attempt
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
		Timeout:  5 * time.Second,
	})

	isHealthy := err == nil
	if isHealthy {
		sshClient.Close()
	}

	newStatus := domain.ServerStatusOffline
	if isHealthy {
		newStatus = domain.ServerStatusOnline
	}

	if err := u.serverRepo.UpdateStatus(ctx, serverID, newStatus); err != nil {
		return isHealthy, err
	}

	return isHealthy, nil
}
