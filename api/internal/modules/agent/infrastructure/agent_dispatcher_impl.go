package infrastructure

import (
	"context"
	"encoding/json"

	agentregistry "einfra/api/internal/modules/agent/application"
	serverdomain "einfra/api/internal/modules/server/domain"
)

type AgentDispatcherImpl struct {
	hub *agentregistry.Hub
}

func (d *AgentDispatcherImpl) IsAgentOnline(ctx context.Context, serverID string) bool {
	return d.hub.IsAnyTransportOnline(serverID)
}

func NewAgentDispatcherImpl(hub *agentregistry.Hub) *AgentDispatcherImpl {
	return &AgentDispatcherImpl{hub: hub}
}

func (d *AgentDispatcherImpl) DispatchTask(ctx context.Context, task *serverdomain.AgentTask) error {
	// Convert serverdomain.AgentTask to the Hub's SendToAgent format.
	var payload any
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		// If it's not JSON, send it as is if it's a command.
		payload = map[string]any{"cmd": task.Payload}
	}

	return d.hub.SendToAgent(task.ServerID.String(), map[string]any{
		"type":       string(task.Type),
		"message_id": task.ID.String(),
		"payload":    payload,
	})
}
