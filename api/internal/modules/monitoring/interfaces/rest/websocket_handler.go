//go:build legacy
// +build legacy

package handler

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/domain"
	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/socket"
)

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	hub *socket.Hub
	cfg *config.Config
	jwt *auth.JWTService
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(hub *socket.Hub, cfg *config.Config, jwt *auth.JWTService) *WebSocketHandler {
	return &WebSocketHandler{
		hub: hub,
		cfg: cfg,
		jwt: jwt,
	}
}

// HandleWebSocket handles WebSocket upgrade requests
// @Summary WebSocket connection endpoint
// @Description Establishes a WebSocket connection for real-time notifications
// @Tags WebSocket
// @Security BearerAuth
// @Param Authorization header string true "Bearer token"
// @Success 101 {string} string "Switching Protocols"
// @Failure 401 {object} map[string]interface{} "Unauthorized"
// @Failure 500 {object} map[string]interface{} "Internal Server Error"
// @Router /ws [get]
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Extract token from Authorization header or query parameter
	token := h.extractToken(c)
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Missing authentication token",
		})
		return
	}

	// Validate token and extract user ID
	claims, err := h.jwt.ValidateAccessToken(token)
	if err != nil {
		log.Printf("WebSocket authentication failed: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid authentication token",
		})
		return
	}

	userID := claims.UserID
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID in token",
		})
		return
	}

	// Upgrade HTTP connection to WebSocket
	socket.ServeWs(h.hub, c.Writer, c.Request, userID)
}

// extractToken extracts JWT token from Authorization header or query parameter
func (h *WebSocketHandler) extractToken(c *gin.Context) string {
	// Try to get token from Authorization header
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		// Expected format: "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
	}

	// Fallback to query parameter (useful for WebSocket clients that can't set headers)
	token := c.Query("token")
	if token != "" {
		return token
	}

	return ""
}

// GetStats returns WebSocket connection statistics
// @Summary Get WebSocket statistics
// @Description Returns statistics about active WebSocket connections
// @Tags WebSocket
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /ws/stats [get]
func (h *WebSocketHandler) GetStats(c *gin.Context) {
	stats := h.hub.GetStats()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}
