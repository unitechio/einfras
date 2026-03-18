package repository

import (
	"context"
	"errors"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type serverIPTableRepository struct {
	db *gorm.DB
}

// NewServerIPTableRepository creates a new server iptables repository instance
func NewServerIPTableRepository(db *gorm.DB) domain.ServerIPTableRepository {
	return &serverIPTableRepository{db: db}
}

// Create creates a new iptables rule record
func (r *serverIPTableRepository) Create(ctx context.Context, rule *domain.ServerIPTable) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

// GetByID retrieves an iptables rule by its ID
func (r *serverIPTableRepository) GetByID(ctx context.Context, id string) (*domain.ServerIPTable, error) {
	var rule domain.ServerIPTable
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&rule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("iptables rule not found")
		}
		return nil, err
	}
	return &rule, nil
}

// List retrieves all iptables rules with pagination and filtering
func (r *serverIPTableRepository) List(ctx context.Context, filter domain.IPTableFilter) ([]*domain.ServerIPTable, int64, error) {
	var rules []*domain.ServerIPTable
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.ServerIPTable{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.Chain != "" {
		query = query.Where("chain = ?", filter.Chain)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.Protocol != "" {
		query = query.Where("protocol = ?", filter.Protocol)
	}
	if filter.Enabled != nil {
		query = query.Where("enabled = ?", *filter.Enabled)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	if filter.Page > 0 && filter.PageSize > 0 {
		offset := (filter.Page - 1) * filter.PageSize
		query = query.Offset(offset).Limit(filter.PageSize)
	}

	// Execute query - order by position
	if err := query.Order("chain ASC, position ASC").Find(&rules).Error; err != nil {
		return nil, 0, err
	}

	return rules, total, nil
}

// Update updates an existing iptables rule
func (r *serverIPTableRepository) Update(ctx context.Context, rule *domain.ServerIPTable) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", rule.ID).
		Updates(rule)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("iptables rule not found or already deleted")
	}
	return nil
}

// Delete soft deletes an iptables rule
func (r *serverIPTableRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerIPTable{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("iptables rule not found or already deleted")
	}
	return nil
}

// GetByServerID retrieves all iptables rules for a server
func (r *serverIPTableRepository) GetByServerID(ctx context.Context, serverID string) ([]*domain.ServerIPTable, error) {
	var rules []*domain.ServerIPTable
	err := r.db.WithContext(ctx).
		Where("server_id = ? AND deleted_at IS NULL", serverID).
		Order("chain ASC, position ASC").
		Find(&rules).Error

	if err != nil {
		return nil, err
	}

	return rules, nil
}

// CreateBackup creates a new iptables backup
func (r *serverIPTableRepository) CreateBackup(ctx context.Context, backup *domain.IPTableBackup) error {
	return r.db.WithContext(ctx).Create(backup).Error
}

// GetBackups retrieves iptables backups for a server
func (r *serverIPTableRepository) GetBackups(ctx context.Context, serverID string, limit int) ([]*domain.IPTableBackup, error) {
	var backups []*domain.IPTableBackup

	query := r.db.WithContext(ctx).
		Where("server_id = ?", serverID).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&backups).Error
	if err != nil {
		return nil, err
	}

	return backups, nil
}

// GetBackupByID retrieves a specific backup
func (r *serverIPTableRepository) GetBackupByID(ctx context.Context, id string) (*domain.IPTableBackup, error) {
	var backup domain.IPTableBackup
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&backup).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("iptables backup not found")
		}
		return nil, err
	}
	return &backup, nil
}
