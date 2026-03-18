package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"einfra/api/internal/modules/server/domain"
)

type PostgresServerRepository struct {
	// DB logic would be inside here using standard libraries, e.g., sql.DB or Gorm.
	// For simulation:
	db map[uuid.UUID]*domain.Server
}

func NewPostgresServerRepository() domain.ServerRepository {
	return &PostgresServerRepository{
		db: make(map[uuid.UUID]*domain.Server),
	}
}

func (r *PostgresServerRepository) Save(ctx context.Context, server *domain.Server) error {
	// e.g: db.Exec("INSERT INTO servers ...")
	r.db[server.ID] = server
	return nil
}

func (r *PostgresServerRepository) GetByID(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) (*domain.Server, error) {
	// Ensure isolated tenant
	// SELECT * FROM servers WHERE id = ? AND tenant_id = ?
	server, exists := r.db[id]
	if !exists || server.TenantID != tenantID {
		return nil, errors.New("server not found")
	}
	return server, nil
}

func (r *PostgresServerRepository) GetByIP(ctx context.Context, ip string, tenantID uuid.UUID) (*domain.Server, error) {
	for _, s := range r.db {
		if s.IPAddress == ip && s.TenantID == tenantID {
			return s, nil
		}
	}
	return nil, nil // Not found is not an error here, logic handles it.
}

func (r *PostgresServerRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Server, error) {
	var result []*(domain.Server)
	for _, s := range r.db {
		if s.TenantID == tenantID {
			result = append(result, s)
		}
	}
	return result, nil
}

func (r *PostgresServerRepository) Delete(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) error {
	// Ensures tenant boundary enforcement during deletion.
	s, exists := r.db[id]
	if exists && s.TenantID == tenantID {
		delete(r.db, id)
	}
	return nil
}
