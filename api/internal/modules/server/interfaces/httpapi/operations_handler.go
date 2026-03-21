package serverhttp

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	managementapp "einfra/api/internal/modules/server/application/management"
	domain "einfra/api/internal/modules/server/domain"
)

type OperationsHandler struct {
	operations *managementapp.RemoteOperations
}

func NewOperationsHandler(operations *managementapp.RemoteOperations) *OperationsHandler {
	return &OperationsHandler{operations: operations}
}

func (h *OperationsHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/servers/{id}/services/discovery", h.queueServiceDiscovery).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers/{id}/services/{service}/actions", h.queueServiceAction).Methods(http.MethodPost)
}

type queueServiceActionRequest struct {
	Action     domain.ServiceAction `json:"action"`
	TimeoutSec int                  `json:"timeout_sec"`
}

func (h *OperationsHandler) queueServiceDiscovery(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	userID := r.Header.Get("X-User-ID")

	command, err := h.operations.QueueServiceDiscovery(r.Context(), serverID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "service", "service.discovery", "queue_failed", err.Error(), map[string]any{"server_id": serverID})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "service", "service.discovery", command, nil, nil))
}

func (h *OperationsHandler) queueServiceAction(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	serviceName := mux.Vars(r)["service"]
	userID := r.Header.Get("X-User-ID")

	var request queueServiceActionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "service", "service.action", "invalid_request", "invalid request body", nil)
		return
	}

	command, err := h.operations.QueueServiceAction(r.Context(), serverID, userID, serviceName, request.Action, request.TimeoutSec)
	if err != nil {
		writeError(w, http.StatusBadRequest, "service", "service."+string(request.Action), "queue_failed", err.Error(), map[string]any{"server_id": serverID, "service": serviceName})
		return
	}
	writeJSON(w, http.StatusAccepted, actionEnvelope("accepted", "service", "service."+string(request.Action), command, map[string]any{"name": serviceName}, nil))
}
