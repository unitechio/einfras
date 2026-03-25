package iam

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

func (h *Handler) listTags(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListTags(r.Context(), principal, r.URL.Query().Get("search"))
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createTag(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateTag(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateTag(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateTag(r.Context(), principal, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteTag(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteTag(r.Context(), principal, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "tag deleted"})
}

func (h *Handler) listApplications(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	items, err := h.service.ListApplications(r.Context(), principal, r.URL.Query().Get("search"), r.URL.Query().Get("status"))
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createApplication(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateApplication(r.Context(), principal, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateApplication(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateApplication(r.Context(), principal, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteApplication(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteApplication(r.Context(), principal, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"message": "application deleted"})
}
