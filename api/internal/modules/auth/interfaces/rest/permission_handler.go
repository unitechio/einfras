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

// PermissionHandler handles permission management HTTP requests
type PermissionHandler struct {
	permissionUsecase usecase.PermissionUsecase
}

// NewPermissionHandler creates a new permission handler instance
func NewPermissionHandler(permissionUsecase usecase.PermissionUsecase) *PermissionHandler {
	return &PermissionHandler{
		permissionUsecase: permissionUsecase,
	}
}

// Create creates a new permission
// @Summary Create a new permission
// @Description Create a new permission with specified resource, action, and scope
// @Tags permissions
// @Accept json
// @Produce json
// @Param permission body domain.Permission true "Permission object to create"
// @Success 201 {object} map[string]interface{} "Permission created successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 409 {object} map[string]interface{} "Permission with this name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions [post]
// @Security BearerAuth
func (h *PermissionHandler) Create(c *gin.Context) {
	var permission domain.Permission

	// Bind and validate request body
	if err := c.ShouldBindJSON(&permission); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Validate permission name format (should be resource.action or resource.subresource.action)
	if permission.Name == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Permission name is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Permission name is required",
		})
		return
	}

	// Create permission using usecase
	if err := h.permissionUsecase.Create(c.Request.Context(), &permission); err != nil {
		// Check if it's a duplicate name error
		if errorx.GetCode(err) == errorx.CodeConflict {
			c.Error(err)
			c.JSON(http.StatusConflict, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create permission"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create permission",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Permission created successfully",
		"permission": permission,
	})
}

// Get retrieves a permission by ID
// @Summary Get permission by ID
// @Description Retrieve a specific permission by its ID
// @Tags permissions
// @Produce json
// @Param id path string true "Permission ID (UUID)"
// @Success 200 {object} map[string]interface{} "Permission details"
// @Failure 400 {object} map[string]interface{} "Invalid permission ID"
// @Failure 404 {object} map[string]interface{} "Permission not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/{id} [get]
// @Security BearerAuth
func (h *PermissionHandler) Get(c *gin.Context) {
	// Extract permission ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Permission ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Permission ID is required",
		})
		return
	}

	// Retrieve permission from usecase
	permission, err := h.permissionUsecase.GetByID(c.Request.Context(), id)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeNotFound, "Permission not found"))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Permission not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"permission": permission,
	})
}

// List retrieves all permissions with filtering and pagination
// @Summary List all permissions
// @Description Retrieve a list of permissions with optional filtering by resource, action, scope and pagination
// @Tags permissions
// @Produce json
// @Param resource query string false "Filter by resource (e.g., 'server', 'k8s', 'docker')"
// @Param action query string false "Filter by action (e.g., 'create', 'read', 'update', 'delete')"
// @Param scope query string false "Filter by scope ('global', 'environment', 'resource')"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Success 200 {object} map[string]interface{} "List of permissions with pagination info"
// @Failure 400 {object} map[string]interface{} "Invalid query parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions [get]
// @Security BearerAuth
func (h *PermissionHandler) List(c *gin.Context) {
	// Initialize filter with default values
	filter := domain.PermissionFilter{
		Resource: c.Query("resource"),
		Action:   c.Query("action"),
		Page:     1,
		PageSize: 20,
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

	// Retrieve permissions from usecase
	permissions, total, err := h.permissionUsecase.List(c.Request.Context(), filter)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to list permissions"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list permissions",
		})
		return
	}

	// Calculate total pages
	totalPages := (int(total) + filter.PageSize - 1) / filter.PageSize

	c.JSON(http.StatusOK, gin.H{
		"message":     "Permissions retrieved successfully",
		"permissions": permissions,
		"total":       total,
		"page":        filter.Page,
		"page_size":   filter.PageSize,
		"total_pages": totalPages,
		"filters": gin.H{
			"resource": filter.Resource,
			"action":   filter.Action,
		},
	})
}

// Update updates an existing permission
// @Summary Update permission
// @Description Update an existing permission's information
// @Tags permissions
// @Accept json
// @Produce json
// @Param id path string true "Permission ID (UUID)"
// @Param permission body domain.Permission true "Updated permission object"
// @Success 200 {object} map[string]interface{} "Permission updated successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "Permission not found"
// @Failure 409 {object} map[string]interface{} "Permission name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/{id} [put]
// @Security BearerAuth
func (h *PermissionHandler) Update(c *gin.Context) {
	// Extract permission ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Permission ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Permission ID is required",
		})
		return
	}

	var permission domain.Permission

	// Bind and validate request body
	if err := c.ShouldBindJSON(&permission); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Set the ID from URL parameter
	permission.ID = id

	// Validate permission name
	if permission.Name == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Permission name is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Permission name is required",
		})
		return
	}

	// Update permission using usecase
	if err := h.permissionUsecase.Update(c.Request.Context(), &permission); err != nil {
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

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to update permission"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update permission",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Permission updated successfully",
		"permission": permission,
	})
}

// Delete deletes a permission
// @Summary Delete permission
// @Description Soft delete a permission by ID (permission will be marked as deleted but not removed from database)
// @Tags permissions
// @Produce json
// @Param id path string true "Permission ID (UUID)"
// @Success 200 {object} map[string]interface{} "Permission deleted successfully"
// @Failure 400 {object} map[string]interface{} "Invalid permission ID"
// @Failure 404 {object} map[string]interface{} "Permission not found"
// @Failure 409 {object} map[string]interface{} "Cannot delete system permission"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/{id} [delete]
// @Security BearerAuth
func (h *PermissionHandler) Delete(c *gin.Context) {
	// Extract permission ID from URL parameter
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Permission ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Permission ID is required",
		})
		return
	}

	// Delete permission using usecase
	if err := h.permissionUsecase.Delete(c.Request.Context(), id); err != nil {
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
				"error": "Cannot delete system permission",
			})
			return
		}

		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to delete permission"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete permission",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Permission deleted successfully",
	})
}

// GetByResource retrieves all permissions for a specific resource
// @Summary Get permissions by resource
// @Description Retrieve all permissions associated with a specific resource (e.g., 'server', 'k8s', 'docker')
// @Tags permissions
// @Produce json
// @Param resource path string true "Resource name (e.g., 'server', 'k8s', 'docker', 'harbor')"
// @Success 200 {object} map[string]interface{} "List of permissions for the resource"
// @Failure 400 {object} map[string]interface{} "Invalid resource parameter"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/permissions/resource/{resource} [get]
// @Security BearerAuth
func (h *PermissionHandler) GetByResource(c *gin.Context) {
	// Extract resource from URL parameter
	resource := c.Param("resource")
	if resource == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Resource parameter is required"))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Resource parameter is required",
		})
		return
	}

	// Retrieve permissions by resource from usecase
	permissions, err := h.permissionUsecase.GetByResource(c.Request.Context(), resource)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to retrieve permissions"))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve permissions for resource",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Permissions retrieved successfully",
		"resource":    resource,
		"permissions": permissions,
		"count":       len(permissions),
	})
}
