// Package agenthandler — server_status_handler.go
// REST handler for GET /v1/servers/{id}/status — returns the live agent connection state.
package agenthandler

import (
	"net/http"

	"github.com/gorilla/mux"

	"einfra/api/internal/modules/agent/domain"
	agentregistry "einfra/api/internal/modules/agent/application"
)

// AgentStatusHandler returns the live connection state of a server's agent.
type AgentStatusHandler struct {
	hub       *agentregistry.Hub
	agentRepo AgentInfoReader
}

// AgentInfoReader is the minimal read interface for agent status queries.
// Implemented by agentrepo.agentInfoRepo.
type AgentInfoReader interface {
	GetByServerID(serverID string) (*agent.AgentInfo, error)
}

// NewAgentStatusHandler creates a new status handler.
func NewAgentStatusHandler(hub *agentregistry.Hub, agentRepo AgentInfoReader) *AgentStatusHandler {
	return &AgentStatusHandler{hub: hub, agentRepo: agentRepo}
}

// GetAgentStatus handles: GET /v1/servers/{id}/status
// Returns the live (real-time) online state from the hub, plus last-known DB info.
func (h *AgentStatusHandler) GetAgentStatus(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	if serverID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "server id required"})
		return
	}

	// Live connectivity takes priority over DB state
	liveOnline := h.hub.IsOnline(serverID)

	// Try to read last known info from DB
	info, err := h.agentRepo.GetByServerID(serverID)
	if err != nil {
		// Agent has never connected — return minimal response
		writeJSON(w, http.StatusOK, map[string]any{
			"server_id": serverID,
			"online":    liveOnline,
		})
		return
	}

	// Override online flag with live state
	info.Online = liveOnline
	writeJSON(w, http.StatusOK, info)
}

// ListOnlineServers handles: GET /v1/agents/online
// Returns the list of server IDs that have active agent connections.
func (h *AgentStatusHandler) ListOnlineServers(w http.ResponseWriter, r *http.Request) {
	ids := h.hub.OnlineServerIDs()
	writeJSON(w, http.StatusOK, map[string]any{
		"online_server_ids": ids,
		"count":             len(ids),
	})
}
