//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/server/application/settings_uc"
	"einfra/api/internal/domain"
)

// FeatureFlagHandler handles HTTP requests related to feature flags.
type FeatureFlagHandler struct {
	uc usecase.FeatureFlagUsecase
}

// NewFeatureFlagHandler creates a new instance of FeatureFlagHandler.
func NewFeatureFlagHandler(uc usecase.FeatureFlagUsecase) *FeatureFlagHandler {
	return &FeatureFlagHandler{uc: uc}
}

func (h *FeatureFlagHandler) CreateFeatureFlag(c *gin.Context) {
	var flag domain.FeatureFlag
	if err := c.ShouldBindJSON(&flag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdFlag, err := h.uc.CreateFeatureFlag(&flag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdFlag)
}

// GetFeatureFlagByName handles the retrieval of a feature flag by its name.
func (h *FeatureFlagHandler) GetFeatureFlagByName(c *gin.Context) {
	name := c.Param("name")
	flag, err := h.uc.GetFeatureFlagByName(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "feature flag not found"})
		return
	}

	c.JSON(http.StatusOK, flag)
}

// GetAllFeatureFlags handles the retrieval of all feature flags.
func (h *FeatureFlagHandler) GetAllFeatureFlags(c *gin.Context) {
	flags, err := h.uc.GetAllFeatureFlags()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, flags)
}

// GetFeatureFlagsByCategory handles the retrieval of all feature flags of a specific category.
func (h *FeatureFlagHandler) GetFeatureFlagsByCategory(c *gin.Context) {
	category := c.Param("category")
	flags, err := h.uc.GetFeatureFlagsByCategory(category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, flags)
}

// UpdateFeatureFlag handles the update of an existing feature flag.
func (h *FeatureFlagHandler) UpdateFeatureFlag(c *gin.Context) {
	var flag domain.FeatureFlag
	if err := c.ShouldBindJSON(&flag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updatedFlag, err := h.uc.UpdateFeatureFlag(&flag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedFlag)
}

// DeleteFeatureFlag handles the deletion of a feature flag by its ID.
func (h *FeatureFlagHandler) DeleteFeatureFlag(c *gin.Context) {
	id := c.Param("id")
	if err := h.uc.DeleteFeatureFlag(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
