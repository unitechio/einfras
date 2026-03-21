package serverpostgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type IPTableRepository struct {
	db *gorm.DB
}

func NewIPTableRepository(db *gorm.DB) *IPTableRepository {
	return &IPTableRepository{db: db}
}

func (r *IPTableRepository) Create(ctx context.Context, rule *domain.ServerIPTable) error {
	return r.db.WithContext(ctx).Create(rule).Error
}

func (r *IPTableRepository) GetByID(ctx context.Context, id string) (*domain.ServerIPTable, error) {
	var rule domain.ServerIPTable
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&rule).Error; err != nil {
		return nil, fmt.Errorf("iptables rule %q not found: %w", id, err)
	}
	return &rule, nil
}

func (r *IPTableRepository) GetByServerID(ctx context.Context, serverID string) ([]*domain.ServerIPTable, error) {
	var rules []*domain.ServerIPTable
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("position asc, created_at asc").Find(&rules).Error; err != nil {
		return nil, err
	}
	return rules, nil
}

func (r *IPTableRepository) Update(ctx context.Context, rule *domain.ServerIPTable) error {
	return r.db.WithContext(ctx).Model(&domain.ServerIPTable{}).Where("id = ?", rule.ID).Updates(rule).Error
}

func (r *IPTableRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.ServerIPTable{}, "id = ?", id).Error
}

func (r *IPTableRepository) CreateBackup(ctx context.Context, backup *domain.IPTableBackup) error {
	return r.db.WithContext(ctx).Create(backup).Error
}

func (r *IPTableRepository) GetBackupByID(ctx context.Context, id string) (*domain.IPTableBackup, error) {
	var backup domain.IPTableBackup
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&backup).Error; err != nil {
		return nil, fmt.Errorf("iptables backup %q not found: %w", id, err)
	}
	return &backup, nil
}

func (r *IPTableRepository) GetBackups(ctx context.Context, serverID string, limit int) ([]*domain.IPTableBackup, error) {
	if limit <= 0 {
		limit = 20
	}
	var backups []*domain.IPTableBackup
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("created_at desc").Limit(limit).Find(&backups).Error; err != nil {
		return nil, err
	}
	return backups, nil
}
