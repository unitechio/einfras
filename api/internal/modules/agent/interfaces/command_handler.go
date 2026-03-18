// Package agenthandler — command_handler.go
// REST API handlers for submitting and querying commands.
package agenthandler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	agentregistry "einfra/api/internal/modules/agent/application"
)

// CommandHandler exposes REST endpoints for command lifecycle.
type CommandHandler struct {
	dispatcher *agentregistry.Dispatcher
	repo       agentregistry.CommandRepository
}

// NewCommandHandler creates a new REST command handler.
func NewCommandHandler(dispatcher *agentregistry.Dispatcher, repo agentregistry.CommandRepository) *CommandHandler {
	return &CommandHandler{dispatcher: dispatcher, repo: repo}
}

// CreateCommandRequest is the JSON body for POST /v1/servers/{id}/commands
type CreateCommandRequest struct {
	Cmd            string `json:"cmd"`
	TimeoutSec     int    `json:"timeout_sec"`
	IdempotencyKey string `json:"idempotency_key,omitempty"`
}

// CreateCommand handles: POST /v1/servers/{id}/commands
// Dispatches a command to the server's agent and returns the Command record.
func (h *CommandHandler) CreateCommand(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	userID := r.Header.Get("X-User-ID") // set by auth middleware

	var req CreateCommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Cmd == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cmd is required"})
		return
	}
	if req.TimeoutSec <= 0 {
		req.TimeoutSec = 120
	}

	// Prefer header over body field
	ikey := r.Header.Get("X-Idempotency-Key")
	if ikey == "" {
		ikey = req.IdempotencyKey
	}

	cmd, err := h.dispatcher.Dispatch(r.Context(), serverID, userID, req.Cmd, req.TimeoutSec, ikey)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, cmd)
}

// GetCommand handles: GET /v1/servers/{id}/commands/{cmd_id}
func (h *CommandHandler) GetCommand(w http.ResponseWriter, r *http.Request) {
	commandID := mux.Vars(r)["cmd_id"]
	cmd, err := h.repo.FindByID(r.Context(), commandID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "command not found"})
		return
	}
	writeJSON(w, http.StatusOK, cmd)
}

// ListCommands handles: GET /v1/servers/{id}/commands?limit=50
func (h *CommandHandler) ListCommands(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	cmds, err := h.repo.ListByServer(r.Context(), serverID, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list commands"})
		return
	}
	writeJSON(w, http.StatusOK, cmds)
}

// CancelCommand handles: DELETE /v1/servers/{id}/commands/{cmd_id}
func (h *CommandHandler) CancelCommand(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	commandID := mux.Vars(r)["cmd_id"]

	if err := h.dispatcher.Cancel(r.Context(), serverID, commandID); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancel_sent"})
}
