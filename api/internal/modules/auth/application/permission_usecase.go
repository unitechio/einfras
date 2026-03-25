//go:build legacy
// +build legacy

package usecase

import (
	"context"

	"einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/domain"
)

type PermissionUsecase interface {
	Create(ctx context.Context, permission *domain.Permission) error
	GetByID(ctx context.Context, id string) (*domain.Permission, error)
	GetByName(ctx context.Context, name string) (*domain.Permission, error)
	List(ctx context.Context, filter domain.PermissionFilter) ([]*domain.Permission, int64, error)
	Update(ctx context.Context, permission *domain.Permission) error
	Delete(ctx context.Context, id string) error
	GetByResource(ctx context.Context, resource string) ([]*domain.Permission, error)
}

type permissionUsecase struct {
	permRepo repository.PermissionRepository
}

func NewPermissionUsecase(permRepo repository.PermissionRepository) PermissionUsecase {
	return &permissionUsecase{
		permRepo: permRepo,
	}
}

func (u *permissionUsecase) Create(ctx context.Context, permission *domain.Permission) error {
	return u.permRepo.Create(ctx, permission)
}

func (u *permissionUsecase) GetByID(ctx context.Context, id string) (*domain.Permission, error) {
	return u.permRepo.GetByID(ctx, id)
}

func (u *permissionUsecase) GetByName(ctx context.Context, name string) (*domain.Permission, error) {
	return u.permRepo.GetByName(ctx, name)
}

func (u *permissionUsecase) List(ctx context.Context, filter domain.PermissionFilter) ([]*domain.Permission, int64, error) {
	return u.permRepo.List(ctx, filter)
}

func (u *permissionUsecase) Update(ctx context.Context, permission *domain.Permission) error {
	return u.permRepo.Update(ctx, permission)
}

func (u *permissionUsecase) Delete(ctx context.Context, id string) error {
	return u.permRepo.Delete(ctx, id)
}

func (u *permissionUsecase) GetByResource(ctx context.Context, resource string) ([]*domain.Permission, error) {
	return u.permRepo.GetByResource(ctx, resource)
}
