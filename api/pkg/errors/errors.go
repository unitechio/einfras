package errors

import (
	"fmt"
	"runtime"

	"github.com/google/uuid"
)

const (
	CodeOK = 200

	CodeBadRequest          = 400 // Invalid request format or parameters
	CodeUnauthorized        = 401 // Authentication required or failed
	CodeForbidden           = 403 // Authenticated but not authorized
	CodeNotFound            = 404 // Resource not found
	CodeConflict            = 409 // Resource conflict (e.g., duplicate)
	CodeUnprocessableEntity = 422 // Validation failed
	CodeTooManyRequests     = 429 // Rate limit exceeded

	CodeInternalError      = 500 // Internal server error
	CodeNotImplemented     = 501 // Feature not implemented
	CodeServiceUnavailable = 503 // Service temporarily unavailable
	CodeGatewayTimeout     = 504 // Gateway timeout
)

// Error represents a custom error with additional context.
type Error struct {
	Code    int
	Message string
	TraceID string
	Stack   string
}

// Error returns the string representation of the error.
func (e *Error) Error() string {
	return fmt.Sprintf("code: %d, message: %s, traceID: %s", e.Code, e.Message, e.TraceID)
}

// New creates a new Error with a unique trace ID.
func New(code int, message string) *Error {
	return &Error{
		Code:    code,
		Message: message,
		TraceID: uuid.New().String(),
	}
}

// Wrap wraps an existing error with additional context
func Wrap(err error, code int, message string) *Error {
	if err == nil {
		return nil
	}

	return &Error{
		Code:    code,
		Message: message + ": " + err.Error(),
		TraceID: uuid.New().String(),
	}
}

// GetCode safely extracts the error code from an error
// Returns 0 if the error is not an errorx.Error
func GetCode(err error) int {
	if e, ok := err.(*Error); ok {
		return e.Code
	}
	return 0
}

// WithStack adds a stack trace to the error.
func (e *Error) WithStack() *Error {
	buf := make([]byte, 1<<16)
	length := runtime.Stack(buf, false)
	e.Stack = string(buf[:length])
	return e
}
