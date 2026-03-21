package agentregistry

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	agent "einfra/api/internal/modules/agent/domain"
	"einfra/api/internal/shared/events"
)

type CommandRepository interface {
	Create(ctx context.Context, cmd *agent.Command) error
	UpdateStatus(ctx context.Context, id string, status agent.CommandStatus, exitCode *int) error
	AppendLog(ctx context.Context, log *agent.CommandLog) error
	FindByID(ctx context.Context, id string) (*agent.Command, error)
	ListByServer(ctx context.Context, serverID string, limit int) ([]*agent.Command, error)
	GetLogs(ctx context.Context, commandID string) ([]*agent.CommandLog, error)
}

// MetricsRecorder is a narrow interface so we can inject monitoring.Metrics without import cycle.
type MetricsRecorder interface {
	IncCommandDispatched(serverID string)
	IncCommandFailed(serverID, reason string)
	ObserveCommandDuration(serverID string, d time.Duration)
}

type EventPublisher interface {
	CommandDispatched(e events.CommandDispatchedEvent)
	CommandFailed(e events.CommandFailedEvent)
}

type ResultProjector interface {
	Project(ctx context.Context, commandID string) error
}

// Dispatcher sends commands to agents and manages their lifecycle.
type Dispatcher struct {
	hub       *Hub
	repo      CommandRepository
	metrics   MetricsRecorder
	publisher EventPublisher
	projector ResultProjector
}

// NewDispatcher creates a new command dispatcher.
// Pass nil for metrics to disable instrumentation (e.g. in tests).
func NewDispatcher(hub *Hub, repo CommandRepository, metrics MetricsRecorder) *Dispatcher {
	return &Dispatcher{hub: hub, repo: repo, metrics: metrics}
}

func (d *Dispatcher) WithPublisher(p EventPublisher) *Dispatcher {
	d.publisher = p
	return d
}

func (d *Dispatcher) WithProjector(projector ResultProjector) *Dispatcher {
	d.projector = projector
	return d
}

// Dispatch sends a command to the agent for the given server and records it in the DB.
// It returns the created Command (in RUNNING state) or an error if the agent is offline.
// idempotencyKey: optional caller-supplied key; if empty, a UUID is generated.
func (d *Dispatcher) Dispatch(ctx context.Context, serverID, userID, cmd string, timeoutSec int, idempotencyKey string) (*agent.Command, error) {
	return d.dispatch(ctx, serverID, userID, agent.CommandTypeShell, cmd, "", map[string]any{
		"type":       "EXEC_COMMAND",
		"message_id": "",
		"payload": map[string]any{
			"command_id":      "",
			"cmd":             cmd,
			"timeout_s":       timeoutSec,
			"idempotency_key": idempotencyKey,
		},
	}, timeoutSec, idempotencyKey)
}

func (d *Dispatcher) DispatchOperation(ctx context.Context, serverID, userID, operation string, params map[string]any, timeoutSec int, idempotencyKey string) (*agent.Command, error) {
	payloadJSON := ""
	payload := agent.ControlOperationPayload{
		Operation: operation,
		TimeoutS:  timeoutSec,
		Params:    params,
	}
	if len(params) > 0 || operation != "" {
		if b, err := json.Marshal(payload); err == nil {
			payloadJSON = string(b)
		}
	}
	return d.dispatch(ctx, serverID, userID, agent.CommandTypeControlOperation, operation, payloadJSON, map[string]any{
		"type":            "CONTROL_OPERATION",
		"message_id":      "",
		"idempotency_key": idempotencyKey,
		"payload": map[string]any{
			"command_id":      "",
			"operation":       operation,
			"params":          params,
			"timeout_s":       timeoutSec,
			"idempotency_key": idempotencyKey,
		},
	}, timeoutSec, idempotencyKey)
}

