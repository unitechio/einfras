// Package agenthandler handles WebSocket connections from the React frontend.
package agenthandler

import (
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	agentregistry "einfra/api/internal/modules/agent/application"
)

// ClientWSHandler handles WebSocket connections from the frontend.
type ClientWSHandler struct {
	hub *agentregistry.Hub
}

// NewClientWSHandler creates a new handler.
func NewClientWSHandler(hub *agentregistry.Hub) *ClientWSHandler {
	return &ClientWSHandler{hub: hub}
}

// HandleClientWS is the HTTP handler for: GET /ws/client/{server_id}
// The frontend connects per-server to receive live updates.
func (h *ClientWSHandler) HandleClientWS(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["server_id"]
	if serverID == "" {
		http.Error(w, "server_id required", http.StatusBadRequest)
		return
	}

	// TODO: validate user JWT from token query param or header
	// token := r.URL.Query().Get("token")

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[client-ws] upgrade failed for server=%s: %v", serverID, err)
		return
	}

	sessionID := uuid.NewString()
	cc := h.hub.RegisterClient(sessionID, serverID, conn)
	log.Printf("[client-ws] frontend client connected: session=%s server=%s", sessionID, serverID)

	defer func() {
		conn.Close()
		h.hub.UnregisterClient(sessionID, serverID)
		log.Printf("[client-ws] frontend client disconnected: session=%s", sessionID)
	}()

	// Immediately tell the client whether the agent is online
	_ = cc.Send(map[string]any{
		"type":      "AGENT_STATUS",
		"server_id": serverID,
		"online":    h.hub.IsOnline(serverID),
	})

	// Keep connection alive — read loop (clients mostly just listen)
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
}
