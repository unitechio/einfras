package serverpostgres

import (
	"context"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type ResourceRepository struct {
	db *gorm.DB
}

func NewResourceRepository(db *gorm.DB) *ResourceRepository {
	return &ResourceRepository{db: db}
}

func (r *ResourceRepository) ReplaceByServerID(ctx context.Context, serverID string, disks []*domain.ServerDisk) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&domain.ServerDisk{}, "server_id = ?", serverID).Error; err != nil {
			return err
		}
		if len(disks) == 0 {
			return nil
		}
		return tx.Create(&disks).Error
	})
}

func (r *ResourceRepository) ListByServerID(ctx context.Context, serverID string) ([]*domain.ServerDisk, error) {
	var items []*domain.ServerDisk
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("name asc").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ResourceRepository) Create(ctx context.Context, sample *domain.ServerMetricSample) error {
	return r.db.WithContext(ctx).Create(sample).Error
}

func (r *ResourceRepository) ListMetricsByServerID(ctx context.Context, serverID string, limit int) ([]*domain.ServerMetricSample, error) {
	if limit <= 0 {
		limit = 120
	}
	var items []*domain.ServerMetricSample
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("recorded_at desc").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ResourceRepository) ListAudit(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.ServerAuditLog, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 200
	}
	query := r.db.WithContext(ctx).Model(&domain.ServerAuditLog{})
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.TenantID != "" {
		query = query.Where("tenant_id = ?", filter.TenantID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.PolicyDecision != "" {
		query = query.Where("policy_decision = ?", filter.PolicyDecision)
	}
	var items []*domain.ServerAuditLog
	if err := query.Order("created_at desc").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *ResourceRepository) CreateAudit(ctx context.Context, entry *domain.ServerAuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}
