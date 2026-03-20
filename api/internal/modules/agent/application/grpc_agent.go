// Package agentregistry — grpc_agent.go
// GRPCAgentConn wraps an agent's bidirectional gRPC stream with:
//   - Thread-safe command sending
//   - Backpressure awareness
//   - Buffered send channel (prevents blocking the hub)
package agentregistry

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
 
	"github.com/rs/zerolog/log"
	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
)

const (
	grpcSendBufSize = 64 // commands queued per agent
	sendTimeout     = 5 * time.Second
)

// GRPCAgentConn wraps the server-side gRPC stream for one connected agent.
type GRPCAgentConn struct {
	ServerID string

	stream  agentpb.AgentService_ConnectStreamServer
	sendCh  chan *agentpb.ControlMessage
	closeCh chan struct{}
	once    sync.Once

	// backpressure: set true when agent requests a pause
	paused     atomic.Bool
	pauseUntil atomic.Int64 // unix nanos
}

// NewGRPCAgentConn creates a new gRPC agent connection wrapper and starts the send loop.
func NewGRPCAgentConn(serverID string, stream agentpb.AgentService_ConnectStreamServer) *GRPCAgentConn {
	c := &GRPCAgentConn{
		ServerID: serverID,
		stream:   stream,
		sendCh:   make(chan *agentpb.ControlMessage, grpcSendBufSize),
		closeCh:  make(chan struct{}),
	}
	go c.sendLoop()
	return c
}

// Send enqueues a command for delivery to the agent.
// Returns an error if the agent is paused (backpressure) or the buffer is full.
func (c *GRPCAgentConn) Send(msg any) error {
	// Check backpressure
	if c.paused.Load() {
		until := time.Unix(0, c.pauseUntil.Load())
		if time.Now().Before(until) {
			return fmt.Errorf("agent %q is under backpressure until %s", c.ServerID, until.Format(time.RFC3339))
		}
		c.paused.Store(false) // pause window expired
	}

	// Build ControlMessage from the passed msg (supports map[string]any or *agentpb.ControlMessage)
	var cmd *agentpb.ControlMessage
	switch v := msg.(type) {
	case *agentpb.ControlMessage:
		cmd = v
	case map[string]any:
		cmd = mapToControlMessage(v)
	default:
		// JSON round-trip fallback
		b, err := json.Marshal(msg)
		if err != nil {
			return fmt.Errorf("marshal command: %w", err)
		}
		cmd = &agentpb.ControlMessage{}
		if err := json.Unmarshal(b, cmd); err != nil {
			return fmt.Errorf("unmarshal command: %w", err)
		}
	}

	select {
	case c.sendCh <- cmd:
		return nil
	case <-time.After(sendTimeout):
		return fmt.Errorf("agent %q send timeout — backpressure applied", c.ServerID)
	default:
		return fmt.Errorf("agent %q send buffer full — backpressure applied", c.ServerID)
	}
}

// ApplyBackpressure pauses the agent's command intake for the given duration.
func (c *GRPCAgentConn) ApplyBackpressure(d time.Duration) {
	c.paused.Store(true)
	c.pauseUntil.Store(time.Now().Add(d).UnixNano())
	log.Warn().
		Str("server_id", c.ServerID).
		Dur("pause", d).
		Msg("[grpc-agent] backpressure applied")
}

// Close signals the send loop to exit.
func (c *GRPCAgentConn) Close() {
	c.once.Do(func() { close(c.closeCh) })
}

// sendLoop drains the send channel and writes to the gRPC stream.
func (c *GRPCAgentConn) sendLoop() {
	for {
		select {
		case <-c.closeCh:
			return
		case cmd, ok := <-c.sendCh:
			if !ok {
				return
			}
			if err := c.stream.Send(cmd); err != nil {
				log.Error().
					Str("server_id", c.ServerID).
					Err(err).
					Msg("[grpc-agent] send error — dropping command")
			}
		}
	}
}

