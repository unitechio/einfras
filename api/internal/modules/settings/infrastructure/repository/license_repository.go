//go:build legacy
// +build legacy

package repository

import (
	"errors"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type licenseRepository struct {
	db *gorm.DB
}

// NewLicenseRepository creates a new instance of LicenseRepository
func NewLicenseRepository(db *gorm.DB) domain.LicenseRepository {
	return &licenseRepository{db: db}
}

// Create creates a new license
func (r *licenseRepository) Create(license *domain.License) (*domain.License, error) {
	if err := r.db.Create(license).Error; err != nil {
		return nil, err
	}
	return license, nil
}

// GetByID retrieves a license by its ID
func (r *licenseRepository) GetByID(id string) (*domain.License, error) {
	var license domain.License
	if err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&license).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("license not found")
		}
		return nil, err
	}
	return &license, nil
}

// GetByKey retrieves a license by its license key
func (r *licenseRepository) GetByKey(key string) (*domain.License, error) {
	var license domain.License
	if err := r.db.Where("license_key = ? AND deleted_at IS NULL", key).First(&license).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("license not found")
		}
		return nil, err
	}
	return &license, nil
}

// GetByOrganization retrieves a license by organization ID
func (r *licenseRepository) GetByOrganization(orgID string) (*domain.License, error) {
	var license domain.License
	if err := r.db.Where("organization_id = ? AND deleted_at IS NULL", orgID).First(&license).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("license not found")
		}
		return nil, err
	}
	return &license, nil
}

// GetAll retrieves all licenses
func (r *licenseRepository) GetAll() ([]*domain.License, error) {
	var licenses []*domain.License
	if err := r.db.Where("deleted_at IS NULL").Order("created_at DESC").Find(&licenses).Error; err != nil {
		return nil, err
	}
	return licenses, nil
}

// GetByTier retrieves all licenses of a specific tier
func (r *licenseRepository) GetByTier(tier domain.LicenseTier) ([]*domain.License, error) {
	var licenses []*domain.License
	if err := r.db.Where("tier = ? AND deleted_at IS NULL", tier).Order("created_at DESC").Find(&licenses).Error; err != nil {
		return nil, err
	}
	return licenses, nil
}

// GetByStatus retrieves all licenses with a specific status
func (r *licenseRepository) GetByStatus(status domain.LicenseStatus) ([]*domain.License, error) {
	var licenses []*domain.License
	if err := r.db.Where("status = ? AND deleted_at IS NULL", status).Order("created_at DESC").Find(&licenses).Error; err != nil {
		return nil, err
	}
	return licenses, nil
}

// Update updates an existing license
func (r *licenseRepository) Update(license *domain.License) (*domain.License, error) {
	if err := r.db.Save(license).Error; err != nil {
		return nil, err
	}
	return license, nil
}

// Delete soft deletes a license
func (r *licenseRepository) Delete(id string) error {
	now := time.Now()
	result := r.db.Model(&domain.License{}).Where("id = ?", id).Update("deleted_at", now)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("license not found")
	}
	return nil
}

// LogUsage logs a usage event for a license
func (r *licenseRepository) LogUsage(log *domain.LicenseUsageLog) error {
	return r.db.Create(log).Error
}

// GetUsageStats retrieves usage statistics for a license within a time range
func (r *licenseRepository) GetUsageStats(licenseID string, from, to time.Time) ([]*domain.LicenseUsageLog, error) {
	var logs []*domain.LicenseUsageLog
	if err := r.db.Where("license_id = ? AND recorded_at BETWEEN ? AND ?", licenseID, from, to).
		Order("recorded_at DESC").
		Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// ResetMonthlyUsage resets the monthly usage counters for a license
func (r *licenseRepository) ResetMonthlyUsage(licenseID string) error {
	return r.db.Model(&domain.License{}).
		Where("id = ?", licenseID).
		Updates(map[string]interface{}{
			"current_api_calls": 0,
		}).Error
}
