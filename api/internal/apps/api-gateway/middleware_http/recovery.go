package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
)

// RecoveryMiddleware recovers from panics and returns 500 error
func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log the error and stack trace
				stack := debug.Stack()
				fmt.Printf("[PANIC RECOVERED] %v\n%s\n", err, stack)

				// TODO: Send to error tracking service (Sentry, etc.)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Internal server error",
					"code":  "INTERNAL_ERROR",
				})
				c.Abort()
			}
		}()

		c.Next()
	}
}

// RecoveryMiddlewareWithLogger recovers from panics with custom logger
func RecoveryMiddlewareWithLogger(logger interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				stack := debug.Stack()

				// Log with custom logger
				// TODO: Implement proper logging
				fmt.Printf("[PANIC RECOVERED] %v\n%s\n", err, stack)

				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Internal server error",
					"code":  "INTERNAL_ERROR",
				})
				c.Abort()
			}
		}()

		c.Next()
	}
}
