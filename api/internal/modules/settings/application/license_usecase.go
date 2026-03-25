//go:build legacy
// +build legacy

package usecase

import (
	"errors"
	"fmt"
	"time"

	"einfra/api/internal/domain"
)

type licenseUsecase struct {
	repo domain.LicenseRepository
}

// NewLicenseUsecase creates a new instance of LicenseUsecase
func NewLicenseUsecase(repo domain.LicenseRepository) LicenseUsecase {
	return &licenseUsecase{repo: repo}
}

// CreateLicense creates a new license with the specified tier
func (u *licenseUsecase) CreateLicense(tier domain.LicenseTier, orgID, orgName, contactEmail string, duration *time.Duration) (*domain.License, error) {
	// Generate license key
	licenseKey, err := domain.GenerateLicenseKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate license key: %w", err)
	}

	// Get tier limits
	maxUsers, maxAPICalls, maxStorage := domain.GetTierLimits(tier)

	// Calculate expiry
	var expiresAt *time.Time
	if duration != nil {
		expiry := time.Now().Add(*duration)
		expiresAt = &expiry
	}

	license := &domain.License{
		LicenseKey:       licenseKey,
		Tier:             tier,
		Status:           domain.LicenseStatusActive,
		OrganizationID:   orgID,
		OrganizationName: orgName,
		ContactEmail:     contactEmail,
		MaxUsers:         maxUsers,
		MaxAPICall:       maxAPICalls,
		MaxStorage:       maxStorage,
		IssuedAt:         time.Now(),
		ExpiresAt:        expiresAt,
	}

	return u.repo.Create(license)
}

// GetLicenseByID retrieves a license by ID
func (u *licenseUsecase) GetLicenseByID(id string) (*domain.License, error) {
	return u.repo.GetByID(id)
}

// GetLicenseByKey retrieves a license by license key
func (u *licenseUsecase) GetLicenseByKey(key string) (*domain.License, error) {
	return u.repo.GetByKey(key)
}

// GetLicenseByOrganization retrieves a license by organization ID
func (u *licenseUsecase) GetLicenseByOrganization(orgID string) (*domain.License, error) {
	return u.repo.GetByOrganization(orgID)
}

// GetAllLicenses retrieves all licenses
func (u *licenseUsecase) GetAllLicenses() ([]*domain.License, error) {
	return u.repo.GetAll()
}

// UpdateLicense updates an existing license
func (u *licenseUsecase) UpdateLicense(license *domain.License) (*domain.License, error) {
	return u.repo.Update(license)
}

// DeleteLicense deletes a license
func (u *licenseUsecase) DeleteLicense(id string) error {
	return u.repo.Delete(id)
}

// ActivateLicense activates a license for an organization
func (u *licenseUsecase) ActivateLicense(req *domain.LicenseActivationRequest) (*domain.LicenseValidationResponse, error) {
	// Get license by key
	license, err := u.repo.GetByKey(req.LicenseKey)
	if err != nil {
		return &domain.LicenseValidationResponse{
			Valid:   false,
			Message: "Invalid license key",
		}, err
	}

	// Check if already activated
	if license.ActivatedAt != nil {
		return &domain.LicenseValidationResponse{
			Valid:   false,
			Message: "License already activated",
		}, errors.New("license already activated")
	}

	// Activate license
	now := time.Now()
	license.ActivatedAt = &now
	license.OrganizationID = req.OrganizationID
	license.OrganizationName = req.OrganizationName
	license.ContactEmail = req.ContactEmail

	license, err = u.repo.Update(license)
	if err != nil {
		return nil, err
	}

	return u.buildValidationResponse(license), nil
}

// ValidateLicense validates a license key
func (u *licenseUsecase) ValidateLicense(licenseKey string) (*domain.LicenseValidationResponse, error) {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return &domain.LicenseValidationResponse{
			Valid:   false,
			Message: "Invalid license key",
		}, err
	}

	return u.buildValidationResponse(license), nil
}

// CheckLicenseExpiry checks if a license is expired and returns days left
func (u *licenseUsecase) CheckLicenseExpiry(licenseKey string) (bool, int, error) {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return true, 0, err
	}

	if license.ExpiresAt == nil {
		return false, -1, nil // Perpetual license
	}

	daysLeft := int(time.Until(*license.ExpiresAt).Hours() / 24)
	isExpired := license.IsExpired()

	return isExpired, daysLeft, nil
}

// TrackAPICall increments the API call counter
func (u *licenseUsecase) TrackAPICall(licenseKey string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	// Check if limit exceeded
	if !license.CanMakeAPICall() {
		return errors.New("API call limit exceeded")
	}

	// Increment counter
	license.CurrentAPICalls++
	_, err = u.repo.Update(license)
	if err != nil {
		return err
	}

	// Log usage
	return u.repo.LogUsage(&domain.LicenseUsageLog{
		LicenseID:  license.ID,
		UsageType:  "api_call",
		Count:      1,
		RecordedAt: time.Now(),
	})
}

