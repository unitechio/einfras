// Package agenthandler — token_handler.go
// REST endpoint: POST /v1/servers/{id}/agent-token
// Issues a new agent bearer token for a server. The raw token is returned ONCE
// and must be stored securely — only the hash is kept in the database.
package agenthandler

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// TokenIssuer issues agent tokens for a server.
type TokenIssuer interface {
	Issue(ctx context.Context, serverID string) (rawToken string, err error)
}

// AgentTokenHandler handles token issuance REST requests.
type AgentTokenHandler struct {
	issuer TokenIssuer
}

// NewAgentTokenHandler creates a new token handler.
func NewAgentTokenHandler(issuer TokenIssuer) *AgentTokenHandler {
	return &AgentTokenHandler{issuer: issuer}
}

// IssueToken handles: POST /v1/servers/{id}/agent-token
// Requires admin auth (enforced by router-level middleware).
// Response: { "server_id": "...", "token": "<raw-token>" }
// NOTE: The raw token is shown exactly once. Rotate by calling this endpoint again.
func (h *AgentTokenHandler) IssueToken(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	if serverID == "" {
		writeError(w, http.StatusBadRequest, "agent_token", "agent_token.issue", "validation_failed", "server id required", nil)
		return
	}

	rawToken, err := h.issuer.Issue(r.Context(), serverID)
	if err != nil {
		log.Error().
			Str("server_id", serverID).
			Err(err).
			Msg("[token] failed to issue agent token")
		writeError(w, http.StatusInternalServerError, "agent_token", "agent_token.issue", "issue_failed", "token issuance failed", map[string]any{"server_id": serverID})
		return
	}

	log.Info().
		Str("server_id", serverID).
		Msg("[token] agent token issued (rotation)")

	writeJSON(w, http.StatusCreated, itemEnvelope("created", "agent_token", map[string]string{
		"server_id": serverID,
		"token":     rawToken,
		"note":      "Store this token securely — it will not be shown again",
	}, nil))
}