// mapToControlMessage converts a generic map (dispatcher legacy format) to ControlMessage.
func mapToControlMessage(m map[string]any) *agentpb.ControlMessage {
	cmd := &agentpb.ControlMessage{}

	if id, ok := m["message_id"].(string); ok {
		cmd.MessageId = id
	}
	if ikey, ok := m["idempotency_key"].(string); ok {
		cmd.IdempotencyKey = ikey
	}

	msgType, _ := m["type"].(string)
	payload, _ := m["payload"].(map[string]any)

	switch msgType {
	case "EXEC_COMMAND":
		exec := &agentpb.ExecuteTask{}
		if c, ok := payload["cmd"].(string); ok {
			exec.Cmd = c
		}
		if t, ok := payload["timeout_s"].(int); ok {
			exec.TimeoutS = int32(t)
		}
		if t, ok := payload["timeout_s"].(float64); ok {
			exec.TimeoutS = int32(t)
		}
		if tID, ok := payload["task_id"].(string); ok {
			exec.TaskId = tID
		} else {
			exec.TaskId = cmd.MessageId
		}
		cmd.Payload = &agentpb.ControlMessage_ExecuteTask{ExecuteTask: exec}

	case "CANCEL_COMMAND":
		if tid, ok := payload["target_command_id"].(string); ok {
			cmd.Payload = &agentpb.ControlMessage_CancelExecution{
				CancelExecution: &agentpb.CancelExecution{TargetTaskId: tid},
			}
		}

	case "SERVICE_ACTION":
		sa := &agentpb.ServiceAction{}
		if svc, ok := payload["service_name"].(string); ok {
			sa.ServiceName = svc
		}
		if act, ok := payload["action"].(string); ok {
			sa.Action = act
		}
		cmd.Payload = &agentpb.ControlMessage_ServiceAction{ServiceAction: sa}

	case "LIST_SERVICES":
		ls := &agentpb.ListServices{}
		if fp, ok := payload["filter"].(string); ok {
			ls.FilterPattern = fp
		}
		cmd.Payload = &agentpb.ControlMessage_ListServices{ListServices: ls}
	}
	return cmd
}

// ─── Hub gRPC extension ──────────────────────────────────────────────────────

// RegisterGRPCAgent adds a gRPC agent connection to the hub.
func (h *Hub) RegisterGRPCAgent(serverID string, stream agentpb.AgentService_ConnectStreamServer) *GRPCAgentConn {
	conn := NewGRPCAgentConn(serverID, stream)

	h.agentMu.Lock()
	// Close old WS connection if it exists
	if old, ok := h.agents[serverID]; ok {
		_ = old // WS conn — just evict
	}
	h.grpcAgents[serverID] = conn
	h.agentMu.Unlock()

	log.Info().Str("server_id", serverID).Msg("[grpc-hub] gRPC agent registered")
	return conn
}

// UnregisterGRPCAgent removes the gRPC agent for a server.
func (h *Hub) UnregisterGRPCAgent(serverID string) {
	h.agentMu.Lock()
	if conn, ok := h.grpcAgents[serverID]; ok {
		conn.Close()
		delete(h.grpcAgents, serverID)
	}
	h.agentMu.Unlock()
	log.Info().Str("server_id", serverID).Msg("[grpc-hub] gRPC agent unregistered")
}

// GetGRPCAgent returns the gRPC connection for a server, if connected via gRPC.
func (h *Hub) GetGRPCAgent(serverID string) (*GRPCAgentConn, bool) {
	h.agentMu.RLock()
	defer h.agentMu.RUnlock()
	c, ok := h.grpcAgents[serverID]
	return c, ok
}

// IsGRPCOnline returns true if the server has an active gRPC agent connection.
func (h *Hub) IsGRPCOnline(serverID string) bool {
	_, ok := h.GetGRPCAgent(serverID)
	return ok
}

// SendToAgent sends a command to an agent, preferring gRPC over WebSocket.
// This is the unified send method that dispatcher should use.
func (h *Hub) SendToAgent(serverID string, msg any) error {
	// 1. Prefer gRPC
	if grpcConn, ok := h.GetGRPCAgent(serverID); ok {
		return grpcConn.Send(msg)
	}
	// 2. Fallback to WebSocket (legacy)
	if wsConn, ok := h.GetAgent(serverID); ok {
		return wsConn.Send(msg)
	}
	return fmt.Errorf("agent %q is not connected (neither gRPC nor WebSocket)", serverID)
}

// IsAnyTransportOnline returns true if the server has any active connection.
func (h *Hub) IsAnyTransportOnline(serverID string) bool {
	return h.IsGRPCOnline(serverID) || h.IsOnline(serverID)
}
