//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/server/application/settings_uc"
	"einfra/api/internal/domain"
)

// SystemSettingHandler handles HTTP requests related to system settings.
type SystemSettingHandler struct {
	uc *usecase.SystemSettingUsecase
}

// NewSystemSettingHandler creates a new instance of SystemSettingHandler.
func NewSystemSettingHandler(uc *usecase.SystemSettingUsecase) *SystemSettingHandler {
	return &SystemSettingHandler{uc: uc}
}

// CreateSystemSetting handles the creation of a new system setting.
// @Summary Create a new system setting
// @Description Create a new system-wide configuration setting
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Param setting body domain.SystemSetting true "System Setting"
// @Success 201 {object} domain.SystemSetting
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/system-settings [post]
func (h *SystemSettingHandler) CreateSystemSetting(c *gin.Context) {
	var setting domain.SystemSetting
	if err := c.ShouldBindJSON(&setting); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdSetting, err := h.uc.CreateSystemSetting(&setting)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdSetting)
}

// GetSystemSettingByKey handles the retrieval of a system setting by its key.
// @Summary Get system setting by key
// @Description Retrieve a system setting by its unique key
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Param key path string true "Setting Key"
// @Success 200 {object} domain.SystemSetting
// @Failure 404 {object} map[string]string
// @Router /api/v1/system-settings/key/{key} [get]
func (h *SystemSettingHandler) GetSystemSettingByKey(c *gin.Context) {
	key := c.Param("key")
	setting, err := h.uc.GetSystemSettingByKey(key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "system setting not found"})
		return
	}

	c.JSON(http.StatusOK, setting)
}

// GetAllSystemSettings handles the retrieval of all system settings.
// @Summary Get all system settings
// @Description Retrieve all system-wide configuration settings
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Success 200 {array} domain.SystemSetting
// @Failure 500 {object} map[string]string
// @Router /api/v1/system-settings [get]
func (h *SystemSettingHandler) GetAllSystemSettings(c *gin.Context) {
	settings, err := h.uc.GetAllSystemSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// GetSystemSettingsByCategory handles the retrieval of all system settings of a specific category.
// @Summary Get system settings by category
// @Description Retrieve all system settings belonging to a specific category
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Param category path string true "Category"
// @Success 200 {array} domain.SystemSetting
// @Failure 500 {object} map[string]string
// @Router /api/v1/system-settings/category/{category} [get]
func (h *SystemSettingHandler) GetSystemSettingsByCategory(c *gin.Context) {
	category := c.Param("category")
	settings, err := h.uc.GetSystemSettingsByCategory(category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateSystemSetting handles the update of an existing system setting.
// @Summary Update system setting
// @Description Update an existing system setting
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Param id path string true "Setting ID"
// @Param setting body domain.SystemSetting true "System Setting"
// @Success 200 {object} domain.SystemSetting
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/system-settings/{id} [put]
func (h *SystemSettingHandler) UpdateSystemSetting(c *gin.Context) {
	id := c.Param("id")
	var setting domain.SystemSetting
	if err := c.ShouldBindJSON(&setting); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	setting.ID = id

	updatedSetting, err := h.uc.UpdateSystemSetting(&setting)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedSetting)
}

// DeleteSystemSetting handles the deletion of a system setting by its ID.
// @Summary Delete system setting
// @Description Delete a system setting by its ID
// @Tags SystemSettings
// @Accept json
// @Produce json
// @Param id path string true "Setting ID"
// @Success 204
// @Failure 500 {object} map[string]string
// @Router /api/v1/system-settings/{id} [delete]
func (h *SystemSettingHandler) DeleteSystemSetting(c *gin.Context) {
	id := c.Param("id")
	if err := h.uc.DeleteSystemSetting(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
