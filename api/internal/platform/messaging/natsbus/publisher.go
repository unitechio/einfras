package natsbus

import (
	"time"

	"einfra/api/internal/shared/events"
)

type Publisher struct {
	bus *Bus
}

func NewPublisher(bus *Bus) *Publisher {
	return &Publisher{bus: bus}
}

func (p *Publisher) CommandDispatched(e events.CommandDispatchedEvent) {
	e.DispatchedAt = time.Now()
	p.bus.PublishAsync(events.SubjectCommandDispatched, e)
}

func (p *Publisher) CommandDone(e events.CommandDoneEvent) {
	e.DoneAt = time.Now()
	p.bus.PublishAsync(events.SubjectCommandDone, e)
}

func (p *Publisher) CommandFailed(e events.CommandFailedEvent) {
	e.FailedAt = time.Now()
	p.bus.PublishAsync(events.SubjectCommandFailed, e)
}

func (p *Publisher) AgentOnline(orgID, serverID, transport string) {
	p.bus.PublishAsync(events.SubjectAgentOnline, events.AgentOnlineEvent{
		OrgID:     orgID,
		ServerID:  serverID,
		Transport: transport,
		OnlineAt:  time.Now(),
	})
}

func (p *Publisher) AgentOffline(orgID, serverID string) {
	p.bus.PublishAsync(events.SubjectAgentOffline, events.AgentOfflineEvent{
		OrgID:     orgID,
		ServerID:  serverID,
		OfflineAt: time.Now(),
	})
}

func (p *Publisher) AgentMetrics(e events.AgentMetricsEvent) {
	e.RecordedAt = time.Now()
	p.bus.PublishAsync(events.SubjectAgentMetrics, e)
}

func (p *Publisher) ServerCreated(e events.ServerCreatedEvent) {
	e.CreatedAt = time.Now()
	p.bus.PublishAsync(events.SubjectServerCreated, e)
}

func (p *Publisher) OrgCreated(e events.OrgCreatedEvent) {
	e.CreatedAt = time.Now()
	p.bus.PublishAsync(events.SubjectOrgCreated, e)
}

func (p *Publisher) BillingUsage(e events.BillingUsageEvent) {
	e.RecordedAt = time.Now()
	p.bus.PublishAsync(events.SubjectBillingUsage, e)
}
