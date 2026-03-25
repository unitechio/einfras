//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type RoleRepository interface {
	Create(ctx context.Context, role *domain.Role) error
	GetByID(ctx context.Context, id string) (*domain.Role, error)
	GetByName(ctx context.Context, name string) (*domain.Role, error)
	List(ctx context.Context, filter domain.RoleFilter) ([]*domain.Role, int64, error)
	Update(ctx context.Context, role *domain.Role) error
	Delete(ctx context.Context, id string) error
	AssignPermissions(ctx context.Context, roleID string, permissionIDs []string) error
	RemovePermissions(ctx context.Context, roleID string, permissionIDs []string) error
}
type roleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) RoleRepository {
	return &roleRepository{db: db}
}

func (r *roleRepository) Create(ctx context.Context, role *domain.Role) error {
	return r.db.WithContext(ctx).Create(role).Error
}

func (r *roleRepository) GetByID(ctx context.Context, id string) (*domain.Role, error) {
	var role domain.Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		First(&role, "id = ?", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("role not found")
		}
		return nil, err
	}

	return &role, nil
}

func (r *roleRepository) GetByName(ctx context.Context, name string) (*domain.Role, error) {
	var role domain.Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		First(&role, "name = ?", name).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("role not found")
		}
		return nil, err
	}

	return &role, nil
}

func (r *roleRepository) List(ctx context.Context, filter domain.RoleFilter) ([]*domain.Role, int64, error) {
	var roles []*domain.Role
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Role{})

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize)

	query = query.Preload("Permissions")

	if err := query.Find(&roles).Error; err != nil {
		return nil, 0, err
	}

	return roles, total, nil
}

func (r *roleRepository) Update(ctx context.Context, role *domain.Role) error {
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *roleRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Role{}, "id = ?", id).Error
}

func (r *roleRepository) AssignPermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	var role domain.Role
	if err := r.db.WithContext(ctx).First(&role, "id = ?", roleID).Error; err != nil {
		return err
	}

	var permissions []domain.Permission
	if err := r.db.WithContext(ctx).Find(&permissions, "id IN ?", permissionIDs).Error; err != nil {
		return err
	}

	return r.db.WithContext(ctx).Model(&role).Association("Permissions").Append(permissions)
}

func (r *roleRepository) RemovePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	var role domain.Role
	if err := r.db.WithContext(ctx).First(&role, "id = ?", roleID).Error; err != nil {
		return err
	}

	var permissions []domain.Permission
	if err := r.db.WithContext(ctx).Find(&permissions, "id IN ?", permissionIDs).Error; err != nil {
		return err
	}

	return r.db.WithContext(ctx).Model(&role).Association("Permissions").Delete(permissions)
}
