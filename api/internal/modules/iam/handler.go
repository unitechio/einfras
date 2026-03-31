package iam

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(r *mux.Router) {
	r.HandleFunc("/v1/public/login-config", h.getPublicLoginConfiguration).Methods(http.MethodGet)
	r.HandleFunc("/v1/auth/login", h.login).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/login/totp", h.loginTOTP).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/refresh", h.refresh).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/password/forgot", h.forgotPassword).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/password/reset", h.resetPassword).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/mfa/reset/request", h.requestMFAReset).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/mfa/reset/confirm", h.confirmMFAReset).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/me", h.me).Methods(http.MethodGet)
	r.HandleFunc("/v1/auth/presence", h.getPresenceSummary).Methods(http.MethodGet)
	r.HandleFunc("/v1/auth/mfa/setup", h.beginMFASetup).Methods(http.MethodPost)
	r.HandleFunc("/v1/auth/mfa/confirm", h.confirmMFASetup).Methods(http.MethodPost)
	r.HandleFunc("/v1/iam/users", h.listUsers).Methods(http.MethodGet)
	r.HandleFunc("/v1/iam/users", h.createUser).Methods(http.MethodPost)
	r.HandleFunc("/v1/iam/users/{id}", h.updateUser).Methods(http.MethodPut)
	r.HandleFunc("/v1/iam/users/{id}", h.deleteUser).Methods(http.MethodDelete)
	r.HandleFunc("/v1/iam/roles", h.listRoles).Methods(http.MethodGet)
	r.HandleFunc("/v1/iam/roles", h.createRole).Methods(http.MethodPost)
	r.HandleFunc("/v1/iam/roles/{id}", h.updateRole).Methods(http.MethodPut)
	r.HandleFunc("/v1/iam/roles/{id}", h.deleteRole).Methods(http.MethodDelete)
	r.HandleFunc("/v1/iam/teams", h.listTeams).Methods(http.MethodGet)
	r.HandleFunc("/v1/iam/teams", h.createTeam).Methods(http.MethodPost)
	r.HandleFunc("/v1/iam/teams/{id}", h.updateTeam).Methods(http.MethodPut)
	r.HandleFunc("/v1/iam/teams/{id}", h.deleteTeam).Methods(http.MethodDelete)
	r.HandleFunc("/v1/iam/audit-logs", h.listAuditLogs).Methods(http.MethodGet)
	r.HandleFunc("/v1/tags", h.listTags).Methods(http.MethodGet)
	r.HandleFunc("/v1/tags", h.createTag).Methods(http.MethodPost)
	r.HandleFunc("/v1/tags/{id}", h.updateTag).Methods(http.MethodPut)
	r.HandleFunc("/v1/tags/{id}", h.deleteTag).Methods(http.MethodDelete)
	r.HandleFunc("/v1/applications", h.listApplications).Methods(http.MethodGet)
	r.HandleFunc("/v1/applications", h.createApplication).Methods(http.MethodPost)
	r.HandleFunc("/v1/applications/{id}", h.updateApplication).Methods(http.MethodPut)
	r.HandleFunc("/v1/applications/{id}", h.deleteApplication).Methods(http.MethodDelete)
	r.HandleFunc("/v1/settings/system", h.listSystemSettings).Methods(http.MethodGet)
	r.HandleFunc("/v1/settings/system", h.saveSystemSettings).Methods(http.MethodPut)
	r.HandleFunc("/v1/settings/feature-flags", h.listFeatureFlags).Methods(http.MethodGet)
	r.HandleFunc("/v1/settings/feature-flags", h.saveFeatureFlags).Methods(http.MethodPut)
	r.HandleFunc("/v1/settings/license", h.getLicense).Methods(http.MethodGet)
	r.HandleFunc("/v1/settings/license", h.saveLicense).Methods(http.MethodPut)
	r.HandleFunc("/v1/settings/license/generate", h.generateLicenseKey).Methods(http.MethodPost)
	r.HandleFunc("/v1/settings/license-keys", h.listLicenseKeys).Methods(http.MethodGet)
	r.HandleFunc("/v1/settings/license-keys", h.createLicenseKey).Methods(http.MethodPost)
	r.HandleFunc("/v1/settings/license-keys/{id}", h.updateLicenseKey).Methods(http.MethodPut)
	r.HandleFunc("/v1/settings/license-keys/{id}", h.deleteLicenseKey).Methods(http.MethodDelete)
	r.HandleFunc("/v1/settings/user", h.getUserSettings).Methods(http.MethodGet)
	r.HandleFunc("/v1/settings/user", h.saveUserSettings).Methods(http.MethodPut)
	r.HandleFunc("/v1/notifications", h.listNotifications).Methods(http.MethodGet)
	r.HandleFunc("/v1/notifications", h.createNotification).Methods(http.MethodPost)
	r.HandleFunc("/v1/notifications/{id}", h.getNotification).Methods(http.MethodGet)
	r.HandleFunc("/v1/notifications/{id}", h.deleteNotification).Methods(http.MethodDelete)
	r.HandleFunc("/v1/notifications/{id}/read", h.markNotificationRead).Methods(http.MethodPut)
	r.HandleFunc("/v1/notifications/{id}/unread", h.markNotificationUnread).Methods(http.MethodPut)
	r.HandleFunc("/v1/notifications/{id}/status", h.updateNotificationStatus).Methods(http.MethodPut)
	r.HandleFunc("/v1/notifications/read-all", h.markAllNotificationsRead).Methods(http.MethodPut)
	r.HandleFunc("/v1/notifications/preferences", h.getNotificationPreferences).Methods(http.MethodGet)
	r.HandleFunc("/v1/notifications/preferences", h.saveNotificationPreferences).Methods(http.MethodPut)
	r.HandleFunc("/v1/integrations", h.listIntegrations).Methods(http.MethodGet)
	r.HandleFunc("/v1/integrations/{kind}", h.saveIntegration).Methods(http.MethodPut)
	r.HandleFunc("/v1/integrations/{kind}/test", h.testIntegration).Methods(http.MethodPost)
	r.HandleFunc("/v1/notification-routing-rules", h.listNotificationRoutingRules).Methods(http.MethodGet)
	r.HandleFunc("/v1/notification-routing-rules", h.createNotificationRoutingRule).Methods(http.MethodPost)
	r.HandleFunc("/v1/notification-routing-rules/simulate", h.simulateNotificationRouting).Methods(http.MethodPost)
	r.HandleFunc("/v1/notification-routing-rules/{id}", h.updateNotificationRoutingRule).Methods(http.MethodPut)
	r.HandleFunc("/v1/notification-routing-rules/{id}", h.deleteNotificationRoutingRule).Methods(http.MethodDelete)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	resp, err := h.service.Login(r.Context(), req, clientIP(r), r.UserAgent())
	if err != nil {
		writeIAMError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, resp)
}

