//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type PermissionRepository interface {
	Create(ctx context.Context, permission *domain.Permission) error
	GetByID(ctx context.Context, id string) (*domain.Permission, error)
	GetByName(ctx context.Context, name string) (*domain.Permission, error)
	List(ctx context.Context, filter domain.PermissionFilter) ([]*domain.Permission, int64, error)
	Update(ctx context.Context, permission *domain.Permission) error
	Delete(ctx context.Context, id string) error
	GetByResource(ctx context.Context, resource string) ([]*domain.Permission, error)
}
type permissionRepository struct {
	db *gorm.DB
}

func NewPermissionRepository(db *gorm.DB) PermissionRepository {
	return &permissionRepository{db: db}
}

func (r *permissionRepository) Create(ctx context.Context, permission *domain.Permission) error {
	return r.db.WithContext(ctx).Create(permission).Error
}

func (r *permissionRepository) GetByID(ctx context.Context, id string) (*domain.Permission, error) {
	var permission domain.Permission
	err := r.db.WithContext(ctx).First(&permission, "id = ?", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("permission not found")
		}
		return nil, err
	}

	return &permission, nil
}

func (r *permissionRepository) GetByName(ctx context.Context, name string) (*domain.Permission, error) {
	var permission domain.Permission
	err := r.db.WithContext(ctx).First(&permission, "name = ?", name).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("permission not found")
		}
		return nil, err
	}

	return &permission, nil
}

func (r *permissionRepository) List(ctx context.Context, filter domain.PermissionFilter) ([]*domain.Permission, int64, error) {
	var permissions []*domain.Permission
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Permission{})

	if filter.Resource != "" {
		query = query.Where("resource = ?", filter.Resource)
	}

	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize)

	if err := query.Find(&permissions).Error; err != nil {
		return nil, 0, err
	}

	return permissions, total, nil
}

func (r *permissionRepository) Update(ctx context.Context, permission *domain.Permission) error {
	return r.db.WithContext(ctx).Save(permission).Error
}

func (r *permissionRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Permission{}, "id = ?", id).Error
}

func (r *permissionRepository) GetByResource(ctx context.Context, resource string) ([]*domain.Permission, error) {
	var permissions []*domain.Permission
	err := r.db.WithContext(ctx).
		Where("resource = ?", resource).
		Find(&permissions).Error

	if err != nil {
		return nil, err
	}

	return permissions, nil
}
