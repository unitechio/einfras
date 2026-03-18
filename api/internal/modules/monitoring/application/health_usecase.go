package usecase

import (
	"context"

	"einfra/api/internal/domain"
)

// HealthUsecase is the use case for health checks.
type HealthUsecase interface {
	Check(ctx context.Context) []domain.HealthStatus
}

// healthUsecase is the implementation of HealthUsecase.
type healthUsecase struct {
	healthRepo domain.HealthRepository
}

// NewHealthUsecase creates a new HealthUsecase.
func NewHealthUsecase(healthRepo domain.HealthRepository) HealthUsecase {
	return &healthUsecase{healthRepo: healthRepo}
}

// Check performs the health check.
func (uc *healthUsecase) Check(ctx context.Context) []domain.HealthStatus {
	return uc.healthRepo.Check(ctx)
}