func (h *Handler) loginTOTP(w http.ResponseWriter, r *http.Request) {
	var req LoginTOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	resp, err := h.service.VerifyLoginTOTP(r.Context(), req)
	if err != nil {
		writeIAMError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, resp)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	resp, err := h.service.Refresh(r.Context(), req, clientIP(r), r.UserAgent())
	if err != nil {
		writeIAMError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, resp)
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	_ = h.service.RequestPasswordReset(r.Context(), req.Email)
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "If the email exists, a password reset mail has been sent."})
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.service.ResetPassword(r.Context(), req); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "Password updated."})
}

func (h *Handler) requestMFAReset(w http.ResponseWriter, r *http.Request) {
	var req PasswordResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	_ = h.service.RequestMFAReset(r.Context(), req.Email)
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "If the email exists, an authenticator reset mail has been sent."})
}

func (h *Handler) confirmMFAReset(w http.ResponseWriter, r *http.Request) {
	var req MFAResetConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.service.ConfirmMFAReset(r.Context(), req); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "Authenticator reset."})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	resp, err := h.service.Me(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, resp)
}

func (h *Handler) getPresenceSummary(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	item, err := h.service.GetPresenceSummary(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) beginMFASetup(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	resp, err := h.service.BeginMFASetup(r.Context(), principal)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, resp)
}

func (h *Handler) confirmMFASetup(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req MFAConfirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.service.ConfirmMFASetup(r.Context(), principal, req); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "Authenticator enabled."})
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	page, pageSize := parsePagination(r)
	items, meta, err := h.service.ListUsersPage(r.Context(), principal.OrganizationID, UserListOptions{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("search"),
		Status:   r.URL.Query().Get("status"),
		SortBy:   r.URL.Query().Get("sort_by"),
		SortDir:  r.URL.Query().Get("sort_dir"),
	})
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items, "meta": meta})
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateUser(r.Context(), principal.OrganizationID, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateUser(r.Context(), principal.OrganizationID, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteUser(r.Context(), principal.OrganizationID, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "User deleted"})
}

func (h *Handler) listRoles(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	page, pageSize := parsePagination(r)
	var systemFilter *bool
	if raw := strings.TrimSpace(r.URL.Query().Get("system")); raw != "" {
		parsed := strings.EqualFold(raw, "true") || raw == "1"
		systemFilter = &parsed
	}
	items, meta, err := h.service.ListRolesPage(r.Context(), principal.OrganizationID, RoleListOptions{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("search"),
		System:   systemFilter,
		SortBy:   r.URL.Query().Get("sort_by"),
		SortDir:  r.URL.Query().Get("sort_dir"),
	})
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items, "meta": meta})
}

