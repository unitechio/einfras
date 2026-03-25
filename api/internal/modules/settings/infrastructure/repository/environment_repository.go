//go:build legacy
// +build legacy

package repository

import (
	"context"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type EnvironmentRepository interface {
	Create(ctx context.Context, env *domain.Environment) error
	GetByID(ctx context.Context, id string) (*domain.Environment, error)
	GetByName(ctx context.Context, name string) (*domain.Environment, error)
	List(ctx context.Context, filter domain.EnvironmentFilter) ([]*domain.Environment, int64, error)
	Update(ctx context.Context, env *domain.Environment) error
	Delete(ctx context.Context, id string) error
}

type environmentRepository struct {
	db *gorm.DB
}

func NewEnvironmentRepository(db *gorm.DB) EnvironmentRepository {
	return &environmentRepository{db: db}
}

func (r *environmentRepository) Create(ctx context.Context, env *domain.Environment) error {
	return r.db.WithContext(ctx).Create(env).Error
}

func (r *environmentRepository) GetByID(ctx context.Context, id string) (*domain.Environment, error) {
	var env domain.Environment
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&env).Error; err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *environmentRepository) GetByName(ctx context.Context, name string) (*domain.Environment, error) {
	var env domain.Environment
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&env).Error; err != nil {
		return nil, err
	}
	return &env, nil
}

func (r *environmentRepository) List(ctx context.Context, filter domain.EnvironmentFilter) ([]*domain.Environment, int64, error) {
	var environments []*domain.Environment
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Environment{})

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}
	if filter.Name != "" {
		query = query.Where("name ILIKE ?", "%"+filter.Name+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if filter.Page > 0 && filter.PageSize > 0 {
		offset := (filter.Page - 1) * filter.PageSize
		query = query.Offset(offset).Limit(filter.PageSize)
	}

	query = query.Order("sort_order ASC, name ASC")

	if err := query.Find(&environments).Error; err != nil {
		return nil, 0, err
	}

	return environments, total, nil
}

func (r *environmentRepository) Update(ctx context.Context, env *domain.Environment) error {
	return r.db.WithContext(ctx).Save(env).Error
}

func (r *environmentRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.Environment{}).Error
}
