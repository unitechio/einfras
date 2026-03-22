package apierrors

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Detail struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type Envelope struct {
	Status   string  `json:"status"`
	Resource string  `json:"resource,omitempty"`
	Action   string  `json:"action,omitempty"`
	Error    *Detail `json:"error,omitempty"`
}

type Error struct {
	StatusCode int
	Code       string
	Message    string
	Details    map[string]any
	Err        error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	if e.Err != nil {
		return e.Err.Error()
	}
	return "request failed"
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func New(statusCode int, code, message string, details map[string]any) *Error {
	return &Error{
		StatusCode: statusCode,
		Code:       code,
		Message:    message,
		Details:    cloneDetails(details),
	}
}

func Wrap(statusCode int, code, message string, err error, details map[string]any) *Error {
	return &Error{
		StatusCode: statusCode,
		Code:       code,
		Message:    message,
		Details:    cloneDetails(details),
		Err:        err,
	}
}

func Internal(message string) *Error {
	return New(http.StatusInternalServerError, "internal_error", message, nil)
}

func From(err error, fallbackStatus int, fallbackCode, fallbackMessage string, fallbackDetails map[string]any) *Error {
	if err == nil {
		return nil
	}
	var target *Error
	if errors.As(err, &target) {
		if target.StatusCode == 0 {
			target.StatusCode = fallbackStatus
		}
		if target.Code == "" {
			target.Code = fallbackCode
		}
		if target.Message == "" {
			target.Message = fallbackMessage
		}
		if len(target.Details) == 0 && len(fallbackDetails) > 0 {
			target.Details = cloneDetails(fallbackDetails)
		}
		return target
	}
	return Wrap(fallbackStatus, fallbackCode, fallbackMessageOrError(fallbackMessage, err), err, fallbackDetails)
}

func EnvelopeFor(resource, action string, err error, fallbackStatus int, fallbackCode, fallbackMessage string, fallbackDetails map[string]any) (int, Envelope) {
	apiErr := From(err, fallbackStatus, fallbackCode, fallbackMessage, fallbackDetails)
	statusCode := fallbackStatus
	if apiErr != nil && apiErr.StatusCode > 0 {
		statusCode = apiErr.StatusCode
	}
	return statusCode, Envelope{
		Status:   "error",
		Resource: resource,
		Action:   action,
		Error: &Detail{
			Code:    apiErr.Code,
			Message: apiErr.Message,
			Details: cloneDetails(apiErr.Details),
		},
	}
}

func Write(w http.ResponseWriter, resource, action string, err error, fallbackStatus int, fallbackCode, fallbackMessage string, fallbackDetails map[string]any) {
	statusCode, payload := EnvelopeFor(resource, action, err, fallbackStatus, fallbackCode, fallbackMessage, fallbackDetails)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(payload)
}

func cloneDetails(details map[string]any) map[string]any {
	if len(details) == 0 {
		return nil
	}
	cloned := make(map[string]any, len(details))
	for key, value := range details {
		cloned[key] = value
	}
	return cloned
}

func fallbackMessageOrError(message string, err error) string {
	if message != "" {
		return message
	}
	if err != nil {
		return err.Error()
	}
	return "request failed"
}
