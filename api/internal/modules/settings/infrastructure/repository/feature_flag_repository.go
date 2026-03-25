//go:build legacy
// +build legacy

package repository

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"einfra/api/internal/domain"
)

type FeatureFlagRepository struct {
	DB *gorm.DB
}

func NewFeatureFlagRepository(db *gorm.DB) *FeatureFlagRepository {
	return &FeatureFlagRepository{DB: db}
}

func (r *FeatureFlagRepository) Create(flag *domain.FeatureFlag) (*domain.FeatureFlag, error) {
	flag.ID = uuid.New().String()
	if err := r.DB.Create(flag).Error; err != nil {
		return nil, err
	}
	return flag, nil
}

func (r *FeatureFlagRepository) GetByName(name string) (*domain.FeatureFlag, error) {
	var flag domain.FeatureFlag
	if err := r.DB.Where("name = ?", name).First(&flag).Error; err != nil {
		return nil, err
	}
	return &flag, nil
}

func (r *FeatureFlagRepository) GetByKey(key string) (*domain.FeatureFlag, error) {
	var flag domain.FeatureFlag
	if err := r.DB.Where("key = ?", key).First(&flag).Error; err != nil {
		return nil, err
	}
	return &flag, nil
}

func (r *FeatureFlagRepository) GetAll() ([]*domain.FeatureFlag, error) {
	var flags []*domain.FeatureFlag
	if err := r.DB.Find(&flags).Error; err != nil {
		return nil, err
	}
	return flags, nil
}

func (r *FeatureFlagRepository) GetByCategory(category string) ([]*domain.FeatureFlag, error) {
	var flags []*domain.FeatureFlag
	if err := r.DB.Where("category = ?", category).Find(&flags).Error; err != nil {
		return nil, err
	}
	return flags, nil
}

// GetByTier retrieves all features available for a specific license tier
func (r *FeatureFlagRepository) GetByTier(tier domain.LicenseTier) ([]*domain.FeatureFlag, error) {
	var flags []*domain.FeatureFlag

	// Tier hierarchy: Free < Pro < Enterprise < Custom
	tierOrder := map[domain.LicenseTier]int{
		domain.TierFree:       1,
		domain.TierPro:        2,
		domain.TierEnterprise: 3,
		domain.TierCustom:     4,
	}

	currentTierLevel := tierOrder[tier]

	// Get all features where required_tier <= current tier
	query := r.DB.Where("enabled = ?", true)

	var validTiers []string
	for t, level := range tierOrder {
		if level <= currentTierLevel {
			validTiers = append(validTiers, string(t))
		}
	}

	query = query.Where("required_tier IN ?", validTiers)

	if err := query.Find(&flags).Error; err != nil {
		return nil, err
	}
	return flags, nil
}

func (r *FeatureFlagRepository) Update(flag *domain.FeatureFlag) (*domain.FeatureFlag, error) {
	if err := r.DB.Save(flag).Error; err != nil {
		return nil, err
	}
	return flag, nil
}

func (r *FeatureFlagRepository) Delete(id string) error {
	return r.DB.Delete(&domain.FeatureFlag{}, "id = ?", id).Error
}
