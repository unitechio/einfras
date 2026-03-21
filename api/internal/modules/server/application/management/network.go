package managementapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type NetworkManager struct {
	servers    domain.ServerRepository
	networks   domain.ServerNetworkRepository
	dispatcher AgentCommandDispatcher
}

func NewNetworkManager(servers domain.ServerRepository, networks domain.ServerNetworkRepository, dispatcher AgentCommandDispatcher) *NetworkManager {
	return &NetworkManager{servers: servers, networks: networks, dispatcher: dispatcher}
}

func (m *NetworkManager) ListInterfaces(ctx context.Context, serverID string) ([]*domain.NetworkInterface, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.networks.GetInterfacesByServerID(ctx, serverID)
}

func (m *NetworkManager) RefreshInterfaces(ctx context.Context, serverID, userID string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	cmd := "ip -j address show"
	return m.dispatcher.Dispatch(ctx, serverID, userID, cmd, 60, "network-refresh:"+serverID)
}

func (m *NetworkManager) CheckConnectivity(ctx context.Context, serverID, userID, targetHost string, targetPort int, protocol string) (*domain.NetworkConnectivityCheck, *agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, nil, err
	}
	targetHost = strings.TrimSpace(targetHost)
	if targetHost == "" {
		return nil, nil, errors.New("target_host is required")
	}
	if protocol == "" {
		protocol = "icmp"
	}
	now := time.Now().UTC()
	check := &domain.NetworkConnectivityCheck{
		ID:           uuid.NewString(),
		ServerID:     serverID,
		TargetHost:   targetHost,
		TargetPort:   targetPort,
		Protocol:     protocol,
		Success:      false,
		ErrorMessage: "queued",
		TestedAt:     now,
		CreatedAt:    now,
	}
	if err := m.networks.CreateConnectivityCheck(ctx, check); err != nil {
		return nil, nil, err
	}
	cmdText := fmt.Sprintf("ping -c 3 %s", targetHost)
	if targetPort > 0 {
		cmdText = fmt.Sprintf("nc -zvw 5 %s %d", targetHost, targetPort)
	}
	command, err := m.dispatcher.Dispatch(ctx, serverID, userID, cmdText, 30, "network-check:"+check.ID)
	if err != nil {
		check.TestedAt = time.Now().UTC()
		check.ErrorMessage = err.Error()
		_ = m.networks.UpdateConnectivityCheck(ctx, check)
		return nil, nil, err
	}
	return check, command, err
}

func (m *NetworkManager) History(ctx context.Context, serverID string, limit int) ([]*domain.NetworkConnectivityCheck, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.networks.GetConnectivityHistory(ctx, serverID, limit)
}
