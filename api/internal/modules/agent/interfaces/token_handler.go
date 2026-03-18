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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "server id required"})
		return
	}

	rawToken, err := h.issuer.Issue(r.Context(), serverID)
	if err != nil {
		log.Error().
			Str("server_id", serverID).
			Err(err).
			Msg("[token] failed to issue agent token")
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token issuance failed"})
		return
	}

	log.Info().
		Str("server_id", serverID).
		Msg("[token] agent token issued (rotation)")

	writeJSON(w, http.StatusCreated, map[string]string{
		"server_id": serverID,
		"token":     rawToken,
		"note":      "Store this token securely — it will not be shown again",
	})
}
