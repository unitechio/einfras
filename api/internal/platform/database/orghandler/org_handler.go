//go:build legacy
// +build legacy

// Package orghandler provides REST handlers for Organization management.
// Routes (all under /api/v1/orgs):
//
//	POST   /                             → CreateOrg
//	GET    /                             → ListOrgs
//	GET    /{org_id}                     → GetOrg
//	PUT    /{org_id}                     → UpdateOrg
//	DELETE /{org_id}                     → DeleteOrg
//	GET    /{org_id}/members             → ListMembers
//	POST   /{org_id}/members             → InviteMember
//	PUT    /{org_id}/members/{user_id}/role → UpdateMemberRole
//	DELETE /{org_id}/members/{user_id}   → RemoveMember
package orghandler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/domain"
	"einfra/api/internal/apps/api-gateway/middleware"
)

// Handler handles Organization REST endpoints.
type Handler struct {
	repo domain.OrganizationRepository
}

// New creates a new org handler.
func New(repo domain.OrganizationRepository) *Handler {
	return &Handler{repo: repo}
}

// RegisterRoutes attaches all org routes under the given subrouter.
func (h *Handler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("", h.ListOrgs).Methods(http.MethodGet)
	r.HandleFunc("", h.CreateOrg).Methods(http.MethodPost)

	orgR := r.PathPrefix("/{org_id}").Subrouter()
	orgR.HandleFunc("", h.GetOrg).Methods(http.MethodGet)
	orgR.HandleFunc("", h.UpdateOrg).Methods(http.MethodPut)
	orgR.HandleFunc("", h.DeleteOrg).Methods(http.MethodDelete)
	orgR.HandleFunc("/members", h.ListMembers).Methods(http.MethodGet)
	orgR.HandleFunc("/members", h.InviteMember).Methods(http.MethodPost)
	orgR.HandleFunc("/members/{user_id}/role", h.UpdateMemberRole).Methods(http.MethodPut)
	orgR.HandleFunc("/members/{user_id}", h.RemoveMember).Methods(http.MethodDelete)
}

// ─── Org CRUD ─────────────────────────────────────────────────────────────────

type createOrgRequest struct {
	Name string `json:"name" validate:"required,min=2,max=255"`
	Slug string `json:"slug" validate:"required,min=2,max=100"`
}

func (h *Handler) CreateOrg(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.UserClaimsFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var req createOrgRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Slug == "" {
		writeErr(w, http.StatusBadRequest, "name and slug are required")
		return
	}

	org := &domain.Organization{
		Name: req.Name, Slug: req.Slug,
		Plan: domain.OrgPlanFree, IsActive: true, CreatedBy: claims.UserID,
	}
	if err := h.repo.Create(r.Context(), org); err != nil {
		log.Error().Err(err).Msg("[org] create failed")
		writeErr(w, http.StatusConflict, "slug already taken or creation failed")
		return
	}
	_ = h.repo.AddMember(r.Context(), &domain.OrgMember{
		OrgID: org.ID, UserID: claims.UserID, Role: domain.OrgRoleOwner,
	})
	writeJSON(w, http.StatusCreated, org)
}

func (h *Handler) GetOrg(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	writeJSON(w, http.StatusOK, org)
}

func (h *Handler) ListOrgs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	orgs, total, err := h.repo.List(r.Context(), page, pageSize)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to list organizations")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": orgs, "total": total, "page": page, "page_size": pageSize})
}

type updateOrgRequest struct {
	Name    string `json:"name"`
	LogoURL string `json:"logo_url"`
}

func (h *Handler) UpdateOrg(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	var req updateOrgRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Name != "" {
		org.Name = req.Name
	}
	if req.LogoURL != "" {
		org.LogoURL = req.LogoURL
	}
	if err := h.repo.Update(r.Context(), org); err != nil {
		writeErr(w, http.StatusInternalServerError, "update failed")
		return
	}
	writeJSON(w, http.StatusOK, org)
}

func (h *Handler) DeleteOrg(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	if err := h.repo.Delete(r.Context(), org.ID); err != nil {
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ─── Members ──────────────────────────────────────────────────────────────────

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	members, err := h.repo.ListMembers(r.Context(), org.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "failed to list members")
		return
	}
	writeJSON(w, http.StatusOK, members)
}

type inviteMemberRequest struct {
	UserID string               `json:"user_id" validate:"required"`
	Role   domain.OrgMemberRole `json:"role"`
}

func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	claims, _ := middleware.UserClaimsFromContext(r.Context())
	var req inviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeErr(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if req.Role == "" {
		req.Role = domain.OrgRoleMember
	}
	member := &domain.OrgMember{OrgID: org.ID, UserID: req.UserID, Role: req.Role, InvitedBy: claims.UserID}
	if err := h.repo.AddMember(r.Context(), member); err != nil {
		writeErr(w, http.StatusConflict, "member already exists")
		return
	}
	writeJSON(w, http.StatusCreated, member)
}

type updateRoleRequest struct {
	Role domain.OrgMemberRole `json:"role" validate:"required"`
}

func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	targetUserID := mux.Vars(r)["user_id"]
	var req updateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Role == "" {
		writeErr(w, http.StatusBadRequest, "role is required")
		return
	}
	if err := h.repo.UpdateMemberRole(r.Context(), org.ID, targetUserID, req.Role); err != nil {
		writeErr(w, http.StatusInternalServerError, "role update failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "role": string(req.Role)})
}

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	org, ok := domain.OrgFromContext(r.Context())
	if !ok {
		writeErr(w, http.StatusNotFound, "organization not found")
		return
	}
	targetUserID := mux.Vars(r)["user_id"]

	// Guard: cannot remove last owner
	members, _ := h.repo.ListMembers(r.Context(), org.ID)
	ownerCount := 0
	for _, m := range members {
		if m.Role == domain.OrgRoleOwner {
			ownerCount++
		}
	}
	if ownerCount <= 1 {
		if target, _ := h.repo.GetMember(r.Context(), org.ID, targetUserID); target != nil && target.IsOwner() {
			writeErr(w, http.StatusConflict, "cannot remove the last owner")
			return
		}
	}

	if err := h.repo.RemoveMember(r.Context(), org.ID, targetUserID); err != nil {
		writeErr(w, http.StatusInternalServerError, "remove member failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
