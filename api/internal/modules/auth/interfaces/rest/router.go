//go:build legacy
// +build legacy

package handler

import (
	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/application"
)

// AuthHandlers groups all Auth-related handlers
type AuthHandlers struct {
	Auth          *AuthHandler
	User          *UserHandler
	Role          *RoleHandler
	Permission    *PermissionHandler
	Authorization *AuthorizationHandler
	Audit         *AuditHandler
}

// NewAuthHandlers creates a new Auth handlers instance
func NewAuthHandlers(
	authUC usecase.AuthUsecase,
	userUC usecase.UserUsecase,
	roleUC usecase.RoleUsecase,
	permissionUC usecase.PermissionUsecase,
	authorizationUC usecase.AuthorizationUsecase,
	auditUC usecase.AuditUsecase,
) *AuthHandlers {
	return &AuthHandlers{
		Auth:          NewAuthHandler(authUC),
		User:          NewUserHandler(userUC),
		Role:          NewRoleHandler(roleUC),
		Permission:    NewPermissionHandler(permissionUC),
		Authorization: NewAuthorizationHandler(authorizationUC),
		Audit:         NewAuditHandler(auditUC),
	}
}

// RegisterAuthRoutes registers all Auth-related routes
func RegisterAuthRoutes(r *gin.RouterGroup, h *AuthHandlers) {
	// Public auth routes (no authentication required)
	auth := r.Group("/auth")
	{
		auth.POST("/login", h.Auth.Login)
		auth.POST("/register", h.Auth.Register)
		auth.POST("/refresh", h.Auth.RefreshToken)
		auth.POST("/forgot-password", h.Auth.ForgotPassword)
		auth.POST("/reset-password", h.Auth.ResetPassword)
	}

	// Protected routes (require authentication)
	auth.POST("/logout", h.Auth.Logout)
	auth.GET("/me", h.Auth.GetCurrentUser)
	auth.PUT("/me", h.Auth.UpdateProfile)
	auth.PUT("/me/password", h.Auth.ChangePassword)

	// User management
	users := r.Group("/users")
	{
		users.GET("", h.User.ListUsers)
		users.POST("", h.User.CreateUser)
		users.GET("/:user_id", h.User.GetUser)
		users.PUT("/:user_id", h.User.UpdateUser)
		users.DELETE("/:user_id", h.User.DeleteUser)
		users.PUT("/:user_id/status", h.User.UpdateUserStatus)
		users.PUT("/:user_id/roles", h.User.AssignRoles)
	}

	// Role management
	roles := r.Group("/roles")
	{
		roles.GET("", h.Role.ListRoles)
		roles.POST("", h.Role.CreateRole)
		roles.GET("/:role_id", h.Role.GetRole)
		roles.PUT("/:role_id", h.Role.UpdateRole)
		roles.DELETE("/:role_id", h.Role.DeleteRole)
		roles.PUT("/:role_id/permissions", h.Role.AssignPermissions)
	}

	// Permission management
	permissions := r.Group("/permissions")
	{
		permissions.GET("", h.Permission.ListPermissions)
		permissions.POST("", h.Permission.CreatePermission)
		permissions.GET("/:permission_id", h.Permission.GetPermission)
		permissions.PUT("/:permission_id", h.Permission.UpdatePermission)
		permissions.DELETE("/:permission_id", h.Permission.DeletePermission)
	}

	// Authorization
	r.POST("/authorize", h.Authorization.CheckPermission)
	r.GET("/permissions/user/:user_id", h.Authorization.GetUserPermissions)

	// Audit logs
	audits := r.Group("/audits")
	{
		audits.GET("", h.Audit.ListAudits)
		audits.GET("/:audit_id", h.Audit.GetAudit)
		audits.GET("/user/:user_id", h.Audit.GetUserAudits)
	}
}
