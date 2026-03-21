package agenthandler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	agentregistry "einfra/api/internal/modules/agent/application"
)

type SkillHandler struct {
	orchestrator *agentregistry.SkillOrchestrator
}

func NewSkillHandler(orchestrator *agentregistry.SkillOrchestrator) *SkillHandler {
	return &SkillHandler{orchestrator: orchestrator}
}

type TriggerAIWorkflowRequest struct {
	UserPrompt string `json:"user_prompt"`
}

// TriggerWorkflow handles: POST /v1/servers/{id}/ai-workflow
func (h *SkillHandler) TriggerWorkflow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serverID := vars["id"]

	var req TriggerAIWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "ai_workflow", "ai_workflow.trigger", "invalid_request", "invalid json", nil)
		return
	}

	// For an asynchronous long-running task, we should return ACCEPTED (202)
	// and run the orchestrator in a goroutine. However, for demo/blocking APIs
	// we await the result directly.

	// Start async processing
	go func() {
		_, err := h.orchestrator.RunAIPipeline(context.Background(), serverID, req.UserPrompt)
		if err != nil {
			// In production, publish via EventBus. Logging locally for demo constraints.
			println("[SkillHandler] Pipeline failed:", err.Error())
		}
	}()

	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "ai_workflow", "ai_workflow.trigger", nil, map[string]string{
		"message":   "workflow started",
		"server_id": serverID,
		"prompt":    req.UserPrompt,
	}, nil))
}
