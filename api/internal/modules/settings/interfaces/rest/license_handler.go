//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/server/application/settings_uc"
	"einfra/api/internal/domain"
)

// LicenseHandler handles HTTP requests for license management
type LicenseHandler struct {
	usecase usecase.LicenseUsecase
}

// NewLicenseHandler creates a new LicenseHandler instance
func NewLicenseHandler(uc usecase.LicenseUsecase) *LicenseHandler {
	return &LicenseHandler{usecase: uc}
}

// ActivateLicense activates a license for an organization
// @Summary Activate a license
// @Description Activate a license key for an organization
// @Tags License
// @Accept json
// @Produce json
// @Param request body domain.LicenseActivationRequest true "License Activation Request"
// @Success 200 {object} domain.LicenseValidationResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/licenses/activate [post]
func (h *LicenseHandler) ActivateLicense(c *gin.Context) {
	var req domain.LicenseActivationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.usecase.ActivateLicense(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// ValidateLicense validates a license key
// @Summary Validate a license
// @Description Validate a license key and get license information
// @Tags License
// @Accept json
// @Produce json
// @Param license_key query string true "License Key"
// @Success 200 {object} domain.LicenseValidationResponse
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/licenses/validate [get]
func (h *LicenseHandler) ValidateLicense(c *gin.Context) {
	licenseKey := c.Query("license_key")
	if licenseKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "license_key is required"})
		return
	}

	response, err := h.usecase.ValidateLicense(licenseKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetCurrentLicense gets the current license information
// @Summary Get current license
// @Description Get information about the current active license
// @Tags License
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Success 200 {object} domain.License
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/licenses/current [get]
func (h *LicenseHandler) GetCurrentLicense(c *gin.Context) {
	licenseKey, exists := c.Get("license_key")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "License key not found in context"})
		return
	}

	license, err := h.usecase.GetLicenseByKey(licenseKey.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, license)
}

// GetUsageStatistics gets usage statistics for the current license
// @Summary Get usage statistics
// @Description Get current usage statistics for the license
// @Tags License
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Success 200 {object} domain.LicenseLimits
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/v1/licenses/usage [get]
func (h *LicenseHandler) GetUsageStatistics(c *gin.Context) {
	licenseKey, exists := c.Get("license_key")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "License key not found in context"})
		return
	}

	stats, err := h.usecase.GetUsageStatistics(licenseKey.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// CreateLicenseRequest represents a request to create a new license
type CreateLicenseRequest struct {
	Tier             string `json:"tier" binding:"required"`
	OrganizationID   string `json:"organization_id" binding:"required"`
	OrganizationName string `json:"organization_name" binding:"required"`
	ContactEmail     string `json:"contact_email" binding:"required,email"`
	DurationDays     *int   `json:"duration_days,omitempty"` // nil = perpetual
}

// CreateLicense creates a new license (Admin only)
// @Summary Create a new license
// @Description Create a new license for an organization (Admin only)
// @Tags License
// @Accept json
// @Produce json
// @Param request body CreateLicenseRequest true "Create License Request"
// @Success 201 {object} domain.License
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/licenses [post]
func (h *LicenseHandler) CreateLicense(c *gin.Context) {
	var req CreateLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tier := domain.LicenseTier(req.Tier)

	var duration *time.Duration
	if req.DurationDays != nil {
		d := time.Duration(*req.DurationDays) * 24 * time.Hour
		duration = &d
	}

	license, err := h.usecase.CreateLicense(tier, req.OrganizationID, req.OrganizationName, req.ContactEmail, duration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, license)
}

// ListLicenses lists all licenses (Admin only)
// @Summary List all licenses
// @Description Get a list of all licenses (Admin only)
// @Tags License
// @Accept json
// @Produce json
// @Success 200 {array} domain.License
// @Failure 500 {object} map[string]string
// @Router /api/v1/admin/licenses [get]
func (h *LicenseHandler) ListLicenses(c *gin.Context) {
	licenses, err := h.usecase.GetAllLicenses()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, licenses)
}

// UpgradeLicenseRequest represents a request to upgrade a license
type UpgradeLicenseRequest struct {
	NewTier string `json:"new_tier" binding:"required"`
}

// UpgradeLicense upgrades a license to a higher tier
// @Summary Upgrade license
// @Description Upgrade the current license to a higher tier
// @Tags License
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param request body UpgradeLicenseRequest true "Upgrade Request"
// @Success 200 {object} domain.License
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/v1/licenses/upgrade [post]
func (h *LicenseHandler) UpgradeLicense(c *gin.Context) {
	licenseKey, exists := c.Get("license_key")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "License key not found in context"})
		return
	}

	var req UpgradeLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newTier := domain.LicenseTier(req.NewTier)
	license, err := h.usecase.UpgradeLicense(licenseKey.(string), newTier)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, license)
}

// SuspendLicense suspends a license (Admin only)
// @Summary Suspend a license
// @Description Suspend a license by license key (Admin only)
// @Tags License
// @Accept json
// @Produce json
// @Param license_key path string true "License Key"
// @Param reason body map[string]string true "Suspension Reason"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /api/v1/admin/licenses/{license_key}/suspend [post]
func (h *LicenseHandler) SuspendLicense(c *gin.Context) {
	licenseKey := c.Param("license_key")

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.usecase.SuspendLicense(licenseKey, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "License suspended successfully"})
}

// ReactivateLicense reactivates a suspended license (Admin only)
// @Summary Reactivate a license
// @Description Reactivate a suspended license (Admin only)
// @Tags License
// @Accept json
// @Produce json
// @Param license_key path string true "License Key"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /api/v1/admin/licenses/{license_key}/reactivate [post]
func (h *LicenseHandler) ReactivateLicense(c *gin.Context) {
	licenseKey := c.Param("license_key")

	if err := h.usecase.ReactivateLicense(licenseKey); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "License reactivated successfully"})
}
