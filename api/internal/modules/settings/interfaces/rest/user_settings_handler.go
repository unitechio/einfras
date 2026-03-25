//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/server/application/settings_uc"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

// UserSettingsHandler handles user settings API endpoints
type UserSettingsHandler struct {
	usecase usecase.UserSettingsUsecase
}

// NewUserSettingsHandler creates a new handler instance
func NewUserSettingsHandler(us usecase.UserSettingsUsecase) *UserSettingsHandler {
	return &UserSettingsHandler{usecase: us}
}

// Get retrieves user settings for a given user ID
// @Summary Get user settings
// @Description Retrieve settings for a specific user
// @Tags UserSettings
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Success 200 {object} domain.UserSettings
// @Failure 404 {object} map[string]string
// @Router /users/{userId}/settings [get]
func (h *UserSettingsHandler) Get(c *gin.Context) {
	userID := c.Param("userId")
	settings, err := h.usecase.GetUserSettings(c.Request.Context(), userID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to get user settings"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user settings"})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// Update performs a full update of user settings
// @Summary Update user settings
// @Description Replace the entire settings object for a user
// @Tags UserSettings
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Param settings body domain.UserSettings true "Settings"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /users/{userId}/settings [put]
func (h *UserSettingsHandler) Update(c *gin.Context) {
	userID := c.Param("userId")
	var update domain.UserSettingsUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if err := h.usecase.UpdateUserSettings(c.Request.Context(), userID, &update); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to update settings"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Settings updated"})
}

// Patch performs a partial update of user settings
// @Summary Patch user settings
// @Description Update selected fields of user settings
// @Tags UserSettings
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Param update body domain.UserSettingsUpdate true "Partial update"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /users/{userId}/settings [patch]
func (h *UserSettingsHandler) Patch(c *gin.Context) {
	userID := c.Param("userId")
	var upd domain.UserSettingsUpdate
	if err := c.ShouldBindJSON(&upd); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if err := h.usecase.UpdateUserSettings(c.Request.Context(), userID, &upd); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to patch settings"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to patch settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Settings patched"})
}

// Reset resets a user's settings to defaults
// @Summary Reset user settings
// @Description Reset settings to default values for a user
// @Tags UserSettings
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /users/{userId}/settings/reset [post]
func (h *UserSettingsHandler) Reset(c *gin.Context) {
	userID := c.Param("userId")
	if err := h.usecase.ResetToDefaults(c.Request.Context(), userID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to reset settings"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Settings reset to defaults"})
}
