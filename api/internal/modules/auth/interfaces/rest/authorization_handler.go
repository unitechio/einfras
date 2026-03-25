//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

// AuthorizationHandler handles authorization management HTTP requests
type AuthorizationHandler struct {
	authUsecase domain.AuthorizationUsecase
}

// NewAuthorizationHandler creates a new authorization handler
func NewAuthorizationHandler(authUsecase domain.AuthorizationUsecase) *AuthorizationHandler {
	return &AuthorizationHandler{
		authUsecase: authUsecase,
	}
}

// GrantResourcePermission grants a resource permission to a user
// @Summary Grant resource permission
// @Description Grant a user permission to perform specific actions on a resource
// @Tags authorization
// @Accept json
// @Produce json
// @Param request body domain.GrantPermissionRequest true "Grant permission request"
// @Success 200 {object} map[string]interface{} "Permission granted successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 404 {object} map[string]interface{} "User, environment, or resource not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/grant [post]
// @Security BearerAuth
func (h *AuthorizationHandler) GrantResourcePermission(c *gin.Context) {
	var req domain.GrantPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get the current user ID from context (who is granting the permission)
	grantedBy, exists := c.Get("userID")
	if !exists {
		c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	grantedByStr, ok := grantedBy.(string)
	if !ok {
		c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	if err := h.authUsecase.GrantResourcePermission(c.Request.Context(), &req, grantedByStr); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to grant permission"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to grant permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Permission granted successfully",
	})
}

// RevokeResourcePermission revokes a resource permission from a user
// @Summary Revoke resource permission
// @Description Revoke a previously granted resource permission
// @Tags authorization
// @Accept json
// @Produce json
// @Param request body domain.RevokePermissionRequest true "Revoke permission request"
// @Success 200 {object} map[string]interface{} "Permission revoked successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 404 {object} map[string]interface{} "Permission not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/revoke [post]
// @Security BearerAuth
func (h *AuthorizationHandler) RevokeResourcePermission(c *gin.Context) {
	var req domain.RevokePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get the current user ID from context (who is revoking the permission)
	revokedBy, exists := c.Get("userID")
	if !exists {
		c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	revokedByStr, ok := revokedBy.(string)
	if !ok {
		c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	if err := h.authUsecase.RevokeResourcePermission(c.Request.Context(), &req, revokedByStr); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to revoke permission"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke permission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Permission revoked successfully",
	})
}

// AssignEnvironmentRole assigns a role to a user in a specific environment
// @Summary Assign environment role
// @Description Assign a role to a user for a specific environment or globally
// @Tags authorization
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Assignment request with user_id, role_id, and optional environment_id"
// @Success 200 {object} map[string]interface{} "Role assigned successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 404 {object} map[string]interface{} "User, role, or environment not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/assign-role [post]
// @Security BearerAuth
func (h *AuthorizationHandler) AssignEnvironmentRole(c *gin.Context) {
	var req struct {
		UserID        string  `json:"user_id" binding:"required"`
		RoleID        string  `json:"role_id" binding:"required"`
		EnvironmentID *string `json:"environment_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get the current user ID from context (who is assigning the role)
	assignedBy, exists := c.Get("userID")
	if !exists {
		c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	assignedByStr, ok := assignedBy.(string)
	if !ok {
		c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	if err := h.authUsecase.AssignEnvironmentRole(c.Request.Context(), req.UserID, req.RoleID, req.EnvironmentID, assignedByStr); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to assign role"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Role assigned successfully",
	})
}

// RemoveEnvironmentRole removes an environment role assignment
// @Summary Remove environment role
// @Description Remove a user's role assignment for a specific environment
// @Tags authorization
// @Produce json
// @Param id path string true "User Environment Role ID (UUID)"
// @Success 200 {object} map[string]interface{} "Role removed successfully"
// @Failure 400 {object} map[string]interface{} "Invalid ID"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/environment-roles/{id} [delete]
// @Security BearerAuth
func (h *AuthorizationHandler) RemoveEnvironmentRole(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Role assignment ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role assignment ID is required"})
		return
	}

	if err := h.authUsecase.RemoveEnvironmentRole(c.Request.Context(), id); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to remove role"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Role removed successfully",
	})
}

// GetUserPermissions retrieves all permissions for a user
// @Summary Get user permissions
// @Description Retrieve all permissions (global, environment-specific, and resource-specific) for a user
// @Tags authorization
// @Produce json
// @Param user_id path string true "User ID (UUID)"
// @Success 200 {object} map[string]interface{} "User permissions"
// @Failure 400 {object} map[string]interface{} "Invalid user ID"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/users/{user_id}/permissions [get]
// @Security BearerAuth
func (h *AuthorizationHandler) GetUserPermissions(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "User ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	permissions, err := h.authUsecase.ListUserPermissions(c.Request.Context(), userID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to retrieve permissions"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Permissions retrieved successfully",
		"permissions": permissions,
	})
}

// GetResourcePermissions retrieves all permissions for a specific resource
// @Summary Get resource permissions
// @Description Retrieve all user permissions for a specific resource
// @Tags authorization
// @Produce json
// @Param resource_type path string true "Resource type (server, k8s_cluster, etc.)"
// @Param resource_id path string true "Resource ID"
// @Success 200 {object} map[string]interface{} "Resource permissions"
// @Failure 400 {object} map[string]interface{} "Invalid parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/resources/{resource_type}/{resource_id}/permissions [get]
// @Security BearerAuth
func (h *AuthorizationHandler) GetResourcePermissions(c *gin.Context) {
	resourceType := c.Param("resource_type")
	resourceID := c.Param("resource_id")

	if resourceType == "" || resourceID == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Resource type and ID are required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resource type and ID are required"})
		return
	}

	permissions, err := h.authUsecase.ListResourcePermissions(c.Request.Context(), domain.ResourceType(resourceType), resourceID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to retrieve permissions"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Permissions retrieved successfully",
		"permissions": permissions,
	})
}

// CleanupExpiredPermissions removes expired resource permissions
// @Summary Cleanup expired permissions
// @Description Remove all resource permissions that have expired
// @Tags authorization
// @Produce json
// @Success 200 {object} map[string]interface{} "Cleanup completed"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/cleanup [post]
// @Security BearerAuth
func (h *AuthorizationHandler) CleanupExpiredPermissions(c *gin.Context) {
	count, err := h.authUsecase.CleanupExpiredPermissions(c.Request.Context())
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to cleanup permissions"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cleanup permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Cleanup completed successfully",
		"deleted_count": count,
	})
}
