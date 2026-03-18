package workers

import (
	"context"
	"encoding/json"

	"github.com/rs/zerolog/log"

	"einfra/api/internal/domain"
	"einfra/api/internal/shared/events"
	"einfra/api/internal/shared/infra/messaging/natsbus"
)

type AuditWriter interface {
	Write(ctx context.Context, entry *domain.AuditLog) error
}

type AuditWorker struct {
	bus    *natsbus.Bus
	writer AuditWriter
}

func NewAuditWorker(bus *natsbus.Bus, writer AuditWriter) *AuditWorker {
	return &AuditWorker{bus: bus, writer: writer}
}

func (w *AuditWorker) Start() error {
	return w.bus.Subscribe(events.SubjectCommandDispatched, "audit-command-dispatched", w.handleCommandDispatched)
}

func (w *AuditWorker) handleCommandDispatched(ctx context.Context, data []byte) error {
	var e events.CommandDispatchedEvent
	if err := json.Unmarshal(data, &e); err != nil {
		return err
	}
	entry := &domain.AuditLog{
		OrgID:       ptrStr(e.OrgID),
		UserID:      ptrStr(e.UserID),
		Action:      domain.AuditActionCommandDispatch,
		Resource:    "server",
		ResourceID:  ptrStr(e.ServerID),
		Description: "Command dispatched: " + e.Cmd,
		Success:     true,
	}
	if err := w.writer.Write(ctx, entry); err != nil {
		log.Error().Err(err).Str("command_id", e.CommandID).Msg("[audit-worker] write failed")
		return err
	}
	return nil
}

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
