package repository

import (
	"context"
	"errors"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type serverCronjobRepository struct {
	db *gorm.DB
}

// NewServerCronjobRepository creates a new server cronjob repository instance
func NewServerCronjobRepository(db *gorm.DB) domain.ServerCronjobRepository {
	return &serverCronjobRepository{db: db}
}

// Create creates a new cronjob record
func (r *serverCronjobRepository) Create(ctx context.Context, cronjob *domain.ServerCronjob) error {
	return r.db.WithContext(ctx).Create(cronjob).Error
}

// GetByID retrieves a cronjob by its ID
func (r *serverCronjobRepository) GetByID(ctx context.Context, id string) (*domain.ServerCronjob, error) {
	var cronjob domain.ServerCronjob
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&cronjob).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("cronjob not found")
		}
		return nil, err
	}
	return &cronjob, nil
}

// List retrieves all cronjobs with pagination and filtering
func (r *serverCronjobRepository) List(ctx context.Context, filter domain.CronjobFilter) ([]*domain.ServerCronjob, int64, error) {
	var cronjobs []*domain.ServerCronjob
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.ServerCronjob{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
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

	// Execute query
	if err := query.Order("created_at DESC").Find(&cronjobs).Error; err != nil {
		return nil, 0, err
	}

	return cronjobs, total, nil
}

// Update updates an existing cronjob
func (r *serverCronjobRepository) Update(ctx context.Context, cronjob *domain.ServerCronjob) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", cronjob.ID).
		Updates(cronjob)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("cronjob not found or already deleted")
	}
	return nil
}

// Delete soft deletes a cronjob
func (r *serverCronjobRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerCronjob{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("cronjob not found or already deleted")
	}
	return nil
}

// GetByServerID retrieves all cronjobs for a server
func (r *serverCronjobRepository) GetByServerID(ctx context.Context, serverID string) ([]*domain.ServerCronjob, error) {
	var cronjobs []*domain.ServerCronjob
	err := r.db.WithContext(ctx).
		Where("server_id = ? AND deleted_at IS NULL", serverID).
		Order("created_at DESC").
		Find(&cronjobs).Error

	if err != nil {
		return nil, err
	}

	return cronjobs, nil
}

// CreateExecution creates a new execution record
func (r *serverCronjobRepository) CreateExecution(ctx context.Context, execution *domain.CronjobExecution) error {
	return r.db.WithContext(ctx).Create(execution).Error
}

// GetExecutions retrieves execution history for a cronjob
func (r *serverCronjobRepository) GetExecutions(ctx context.Context, cronjobID string, limit int) ([]*domain.CronjobExecution, error) {
	var executions []*domain.CronjobExecution

	query := r.db.WithContext(ctx).
		Where("cronjob_id = ?", cronjobID).
		Order("started_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&executions).Error
	if err != nil {
		return nil, err
	}

	return executions, nil
}
