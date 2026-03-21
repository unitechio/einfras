// Package agenthandler — command_handler.go
// REST API handlers for submitting and querying commands.
package agenthandler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"

	agentregistry "einfra/api/internal/modules/agent/application"
	agent "einfra/api/internal/modules/agent/domain"
)

// CommandHandler exposes REST endpoints for command lifecycle.
type CommandHandler struct {
	dispatcher *agentregistry.Dispatcher
	repo       agentregistry.CommandRepository
}

type commandResponse struct {
	ID             string                    `json:"id"`
	ServerID       string                    `json:"server_id"`
	UserID         string                    `json:"user_id"`
	IdempotencyKey string                    `json:"idempotency_key,omitempty"`
	CommandType    agent.CommandType         `json:"command_type"`
	Command        string                    `json:"command"`
	Status         agent.CommandStatus       `json:"status"`
	ExitCode       *int                      `json:"exit_code,omitempty"`
	TimeoutSec     int                       `json:"timeout_sec"`
	CreatedAt      any                       `json:"created_at"`
	StartedAt      any                       `json:"started_at,omitempty"`
	DoneAt         any                       `json:"done_at,omitempty"`
	OutputPreview  string                    `json:"output_preview,omitempty"`
	OutputChunks   int                       `json:"output_chunks"`
	Result         *agent.TypedControlResult `json:"result,omitempty"`
	RawOutput      string                    `json:"raw_output,omitempty"`
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
		writeError(w, http.StatusBadRequest, "command", "command.create", "invalid_request", "invalid request body", nil)
		return
	}

	if req.Cmd == "" {
		writeError(w, http.StatusBadRequest, "command", "command.create", "validation_failed", "cmd is required", nil)
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
		writeError(w, http.StatusBadGateway, "command", "command.create", "dispatch_failed", err.Error(), map[string]any{"server_id": serverID})
		return
	}

	writeJSON(w, http.StatusCreated, itemEnvelope("created", "command", h.buildCommandResponse(cmd, nil), nil))
}

// GetCommand handles: GET /v1/servers/{id}/commands/{cmd_id}
func (h *CommandHandler) GetCommand(w http.ResponseWriter, r *http.Request) {
	commandID := mux.Vars(r)["cmd_id"]
	cmd, err := h.repo.FindByID(r.Context(), commandID)
	if err != nil {
		writeError(w, http.StatusNotFound, "command", "command.get", "not_found", "command not found", map[string]any{"id": commandID})
		return
	}
	logs, _ := h.repo.GetLogs(r.Context(), commandID)
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "command", h.buildCommandResponse(cmd, logs), nil))
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
		writeError(w, http.StatusInternalServerError, "command", "command.list", "list_failed", "failed to list commands", map[string]any{"server_id": serverID})
		return
	}
	items := make([]commandResponse, 0, len(cmds))
	for _, cmd := range cmds {
		items = append(items, h.buildCommandResponse(cmd, nil))
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "command", items, map[string]any{"limit": limit}))
}

// CancelCommand handles: DELETE /v1/servers/{id}/commands/{cmd_id}
func (h *CommandHandler) CancelCommand(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	commandID := mux.Vars(r)["cmd_id"]

	if err := h.dispatcher.Cancel(r.Context(), serverID, commandID); err != nil {
		writeError(w, http.StatusBadGateway, "command", "command.cancel", "cancel_failed", err.Error(), map[string]any{"server_id": serverID, "id": commandID})
		return
	}
	writeJSON(w, http.StatusOK, actionEnvelope("accepted", "command", "command.cancel", nil, map[string]any{"id": commandID, "state": "cancel_sent"}, nil))
}

func (h *CommandHandler) buildCommandResponse(cmd *agent.Command, logs []*agent.CommandLog) commandResponse {
	result, rawOutput := parseStructuredResult(cmd.Output)
	preview := cmd.Output
	if result != nil && strings.TrimSpace(result.Preview) != "" {
		preview = result.Preview
	}
	if len(preview) > 512 {
		preview = preview[:512]
	}
	chunks := len(logs)
	if chunks == 0 && strings.TrimSpace(cmd.Output) != "" {
		chunks = 1
	}
	return commandResponse{
		ID:             cmd.ID,
		ServerID:       cmd.ServerID,
		UserID:         cmd.UserID,
		IdempotencyKey: cmd.IdempotencyKey,
		CommandType:    cmd.Type,
		Command:        cmd.Cmd,
		Status:         cmd.Status,
		ExitCode:       cmd.ExitCode,
		TimeoutSec:     cmd.TimeoutSec,
		CreatedAt:      cmd.CreatedAt,
		StartedAt:      cmd.StartedAt,
		DoneAt:         cmd.DoneAt,
		OutputPreview:  preview,
		OutputChunks:   chunks,
		Result:         result,
		RawOutput:      rawOutput,
	}
}

func parseStructuredResult(output string) (*agent.TypedControlResult, string) {
	return agent.ParseTypedControlResult(strings.TrimSpace(output))
}
