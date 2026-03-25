//go:build legacy
// +build legacy

package workers

import (
	"context"
	"encoding/json"

	"github.com/rs/zerolog/log"

	"einfra/api/internal/shared/events"
	"einfra/api/internal/shared/infra/messaging/natsbus"
)

type BillingStore interface {
	RecordUsage(ctx context.Context, orgID, serverID, resource string, units float64) error
}

type BillingWorker struct {
	bus   *natsbus.Bus
	store BillingStore
}

func NewBillingWorker(bus *natsbus.Bus, store BillingStore) *BillingWorker {
	return &BillingWorker{bus: bus, store: store}
}

func (w *BillingWorker) Start() error {
	return w.bus.Subscribe(events.SubjectBillingUsage, "billing-usage", w.handle)
}

func (w *BillingWorker) handle(ctx context.Context, data []byte) error {
	var e events.BillingUsageEvent
	if err := json.Unmarshal(data, &e); err != nil {
		return err
	}
	if err := w.store.RecordUsage(ctx, e.OrgID, e.ServerID, e.Resource, e.Units); err != nil {
		log.Error().Err(err).Str("org_id", e.OrgID).Msg("[billing-worker] record usage failed")
		return err
	}
	return nil
}
