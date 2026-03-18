package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

const (
	// UserIDKey is the key used to store the user's ID in the Gin context
	UserIDKey = "userID"
)

// AuthorizationMiddleware provides middleware functions for authorization
type AuthorizationMiddleware struct {
	authUsecase domain.AuthorizationUsecase
}

// NewAuthorizationMiddleware creates a new authorization middleware
func NewAuthorizationMiddleware(authUsecase domain.AuthorizationUsecase) *AuthorizationMiddleware {
	return &AuthorizationMiddleware{
		authUsecase: authUsecase,
	}
}

// RequirePermission creates a middleware that checks if the user has a specific permission
func (m *AuthorizationMiddleware) RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by authentication middleware)
		userID, exists := c.Get(UserIDKey)
		if !exists {
			c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user ID format",
			})
			return
		}

		// Check permission
		hasPermission, err := m.authUsecase.CheckPermission(c.Request.Context(), userIDStr, permission)
		if err != nil {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to check permission"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to check permission",
			})
			return
		}

		if !hasPermission {
			c.Error(errorx.New(errorx.CodeForbidden, "Insufficient permissions"))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":      "Forbidden: You do not have the required permission",
				"permission": permission,
			})
			return
		}

		c.Next()
	}
}

// RequireEnvironmentPermission creates a middleware that checks permission in a specific environment
// envExtractor is a function that extracts the environment ID from the request
func (m *AuthorizationMiddleware) RequireEnvironmentPermission(permission string, envExtractor func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(UserIDKey)
		if !exists {
			c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user ID format",
			})
			return
		}

		// Extract environment ID
		environmentID := envExtractor(c)
		if environmentID == "" {
			c.Error(errorx.New(errorx.CodeBadRequest, "Environment ID not provided"))
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Environment ID is required",
			})
			return
		}

		// Check environment permission
		hasPermission, err := m.authUsecase.CheckEnvironmentPermission(c.Request.Context(), userIDStr, permission, environmentID)
		if err != nil {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to check permission"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to check permission",
			})
			return
		}

		if !hasPermission {
			c.Error(errorx.New(errorx.CodeForbidden, "Insufficient permissions"))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":          "Forbidden: You do not have the required permission in this environment",
				"permission":     permission,
				"environment_id": environmentID,
			})
			return
		}

		c.Next()
	}
}

// RequireResourcePermission creates a middleware that checks permission on a specific resource
// resourceTypeExtractor extracts the resource type from the request
// resourceIDExtractor extracts the resource ID from the request
// action is the action being performed (e.g., "read", "update", "delete")
func (m *AuthorizationMiddleware) RequireResourcePermission(
	resourceTypeExtractor func(*gin.Context) domain.ResourceType,
	resourceIDExtractor func(*gin.Context) string,
	action string,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(UserIDKey)
		if !exists {
			c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user ID format",
			})
			return
		}

		// Extract resource type and ID
		resourceType := resourceTypeExtractor(c)
		resourceID := resourceIDExtractor(c)
		if resourceID == "" {
			c.Error(errorx.New(errorx.CodeBadRequest, "Resource ID not provided"))
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Resource ID is required",
			})
			return
		}

		// Check resource permission
		hasPermission, err := m.authUsecase.CheckResourcePermission(c.Request.Context(), userIDStr, resourceType, resourceID, action)
		if err != nil {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to check permission"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to check permission",
			})
			return
		}

		if !hasPermission {
			c.Error(errorx.New(errorx.CodeForbidden, "Insufficient permissions"))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":         "Forbidden: You do not have the required permission on this resource",
				"resource_type": resourceType,
				"resource_id":   resourceID,
				"action":        action,
			})
			return
		}

		c.Next()
	}
}

// RequireAnyPermission creates a middleware that checks if the user has at least one of the specified permissions
func (m *AuthorizationMiddleware) RequireAnyPermission(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(UserIDKey)
		if !exists {
			c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user ID format",
			})
			return
		}

		// Check if user has any of the permissions
		for _, permission := range permissions {
			hasPermission, err := m.authUsecase.CheckPermission(c.Request.Context(), userIDStr, permission)
			if err != nil {
				continue // Skip this permission and check the next one
			}
			if hasPermission {
				c.Next()
				return
			}
		}

		// User doesn't have any of the required permissions
		c.Error(errorx.New(errorx.CodeForbidden, "Insufficient permissions"))
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":       "Forbidden: You do not have any of the required permissions",
			"permissions": permissions,
		})
	}
}

// RequireAllPermissions creates a middleware that checks if the user has all of the specified permissions
func (m *AuthorizationMiddleware) RequireAllPermissions(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context
		userID, exists := c.Get(UserIDKey)
		if !exists {
			c.Error(errorx.New(errorx.CodeUnauthorized, "User not authenticated"))
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "User not authenticated",
			})
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			c.Error(errorx.New(errorx.CodeInternalError, "Invalid user ID format"))
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid user ID format",
			})
			return
		}

		// Check if user has all of the permissions
		missingPermissions := []string{}
		for _, permission := range permissions {
			hasPermission, err := m.authUsecase.CheckPermission(c.Request.Context(), userIDStr, permission)
			if err != nil || !hasPermission {
				missingPermissions = append(missingPermissions, permission)
			}
		}

		if len(missingPermissions) > 0 {
			c.Error(errorx.New(errorx.CodeForbidden, "Insufficient permissions"))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":               "Forbidden: You are missing required permissions",
				"missing_permissions": missingPermissions,
			})
			return
		}

		c.Next()
	}
}

// Helper functions for common extractors

// ExtractEnvFromQuery extracts environment ID from query parameter "environment_id"
func ExtractEnvFromQuery(c *gin.Context) string {
	return c.Query("environment_id")
}

// ExtractEnvFromParam extracts environment ID from URL parameter ":environment_id"
func ExtractEnvFromParam(c *gin.Context) string {
	return c.Param("environment_id")
}

// ExtractEnvFromBody extracts environment ID from JSON body field "environment_id"
func ExtractEnvFromBody(c *gin.Context) string {
	var body struct {
		EnvironmentID string `json:"environment_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		return ""
	}
	return body.EnvironmentID
}

// ExtractResourceIDFromParam creates an extractor for resource ID from URL parameter
func ExtractResourceIDFromParam(paramName string) func(*gin.Context) string {
	return func(c *gin.Context) string {
		return c.Param(paramName)
	}
}

// ExtractResourceTypeFromPath creates an extractor that determines resource type from the URL path
func ExtractResourceTypeFromPath(c *gin.Context) domain.ResourceType {
	path := c.Request.URL.Path
	if strings.Contains(path, "/servers/") {
		return domain.ResourceTypeServer
	} else if strings.Contains(path, "/k8s/clusters/") {
		return domain.ResourceTypeK8sCluster
	} else if strings.Contains(path, "/docker/containers/") {
		return domain.ResourceTypeDockerContainer
	} else if strings.Contains(path, "/harbor/projects/") {
		return domain.ResourceTypeHarborProject
	}
	return ""
}
