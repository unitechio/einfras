package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func PermissionMiddleware(requiredPermission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissionsInterface, exists := c.Get("permissions")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "No permissions found",
				"code":  "NO_PERMISSIONS",
			})
			c.Abort()
			return
		}

		permissions, ok := permissionsInterface.([]string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid permissions format",
				"code":  "INVALID_PERMISSIONS",
			})
			c.Abort()
			return
		}

		hasPermission := false
		for _, perm := range permissions {
			if perm == requiredPermission || perm == "*" {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{
				"error":               "Insufficient permissions",
				"code":                "INSUFFICIENT_PERMISSIONS",
				"required_permission": requiredPermission,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func RoleMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleNameInterface, exists := c.Get("role_name")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "No role found",
				"code":  "NO_ROLE",
			})
			c.Abort()
			return
		}

		roleName, ok := roleNameInterface.(string)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Invalid role format",
				"code":  "INVALID_ROLE",
			})
			c.Abort()
			return
		}

		if roleName != requiredRole && roleName != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "Insufficient role",
				"code":          "INSUFFICIENT_ROLE",
				"required_role": requiredRole,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return "", false
	}
	id, ok := userID.(string)
	return id, ok
}

func GetUsername(c *gin.Context) (string, bool) {
	username, exists := c.Get("username")
	if !exists {
		return "", false
	}
	name, ok := username.(string)
	return name, ok
}

func GetPermissions(c *gin.Context) ([]string, bool) {
	permissions, exists := c.Get("permissions")
	if !exists {
		return nil, false
	}
	perms, ok := permissions.([]string)
	return perms, ok
}

func HasPermission(c *gin.Context, permission string) bool {
	permissions, ok := GetPermissions(c)
	if !ok {
		return false
	}

	for _, perm := range permissions {
		if perm == permission || perm == "*" {
			return true
		}
	}
	return false
}