// TrackUserLogin tracks a user login event
func (u *licenseUsecase) TrackUserLogin(licenseKey string, userID string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	// Log usage
	return u.repo.LogUsage(&domain.LicenseUsageLog{
		LicenseID:  license.ID,
		UsageType:  "user_login",
		Count:      1,
		Metadata:   fmt.Sprintf(`{"user_id":"%s"}`, userID),
		RecordedAt: time.Now(),
	})
}

// TrackStorageUsage updates storage usage
func (u *licenseUsecase) TrackStorageUsage(licenseKey string, sizeInGB int) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	license.CurrentStorage = sizeInGB
	_, err = u.repo.Update(license)
	return err
}

// GetUsageStatistics retrieves current usage statistics
func (u *licenseUsecase) GetUsageStatistics(licenseKey string) (*domain.LicenseLimits, error) {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return nil, err
	}

	return &domain.LicenseLimits{
		MaxUsers:        license.MaxUsers,
		CurrentUsers:    license.CurrentUsers,
		MaxAPICalls:     license.MaxAPICall,
		CurrentAPICalls: license.CurrentAPICalls,
		MaxStorage:      license.MaxStorage,
		CurrentStorage:  license.CurrentStorage,
	}, nil
}

// ResetMonthlyUsage resets monthly usage counters
func (u *licenseUsecase) ResetMonthlyUsage(licenseKey string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	return u.repo.ResetMonthlyUsage(license.ID)
}

// UpgradeLicense upgrades a license to a higher tier
func (u *licenseUsecase) UpgradeLicense(licenseKey string, newTier domain.LicenseTier) (*domain.License, error) {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return nil, err
	}

	// Update tier and limits
	license.Tier = newTier
	maxUsers, maxAPICalls, maxStorage := domain.GetTierLimits(newTier)
	license.MaxUsers = maxUsers
	license.MaxAPICall = maxAPICalls
	license.MaxStorage = maxStorage

	return u.repo.Update(license)
}

// DowngradeLicense downgrades a license to a lower tier
func (u *licenseUsecase) DowngradeLicense(licenseKey string, newTier domain.LicenseTier) (*domain.License, error) {
	return u.UpgradeLicense(licenseKey, newTier) // Same logic
}

// SuspendLicense suspends a license
func (u *licenseUsecase) SuspendLicense(licenseKey string, reason string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	now := time.Now()
	license.Status = domain.LicenseStatusSuspended
	license.SuspendedAt = &now
	license.Notes = reason

	_, err = u.repo.Update(license)
	return err
}

// RevokeLicense revokes a license permanently
func (u *licenseUsecase) RevokeLicense(licenseKey string, reason string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	license.Status = domain.LicenseStatusRevoked
	license.Notes = reason

	_, err = u.repo.Update(license)
	return err
}

// ReactivateLicense reactivates a suspended license
func (u *licenseUsecase) ReactivateLicense(licenseKey string) error {
	license, err := u.repo.GetByKey(licenseKey)
	if err != nil {
		return err
	}

	license.Status = domain.LicenseStatusActive
	license.SuspendedAt = nil

	_, err = u.repo.Update(license)
	return err
}

// buildValidationResponse builds a validation response from a license
func (u *licenseUsecase) buildValidationResponse(license *domain.License) *domain.LicenseValidationResponse {
	response := &domain.LicenseValidationResponse{
		Valid:     license.IsValid(),
		License:   license,
		Tier:      license.Tier,
		Status:    license.Status,
		ExpiresAt: license.ExpiresAt,
		Limits: domain.LicenseLimits{
			MaxUsers:        license.MaxUsers,
			CurrentUsers:    license.CurrentUsers,
			MaxAPICalls:     license.MaxAPICall,
			CurrentAPICalls: license.CurrentAPICalls,
			MaxStorage:      license.MaxStorage,
			CurrentStorage:  license.CurrentStorage,
		},
	}

	if license.ExpiresAt != nil {
		daysLeft := int(time.Until(*license.ExpiresAt).Hours() / 24)
		response.DaysLeft = daysLeft

		if license.IsExpired() {
			response.Valid = false
			response.Message = "License has expired"
		} else if daysLeft <= 30 {
			response.Message = fmt.Sprintf("License expires in %d days", daysLeft)
		}
	}

	if license.Status != domain.LicenseStatusActive {
		response.Valid = false
		response.Message = fmt.Sprintf("License is %s", license.Status)
	}

	return response
}
