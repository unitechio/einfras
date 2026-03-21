package serverpostgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domain "einfra/api/internal/modules/server/domain"
)

type ServiceRepository struct {
	db *gorm.DB
}

func NewServiceRepository(db *gorm.DB) *ServiceRepository {
	return &ServiceRepository{db: db}
}

func (r *ServiceRepository) Create(ctx context.Context, service *domain.ServerService) error {
	return r.db.WithContext(ctx).Create(service).Error
}

func (r *ServiceRepository) GetByID(ctx context.Context, id string) (*domain.ServerService, error) {
	var service domain.ServerService
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&service).Error; err != nil {
		return nil, fmt.Errorf("service %q not found: %w", id, err)
	}
	return &service, nil
}

func (r *ServiceRepository) GetByServerAndName(ctx context.Context, serverID, name string) (*domain.ServerService, error) {
	var service domain.ServerService
	if err := r.db.WithContext(ctx).Where("server_id = ? AND name = ?", serverID, name).First(&service).Error; err != nil {
		return nil, fmt.Errorf("service %q on server %q not found: %w", name, serverID, err)
	}
	return &service, nil
}

func (r *ServiceRepository) List(ctx context.Context, filter domain.ServiceFilter) ([]*domain.ServerService, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.ServerService{})
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 100
	}

	var services []*domain.ServerService
	if err := query.Order("name asc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&services).Error; err != nil {
		return nil, 0, err
	}
	return services, total, nil
}

func (r *ServiceRepository) Update(ctx context.Context, service *domain.ServerService) error {
	return r.db.WithContext(ctx).Model(&domain.ServerService{}).Where("id = ?", service.ID).Updates(service).Error
}

func (r *ServiceRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.ServerService{}, "id = ?", id).Error
}

func (r *ServiceRepository) UpsertMany(ctx context.Context, services []*domain.ServerService) error {
	if len(services) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "display_name", "description", "status", "enabled", "pid", "port",
			"config_path", "log_path", "last_checked_at", "updated_at",
		}),
	}).Create(&services).Error
}
