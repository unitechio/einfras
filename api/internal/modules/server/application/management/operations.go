package managementapp

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

var serviceNamePattern = regexp.MustCompile(`^[a-zA-Z0-9_.@-]+$`)

type AgentCommandDispatcher interface {
	Dispatch(ctx context.Context, serverID, userID, cmd string, timeoutSec int, idempotencyKey string) (*agent.Command, error)
	DispatchOperation(ctx context.Context, serverID, userID string, payload agent.ControlOperationPayload, idempotencyKey string) (*agent.Command, error)
}

type RemoteOperations struct {
	servers    domain.ServerRepository
	dispatcher AgentCommandDispatcher
}

func NewRemoteOperations(servers domain.ServerRepository, dispatcher AgentCommandDispatcher) *RemoteOperations {
	return &RemoteOperations{
		servers:    servers,
		dispatcher: dispatcher,
	}
}

func (r *RemoteOperations) QueueServiceDiscovery(ctx context.Context, serverID, userID string) (*agent.Command, error) {
	if _, err := r.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}

	const cmd = "systemctl list-units --type=service --all --no-pager --no-legend"
	return r.dispatcher.Dispatch(ctx, serverID, userID, cmd, 60, "service-discovery:"+serverID)
}

func (r *RemoteOperations) QueueServiceAction(ctx context.Context, serverID, userID, serviceName string, action domain.ServiceAction, timeoutSec int) (*agent.Command, error) {
	if _, err := r.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	if !serviceNamePattern.MatchString(serviceName) {
		return nil, errors.New("service_name contains unsupported characters")
	}

	commandAction, err := normalizeServiceAction(action)
	if err != nil {
		return nil, err
	}
	if timeoutSec <= 0 {
		timeoutSec = 90
	}

	cmd := fmt.Sprintf("systemctl %s %s", commandAction, serviceName)
	idempotencyKey := fmt.Sprintf("service-action:%s:%s:%s", serverID, serviceName, commandAction)
	return r.dispatcher.Dispatch(ctx, serverID, userID, cmd, timeoutSec, idempotencyKey)
}

func normalizeServiceAction(action domain.ServiceAction) (string, error) {
	switch strings.ToLower(string(action)) {
	case "start":
		return "start", nil
	case "stop":
		return "stop", nil
	case "restart":
		return "restart", nil
	case "reload":
		return "reload", nil
	case "enable":
		return "enable", nil
	case "disable":
		return "disable", nil
	default:
		return "", fmt.Errorf("unsupported service action %q", action)
	}
}

func defaultTimeout(value, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}
