package repository

import (
	"context"
	"errors"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type serverServiceRepository struct {
	db *gorm.DB
}

// NewServerServiceRepository creates a new server service repository instance
func NewServerServiceRepository(db *gorm.DB) domain.ServerServiceRepository {
	return &serverServiceRepository{db: db}
}

// Create creates a new service record
func (r *serverServiceRepository) Create(ctx context.Context, service *domain.ServerService) error {
	return r.db.WithContext(ctx).Create(service).Error
}

// GetByID retrieves a service by its ID
func (r *serverServiceRepository) GetByID(ctx context.Context, id string) (*domain.ServerService, error) {
	var service domain.ServerService
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&service).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("service not found")
		}
		return nil, err
	}
	return &service, nil
}

// GetByServerAndName retrieves a service by server ID and service name
func (r *serverServiceRepository) GetByServerAndName(ctx context.Context, serverID, name string) (*domain.ServerService, error) {
	var service domain.ServerService
	err := r.db.WithContext(ctx).
		Where("server_id = ? AND name = ? AND deleted_at IS NULL", serverID, name).
		First(&service).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("service not found")
		}
		return nil, err
	}
	return &service, nil
}

// List retrieves all services with pagination and filtering
func (r *serverServiceRepository) List(ctx context.Context, filter domain.ServiceFilter) ([]*domain.ServerService, int64, error) {
	var services []*domain.ServerService
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.ServerService{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
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

	// Execute query
	if err := query.Order("name ASC").Find(&services).Error; err != nil {
		return nil, 0, err
	}

	return services, total, nil
}

// Update updates an existing service
func (r *serverServiceRepository) Update(ctx context.Context, service *domain.ServerService) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", service.ID).
		Updates(service)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("service not found or already deleted")
	}
	return nil
}

// Delete soft deletes a service
func (r *serverServiceRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerService{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("service not found or already deleted")
	}
	return nil
}

// UpdateStatus updates only the status of a service
func (r *serverServiceRepository) UpdateStatus(ctx context.Context, id string, status domain.ServiceStatus) error {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerService{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("status", status)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("service not found or already deleted")
	}
	return nil
}
