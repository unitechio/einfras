//go:build legacy
// +build legacy

package usecase

import (
	"einfra/api/internal/domain"
)

type FeatureFlagUsecase interface {
	CreateFeatureFlag(flag *domain.FeatureFlag) (*domain.FeatureFlag, error)
	GetFeatureFlagByName(name string) (*domain.FeatureFlag, error)
	GetFeatureFlagByKey(key string) (*domain.FeatureFlag, error)
	GetAllFeatureFlags() ([]*domain.FeatureFlag, error)
	GetFeatureFlagsByCategory(category string) ([]*domain.FeatureFlag, error)
	GetFeatureFlagsByTier(tier domain.LicenseTier) ([]*domain.FeatureFlag, error)
	UpdateFeatureFlag(flag *domain.FeatureFlag) (*domain.FeatureFlag, error)
	DeleteFeatureFlag(id string) error
	EnableFeature(name string) (*domain.FeatureFlag, error)
	DisableFeature(name string) (*domain.FeatureFlag, error)
	IsFeatureEnabled(name string) (bool, error)
	IsFeatureAvailableForTier(key string, tier domain.LicenseTier) (bool, error)
}

type featureFlagUsecase struct {
	repo domain.FeatureFlagRepository
}

func NewFeatureFlagUsecase(repo domain.FeatureFlagRepository) FeatureFlagUsecase {
	return &featureFlagUsecase{repo: repo}
}
func (uc *featureFlagUsecase) CreateFeatureFlag(flag *domain.FeatureFlag) (*domain.FeatureFlag, error) {
	return uc.repo.Create(flag)
}
func (uc *featureFlagUsecase) GetFeatureFlagByName(name string) (*domain.FeatureFlag, error) {
	return uc.repo.GetByName(name)
}
func (uc *featureFlagUsecase) GetFeatureFlagByKey(key string) (*domain.FeatureFlag, error) {
	return uc.repo.GetByKey(key)
}
func (uc *featureFlagUsecase) GetAllFeatureFlags() ([]*domain.FeatureFlag, error) {
	return uc.repo.GetAll()
}

// GetFeatureFlagsByCategory retrieves all feature flags of a specific category.
func (uc *featureFlagUsecase) GetFeatureFlagsByCategory(category string) ([]*domain.FeatureFlag, error) {
	return uc.repo.GetByCategory(category)
}

// GetFeatureFlagsByTier retrieves all features available for a specific license tier.
func (uc *featureFlagUsecase) GetFeatureFlagsByTier(tier domain.LicenseTier) ([]*domain.FeatureFlag, error) {
	return uc.repo.GetByTier(tier)
}

// UpdateFeatureFlag updates an existing feature flag.
func (uc *featureFlagUsecase) UpdateFeatureFlag(flag *domain.FeatureFlag) (*domain.FeatureFlag, error) {
	return uc.repo.Update(flag)
}

// DeleteFeatureFlag deletes a feature flag by its ID.
func (uc *featureFlagUsecase) DeleteFeatureFlag(id string) error {
	return uc.repo.Delete(id)
}

// EnableFeature enables a feature flag.
func (uc *featureFlagUsecase) EnableFeature(name string) (*domain.FeatureFlag, error) {
	flag, err := uc.repo.GetByName(name)
	if err != nil {
		return nil, err
	}
	flag.Enabled = true
	return uc.repo.Update(flag)
}

// DisableFeature disables a feature flag.
func (uc *featureFlagUsecase) DisableFeature(name string) (*domain.FeatureFlag, error) {
	flag, err := uc.repo.GetByName(name)
	if err != nil {
		return nil, err
	}
	flag.Enabled = false
	return uc.repo.Update(flag)
}

// IsFeatureEnabled checks if a feature is enabled globally.
func (uc *featureFlagUsecase) IsFeatureEnabled(name string) (bool, error) {
	flag, err := uc.repo.GetByName(name)
	if err != nil {
		return false, err
	}
	return flag.Enabled, nil
}

// IsFeatureAvailableForTier checks if a feature is available for a specific license tier.
func (uc *featureFlagUsecase) IsFeatureAvailableForTier(key string, tier domain.LicenseTier) (bool, error) {
	flag, err := uc.repo.GetByKey(key)
	if err != nil {
		return false, err
	}

	if !flag.Enabled {
		return false, nil
	}

	return flag.IsAvailableForTier(tier), nil
}
