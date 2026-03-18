package middleware

import (
	"bytes"
	"io"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
)

// responseWriter wraps gin.ResponseWriter to capture response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// AuditLogMiddleware logs all requests to the audit log
func AuditLogMiddleware(auditUsecase usecase.AuditUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Record start time
		startTime := time.Now()

		// Get request body (for POST/PUT/PATCH)
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			// Restore the body for downstream handlers
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// Wrap response writer to capture response
		blw := &responseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBufferString(""),
		}
		c.Writer = blw

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(startTime).Milliseconds()

		// Get user information from context
		userID, _ := GetUserID(c)
		username, _ := GetUsername(c)

		// Determine action based on HTTP method
		var action domain.AuditAction
		switch c.Request.Method {
		case "POST":
			action = domain.AuditActionCreate
		case "PUT", "PATCH":
			action = domain.AuditActionUpdate
		case "DELETE":
			action = domain.AuditActionDelete
		default:
			action = domain.AuditActionRead
		}

		// Extract resource from path
		resource := extractResourceFromPath(c.Request.URL.Path)

		// Create audit log entry
		auditLog := &domain.AuditLog{
			UserID:        &userID,
			Username:      username,
			Action:        action,
			Resource:      resource,
			Description:   generateDescription(c.Request.Method, c.Request.URL.Path),
			IPAddress:     c.ClientIP(),
			UserAgent:     c.Request.UserAgent(),
			RequestMethod: c.Request.Method,
			RequestPath:   c.Request.URL.Path,
			StatusCode:    c.Writer.Status(),
			Duration:      duration,
			Success:       c.Writer.Status() < 400,
		}

		// Add error message if request failed
		if c.Writer.Status() >= 400 {
			auditLog.ErrorMessage = blw.body.String()
		}

		// Log asynchronously to avoid blocking the request
		go func() {
			_ = auditUsecase.Log(c.Request.Context(), auditLog)
		}()
	}
}

// AuditLogMiddlewareWithFilter logs requests with custom filtering
func AuditLogMiddlewareWithFilter(auditUsecase usecase.AuditUsecase, shouldLog func(*gin.Context) bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !shouldLog(c) {
			c.Next()
			return
		}

		startTime := time.Now()

		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		blw := &responseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBufferString(""),
		}
		c.Writer = blw

		c.Next()

		duration := time.Since(startTime).Milliseconds()
		userID, _ := GetUserID(c)
		username, _ := GetUsername(c)

		var action domain.AuditAction
		switch c.Request.Method {
		case "POST":
			action = domain.AuditActionCreate
		case "PUT", "PATCH":
			action = domain.AuditActionUpdate
		case "DELETE":
			action = domain.AuditActionDelete
		default:
			action = domain.AuditActionRead
		}

		resource := extractResourceFromPath(c.Request.URL.Path)

		auditLog := &domain.AuditLog{
			UserID:        &userID,
			Username:      username,
			Action:        action,
			Resource:      resource,
			Description:   generateDescription(c.Request.Method, c.Request.URL.Path),
			IPAddress:     c.ClientIP(),
			UserAgent:     c.Request.UserAgent(),
			RequestMethod: c.Request.Method,
			RequestPath:   c.Request.URL.Path,
			StatusCode:    c.Writer.Status(),
			Duration:      duration,
			Success:       c.Writer.Status() < 400,
		}

		if c.Writer.Status() >= 400 {
			auditLog.ErrorMessage = blw.body.String()
		}

		go func() {
			_ = auditUsecase.Log(c.Request.Context(), auditLog)
		}()
	}
}

// extractResourceFromPath extracts the resource name from the request path
func extractResourceFromPath(path string) string {
	// Simple extraction: /api/servers/123 -> servers
	// /api/docker/hosts -> docker
	parts := splitPath(path)
	if len(parts) >= 2 && parts[0] == "api" {
		return parts[1]
	}
	if len(parts) >= 1 {
		return parts[0]
	}
	return "unknown"
}

// splitPath splits a path into parts
func splitPath(path string) []string {
	var parts []string
	current := ""
	for _, char := range path {
		if char == '/' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// generateDescription generates a human-readable description
func generateDescription(method, path string) string {
	resource := extractResourceFromPath(path)
	switch method {
	case "POST":
		return "Created " + resource
	case "PUT", "PATCH":
		return "Updated " + resource
	case "DELETE":
		return "Deleted " + resource
	case "GET":
		return "Viewed " + resource
	default:
		return method + " " + path
	}
}
