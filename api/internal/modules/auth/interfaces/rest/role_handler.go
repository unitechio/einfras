//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/application"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

// RoleHandler handles role management HTTP requests
type RoleHandler struct {
	roleUsecase usecase.RoleUsecase
}

// NewRoleHandler creates a new role handler instance
func NewRoleHandler(roleUsecase usecase.RoleUsecase) *RoleHandler {
	return &RoleHandler{
		roleUsecase: roleUsecase,
	}
}

// Create creates a new role
// @Summary Create a new role
// @Description Create a new role with specified permissions
// @Tags roles
// @Accept json
// @Produce json
// @Param role body domain.Role true "Role object to create"
// @Success 201 {object} map[string]interface{} "Role created successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 409 {object} map[string]interface{} "Role with this name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/roles [post]
// @Security BearerAuth
func (h *RoleHandler) Create(c *gin.Context) {
	var role domain.Role

	// Bind and validate request body
	if err := c.ShouldBindJSON(&role); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Create role using usecase
	if err := h.roleUsecase.Create(c.Request.Context(), &role); err != nil {
		// Check if it's a duplicate name error
		if errorx.GetCode(err) == errorx.CodeConflict {
			c.Error(err)
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create role"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create role",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Role created successfully",
		"role":    role,
	})
}

// Get retrieves a role by ID
// @Summary Get role by ID
// @Description Retrieve a specific role by its ID with associated permissions
// @Tags roles
// @Produce json
// @Param id path string true "Role ID (UUID)"
// @Success 200 {object} map[string]interface{} "Role details with permissions"
// @Failure 400 {object} map[string]interface{} "Invalid role ID"
// @Failure 404 {object} map[string]interface{} "Role not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/roles/{id} [get]
// @Security BearerAuth
func (h *RoleHandler) Get(c *gin.Context) {
	// Extract role ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Role ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Role ID is required",
		})
		return
	}

	// Retrieve role from usecase
	role, err := h.roleUsecase.GetByID(c.Request.Context(), id)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeNotFound, "Role not found"))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Role not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"role": role,
	})
}

// List retrieves all roles with filtering and pagination
// @Summary List all roles
// @Description Retrieve a list of roles with optional filtering by active status and pagination
// @Tags roles
// @Produce json
// @Param is_active query boolean false "Filter by active status"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Success 200 {object} map[string]interface{} "List of roles with pagination info"
// @Failure 400 {object} map[string]interface{} "Invalid query parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/roles [get]
// @Security BearerAuth
func (h *RoleHandler) List(c *gin.Context) {
	// Initialize filter with default values
	filter := domain.RoleFilter{
		Page:     1,
		PageSize: 20,
	}

	// Parse is_active filter
	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		isActive, err := strconv.ParseBool(isActiveStr)
		if err != nil {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid is_active parameter"))
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid is_active parameter, must be true or false",
			})
			return
		}
		filter.IsActive = &isActive
	}

	// Parse page number
	if pageStr := c.Query("page"); pageStr != "" {
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid page parameter"))
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid page parameter, must be a positive integer",
			})
			return
		}
		filter.Page = page
	}

	// Parse page size
	if pageSizeStr := c.Query("page_size"); pageSizeStr != "" {
		pageSize, err := strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 || pageSize > 100 {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid page_size parameter"))
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid page_size parameter, must be between 1 and 100",
			})
			return
		}
		filter.PageSize = pageSize
	}

	// Retrieve roles from usecase
	roles, total, err := h.roleUsecase.List(c.Request.Context(), filter)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to list roles"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list roles",
		})
		return
	}

	// Calculate total pages
	totalPages := (int(total) + filter.PageSize - 1) / filter.PageSize

	c.JSON(http.StatusOK, gin.H{
		"message":     "Roles retrieved successfully",
		"roles":       roles,
		"total":       total,
		"page":        filter.Page,
		"page_size":   filter.PageSize,
		"total_pages": totalPages,
	})
}

// Update updates an existing role
// @Summary Update role
// @Description Update an existing role's information and permissions
// @Tags roles
// @Accept json
// @Produce json
// @Param id path string true "Role ID (UUID)"
// @Param role body domain.Role true "Updated role object"
// @Success 200 {object} map[string]interface{} "Role updated successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "Role not found"
// @Failure 409 {object} map[string]interface{} "Role name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/roles/{id} [put]
// @Security BearerAuth
func (h *RoleHandler) Update(c *gin.Context) {
	// Extract role ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Role ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Role ID is required",
		})
		return
	}

	var role domain.Role

	// Bind and validate request body
	if err := c.ShouldBindJSON(&role); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Set the ID from URL parameter
	role.ID = id

	// Update role using usecase
	if err := h.roleUsecase.Update(c.Request.Context(), &role); err != nil {
		// Check error type
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}
		if errorx.GetCode(err) == errorx.CodeConflict {
			c.Error(err)
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to update role"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update role",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Role updated successfully",
		"role":    role,
	})
}

// Delete deletes a role
// @Summary Delete role
// @Description Soft delete a role by ID (role will be marked as deleted but not removed from database)
// @Tags roles
// @Produce json
// @Param id path string true "Role ID (UUID)"
// @Success 200 {object} map[string]interface{} "Role deleted successfully"
// @Failure 400 {object} map[string]interface{} "Invalid role ID"
// @Failure 404 {object} map[string]interface{} "Role not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/roles/{id} [delete]
// @Security BearerAuth
func (h *RoleHandler) Delete(c *gin.Context) {
	// Extract role ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Role ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Role ID is required",
		})
		return
	}

	// Delete role using usecase
	if err := h.roleUsecase.Delete(c.Request.Context(), id); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to delete role"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete role",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Role deleted successfully",
	})
}