func (d *Dispatcher) dispatch(ctx context.Context, serverID, userID string, commandType agent.CommandType, cmd, payloadJSON string, message map[string]any, timeoutSec int, idempotencyKey string) (*agent.Command, error) {
	_, ok := d.hub.GetAgent(serverID)
	if !ok && !d.hub.IsGRPCOnline(serverID) {
		if d.metrics != nil {
			d.metrics.IncCommandFailed(serverID, "agent_offline")
		}
		if d.publisher != nil {
			d.publisher.CommandFailed(events.CommandFailedEvent{
				ServerID: serverID,
				Reason:   "agent_offline",
			})
		}
		return nil, fmt.Errorf("agent for server %q is not connected", serverID)
	}

	// Idempotency key — use caller's key or generate a fresh UUID
	ikey := idempotencyKey
	if ikey == "" {
		ikey = uuid.NewString()
	}

	command := &agent.Command{
		ID:             uuid.NewString(),
		ServerID:       serverID,
		UserID:         userID,
		IdempotencyKey: ikey,
		Type:           commandType,
		Cmd:            cmd,
		PayloadJSON:    payloadJSON,
		Status:         agent.StatusPending,
		TimeoutSec:     timeoutSec,
		CreatedAt:      time.Now(),
	}
	if err := d.repo.Create(ctx, command); err != nil {
		return nil, fmt.Errorf("persist command: %w", err)
	}

	message["message_id"] = command.ID
	if payload, ok := message["payload"].(map[string]any); ok {
		payload["command_id"] = command.ID
		payload["idempotency_key"] = ikey
	}
	message["idempotency_key"] = ikey

	if err := d.hub.SendToAgent(serverID, message); err != nil {
		_ = d.repo.UpdateStatus(ctx, command.ID, agent.StatusFailed, nil)
		if d.metrics != nil {
			d.metrics.IncCommandFailed(serverID, "send_error")
		}
		if d.publisher != nil {
			d.publisher.CommandFailed(events.CommandFailedEvent{
				ServerID:  serverID,
				CommandID: command.ID,
				Reason:    "send_error",
			})
		}
		return nil, fmt.Errorf("send command to agent: %w", err)
	}

	if d.metrics != nil {
		d.metrics.IncCommandDispatched(serverID)
	}
	if d.publisher != nil {
		d.publisher.CommandDispatched(events.CommandDispatchedEvent{
			ServerID:       serverID,
			CommandID:      command.ID,
			UserID:         userID,
			Cmd:            cmd,
			IdempotencyKey: ikey,
		})
	}

	log.Info().
		Str("command_id", command.ID).
		Str("server_id", serverID).
		Str("idempotency_key", ikey).
		Str("cmd", cmd).
		Msg("[dispatcher] command dispatched")

	now := time.Now()
	command.Status = agent.StatusRunning
	command.StartedAt = &now
	_ = d.repo.UpdateStatus(ctx, command.ID, agent.StatusRunning, nil)

	return command, nil
}

// Cancel sends a cancel signal to the agent for a running command.
func (d *Dispatcher) Cancel(ctx context.Context, serverID, commandID string) error {
	ag, ok := d.hub.GetAgent(serverID)
	if !ok {
		return fmt.Errorf("agent for server %q is not connected", serverID)
	}
	return ag.Send(map[string]any{
		"type":       "CANCEL_COMMAND",
		"message_id": uuid.NewString(),
		"payload": map[string]any{
			"command_id": commandID,
		},
	})
}

// HandleAgentMessage processes an inbound message from an agent and:
//  1. Persists log chunks / status updates to DB
//  2. Broadcasts the message to any subscribed frontend clients
func (d *Dispatcher) HandleAgentMessage(serverID string, msg agent.AgentMessage) {
	ctx := context.Background()

	switch msg.Type {
	case "COMMAND_OUTPUT":
		if payload, ok := msg.Payload.(map[string]any); ok {
			commandID, _ := payload["command_id"].(string)
			chunk, _ := payload["chunk"].(string)
			seq, _ := payload["seq"].(float64)

			_ = d.repo.AppendLog(ctx, &agent.CommandLog{
				CommandID: commandID,
				Seq:       int(seq),
				Chunk:     chunk,
				Ts:        time.Now(),
			})
		}

	case "COMMAND_DONE":
		if payload, ok := msg.Payload.(map[string]any); ok {
			commandID, _ := payload["command_id"].(string)
			exitCode := 0
			if ec, ok := payload["exit_code"].(float64); ok {
				exitCode = int(ec)
			}
			_ = d.repo.UpdateStatus(ctx, commandID, agent.StatusSuccess, &exitCode)
			d.projectResult(ctx, commandID)
		}

	case "COMMAND_ERROR":
		if payload, ok := msg.Payload.(map[string]any); ok {
			commandID, _ := payload["command_id"].(string)
			exitCode := 1
			if ec, ok := payload["exit_code"].(float64); ok {
				exitCode = int(ec)
			}
			_ = d.repo.UpdateStatus(ctx, commandID, agent.StatusFailed, &exitCode)
			d.projectResult(ctx, commandID)
		}
	}

	// Always broadcast to watching frontend clients
	d.hub.BroadcastToClients(serverID, msg)
}

func (d *Dispatcher) projectResult(ctx context.Context, commandID string) {
	if d.projector == nil || commandID == "" {
		return
	}
	if err := d.projector.Project(ctx, commandID); err != nil {
		log.Warn().
			Str("command_id", commandID).
			Err(err).
			Msg("[dispatcher] project command result")
	}
}

// ── MetricsRecorder no-op helpers (used when metrics is nil) ─────────────────

// NopMetrics is a no-op implementation of MetricsRecorder (used in tests).
type NopMetrics struct{}

func (NopMetrics) IncCommandDispatched(string)                  {}
func (NopMetrics) IncCommandFailed(string, string)              {}
func (NopMetrics) ObserveCommandDuration(string, time.Duration) {}
