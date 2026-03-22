// Package agenthandler — server_status_handler.go
// REST handler for GET /v1/servers/{id}/status — returns the live agent connection state.
package agenthandler

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	agentregistry "einfra/api/internal/modules/agent/application"
	"einfra/api/internal/modules/agent/domain"
	"einfra/api/internal/platform/loggingx"
)

// AgentStatusHandler returns the live connection state of a server's agent.
type AgentStatusHandler struct {
	hub       *agentregistry.Hub
	agentRepo AgentInfoReader
	tracker   *loggingx.StateTracker
}

// AgentInfoReader is the minimal read interface for agent status queries.
// Implemented by agentrepo.agentInfoRepo.
type AgentInfoReader interface {
	GetByServerID(serverID string) (*agent.AgentInfo, error)
}

// NewAgentStatusHandler creates a new status handler.
func NewAgentStatusHandler(hub *agentregistry.Hub, agentRepo AgentInfoReader) *AgentStatusHandler {
	return &AgentStatusHandler{hub: hub, agentRepo: agentRepo, tracker: loggingx.NewStateTracker()}
}

// GetAgentStatus handles: GET /v1/servers/{id}/status
// Returns the live (real-time) online state from the hub, plus last-known DB info.
func (h *AgentStatusHandler) GetAgentStatus(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	if serverID == "" {
		writeError(w, http.StatusBadRequest, "agent_status", "agent_status.get", "validation_failed", "server id required", nil)
		return
	}

	// Live connectivity takes priority over DB state
	liveOnline := h.hub.IsAnyTransportOnline(serverID)
	statusLabel := "offline"
	if liveOnline {
		statusLabel = "online"
	}
	changed := h.tracker.Changed("agent-status:"+serverID, statusLabel)
	if changed {
		loggingx.New("agent-status").Info(log.Logger, "status-poll", serverID, statusLabel, map[string]any{
			"route":   "/v1/servers/{id}/agent-status",
			"changed": true,
		})
	}
	w.Header().Set("X-Agent-Status-Changed", boolString(changed))

	// Try to read last known info from DB
	info, err := h.agentRepo.GetByServerID(serverID)
	if err != nil {
		// Agent has never connected — return minimal response
		writeJSON(w, http.StatusOK, itemEnvelope("ok", "agent_status", map[string]any{
			"server_id": serverID,
			"online":    liveOnline,
		}, nil))
		return
	}

	// Override online flag with live state
	info.Online = liveOnline
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "agent_status", info, nil))
}

// ListOnlineServers handles: GET /v1/agents/online
// Returns the list of server IDs that have active agent connections.
func (h *AgentStatusHandler) ListOnlineServers(w http.ResponseWriter, r *http.Request) {
	ids := h.hub.OnlineServerIDs()
	writeJSON(w, http.StatusOK, listEnvelope("ok", "agent_online_server", ids, map[string]any{"count": len(ids)}))
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
