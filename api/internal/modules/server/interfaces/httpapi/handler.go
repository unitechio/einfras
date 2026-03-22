package serverhttp

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"

	managementapp "einfra/api/internal/modules/server/application/management"
	domain "einfra/api/internal/modules/server/domain"
)

type Handler struct {
	service *managementapp.Service
}

func NewHandler(service *managementapp.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(r *mux.Router) {
	r.HandleFunc("/v1/servers", h.createServer).Methods(http.MethodPost)
	r.HandleFunc("/v1/servers", h.listServers).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}", h.getServer).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}", h.updateServer).Methods(http.MethodPut)
	r.HandleFunc("/v1/servers/{id}", h.deleteServer).Methods(http.MethodDelete)
	r.HandleFunc("/v1/servers/{id}/status", h.getStatus).Methods(http.MethodGet)
	r.HandleFunc("/v1/servers/{id}/metrics", h.getMetrics).Methods(http.MethodGet)
	r.HandleFunc("/v1/platform/overview", h.getOverview).Methods(http.MethodGet)
}

func (h *Handler) createServer(w http.ResponseWriter, r *http.Request) {
	var request createServerRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "server", "server.create", "invalid_request", "invalid request body", nil)
		return
	}
	server := domain.Server{
		Name:           request.Name,
		Description:    request.Description,
		Hostname:       request.Hostname,
		IPAddress:      request.IPAddress,
		OS:             request.OS,
		OSVersion:      request.OSVersion,
		Environment:    request.Environment,
		ConnectionMode: request.ConnectionMode,
		Location:       request.Location,
		Provider:       request.Provider,
		CPUCores:       request.CPUCores,
		MemoryGB:       request.MemoryGB,
		DiskGB:         request.DiskGB,
		SSHPort:        request.SSHPort,
		SSHUser:        request.SSHUser,
		SSHPassword:    request.SSHPassword,
		SSHKeyPath:     request.SSHKeyPath,
		Tags:           request.Tags,
	}
	if err := h.service.RegisterServer(r.Context(), &server); err != nil {
		writeError(w, http.StatusBadRequest, "server", "server.create", "register_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusCreated, itemEnvelope("created", "server", toServerResponse(&server), nil))
}

func (h *Handler) listServers(w http.ResponseWriter, r *http.Request) {
	filter := domain.ServerFilter{
		Status:   domain.ServerStatus(r.URL.Query().Get("status")),
		OS:       domain.ServerOS(r.URL.Query().Get("os")),
		Location: r.URL.Query().Get("location"),
		Provider: r.URL.Query().Get("provider"),
		Page:     parseInt(r.URL.Query().Get("page"), 1),
		PageSize: parseInt(r.URL.Query().Get("page_size"), 20),
	}

	servers, total, err := h.service.ListServers(r.Context(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server", "server.list", "list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, listEnvelope("ok", "server", toServerResponses(servers), map[string]any{
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	}))
}

func (h *Handler) getServer(w http.ResponseWriter, r *http.Request) {
	server, err := h.service.GetServer(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusNotFound, "server", "server.get", "not_found", err.Error(), map[string]any{"id": mux.Vars(r)["id"]})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "server", toServerResponse(server), nil))
}

func (h *Handler) updateServer(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	existing, err := h.service.GetServer(r.Context(), serverID)
	if err != nil {
		writeError(w, http.StatusNotFound, "server", "server.update", "not_found", err.Error(), map[string]any{"id": serverID})
		return
	}
	var request updateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "server", "server.update", "invalid_request", "invalid request body", nil)
		return
	}
	server := *existing
	server.ID = serverID
	server.Name = request.Name
	server.Description = request.Description
	server.Hostname = request.Hostname
	server.IPAddress = request.IPAddress
	server.OS = request.OS
	server.OSVersion = request.OSVersion
	server.Environment = request.Environment
	server.ConnectionMode = request.ConnectionMode
	server.Location = request.Location
	server.Provider = request.Provider
	server.CPUCores = request.CPUCores
	server.MemoryGB = request.MemoryGB
	server.DiskGB = request.DiskGB
	server.SSHPort = request.SSHPort
	server.SSHUser = request.SSHUser
	if request.SSHPassword != "" {
		server.SSHPassword = request.SSHPassword
	}
	server.SSHKeyPath = request.SSHKeyPath
	server.Tags = request.Tags
	if err := h.service.UpdateServer(r.Context(), &server); err != nil {
		writeError(w, http.StatusBadRequest, "server", "server.update", "update_failed", err.Error(), map[string]any{"id": serverID})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("updated", "server", toServerResponse(&server), nil))
}

func (h *Handler) deleteServer(w http.ResponseWriter, r *http.Request) {
	serverID := mux.Vars(r)["id"]
	if err := h.service.DeleteServer(r.Context(), serverID); err != nil {
		writeError(w, http.StatusNotFound, "server", "server.delete", "not_found", err.Error(), map[string]any{"id": serverID})
		return
	}
	writeJSON(w, http.StatusOK, actionEnvelope("deleted", "server", "server.delete", nil, map[string]any{"id": serverID}, nil))
}

func (h *Handler) getStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.service.GetRuntimeStatus(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusNotFound, "server_status", "server.status", "not_found", err.Error(), map[string]any{"id": mux.Vars(r)["id"]})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "server_status", status, nil))
}

func (h *Handler) getMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := h.service.GetMetrics(r.Context(), mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusNotFound, "server_metrics", "server.metrics", "not_found", err.Error(), map[string]any{"id": mux.Vars(r)["id"]})
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "server_metrics", metrics, nil))
}

func (h *Handler) getOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := h.service.GetPlatformOverview(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "platform_overview", "platform.overview", "overview_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, itemEnvelope("ok", "platform_overview", overview, nil))
}

func parseInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	if payload, ok := normalizeLegacyErrorEnvelope(v); ok {
		v = payload
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func normalizeLegacyErrorEnvelope(v any) (responseEnvelope, bool) {
	switch payload := v.(type) {
	case map[string]string:
		if msg, ok := payload["error"]; ok {
			return errorEnvelope("", "", "request_failed", msg, nil), true
		}
	case map[string]any:
		if raw, ok := payload["error"]; ok {
			if msg, ok := raw.(string); ok {
				return errorEnvelope("", "", "request_failed", msg, nil), true
			}
		}
	}
	return responseEnvelope{}, false
}

func toServerResponses(servers []*domain.Server) []serverResponse {
	items := make([]serverResponse, 0, len(servers))
	for _, server := range servers {
		items = append(items, toServerResponse(server))
	}
	return items
}
