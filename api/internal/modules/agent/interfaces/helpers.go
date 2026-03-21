// Package agenthandler — helpers.go
// Shared utilities for all handlers in this package.
package agenthandler

import (
	"encoding/json"
	"net/http"
)

type errorDetail struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type responseEnvelope struct {
	Status   string         `json:"status"`
	Resource string         `json:"resource,omitempty"`
	Action   string         `json:"action,omitempty"`
	Item     any            `json:"item,omitempty"`
	Items    any            `json:"items,omitempty"`
	Command  any            `json:"command,omitempty"`
	Result   any            `json:"result,omitempty"`
	Meta     map[string]any `json:"meta,omitempty"`
	Error    *errorDetail   `json:"error,omitempty"`
}

func itemEnvelope(status, resource string, item any, meta map[string]any) responseEnvelope {
	return responseEnvelope{Status: status, Resource: resource, Item: item, Meta: meta}
}

func listEnvelope(status, resource string, items any, meta map[string]any) responseEnvelope {
	return responseEnvelope{Status: status, Resource: resource, Items: items, Meta: meta}
}

func actionEnvelope(status, resource, action string, command, result any, meta map[string]any) responseEnvelope {
	return responseEnvelope{Status: status, Resource: resource, Action: action, Command: command, Result: result, Meta: meta}
}

func errorEnvelope(resource, action, code, message string, details map[string]any) responseEnvelope {
	return responseEnvelope{
		Status:   "error",
		Resource: resource,
		Action:   action,
		Error: &errorDetail{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, code int, v any) {
	if payload, ok := normalizeLegacyErrorEnvelope(v); ok {
		v = payload
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, statusCode int, resource, action, code, message string, details map[string]any) {
	writeJSON(w, statusCode, errorEnvelope(resource, action, code, message, details))
}

func normalizeLegacyErrorEnvelope(v any) (responseEnvelope, bool) {
	switch payload := v.(type) {
	case map[string]string:
		if msg, ok := payload["error"]; ok {
			return errorEnvelope("", "", "request_failed", msg, nil), true
		}
	case map[string]any:
		if raw, ok := payload["error"]; ok {
			if msg, ok := raw.(string); ok {
				return errorEnvelope("", "", "request_failed", msg, nil), true
			}
		}
	}
	return responseEnvelope{}, false
}
