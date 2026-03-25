//go:build legacy
// +build legacy

package usecase

import (
	"context"

	"einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/domain"
)

type RoleUsecase interface {
	Create(ctx context.Context, role *domain.Role) error
	GetByID(ctx context.Context, id string) (*domain.Role, error)
	GetByName(ctx context.Context, name string) (*domain.Role, error)
	List(ctx context.Context, filter domain.RoleFilter) ([]*domain.Role, int64, error)
	Update(ctx context.Context, role *domain.Role) error
	Delete(ctx context.Context, id string) error
	AssignPermissions(ctx context.Context, roleID string, permissionIDs []string) error
	RemovePermissions(ctx context.Context, roleID string, permissionIDs []string) error
}

type roleUsecase struct {
	roleRepo repository.RoleRepository
}

func NewRoleUsecase(roleRepo repository.RoleRepository) RoleUsecase {
	return &roleUsecase{
		roleRepo: roleRepo,
	}
}

func (u *roleUsecase) Create(ctx context.Context, role *domain.Role) error {
	return u.roleRepo.Create(ctx, role)
}

func (u *roleUsecase) GetByID(ctx context.Context, id string) (*domain.Role, error) {
	return u.roleRepo.GetByID(ctx, id)
}

func (u *roleUsecase) GetByName(ctx context.Context, name string) (*domain.Role, error) {
	return u.roleRepo.GetByName(ctx, name)
}

func (u *roleUsecase) List(ctx context.Context, filter domain.RoleFilter) ([]*domain.Role, int64, error) {
	return u.roleRepo.List(ctx, filter)
}

func (u *roleUsecase) Update(ctx context.Context, role *domain.Role) error {
	return u.roleRepo.Update(ctx, role)
}

func (u *roleUsecase) Delete(ctx context.Context, id string) error {
	return u.roleRepo.Delete(ctx, id)
}

func (u *roleUsecase) AssignPermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	return u.roleRepo.AssignPermissions(ctx, roleID, permissionIDs)
}

func (u *roleUsecase) RemovePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	return u.roleRepo.RemovePermissions(ctx, roleID, permissionIDs)
}
