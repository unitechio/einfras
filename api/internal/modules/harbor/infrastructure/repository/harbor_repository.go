package repository

import (
	"context"
	"errors"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type harborRegistryRepository struct {
	db *gorm.DB
}

// NewHarborRegistryRepository creates a new Harbor registry repository instance
func NewHarborRegistryRepository(db *gorm.DB) domain.HarborRegistryRepository {
	return &harborRegistryRepository{db: db}
}

// Create creates a new Harbor registry record
func (r *harborRegistryRepository) Create(ctx context.Context, registry *domain.HarborRegistry) error {
	return r.db.WithContext(ctx).Create(registry).Error
}

// GetByID retrieves a registry by ID
func (r *harborRegistryRepository) GetByID(ctx context.Context, id string) (*domain.HarborRegistry, error) {
	var registry domain.HarborRegistry
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&registry).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("harbor registry not found")
		}
		return nil, err
	}
	return &registry, nil
}

// List retrieves all registries with filtering
func (r *harborRegistryRepository) List(ctx context.Context, filter domain.HarborRegistryFilter) ([]*domain.HarborRegistry, int64, error) {
	var registries []*domain.HarborRegistry
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.HarborRegistry{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}
	if filter.IsDefault != nil {
		query = query.Where("is_default = ?", *filter.IsDefault)
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
	if err := query.Order("created_at DESC").Find(&registries).Error; err != nil {
		return nil, 0, err
	}

	return registries, total, nil
}

// Update updates a registry
func (r *harborRegistryRepository) Update(ctx context.Context, registry *domain.HarborRegistry) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", registry.ID).
		Updates(registry)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("harbor registry not found or already deleted")
	}
	return nil
}

// Delete soft deletes a registry
func (r *harborRegistryRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.HarborRegistry{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("harbor registry not found or already deleted")
	}
	return nil
}

// GetDefault retrieves the default registry
func (r *harborRegistryRepository) GetDefault(ctx context.Context) (*domain.HarborRegistry, error) {
	var registry domain.HarborRegistry
	err := r.db.WithContext(ctx).
		Where("is_default = ? AND is_active = ? AND deleted_at IS NULL", true, true).
		First(&registry).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("no default harbor registry found")
		}
		return nil, err
	}
	return &registry, nil
}
