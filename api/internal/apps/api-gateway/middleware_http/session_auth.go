//go:build legacy
// +build legacy

package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/apps/api-gateway/session"
)

// SessionAuthMiddleware validates the user session.
func SessionAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		sess, err := session.Store.Get(c.Request, session.SessionName)
		if err != nil {
			// If the cookie can't be parsed, it might be tampered with.
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid session cookie"})
			return
		}

		// Check if the user ID is present in the session.
		userID, ok := sess.Values[session.UserIDKey].(string)
		if !ok || userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized - no user in session"})
			return
		}

		// Get user role, default to a standard role if not present.
		userRole, ok := sess.Values[session.UserRoleKey].(string)
		if !ok {
			userRole = "user" // Or whatever default role you have
		}

		// Set user info in the context for downstream handlers.
		c.Set("userID", userID)
		c.Set("userRole", userRole)

		c.Next()
	}
}
