//go:build legacy
// +build legacy

package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"
	"einfra/api/pkg/errorx"
)

// ErrorHandler is a middleware to handle errors encountered during requests.
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			for _, ginErr := range c.Errors {
				switch err := ginErr.Err.(type) {
				case *errorx.Error:
					log.Error().
						Str("traceId", err.TraceID).
						Str("stack", err.Stack).
						Msg(err.Message)
					c.JSON(err.Code, gin.H{"error": err.Message, "traceId": err.TraceID})
				case validator.ValidationErrors:
					validationMessages := make(map[string]string)
					for _, fieldErr := range err {
						validationMessages[fieldErr.Field()] = formatValidationError(fieldErr)
					}
					c.JSON(http.StatusBadRequest, gin.H{
						"error":  "Validation failed",
						"fields": validationMessages,
					})
				default:
					// For any other error, create a generic internal server error with a stack trace.
					appErr := errorx.New(http.StatusInternalServerError, "An unexpected error occurred").WithStack()
					log.Error().
						Str("traceId", appErr.TraceID).
						Str("stack", appErr.Stack).
						Msg(appErr.Message)
					c.JSON(appErr.Code, gin.H{"error": appErr.Message, "traceId": appErr.TraceID})
				}
				return // Stop processing after handling the first error
			}
		}
	}
}

// formatValidationError creates a user-friendly message for a validation error.
func formatValidationError(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return "This field is required."
	case "email":
		return "Please provide a valid email address."
	case "min":
		return "This field must be at least " + err.Param() + " characters long."
	case "max":
		return "This field must not exceed " + err.Param() + " characters."
	case "gte":
		return "This field must be greater than or equal to " + err.Param() + "."
	case "lte":
		return "This field must be less than or equal to " + err.Param() + "."
	default:
		return "This field is invalid."
	}
}
