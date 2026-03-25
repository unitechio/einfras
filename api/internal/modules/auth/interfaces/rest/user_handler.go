//go:build legacy
// +build legacy

package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/application"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

type UserHandler struct {
	userUsecase usecase.UserUsecase
	roleUsecase usecase.RoleUsecase
}

func NewUserHandler(
	userUsecase usecase.UserUsecase,
	roleUsecase usecase.RoleUsecase,
) *UserHandler {
	return &UserHandler{
		userUsecase: userUsecase,
		roleUsecase: roleUsecase,
	}
}

// Create creates a new user account
// @Summary Create a new user
// @Description Create a new user account with username, email, password, and optional profile information
// @Tags users
// @Accept json
// @Produce json
// @Param request body domain.User true "User creation data (password field required)"
// @Success 201 {object} map[string]interface{} "User created successfully"
// @Failure 400 {object} errorx.Error "Invalid request body or validation error"
// @Failure 409 {object} errorx.Error "User with email or username already exists"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users [post]
// @Security BearerAuth
func (h *UserHandler) Create(c *gin.Context) {
	var user domain.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	// Password is required for user creation
	if user.Password == "" {
		c.Error(errorx.New(http.StatusBadRequest, "Password is required"))
		return
	}

	// Store password temporarily before it gets hashed
	password := user.Password

	if err := h.userUsecase.CreateUser(c.Request.Context(), &user, password); err != nil {
		// Check for specific error types
		if err.Error() == "user with this email already exists" || err.Error() == "user with this username already exists" {
			c.Error(errorx.New(http.StatusConflict, err.Error()))
		} else {
			c.Error(errorx.New(http.StatusInternalServerError, "Failed to create user: "+err.Error()).WithStack())
		}
		return
	}

	// Remove password from response
	user.Password = ""

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"data":    user,
	})
}

// Get retrieves a user by ID
// @Summary Get user by ID
// @Description Retrieve detailed information about a specific user by their unique ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Success 200 {object} map[string]interface{} "User details"
// @Failure 400 {object} errorx.Error "Invalid user ID"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id} [get]
// @Security BearerAuth
func (h *UserHandler) Get(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	user, err := h.userUsecase.GetUser(c.Request.Context(), id)
	if err != nil {
		c.Error(errorx.New(http.StatusNotFound, "User not found: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User retrieved successfully",
		"data":    user,
	})
}

// List retrieves a paginated list of users with filtering
// @Summary List all users
// @Description Get a paginated list of users with optional filtering by role, active status, and search term
// @Tags users
// @Accept json
// @Produce json
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 10, max: 100)" default(10)
// @Param search query string false "Search term (searches in username, email, first name, last name)"
// @Param role_id query string false "Filter by role ID (UUID)"
// @Param is_active query boolean false "Filter by active status"
// @Success 200 {object} map[string]interface{} "List of users with pagination info"
// @Failure 400 {object} errorx.Error "Invalid query parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users [get]
// @Security BearerAuth
func (h *UserHandler) List(c *gin.Context) {
	var filter domain.UserFilter

	// Parse pagination parameters
	if page, err := strconv.Atoi(c.Query("page")); err == nil && page > 0 {
		filter.Page = page
	} else {
		filter.Page = 1
	}

	if pageSize, err := strconv.Atoi(c.Query("page_size")); err == nil && pageSize > 0 {
		filter.PageSize = pageSize
		if filter.PageSize > 100 {
			filter.PageSize = 100 // Limit max page size
		}
	} else {
		filter.PageSize = 10
	}

	// Parse filter parameters
	filter.Search = c.Query("search")
	filter.RoleID = c.Query("role_id")

	if isActive := c.Query("is_active"); isActive != "" {
		active, err := strconv.ParseBool(isActive)
		if err == nil {
			filter.IsActive = &active
		}
	}

	users, total, err := h.userUsecase.ListUsers(c.Request.Context(), filter)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to retrieve users: "+err.Error()).WithStack())
		return
	}

	totalPages := (total + int64(filter.PageSize) - 1) / int64(filter.PageSize)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Users retrieved successfully",
		"data":        users,
		"total":       total,
		"page":        filter.Page,
		"page_size":   filter.PageSize,
		"total_pages": totalPages,
	})
}

// Update updates an existing user's information
// @Summary Update user
// @Description Update an existing user's profile information, role, or status
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Param request body domain.User true "Updated user data"
// @Success 200 {object} map[string]interface{} "User updated successfully"
// @Failure 400 {object} errorx.Error "Invalid request body or validation error"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 409 {object} errorx.Error "Email or username already in use"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id} [put]
// @Security BearerAuth
func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	var user domain.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	user.ID = id
	if err := h.userUsecase.UpdateUser(c.Request.Context(), &user); err != nil {
		// Check for specific error types
		if err.Error() == "user not found" {
			c.Error(errorx.New(http.StatusNotFound, err.Error()))
		} else if err.Error() == "email already in use" || err.Error() == "username already in use" {
			c.Error(errorx.New(http.StatusConflict, err.Error()))
		} else {
			c.Error(errorx.New(http.StatusInternalServerError, "Failed to update user: "+err.Error()).WithStack())
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated successfully",
		"data":    user,
	})
}

