package iam

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
)

func (h *Handler) getPublicLoginConfiguration(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.GetPublicLoginConfiguration(r.Context(), strings.TrimSpace(r.URL.Query().Get("organization")))
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) listSystemSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListSystemSettings(r.Context(), principal, strings.TrimSpace(r.URL.Query().Get("category")))
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) saveSystemSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req BulkUpsertSystemSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	items, err := h.service.BulkUpsertSystemSettings(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listFeatureFlags(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListFeatureFlags(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) saveFeatureFlags(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req BulkUpsertFeatureFlagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	items, err := h.service.BulkUpsertFeatureFlags(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getLicense(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	item, err := h.service.GetLicense(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) saveLicense(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertLicenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpsertLicense(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) generateLicenseKey(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req GenerateLicenseKeyRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	item, err := h.service.GenerateLicenseKey(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) getUserSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	item, err := h.service.GetUserSettings(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) saveUserSettings(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertUserSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpsertUserSettings(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) listLicenseKeys(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListLicenseKeys(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createLicenseKey(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertLicenseKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateLicenseKey(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateLicenseKey(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertLicenseKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateLicenseKey(r.Context(), principal, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteLicenseKey(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteLicenseKey(r.Context(), principal, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "license key deleted"})
}
