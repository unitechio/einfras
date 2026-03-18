package domain

import (
	"time"

	"github.com/google/uuid"
)

// Base DomainEvent interface
type DomainEvent interface {
	EventName() string
	AggregateID() uuid.UUID
	TenantID() uuid.UUID
	OccurredAt() time.Time
	Payload() interface{}
}

// Event Publisher Interface (Adapter implemented in infrastructure)
type EventPublisher interface {
	Publish(event DomainEvent) error
}

// ----------------------------------------------------
// Example: ServerCreatedEvent
// ----------------------------------------------------

type ServerCreatedEvent struct {
	eventName   string
	aggregateID uuid.UUID
	tenantID    uuid.UUID
	occurredAt  time.Time
	payload     map[string]interface{}
}

func NewServerCreatedEvent(server *Server) DomainEvent {
	return &ServerCreatedEvent{
		eventName:   "ServerCreated",
		aggregateID: server.ID,
		tenantID:    server.TenantID,
		occurredAt:  time.Now(),
		payload: map[string]interface{}{
			"name":       server.Name,
			"ip_address": server.IPAddress,
		},
	}
}

func (e *ServerCreatedEvent) EventName() string       { return e.eventName }
func (e *ServerCreatedEvent) AggregateID() uuid.UUID  { return e.aggregateID }
func (e *ServerCreatedEvent) TenantID() uuid.UUID     { return e.tenantID }
func (e *ServerCreatedEvent) OccurredAt() time.Time   { return e.occurredAt }
func (e *ServerCreatedEvent) Payload() interface{}    { return e.payload }

// ----------------------------------------------------
// Example: ServerStatusChangedEvent
// ----------------------------------------------------

type ServerStatusChangedEvent struct {
	eventName   string
	aggregateID uuid.UUID
	tenantID    uuid.UUID
	occurredAt  time.Time
	payload     map[string]interface{}
}

func NewServerStatusChangedEvent(server *Server, newStatus string) DomainEvent {
	return &ServerStatusChangedEvent{
		eventName:   "ServerStatusChanged",
		aggregateID: server.ID,
		tenantID:    server.TenantID,
		occurredAt:  time.Now(),
		payload: map[string]interface{}{
			"new_status": newStatus,
		},
	}
}

func (e *ServerStatusChangedEvent) EventName() string       { return e.eventName }
func (e *ServerStatusChangedEvent) AggregateID() uuid.UUID  { return e.aggregateID }
func (e *ServerStatusChangedEvent) TenantID() uuid.UUID     { return e.tenantID }
func (e *ServerStatusChangedEvent) OccurredAt() time.Time   { return e.occurredAt }
func (e *ServerStatusChangedEvent) Payload() interface{}    { return e.payload }