// Delete soft deletes a user
// @Summary Delete user
// @Description Soft delete a user by their ID (marks as deleted but doesn't remove from database)
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Success 200 {object} map[string]interface{} "User deleted successfully"
// @Failure 400 {object} errorx.Error "Invalid user ID"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id} [delete]
// @Security BearerAuth
func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	if err := h.userUsecase.DeleteUser(c.Request.Context(), id); err != nil {
		if err.Error() == "user not found" {
			c.Error(errorx.New(http.StatusNotFound, err.Error()))
		} else {
			c.Error(errorx.New(http.StatusInternalServerError, "Failed to delete user: "+err.Error()).WithStack())
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// ChangePassword changes a user's password with old password verification
// @Summary Change user password
// @Description Change a user's password after verifying the current password
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Param request body object{old_password=string,new_password=string} true "Password change request"
// @Success 200 {object} map[string]interface{} "Password changed successfully"
// @Failure 400 {object} errorx.Error "Invalid request or incorrect old password"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id}/password [put]
// @Security BearerAuth
func (h *UserHandler) ChangePassword(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	if err := h.userUsecase.ChangePassword(c.Request.Context(), id, req.OldPassword, req.NewPassword); err != nil {
		if err.Error() == "user not found" {
			c.Error(errorx.New(http.StatusNotFound, err.Error()))
		} else if err.Error() == "invalid old password" {
			c.Error(errorx.New(http.StatusBadRequest, err.Error()))
		} else {
			c.Error(errorx.New(http.StatusInternalServerError, "Failed to change password: "+err.Error()).WithStack())
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password changed successfully",
	})
}

// ResetPassword resets a user's password (admin only)
// @Summary Reset user password
// @Description Reset a user's password without requiring the old password (admin operation)
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Param request body object{new_password=string} true "Password reset request"
// @Success 200 {object} map[string]interface{} "Password reset successfully"
// @Failure 400 {object} errorx.Error "Invalid request body"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id}/password/reset [post]
// @Security BearerAuth
func (h *UserHandler) ResetPassword(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	var req struct {
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	if err := h.userUsecase.ResetPassword(c.Request.Context(), id, req.NewPassword); err != nil {
		if err.Error() == "user not found" {
			c.Error(errorx.New(http.StatusNotFound, err.Error()))
		} else {
			c.Error(errorx.New(http.StatusInternalServerError, "Failed to reset password: "+err.Error()).WithStack())
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password reset successfully",
	})
}

// UpdateSettings updates user-specific settings and preferences
// @Summary Update user settings
// @Description Update a user's settings and preferences (theme, language, notifications, etc.)
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID (UUID)"
// @Param settings body domain.UserSettings true "User settings"
// @Success 200 {object} map[string]interface{} "Settings updated successfully"
// @Failure 400 {object} errorx.Error "Invalid request body"
// @Failure 404 {object} errorx.Error "User not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/{id}/settings [put]
// @Security BearerAuth
func (h *UserHandler) UpdateSettings(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	var settings domain.UserSettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	if err := h.userUsecase.UpdateUserSettings(c.Request.Context(), id, settings); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to update settings: "+err.Error()).WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Settings updated successfully",
		"data":    settings,
	})
}

// ImportUsers imports users from an Excel file
// @Summary Import users from Excel
// @Description Import multiple users from an Excel file (.xlsx format)
// @Tags users
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Excel file containing user data"
// @Success 200 {object} map[string]interface{} "Users imported successfully"
// @Failure 400 {object} errorx.Error "Invalid file or file format"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/import [post]
// @Security BearerAuth
func (h *UserHandler) ImportUsers(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "File is required: "+err.Error()))
		return
	}

	// Validate file extension
	ext := filepath.Ext(file.Filename)
	if ext != ".xlsx" && ext != ".xls" {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid file format. Only .xlsx and .xls files are supported"))
		return
	}

	// Save uploaded file temporarily
	tempPath := fmt.Sprintf("/tmp/%s", file.Filename)
	if err := c.SaveUploadedFile(file, tempPath); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to save uploaded file: "+err.Error()).WithStack())
		return
	}

	// Import users from the file
	if err := h.userUsecase.ImportUsersFromExcel(c.Request.Context(), tempPath); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to import users: "+err.Error()).WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Users imported successfully",
	})
}

// ExportUsers exports all users to an Excel file
// @Summary Export users to Excel
// @Description Export all users to an Excel file (.xlsx format)
// @Tags users
// @Accept json
// @Produce application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// @Success 200 {file} file "Excel file containing user data"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /users/export [get]
// @Security BearerAuth
func (h *UserHandler) ExportUsers(c *gin.Context) {
	file, filename, err := h.userUsecase.ExportUsersToExcel(c.Request.Context())
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to export users: "+err.Error()).WithStack())
		return
	}

	// Set headers for file download
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Transfer-Encoding", "binary")

	// Write the Excel file to response
	if err := file.Write(c.Writer); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to write file: "+err.Error()).WithStack())
		return
	}
}
