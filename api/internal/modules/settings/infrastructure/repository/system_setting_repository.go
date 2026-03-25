//go:build legacy
// +build legacy

package repository

import (
	"errors"

	"github.com/google/uuid"
	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type systemSettingRepository struct {
	db *gorm.DB
}

// NewSystemSettingRepository creates a new instance of SystemSettingRepository
func NewSystemSettingRepository(db *gorm.DB) domain.SystemSettingRepository {
	return &systemSettingRepository{db: db}
}

// Create creates a new system setting
func (r *systemSettingRepository) Create(setting *domain.SystemSetting) (*domain.SystemSetting, error) {
	if setting.ID == "" {
		setting.ID = uuid.New().String()
	}

	// Check if key already exists
	var existing domain.SystemSetting
	if err := r.db.Where("key = ?", setting.Key).First(&existing).Error; err == nil {
		return nil, errors.New("system setting with this key already exists")
	}

	if err := r.db.Create(setting).Error; err != nil {
		return nil, err
	}
	return setting, nil
}

// GetByKey retrieves a system setting by its key
func (r *systemSettingRepository) GetByKey(key string) (*domain.SystemSetting, error) {
	var setting domain.SystemSetting
	if err := r.db.Where("key = ?", key).First(&setting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("system setting not found")
		}
		return nil, err
	}
	return &setting, nil
}

// GetAll retrieves all system settings
func (r *systemSettingRepository) GetAll() ([]*domain.SystemSetting, error) {
	var settings []*domain.SystemSetting
	if err := r.db.Order("category, key").Find(&settings).Error; err != nil {
		return nil, err
	}
	return settings, nil
}

// GetByCategory retrieves all system settings of a specific category
func (r *systemSettingRepository) GetByCategory(category string) ([]*domain.SystemSetting, error) {
	var settings []*domain.SystemSetting
	if err := r.db.Where("category = ?", category).Order("key").Find(&settings).Error; err != nil {
		return nil, err
	}
	return settings, nil
}

// Update updates an existing system setting
func (r *systemSettingRepository) Update(setting *domain.SystemSetting) (*domain.SystemSetting, error) {
	// Check if setting exists
	var existing domain.SystemSetting
	if err := r.db.Where("id = ?", setting.ID).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("system setting not found")
		}
		return nil, err
	}

	// Update only allowed fields
	updates := map[string]interface{}{
		"value":       setting.Value,
		"category":    setting.Category,
		"description": setting.Description,
	}

	if err := r.db.Model(&existing).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Reload to get updated data
	if err := r.db.Where("id = ?", setting.ID).First(&existing).Error; err != nil {
		return nil, err
	}

	return &existing, nil
}

// Delete deletes a system setting by its ID
func (r *systemSettingRepository) Delete(id string) error {
	result := r.db.Where("id = ?", id).Delete(&domain.SystemSetting{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("system setting not found")
	}
	return nil
}
