package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/domain"
	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/repository"
)

func AuthMiddleware(jwtService *auth.JWTService, cfg config.Config, authRepo repository.AuthRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
				"code":  "AUTH_HEADER_MISSING",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
				"code":  "INVALID_AUTH_HEADER",
			})
			c.Abort()
			return
		}

		token := parts[1]

		claims, err := jwtService.ValidateAccessToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
				"code":  "INVALID_TOKEN",
			})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("role_id", claims.RoleID)
		c.Set("role_name", claims.RoleName)
		c.Set("permissions", claims.Permissions)

		c.Next()
	}
}

func OptionalAuthMiddleware(jwtService *auth.JWTService, cfg config.Config, authRepo repository.AuthRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}

		token := parts[1]
		claims, err := jwtService.ValidateAccessToken(token)
		if err == nil {
			c.Set("user_id", claims.UserID)
			c.Set("username", claims.Username)
			c.Set("email", claims.Email)
			c.Set("role_id", claims.RoleID)
			c.Set("role_name", claims.RoleName)
			c.Set("permissions", claims.Permissions)
		}

		c.Next()
	}
}

// SetUserContext sets user context for downstream services
func SetUserContext(c *gin.Context, ctx context.Context) context.Context {
	if userID, ok := GetUserID(c); ok {
		ctx = context.WithValue(ctx, "user_id", userID)
	}
	if username, ok := GetUsername(c); ok {
		ctx = context.WithValue(ctx, "username", username)
	}
	return ctx
}
