package serverpostgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type CronRepository struct {
	db *gorm.DB
}

func NewCronRepository(db *gorm.DB) *CronRepository {
	return &CronRepository{db: db}
}

func (r *CronRepository) Create(ctx context.Context, cronjob *domain.ServerCronjob) error {
	return r.db.WithContext(ctx).Create(cronjob).Error
}

func (r *CronRepository) GetByID(ctx context.Context, id string) (*domain.ServerCronjob, error) {
	var cronjob domain.ServerCronjob
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&cronjob).Error; err != nil {
		return nil, fmt.Errorf("cronjob %q not found: %w", id, err)
	}
	return &cronjob, nil
}

func (r *CronRepository) List(ctx context.Context, filter domain.CronjobFilter) ([]*domain.ServerCronjob, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.ServerCronjob{})
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
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
		pageSize = 50
	}

	var items []*domain.ServerCronjob
	if err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *CronRepository) Update(ctx context.Context, cronjob *domain.ServerCronjob) error {
	return r.db.WithContext(ctx).Model(&domain.ServerCronjob{}).Where("id = ?", cronjob.ID).Updates(cronjob).Error
}

func (r *CronRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.ServerCronjob{}, "id = ?", id).Error
}

func (r *CronRepository) CreateExecution(ctx context.Context, execution *domain.CronjobExecution) error {
	return r.db.WithContext(ctx).Create(execution).Error
}

func (r *CronRepository) GetExecutions(ctx context.Context, cronjobID string, limit int) ([]*domain.CronjobExecution, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []*domain.CronjobExecution
	if err := r.db.WithContext(ctx).Where("cronjob_id = ?", cronjobID).Order("started_at desc").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
