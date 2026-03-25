package serverpostgres

import (
	"context"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type ServiceInstallPlanRepository struct {
	db *gorm.DB
}

func NewServiceInstallPlanRepository(db *gorm.DB) *ServiceInstallPlanRepository {
	return &ServiceInstallPlanRepository{db: db}
}

func (r *ServiceInstallPlanRepository) Create(ctx context.Context, plan *domain.ServerServiceInstallPlan) error {
	return r.db.WithContext(ctx).Create(plan).Error
}

func (r *ServiceInstallPlanRepository) ListByServerID(ctx context.Context, serverID string) ([]*domain.ServerServiceInstallPlan, error) {
	var items []*domain.ServerServiceInstallPlan
	if err := r.db.WithContext(ctx).
		Where("server_id = ?", serverID).
		Order("created_at desc").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
