package iam

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var unread *bool
	if raw := strings.TrimSpace(r.URL.Query().Get("unread")); raw != "" {
		value := strings.EqualFold(raw, "true") || raw == "1"
		unread = &value
	}
	limit := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}
	items, err := h.service.ListNotifications(r.Context(), principal, NotificationListOptions{
		Search:   r.URL.Query().Get("search"),
		Status:   r.URL.Query().Get("status"),
		Channel:  r.URL.Query().Get("channel"),
		Priority: r.URL.Query().Get("priority"),
		Unread:   unread,
		Limit:    limit,
	})
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createNotification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateNotificationRecord(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) getNotification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	item, err := h.service.GetNotificationRecord(r.Context(), principal, mux.Vars(r)["id"])
	if err != nil {
		writeIAMError(w, http.StatusNotFound, "notification not found")
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) markNotificationRead(w http.ResponseWriter, r *http.Request) {
	h.setNotificationReadState(w, r, true)
}

func (h *Handler) markNotificationUnread(w http.ResponseWriter, r *http.Request) {
	h.setNotificationReadState(w, r, false)
}

func (h *Handler) setNotificationReadState(w http.ResponseWriter, r *http.Request, read bool) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.MarkNotificationRead(r.Context(), principal, mux.Vars(r)["id"], read); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "updated"})
}

func (h *Handler) markAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.MarkAllNotificationsRead(r.Context(), principal); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "all notifications marked as read"})
}

func (h *Handler) updateNotificationStatus(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpdateNotificationStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.service.UpdateNotificationStatus(r.Context(), principal, mux.Vars(r)["id"], req.Status); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "status updated"})
}

func (h *Handler) deleteNotification(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteNotificationRecord(r.Context(), principal, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "notification deleted"})
}

func (h *Handler) getNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	item, err := h.service.GetNotificationPreferences(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) saveNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertNotificationPreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpsertNotificationPreferences(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) listIntegrations(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListIntegrationPlugins(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) saveIntegration(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertIntegrationPluginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpsertIntegrationPlugin(r.Context(), principal, mux.Vars(r)["kind"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) testIntegration(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.SendIntegrationTest(r.Context(), principal, mux.Vars(r)["kind"]); err != nil {
		writeIAMError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "test event sent"})
}

func (h *Handler) listNotificationRoutingRules(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListNotificationRoutingRules(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createNotificationRoutingRule(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertNotificationRoutingRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateNotificationRoutingRule(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) simulateNotificationRouting(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req NotificationRoutingSimulationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.SimulateNotificationRouting(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) updateNotificationRoutingRule(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertNotificationRoutingRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateNotificationRoutingRule(r.Context(), principal, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteNotificationRoutingRule(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteNotificationRoutingRule(r.Context(), principal, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "routing rule deleted"})
}
