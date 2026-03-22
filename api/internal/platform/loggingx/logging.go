package loggingx

import (
	"net/url"
	"strings"
	"sync"

	"github.com/rs/zerolog"
)

type EventLogger struct {
	component string
}

func New(component string) EventLogger {
	return EventLogger{component: strings.TrimSpace(component)}
}

func (l EventLogger) Info(base zerolog.Logger, event, serverID, status string, details map[string]any) {
	write(base.Info(), l.component, event, serverID, status, details)
}

func (l EventLogger) Debug(base zerolog.Logger, event, serverID, status string, details map[string]any) {
	write(base.Debug(), l.component, event, serverID, status, details)
}

func (l EventLogger) Warn(base zerolog.Logger, event, serverID, status string, details map[string]any) {
	write(base.Warn(), l.component, event, serverID, status, details)
}

func (l EventLogger) Error(base zerolog.Logger, event, serverID, status string, details map[string]any) {
	write(base.Error(), l.component, event, serverID, status, details)
}

func write(evt *zerolog.Event, component, event, serverID, status string, details map[string]any) {
	if evt == nil {
		return
	}
	if component != "" {
		evt = evt.Str("component", component)
	}
	if event != "" {
		evt = evt.Str("event", event)
	}
	if serverID != "" {
		evt = evt.Str("server_id", serverID)
	}
	if status != "" {
		evt = evt.Str("status", status)
	}
	if details == nil {
		details = map[string]any{}
	}
	evt.Interface("details", details).Send()
}

func NormalizeURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	decoded := strings.ReplaceAll(raw, `\u0026`, "&")
	decoded, err := url.QueryUnescape(decoded)
	if err != nil {
		return decoded
	}
	return decoded
}

func QueryDetails(values url.Values) map[string]any {
	out := make(map[string]any, len(values))
	for key, items := range values {
		if len(items) == 1 {
			out[key] = NormalizeURL(items[0])
			continue
		}
		normalized := make([]string, 0, len(items))
		for _, item := range items {
			normalized = append(normalized, NormalizeURL(item))
		}
		out[key] = normalized
	}
	return out
}

type StateTracker struct {
	mu     sync.Mutex
	states map[string]string
}

func NewStateTracker() *StateTracker {
	return &StateTracker{states: map[string]string{}}
}

func (t *StateTracker) Changed(key, state string) bool {
	if t == nil {
		return true
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if previous, ok := t.states[key]; ok && previous == state {
		return false
	}
	t.states[key] = state
	return true
}
