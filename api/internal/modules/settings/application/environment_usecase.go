//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/modules/server/infrastructure/settings_repo"
	"einfra/api/internal/domain"
)

type environmentUsecase struct {
	envRepo repository.EnvironmentRepository
}

func NewEnvironmentUsecase(envRepo repository.EnvironmentRepository) EnvironmentUsecase {
	return &environmentUsecase{
		envRepo: envRepo,
	}
}

func (u *environmentUsecase) CreateEnvironment(ctx context.Context, env *domain.Environment) error {
	existing, _ := u.envRepo.GetByName(ctx, env.Name)
	if existing != nil {
		return fmt.Errorf("environment with name '%s' already exists", env.Name)
	}

	return u.envRepo.Create(ctx, env)
}

func (u *environmentUsecase) GetEnvironment(ctx context.Context, id string) (*domain.Environment, error) {
	return u.envRepo.GetByID(ctx, id)
}

func (u *environmentUsecase) GetEnvironmentByName(ctx context.Context, name string) (*domain.Environment, error) {
	return u.envRepo.GetByName(ctx, name)
}

func (u *environmentUsecase) ListEnvironments(ctx context.Context, filter domain.EnvironmentFilter) ([]*domain.Environment, int64, error) {
	return u.envRepo.List(ctx, filter)
}

func (u *environmentUsecase) UpdateEnvironment(ctx context.Context, env *domain.Environment) error {
	existing, err := u.envRepo.GetByID(ctx, env.ID)
	if err != nil {
		return fmt.Errorf("environment not found")
	}

	if env.Name != existing.Name {
		nameExists, _ := u.envRepo.GetByName(ctx, env.Name)
		if nameExists != nil && nameExists.ID != env.ID {
			return fmt.Errorf("environment with name '%s' already exists", env.Name)
		}
	}

	return u.envRepo.Update(ctx, env)
}

func (u *environmentUsecase) DeleteEnvironment(ctx context.Context, id string) error {
	_, err := u.envRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("environment not found")
	}

	return u.envRepo.Delete(ctx, id)
}
