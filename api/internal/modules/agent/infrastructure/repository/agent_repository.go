// Package agentrepo implements the persistence layer for the agent domain.
// Uses PostgreSQL via GORM.
package agentrepo

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	agentregistry "einfra/api/internal/modules/agent/application"
	"einfra/api/internal/modules/agent/domain"
)

// ── Command Repository ────────────────────────────────────────────────────────

// commandRepo implements agentregistry.CommandRepository.
type commandRepo struct {
	db *gorm.DB
}

// NewCommandRepository creates a new GORM-backed command repository.
func NewCommandRepository(db *gorm.DB) agentregistry.CommandRepository {
	return &commandRepo{db: db}
}

func (r *commandRepo) Create(ctx context.Context, cmd *agent.Command) error {
	return r.db.WithContext(ctx).Table("agent_commands").Create(cmd).Error
}

func (r *commandRepo) UpdateStatus(ctx context.Context, id string, status agent.CommandStatus, exitCode *int) error {
	updates := map[string]any{
		"status": status,
	}
	now := time.Now()
	if exitCode != nil {
		updates["exit_code"] = *exitCode
		updates["done_at"] = now
	}
	return r.db.WithContext(ctx).
		Table("agent_commands").
		Where("id = ?", id).
		Updates(updates).Error
}

func (r *commandRepo) AppendLog(ctx context.Context, log *agent.CommandLog) error {
	tx := r.db.WithContext(ctx)
	if err := tx.Table("agent_command_logs").Create(log).Error; err != nil {
		return err
	}
	return tx.Table("agent_commands").
		Where("id = ?", log.CommandID).
		UpdateColumn("output", gorm.Expr("LEFT(COALESCE(output, '') || ?, 524288)", log.Chunk)).
		Error
}

func (r *commandRepo) FindByID(ctx context.Context, id string) (*agent.Command, error) {
	var cmd agent.Command
	if err := r.db.WithContext(ctx).Table("agent_commands").
		Where("id = ?", id).First(&cmd).Error; err != nil {
		return nil, fmt.Errorf("command %q not found: %w", id, err)
	}
	return &cmd, nil
}

func (r *commandRepo) FindByIdempotencyKey(ctx context.Context, idempotencyKey string) (*agent.Command, error) {
	var cmd agent.Command
	if err := r.db.WithContext(ctx).Table("agent_commands").
		Where("idempotency_key = ?", idempotencyKey).
		Order("created_at DESC").
		First(&cmd).Error; err != nil {
		return nil, fmt.Errorf("command with idempotency key %q not found: %w", idempotencyKey, err)
	}
	return &cmd, nil
}

func (r *commandRepo) ListByServer(ctx context.Context, serverID string, limit int) ([]*agent.Command, error) {
	var cmds []*agent.Command
	if err := r.db.WithContext(ctx).Table("agent_commands").
		Where("server_id = ?", serverID).
		Order("created_at DESC").
		Limit(limit).
		Find(&cmds).Error; err != nil {
		return nil, err
	}
	return cmds, nil
}

// GetLogs returns all log chunks for a command ordered by sequence number.
func (r *commandRepo) GetLogs(ctx context.Context, commandID string) ([]*agent.CommandLog, error) {
	var logs []*agent.CommandLog
	if err := r.db.WithContext(ctx).Table("agent_command_logs").
		Where("command_id = ?", commandID).
		Order("seq ASC").
		Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// ── Agent Info Repository ────────────────────────────────────────────────────

// AgentInfoRepo implements agenthandler.AgentRepository and agenthandler.AgentInfoReader.
// Exported so router.go can pass it as both interfaces without an adapter.
type AgentInfoRepo struct {
	db *gorm.DB
}

// NewAgentInfoRepository creates a new GORM-backed agent info repository.
func NewAgentInfoRepository(db *gorm.DB) *AgentInfoRepo {
	return &AgentInfoRepo{db: db}
}

// Upsert inserts or updates Agent info (called on heartbeat).
func (r *AgentInfoRepo) Upsert(serverID string, info *agent.AgentInfo) error {
	info.ServerID = serverID
	info.UpdatedAt = time.Now()
	updateColumns := []string{
		"version", "online", "last_seen",
		"cpu_percent", "mem_percent", "disk_percent",
		"has_docker", "has_k8s", "os", "arch", "updated_at",
	}
	if len(info.Capabilities) > 0 {
		updateColumns = append(updateColumns, "capabilities")
	}
	return r.db.Table("agent_infos").
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "server_id"}},
			DoUpdates: clause.AssignmentColumns(updateColumns),
		}).
		Create(info).Error
}

// SetOnline marks an agent as online or offline.
func (r *AgentInfoRepo) SetOnline(serverID string, online bool) error {
	now := time.Now()
	result := r.db.Table("agent_infos").
		Where("server_id = ?", serverID).
		Updates(map[string]any{
			"online":     online,
			"last_seen":  now,
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	// Row didn't exist yet — create it (happens on first connect)
	if result.RowsAffected == 0 && online {
		return r.db.Table("agent_infos").Create(&agent.AgentInfo{
			ServerID:  serverID,
			Online:    online,
			LastSeen:  now,
			UpdatedAt: now,
		}).Error
	}
	return nil
}

// GetByServerID returns the agent info for a server.
func (r *AgentInfoRepo) GetByServerID(serverID string) (*agent.AgentInfo, error) {
	var info agent.AgentInfo
	if err := r.db.Table("agent_infos").
		Where("server_id = ?", serverID).
		First(&info).Error; err != nil {
		return nil, err
	}
	return &info, nil
}
