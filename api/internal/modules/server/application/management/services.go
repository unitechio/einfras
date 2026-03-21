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

type ServiceManager struct {
	servers    domain.ServerRepository
	services   domain.ServerServiceRepository
	dispatcher AgentCommandDispatcher
}

func NewServiceManager(servers domain.ServerRepository, services domain.ServerServiceRepository, dispatcher AgentCommandDispatcher) *ServiceManager {
	return &ServiceManager{servers: servers, services: services, dispatcher: dispatcher}
}

func (m *ServiceManager) List(ctx context.Context, serverID string) ([]*domain.ServerService, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	items, _, err := m.services.List(ctx, domain.ServiceFilter{ServerID: serverID, Page: 1, PageSize: 500})
	return items, err
}

func (m *ServiceManager) GetByName(ctx context.Context, serverID, name string) (*domain.ServerService, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.services.GetByServerAndName(ctx, serverID, name)
}

func (m *ServiceManager) Refresh(ctx context.Context, serverID, userID string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	cmd := "systemctl list-units --type=service --all --no-pager --no-legend"
	return m.dispatcher.Dispatch(ctx, serverID, userID, cmd, 60, "service-refresh:"+serverID)
}

func (m *ServiceManager) Action(ctx context.Context, serverID, userID, serviceName string, action domain.ServiceAction, timeoutSec int) (*agent.Command, error) {
	if !serviceNamePattern.MatchString(serviceName) {
		return nil, errors.New("service_name contains unsupported characters")
	}
	commandAction, err := normalizeServiceAction(action)
	if err != nil {
		return nil, err
	}
	svc, err := m.ensureServiceRecord(ctx, serverID, serviceName)
	if err != nil {
		return nil, err
	}
	cmd := fmt.Sprintf("sudo systemctl %s %s", commandAction, serviceName)
	command, err := m.dispatcher.Dispatch(ctx, serverID, userID, cmd, defaultTimeout(timeoutSec, 90), fmt.Sprintf("service-action:%s:%s:%s", serverID, serviceName, commandAction))
	if err != nil {
		return nil, err
	}
	svc.LastCheckedAt = time.Now().UTC()
	switch action {
	case domain.ServiceActionStart, domain.ServiceActionRestart:
		svc.Status = domain.ServiceStatusRunning
	case domain.ServiceActionStop:
		svc.Status = domain.ServiceStatusStopped
	case domain.ServiceActionEnable:
		svc.Enabled = true
	case domain.ServiceActionDisable:
		svc.Enabled = false
	}
	_ = m.services.Update(ctx, svc)
	return command, nil
}

func (m *ServiceManager) Logs(ctx context.Context, serverID, userID, serviceName string, lines int) (*agent.Command, error) {
	if !serviceNamePattern.MatchString(serviceName) {
		return nil, errors.New("service_name contains unsupported characters")
	}
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	if lines <= 0 {
		lines = 200
	}
	cmd := fmt.Sprintf("journalctl -u %s -n %d --no-pager", serviceName, lines)
	return m.dispatcher.Dispatch(ctx, serverID, userID, cmd, 60, fmt.Sprintf("service-logs:%s:%s:%d", serverID, serviceName, lines))
}

func (m *ServiceManager) ensureServiceRecord(ctx context.Context, serverID, serviceName string) (*domain.ServerService, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	svc, err := m.services.GetByServerAndName(ctx, serverID, serviceName)
	if err == nil {
		return svc, nil
	}
	now := time.Now().UTC()
	svc = &domain.ServerService{
		ID:            uuid.NewString(),
		ServerID:      serverID,
		Name:          serviceName,
		DisplayName:   serviceName,
		Description:   strings.TrimSpace(serviceName),
		Status:        domain.ServiceStatusUnknown,
		LastCheckedAt: now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := m.services.Create(ctx, svc); err != nil {
		return nil, err
	}
	return svc, nil
}
