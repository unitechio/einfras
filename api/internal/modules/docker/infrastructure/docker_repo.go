package repository

import (
	"context"
	"errors"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type dockerHostRepository struct {
	db *gorm.DB
}

func NewDockerHostRepository(db *gorm.DB) domain.DockerHostRepository {
	return &dockerHostRepository{db: db}
}

func (r *dockerHostRepository) Create(ctx context.Context, host *domain.DockerHost) error {
	return r.db.WithContext(ctx).Create(host).Error
}

func (r *dockerHostRepository) GetByID(ctx context.Context, id string) (*domain.DockerHost, error) {
	var host domain.DockerHost
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&host).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("docker host not found")
		}
		return nil, err
	}
	return &host, nil
}

func (r *dockerHostRepository) List(ctx context.Context, filter domain.DockerHostFilter) ([]*domain.DockerHost, int64, error) {
	var hosts []*domain.DockerHost
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.DockerHost{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.ServerID != nil {
		query = query.Where("server_id = ?", *filter.ServerID)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
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
	if err := query.Order("created_at DESC").Find(&hosts).Error; err != nil {
		return nil, 0, err
	}

	return hosts, total, nil
}

// Update updates a Docker host
func (r *dockerHostRepository) Update(ctx context.Context, host *domain.DockerHost) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", host.ID).
		Updates(host)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("docker host not found or already deleted")
	}
	return nil
}

// Delete soft deletes a Docker host
func (r *dockerHostRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.DockerHost{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("docker host not found or already deleted")
	}
	return nil
}
