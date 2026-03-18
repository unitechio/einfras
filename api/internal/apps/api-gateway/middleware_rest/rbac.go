// Package middleware — rbac.go
// Organization context + RBAC permission enforcement middleware.
//
// Middleware chain for a protected route:
//
//	AuthRequired → OrgContext → RequireOrgRole(member) → handler
//	AuthRequired → OrgContext → RequirePermission("server:create") → handler
package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"einfra/api/internal/domain"
)

// OrgFinder retrieves an organization by ID.
type OrgFinder interface {
	FindByID(ctx context.Context, id string) (*domain.Organization, error)
}

// MemberChecker retrieves org membership for a (org, user) pair.
type MemberChecker interface {
	GetMember(ctx context.Context, orgID, userID string) (*domain.OrgMember, error)
}

// PermissionChecker checks whether a user has a specific permission.
// Implementations should cache results (Redis TTL ~60s).
type PermissionChecker interface {
	HasPermission(ctx context.Context, userID, orgID, permission string) (bool, error)
}

// AuditWriter persists an audit event.
type AuditWriter interface {
	Write(ctx context.Context, entry *domain.AuditLog) error
}

// ─── Context keys ─────────────────────────────────────────────────────────────

type userClaimsKey struct{}
type requestStartKey struct{}

// WithUserClaims stores JWT claims in context (called by auth middleware).
func WithUserClaims(ctx context.Context, claims *domain.TokenClaims) context.Context {
	return context.WithValue(ctx, userClaimsKey{}, claims)
}

// UserClaimsFromContext retrieves JWT claims from context.
func UserClaimsFromContext(ctx context.Context) (*domain.TokenClaims, bool) {
	c, ok := ctx.Value(userClaimsKey{}).(*domain.TokenClaims)
	return c, ok && c != nil
}

// ─── OrgContext middleware ────────────────────────────────────────────────────

// OrgContext resolves the {org_id} path variable, loads the Organization from
// the repository, verifies the caller is a member and injects both into context.
//
// Route pattern must contain {org_id}.
// Requires auth middleware to have run first (UserClaims must be in context).
func OrgContext(orgs OrgFinder, members MemberChecker) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			orgID := mux.Vars(r)["org_id"]
			if orgID == "" {
				writeJSONError(w, http.StatusBadRequest, "org_id path variable required")
				return
			}

			claims, ok := UserClaimsFromContext(r.Context())
			if !ok {
				writeJSONError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			// Load org — 404 if not found or deleted
			org, err := orgs.FindByID(r.Context(), orgID)
			if err != nil || !org.IsActive {
				writeJSONError(w, http.StatusNotFound, "organization not found")
				return
			}

			// Load membership — 403 if caller is not a member
			member, err := members.GetMember(r.Context(), orgID, claims.UserID)
			if err != nil {
				log.Warn().
					Str("user_id", claims.UserID).
					Str("org_id", orgID).
					Msg("[rbac] user is not a member of org")
				writeJSONError(w, http.StatusForbidden, "you are not a member of this organization")
				return
			}

			ctx := domain.WithOrg(r.Context(), org)
			ctx = domain.WithOrgMember(ctx, member)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ─── Role middleware ─────────────────────────────────────────────────────────

// RequireOrgRole enforces that the caller has AT LEAST the given org role.
// Role hierarchy: owner > admin > member > viewer
func RequireOrgRole(minRole domain.OrgMemberRole) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			member, ok := domain.OrgMemberFromContext(r.Context())
			if !ok {
				writeJSONError(w, http.StatusForbidden, "org context missing")
				return
			}
			if !roleAtLeast(member.Role, minRole) {
				log.Warn().
					Str("user_role", string(member.Role)).
					Str("required", string(minRole)).
					Msg("[rbac] insufficient org role")
				writeJSONError(w, http.StatusForbidden, "insufficient role in this organization")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// roleAtLeast returns true if actual >= required in the role hierarchy.
func roleAtLeast(actual, required domain.OrgMemberRole) bool {
	order := map[domain.OrgMemberRole]int{
		domain.OrgRoleViewer: 1,
		domain.OrgRoleMember: 2,
		domain.OrgRoleAdmin:  3,
		domain.OrgRoleOwner:  4,
	}
	return order[actual] >= order[required]
}

// ─── Permission middleware ────────────────────────────────────────────────────

// RequirePermission checks a fine-grained permission string (e.g. "server:create").
// Requires OrgContext to have run first.
func RequirePermission(checker PermissionChecker, permission string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := UserClaimsFromContext(r.Context())
			if !ok {
				writeJSONError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			org, hasOrg := domain.OrgFromContext(r.Context())
			orgID := ""
			if hasOrg {
				orgID = org.ID
			}

			allowed, err := checker.HasPermission(r.Context(), claims.UserID, orgID, permission)
			if err != nil {
				log.Error().
					Err(err).
					Str("user_id", claims.UserID).
					Str("permission", permission).
					Msg("[rbac] permission check failed")
				writeJSONError(w, http.StatusInternalServerError, "permission check failed")
				return
			}
			if !allowed {
				log.Warn().
					Str("user_id", claims.UserID).
					Str("permission", permission).
					Msg("[rbac] permission denied")
				writeJSONError(w, http.StatusForbidden, "permission denied: "+permission)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// ─── Audit middleware ─────────────────────────────────────────────────────────

// AuditLog records every mutating HTTP request (POST/PUT/PATCH/DELETE) as an
// audit event AFTER the handler completes so it includes the response status.
func AuditLog(writer AuditWriter) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only audit write operations
			if r.Method == http.MethodGet || r.Method == http.MethodOptions || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
			ctx := context.WithValue(r.Context(), requestStartKey{}, start)
			next.ServeHTTP(rw, r.WithContext(ctx))

			// Build audit entry (fire-and-forget — don't block response)
			go func() {
				claims, _ := UserClaimsFromContext(r.Context())
				org, _ := domain.OrgFromContext(r.Context())
				corrID := GetCorrelationID(r.Context())

				entry := &domain.AuditLog{
					Action:        domain.AuditAction(r.Method + ":" + r.URL.Path),
					Resource:      r.URL.Path,
					IPAddress:     r.RemoteAddr,
					UserAgent:     r.UserAgent(),
					RequestMethod: r.Method,
					RequestPath:   r.URL.Path,
					StatusCode:    rw.status,
					Duration:      time.Since(start).Milliseconds(),
					TraceID:       corrID,
					Success:       rw.status < 400,
				}
				if claims != nil {
					entry.UserID = &claims.UserID
					entry.Username = claims.Username
				}
				if org != nil {
					entry.OrgID = &org.ID
				}

				bgCtx := context.Background()
				if err := writer.Write(bgCtx, entry); err != nil {
					log.Error().Err(err).Msg("[audit] failed to write audit log")
				}
			}()
		})
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + msg + `"}`))
}
