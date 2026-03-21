// Package agentrepo — token_repo.go
// GORM-backed persistence for agent tokens.
package agentrepo

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	agentregistry "einfra/api/internal/modules/agent/application"
	"einfra/api/internal/modules/agent/domain"
)

// tokenRepo implements agentregistry.AgentTokenRepository.
type tokenRepo struct {
	db *gorm.DB
}

// NewAgentTokenRepository creates a GORM-backed token repository.
func NewAgentTokenRepository(db *gorm.DB) agentregistry.AgentTokenRepository {
	return &tokenRepo{db: db}
}

// Save upserts an agent token record (ON CONFLICT on server_id → replace).
func (r *tokenRepo) Save(ctx context.Context, tok *agent.AgentToken) error {
	return r.db.WithContext(ctx).
		Table("agent_tokens").
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "server_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"id", "token_hash", "issued_at", "expires_at",
			}),
		}).
		Create(tok).Error
}

// FindByServerID returns the token for a server.
func (r *tokenRepo) FindByServerID(ctx context.Context, serverID string) (*agent.AgentToken, error) {
	var tok agent.AgentToken
	if err := r.db.WithContext(ctx).
		Table("agent_tokens").
		Where("server_id = ?", serverID).
		First(&tok).Error; err != nil {
		return nil, fmt.Errorf("agent token for server %q not found: %w", serverID, err)
	}
	return &tok, nil
}

// Delete removes the token record for a server (used during rotation).
func (r *tokenRepo) Delete(ctx context.Context, serverID string) error {
	return r.db.WithContext(ctx).
		Table("agent_tokens").
		Where("server_id = ?", serverID).
		Delete(&agent.AgentToken{}).Error
}