func (h *Handler) createRole(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateRole(r.Context(), principal.OrganizationID, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateRole(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateRole(r.Context(), principal.OrganizationID, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteRole(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteRole(r.Context(), principal.OrganizationID, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "Role deleted"})
}

func (h *Handler) listTeams(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	page, pageSize := parsePagination(r)
	items, meta, err := h.service.ListTeamsPage(r.Context(), principal.OrganizationID, TeamListOptions{
		Page:     page,
		PageSize: pageSize,
		Search:   r.URL.Query().Get("search"),
		SortBy:   r.URL.Query().Get("sort_by"),
		SortDir:  r.URL.Query().Get("sort_dir"),
	})
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items, "meta": meta})
}

func (h *Handler) createTeam(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.CreateTeam(r.Context(), principal.OrganizationID, req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateTeam(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	var req UpsertTeamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeIAMError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := h.service.UpdateTeam(r.Context(), principal.OrganizationID, mux.Vars(r)["id"], req)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, item)
}

func (h *Handler) deleteTeam(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	if err := h.service.DeleteTeam(r.Context(), principal.OrganizationID, mux.Vars(r)["id"]); err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]string{"message": "Team deleted"})
}

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	principal, ok := PrincipalFromContext(r.Context())
	if !ok {
		writeIAMError(w, http.StatusUnauthorized, "missing principal")
		return
	}
	limit := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			limit = parsed
		}
	}
	items, err := h.service.ListAuditLogs(
		r.Context(),
		principal.OrganizationID,
		limit,
		r.URL.Query().Get("status"),
		r.URL.Query().Get("resource"),
		r.URL.Query().Get("action"),
	)
	if err != nil {
		writeIAMError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeIAMJSON(w, http.StatusOK, map[string]any{"items": items})
}

type Middleware struct {
	service *Service
	tokens  *TokenManager
}

func NewMiddleware(service *Service, tokens *TokenManager) *Middleware {
	return &Middleware{service: service, tokens: tokens}
}

func (m *Middleware) Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		token := websocketAccessToken(r)
		if token == "" {
			rawAuth := strings.TrimSpace(r.Header.Get("Authorization"))
			if strings.HasPrefix(strings.ToLower(rawAuth), "bearer ") {
				token = strings.TrimSpace(strings.TrimPrefix(rawAuth, "Bearer "))
			}
		}
		if token == "" {
			writeIAMError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		principal, err := m.tokens.ParseAccessToken(token)
		if err != nil {
			writeIAMError(w, http.StatusUnauthorized, "invalid access token")
			return
		}
		_ = m.service.TouchSessionPresence(r.Context(), principal, token, r.UserAgent(), clientIP(r))
		r = r.WithContext(ContextWithPrincipal(r.Context(), principal))
		r.Header.Set("X-User-ID", principal.UserID)
		r.Header.Set("X-Organization-ID", principal.OrganizationID)
		role := "viewer"
		if len(principal.Roles) > 0 {
			role = principal.Roles[0]
		}
		r.Header.Set("X-User-Role", role)
		next.ServeHTTP(w, r)
	})
}

func (m *Middleware) Authorize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		principal, ok := PrincipalFromContext(r.Context())
		if !ok {
			writeIAMError(w, http.StatusUnauthorized, "missing principal")
			return
		}
		resource, action, env, resourceID, needsCheck, sensitive, adminOnly := routePolicy(r)
		if adminOnly && !hasRole(principal.Roles, "admin") {
			_ = m.logAudit(r, principal, "iam", "admin", resourceID, env, "failure", "admin_required")
			writeIAMError(w, http.StatusForbidden, "admin role required")
			return
		}
		if !needsCheck {
			next.ServeHTTP(w, r)
			return
		}
		decision, err := m.service.checkPermissionDecision(r.Context(), principal.UserID, principal.OrganizationID, resource, action, env, resourceID)
		if err != nil {
			writeIAMError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !decision.Allowed {
			_ = m.logAudit(r, principal, resource, action, resourceID, env, "failure", decision.Reason)
			writeIAMError(w, http.StatusForbidden, "permission denied")
			return
		}
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		if sensitive {
			status := "success"
			if recorder.status >= 400 {
				status = "failure"
			}
			_ = m.logAudit(r, principal, resource, action, resourceID, env, status, "")
		}
	})
}

