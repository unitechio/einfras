//go:build legacy
// +build legacy

package middleware

// import (
// 	"context"
// 	"fmt"
// 	"einfra/api/internal/shared/platform/logger"

// 	"github.com/gin-gonic/gin"
// )

// // contextKey is a private type to prevent collisions with other context keys.
// // This avoids staticcheck error: SA1029: should not use built-in type string as key for value; define your own type to avoid collisions
// type contextKey string

// const (
// 	// EndpointKey is the context key for the endpoint pattern.
// 	EndpointKey contextKey = "endpoint"
// )

// // WithEndpoint is a middleware that adds the endpoint pattern to the context.
// // This is useful for logging and metrics to have a consistent endpoint name.
// func WithEndpoint(endpoint string) gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		ctx := context.WithValue(c.Request.Context(), EndpointKey, endpoint)
// 		c.Request = c.Request.WithContext(ctx)
// 		c.Next()
// 	}
// }

// // DeprecationOptions holds configuration for the Deprecated middleware.
// type DeprecationOptions struct {
// 	Since       string // Version or date since the endpoint is deprecated.
// 	NewEndpoint string // The new endpoint that should be used instead.
// }

// // Deprecated returns a middleware that adds a "Warning" header for deprecated endpoints
// // and logs the usage of the deprecated endpoint.
// func Deprecated(log logger.Logger, opts DeprecationOptions) gin.HandlerFunc {
// 	return func(c *gin.Context) {
// 		// Set Warning header according to RFC 7234, section 5.5
// 		// 299 - Miscellaneous Persistent Warning
// 		warningValue := fmt.Sprintf(`299 - "%s" is deprecated`, c.Request.URL.Path)
// 		if opts.Since != "" {
// 			warningValue += fmt.Sprintf(" since %s", opts.Since)
// 		}
// 		if opts.NewEndpoint != "" {
// 			warningValue += fmt.Sprintf(". Please use '%s' instead", opts.NewEndpoint)
// 		}
// 		c.Header("Warning", warningValue)

// 		// Log the deprecated endpoint call
// 		log.Warn(c.Request.Context(), "Deprecated endpoint called",
// 			logger.LogField{Key: "component", Value: "http"},
// 			logger.LogField{Key: "http.request.method", Value: c.Request.Method},
// 			logger.LogField{Key: "http.request.path", Value: c.Request.URL.Path},
// 			logger.LogField{Key: "deprecation.since", Value: opts.Since},
// 			logger.LogField{Key: "deprecation.new_endpoint", Value: opts.NewEndpoint},
// 		)

// 		c.Next()
// 	}
// }
