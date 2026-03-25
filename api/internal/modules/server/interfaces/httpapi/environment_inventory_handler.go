package serverhttp

import (
	"net/http"

	"github.com/gorilla/mux"

	managementapp "einfra/api/internal/modules/server/application/management"
)

type EnvironmentInventoryHandler struct {
	service *managementapp.EnvironmentInventoryService
}

func NewEnvironmentInventoryHandler(service *managementapp.EnvironmentInventoryService) *EnvironmentInventoryHandler {
	return &EnvironmentInventoryHandler{service: service}
}

func (h *EnvironmentInventoryHandler) Register(r *mux.Router) {
	r.HandleFunc("/v1/environments/discovered", h.list).Methods(http.MethodGet)
}

func (h *EnvironmentInventoryHandler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_inventory", "environment.list_discovered", "list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "environment_inventory", items, map[string]any{
		"count": len(items),
	}))
}