func (m *Middleware) logAudit(r *http.Request, principal *Principal, resource, action, resourceID, env, status, reason string) error {
	return m.service.db.WithContext(r.Context()).Create(&AuditLog{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		Action:         action,
		Resource:       resource,
		ResourceID:     resourceID,
		Environment:    env,
		Status:         status,
		IPAddress:      clientIP(r),
		UserAgent:      r.UserAgent(),
		Metadata: JSONObject{
			"path":   r.URL.Path,
			"method": r.Method,
			"reason": reason,
		},
	}).Error
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func isPublicPath(path string) bool {
	switch {
	case path == "/health":
		return true
	case strings.HasPrefix(path, "/ws/agent/"), strings.HasPrefix(path, "/ws/client/"):
		return true
	case strings.HasPrefix(path, "/v1/auth/login"),
		strings.HasPrefix(path, "/v1/auth/refresh"),
		strings.HasPrefix(path, "/v1/auth/password/"),
		strings.HasPrefix(path, "/v1/auth/mfa/reset/"),
		strings.HasPrefix(path, "/v1/public/login-config"):
		return true
	// Agent onboarding endpoints — must be public so curl | bash works without credentials
	case path == "/install.sh",
		strings.HasPrefix(path, "/v1/agent/binary"),
		strings.HasPrefix(path, "/v1/agent/manifest"):
		return true
	default:
		return false
	}
}

func routePolicy(r *http.Request) (resource, action, env, resourceID string, needsCheck, sensitive, adminOnly bool) {
	vars := mux.Vars(r)
	resourceID = firstNonEmpty(vars["id"], vars["server_id"], vars["backupId"], vars["cronjobId"])
	env = firstNonEmpty(r.URL.Query().Get("env"), r.Header.Get("X-Environment"))
	path := r.URL.Path
	switch {
	case strings.HasPrefix(path, "/v1/iam/users"):
		return "iam_user", strings.ToLower(r.Method), env, resourceID, false, true, true
	case strings.HasPrefix(path, "/v1/iam/roles"):
		return "iam_role", strings.ToLower(r.Method), env, resourceID, false, true, true
	case strings.HasPrefix(path, "/v1/iam/teams"):
		return "iam_team", strings.ToLower(r.Method), env, resourceID, false, true, true
	case strings.HasPrefix(path, "/v1/iam/audit-logs"):
		return "audit_log", "read", env, resourceID, true, false, true
	case strings.HasPrefix(path, "/v1/auth/presence"):
		return "iam_session", "read", env, resourceID, false, false, true
	case strings.HasPrefix(path, "/v1/notification-routing-rules/simulate"):
		return "notification_route", "simulate", env, resourceID, false, true, true
	case path == "/v1/servers" && r.Method == http.MethodGet:
		return "server", "read", env, "", true, false, false
	case path == "/v1/servers" && r.Method == http.MethodPost:
		return "server", "write", env, "", true, true, false
	case strings.HasPrefix(path, "/v1/servers/") && r.Method == http.MethodDelete:
		return "server", "delete", env, resourceID, true, true, false
	case strings.HasPrefix(path, "/v1/servers/") && r.Method == http.MethodGet:
		return "server", "read", env, resourceID, true, false, false
	case strings.Contains(path, "/terminal/exec"):
		return "server", "execute", env, resourceID, true, true, false
	case strings.Contains(path, "/iptables/"):
		switch r.Method {
		case http.MethodGet:
			return "firewall", "read", env, resourceID, true, false, false
		case http.MethodDelete:
			return "firewall", "delete", env, resourceID, true, true, false
		default:
			return "firewall", "write", env, resourceID, true, true, false
		}
	case strings.Contains(path, "/access/actions"):
		return "ssh_key", "execute", env, resourceID, true, true, false
	case strings.Contains(path, "/audit-logs"):
		return "audit_log", "read", env, resourceID, true, false, false
	default:
		return "", "", env, resourceID, false, false, false
	}
}

func writeIAMJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeIAMError(w http.ResponseWriter, status int, message string) {
	writeIAMJSON(w, status, map[string]any{"error": map[string]any{"message": message}})
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func websocketAccessToken(r *http.Request) string {
	if !strings.EqualFold(strings.TrimSpace(r.Header.Get("Upgrade")), "websocket") {
		return ""
	}
	return strings.TrimSpace(firstNonEmpty(
		r.URL.Query().Get("access_token"),
		r.URL.Query().Get("token"),
	))
}

func hasRole(roles []string, target string) bool {
	for _, role := range roles {
		if strings.EqualFold(strings.TrimSpace(role), target) {
			return true
		}
	}
	return false
}

func parsePagination(r *http.Request) (int, int) {
	page := 1
	pageSize := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			page = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("page_size")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			pageSize = parsed
		}
	}
	return page, pageSize
}
