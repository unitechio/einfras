// Package agentregistry manages the in-memory registry of connected agent connections.
// Supports two transports:
//   - WebSocket (Phase 1 — current)
//   - gRPC bidirectional streaming (Phase 2 — see grpc_agent.go)
package agentregistry

import (
	"sync"

	"github.com/gorilla/websocket"
)

// ── WebSocket Agent Connection ────────────────────────────────────────────────

// AgentConn wraps a WebSocket connection from an agent with thread-safe send support.
type AgentConn struct {
	ServerID string
	Conn     *websocket.Conn
	mu       sync.Mutex
}

// Send writes a JSON message to the agent safely.
func (a *AgentConn) Send(msg any) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.Conn.WriteJSON(msg)
}

// ── Frontend WebSocket Connection ─────────────────────────────────────────────

// ClientConn wraps a frontend WebSocket connection.
type ClientConn struct {
	SessionID string
	ServerID  string // which server this client is watching
	Conn      *websocket.Conn
	mu        sync.Mutex
}

// Send writes a JSON message to the client safely.
func (c *ClientConn) Send(msg any) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Conn.WriteJSON(msg)
}

// ── Hub ───────────────────────────────────────────────────────────────────────

// Hub manages all active agent and client connections.
// GRPCAgentConn and gRPC methods are defined in grpc_agent.go
type Hub struct {
	agentMu    sync.RWMutex
	agents     map[string]*AgentConn     // serverID → WS connection
	grpcAgents map[string]*GRPCAgentConn // serverID → gRPC connection (Phase 2)

	clientMu sync.RWMutex
	clients  map[string][]*ClientConn // serverID → list of watching clients
}

var globalHub = &Hub{
	agents:     make(map[string]*AgentConn),
	grpcAgents: make(map[string]*GRPCAgentConn),
	clients:    make(map[string][]*ClientConn),
}

// GetHub returns the singleton Hub instance.
func GetHub() *Hub {
	return globalHub
}

// ── WS Agent Registration ──────────────────────────────────────────────────

// RegisterAgent registers a new WebSocket agent connection for a server.
func (h *Hub) RegisterAgent(serverID string, conn *websocket.Conn) *AgentConn {
	ac := &AgentConn{ServerID: serverID, Conn: conn}
	h.agentMu.Lock()
	h.agents[serverID] = ac
	h.agentMu.Unlock()
	return ac
}

// UnregisterAgent removes a WebSocket agent connection (called on disconnect).
func (h *Hub) UnregisterAgent(serverID string) {
	h.agentMu.Lock()
	delete(h.agents, serverID)
	h.agentMu.Unlock()
}

// GetAgent returns the active WebSocket connection for a server, if any.
func (h *Hub) GetAgent(serverID string) (*AgentConn, bool) {
	h.agentMu.RLock()
	defer h.agentMu.RUnlock()
	a, ok := h.agents[serverID]
	return a, ok
}

// IsOnline returns true if a WebSocket agent is currently connected.
func (h *Hub) IsOnline(serverID string) bool {
	_, ok := h.GetAgent(serverID)
	return ok
}

// OnlineServerIDs returns all server IDs with active agent connections (any transport).
func (h *Hub) OnlineServerIDs() []string {
	h.agentMu.RLock()
	defer h.agentMu.RUnlock()
	seen := make(map[string]struct{})
	for id := range h.agents {
		seen[id] = struct{}{}
	}
	for id := range h.grpcAgents {
		seen[id] = struct{}{}
	}
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	return ids
}

// ── Client Registration ────────────────────────────────────────────────────

// RegisterClient registers a frontend WebSocket watching a specific server.
func (h *Hub) RegisterClient(sessionID, serverID string, conn *websocket.Conn) *ClientConn {
	cc := &ClientConn{SessionID: sessionID, ServerID: serverID, Conn: conn}
	h.clientMu.Lock()
	h.clients[serverID] = append(h.clients[serverID], cc)
	h.clientMu.Unlock()
	return cc
}

// UnregisterClient removes a frontend WebSocket connection.
func (h *Hub) UnregisterClient(sessionID, serverID string) {
	h.clientMu.Lock()
	defer h.clientMu.Unlock()
	list := h.clients[serverID]
	filtered := list[:0]
	for _, c := range list {
		if c.SessionID != sessionID {
			filtered = append(filtered, c)
		}
	}
	h.clients[serverID] = filtered
}

// BroadcastToClients sends a message to all frontend clients watching a server.
func (h *Hub) BroadcastToClients(serverID string, msg any) {
	h.clientMu.RLock()
	conns := make([]*ClientConn, len(h.clients[serverID]))
	copy(conns, h.clients[serverID])
	h.clientMu.RUnlock()

	for _, c := range conns {
		_ = c.Send(msg)
	}
}
