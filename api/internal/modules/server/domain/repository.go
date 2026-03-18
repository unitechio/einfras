package domain

import (
	"context"

	"github.com/google/uuid"
)

// ServerRepository abstracts the persistence layer for the Server Aggregate
type ServerRepository interface {
	Save(ctx context.Context, server *Server) error
	GetByID(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) (*Server, error)
	GetByIP(ctx context.Context, ip string, tenantID uuid.UUID) (*Server, error)
	ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*Server, error)
	Delete(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) error
}

// Ensure ONLY domain logic structures exist here.
// NO POSTGRESQL or GORM imports are allowed here.
