// Package agenthandler handles WebSocket connections from EINFRA agent binaries.
package agenthandler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	agentregistry "einfra/api/internal/modules/agent/application"
	"einfra/api/internal/modules/agent/domain"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true }, // TODO: tighten in prod
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

// AgentRepository is the persistence interface for agent information.
type AgentRepository interface {
	Upsert(serverID string, info *agent.AgentInfo) error
	SetOnline(serverID string, online bool) error
}

// AgentTokenValidator validates Bearer tokens presented by agent binaries.
type AgentTokenValidator interface {
	ValidateFromHeader(ctx context.Context, serverID, authHeader string) error
}

type HeartbeatObserver interface {
	RecordHeartbeat(serverID string, payload map[string]any) error
}

// AgentWSHandler handles the WebSocket lifecycle for a connecting agent.
type AgentWSHandler struct {
	hub        *agentregistry.Hub
	dispatcher *agentregistry.Dispatcher
	agentRepo  AgentRepository
	tokenSvc   AgentTokenValidator // nil = auth disabled (dev mode only)
	observer   HeartbeatObserver
}

// NewAgentWSHandler creates a new handler.
// Pass a non-nil tokenSvc to enforce agent token authentication.
func NewAgentWSHandler(
	hub *agentregistry.Hub,
	dispatcher *agentregistry.Dispatcher,
	agentRepo AgentRepository,
	tokenSvc AgentTokenValidator,
	observer HeartbeatObserver,
) *AgentWSHandler {
	return &AgentWSHandler{
		hub:        hub,
		dispatcher: dispatcher,
		agentRepo:  agentRepo,
		tokenSvc:   tokenSvc,
		observer:   observer,
	}
}

// HandleAgentWS is the HTTP handler for: GET /ws/agent/{server_id}
// The agent binary connects here on startup and maintains a persistent WS connection.
func (h *AgentWSHandler) HandleAgentWS(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["server_id"]
	if serverID == "" {
		writeError(w, http.StatusBadRequest, "agent_ws", "agent_ws.connect", "validation_failed", "server_id required", nil)
		return
	}

	// ── Agent token auth ────────────────────────────────────────────────────
	// Agents must present: Authorization: Bearer <token>
	if h.tokenSvc != nil {
		if err := h.tokenSvc.ValidateFromHeader(r.Context(), serverID, r.Header.Get("Authorization")); err != nil {
			log.Warn().
				Str("server_id", serverID).
				Str("remote", r.RemoteAddr).
				Err(err).
				Msg("[agent-ws] unauthorized connection attempt")
			writeError(w, http.StatusUnauthorized, "agent_ws", "agent_ws.connect", "unauthorized", "unauthorized", map[string]any{"server_id": serverID})
			return
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[agent-ws] upgrade failed for %s: %v", serverID, err)
		return
	}

	ac := h.hub.RegisterAgent(serverID, conn)
	_ = h.agentRepo.SetOnline(serverID, true)
	log.Info().
		Str("server_id", serverID).
		Str("remote", r.RemoteAddr).
		Msg("[agent-ws] agent connected")

	// Notify clients that this server came online
	h.hub.BroadcastToClients(serverID, map[string]any{
		"type":      "AGENT_ONLINE",
		"server_id": serverID,
		"ts":        time.Now().UnixMilli(),
	})

	defer func() {
		conn.Close()
		h.hub.UnregisterAgent(serverID)
		_ = h.agentRepo.SetOnline(serverID, false)
		log.Info().
			Str("server_id", serverID).
			Msg("[agent-ws] agent disconnected")
		h.hub.BroadcastToClients(serverID, map[string]any{
			"type":      "AGENT_OFFLINE",
			"server_id": serverID,
			"ts":        time.Now().UnixMilli(),
		})
	}()

	// Start ping/pong keepalive
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()
	go func() {
		for range pingTicker.C {
			// Use Send() which is goroutine-safe (it also writes JSON, which is fine for a ping)
			if err := ac.Send(map[string]any{"type": "PING", "ts": time.Now().UnixMilli()}); err != nil {
				return
			}
		}
	}()

	// Read loop — process messages from agent
	for {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg agent.AgentMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Warn().
				Str("server_id", serverID).
				Err(err).
				Msg("[agent-ws] bad message")
			continue
		}
		msg.ServerID = serverID

		switch msg.Type {
		case "HEARTBEAT":
			h.handleHeartbeat(serverID, msg)
		default:
			h.dispatcher.HandleAgentMessage(serverID, msg)
		}
	}
}

func (h *AgentWSHandler) handleHeartbeat(serverID string, msg agent.AgentMessage) {
	payload, ok := msg.Payload.(map[string]any)
	if !ok {
		return
	}

	info := &agent.AgentInfo{
		ServerID:  serverID,
		Online:    true,
		LastSeen:  time.Now(),
		UpdatedAt: time.Now(),
	}

	if v, ok := payload["cpu_percent"].(float64); ok {
		info.CPUPercent = v
	}
	if v, ok := payload["mem_percent"].(float64); ok {
		info.MemPercent = v
	}
	if v, ok := payload["disk_percent"].(float64); ok {
		info.DiskPercent = v
	}
	if v, ok := payload["os"].(string); ok {
		info.OS = v
	}
	if v, ok := payload["has_docker"].(bool); ok {
		info.HasDocker = v
	}
	if v, ok := payload["has_k8s"].(bool); ok {
		info.HasK8s = v
	}
	if v, ok := payload["agent_version"].(string); ok {
		info.Version = v
	}

	_ = h.agentRepo.Upsert(serverID, info)
	if h.observer != nil {
		_ = h.observer.RecordHeartbeat(serverID, payload)
	}

	// Broadcast metrics to frontend clients
	h.hub.BroadcastToClients(serverID, map[string]any{
		"type":      "METRICS_UPDATE",
		"server_id": serverID,
		"payload":   payload,
		"ts":        time.Now().UnixMilli(),
	})
}
