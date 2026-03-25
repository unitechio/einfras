//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/server/application/settings_uc"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

type EnvironmentHandler struct {
	envUsecase usecase.EnvironmentUsecase
}

func NewEnvironmentHandler(envUsecase usecase.EnvironmentUsecase) *EnvironmentHandler {
	return &EnvironmentHandler{
		envUsecase: envUsecase,
	}
}

// Create creates a new environment
// @Summary Create a new environment
// @Description Create a new deployment environment (dev, staging, production, etc.)
// @Tags environments
// @Accept json
// @Produce json
// @Param environment body domain.Environment true "Environment object"
// @Success 201 {object} map[string]interface{} "Environment created successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request body"
// @Failure 409 {object} map[string]interface{} "Environment with this name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/environments [post]
// @Security BearerAuth
func (h *EnvironmentHandler) Create(c *gin.Context) {
	var env domain.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.envUsecase.CreateEnvironment(c.Request.Context(), &env); err != nil {
		if errorx.GetCode(err) == errorx.CodeConflict {
			c.Error(err)
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create environment"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create environment"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Environment created successfully",
		"environment": env,
	})
}

// Get retrieves an environment by ID
// @Summary Get environment by ID
// @Description Retrieve a specific environment by its ID
// @Tags environments
// @Produce json
// @Param id path string true "Environment ID (UUID)"
// @Success 200 {object} map[string]interface{} "Environment details"
// @Failure 400 {object} map[string]interface{} "Invalid environment ID"
// @Failure 404 {object} map[string]interface{} "Environment not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/environments/{id} [get]
// @Security BearerAuth
func (h *EnvironmentHandler) Get(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Environment ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Environment ID is required"})
		return
	}

	env, err := h.envUsecase.GetEnvironment(c.Request.Context(), id)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeNotFound, "Environment not found"))
		c.JSON(http.StatusNotFound, gin.H{"error": "Environment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"environment": env,
	})
}

// List retrieves all environments with filtering and pagination
// @Summary List all environments
// @Description Retrieve a list of environments with optional filtering and pagination
// @Tags environments
// @Produce json
// @Param is_active query boolean false "Filter by active status"
// @Param name query string false "Filter by name (partial match)"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Success 200 {object} map[string]interface{} "List of environments"
// @Failure 400 {object} map[string]interface{} "Invalid query parameters"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/environments [get]
// @Security BearerAuth
func (h *EnvironmentHandler) List(c *gin.Context) {
	filter := domain.EnvironmentFilter{
		Name:     c.Query("name"),
		Page:     1,
		PageSize: 20,
	}

	// Parse is_active
	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		isActive, err := strconv.ParseBool(isActiveStr)
		if err != nil {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid is_active parameter"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid is_active parameter"})
			return
		}
		filter.IsActive = &isActive
	}

	// Parse page
	if pageStr := c.Query("page"); pageStr != "" {
		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid page parameter"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page parameter"})
			return
		}
		filter.Page = page
	}

	// Parse page_size
	if pageSizeStr := c.Query("page_size"); pageSizeStr != "" {
		pageSize, err := strconv.Atoi(pageSizeStr)
		if err != nil || pageSize < 1 || pageSize > 100 {
			c.Error(errorx.New(errorx.CodeBadRequest, "Invalid page_size parameter (max: 100)"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid page_size parameter (max: 100)"})
			return
		}
		filter.PageSize = pageSize
	}

	environments, total, err := h.envUsecase.ListEnvironments(c.Request.Context(), filter)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to list environments"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list environments"})
		return
	}

	totalPages := (int(total) + filter.PageSize - 1) / filter.PageSize

	c.JSON(http.StatusOK, gin.H{
		"message":      "Environments retrieved successfully",
		"environments": environments,
		"total":        total,
		"page":         filter.Page,
		"page_size":    filter.PageSize,
		"total_pages":  totalPages,
	})
}

// Update updates an existing environment
// @Summary Update environment
// @Description Update an existing environment's information
// @Tags environments
// @Accept json
// @Produce json
// @Param id path string true "Environment ID (UUID)"
// @Param environment body domain.Environment true "Updated environment object"
// @Success 200 {object} map[string]interface{} "Environment updated successfully"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "Environment not found"
// @Failure 409 {object} map[string]interface{} "Environment name already exists"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/environments/{id} [put]
// @Security BearerAuth
func (h *EnvironmentHandler) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Environment ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Environment ID is required"})
		return
	}

	var env domain.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeBadRequest, "Invalid request body"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	env.ID = id

	if err := h.envUsecase.UpdateEnvironment(c.Request.Context(), &env); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		if errorx.GetCode(err) == errorx.CodeConflict {
			c.Error(err)
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to update environment"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update environment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Environment updated successfully",
		"environment": env,
	})
}

// Delete deletes an environment
// @Summary Delete environment
// @Description Soft delete an environment by ID
// @Tags environments
// @Produce json
// @Param id path string true "Environment ID (UUID)"
// @Success 200 {object} map[string]interface{} "Environment deleted successfully"
// @Failure 400 {object} map[string]interface{} "Invalid environment ID"
// @Failure 404 {object} map[string]interface{} "Environment not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/environments/{id} [delete]
// @Security BearerAuth
func (h *EnvironmentHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Environment ID is required"))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Environment ID is required"})
		return
	}

	if err := h.envUsecase.DeleteEnvironment(c.Request.Context(), id); err != nil {
		if errorx.GetCode(err) == errorx.CodeNotFound {
			c.Error(err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to delete environment"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete environment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Environment deleted successfully",
	})
}
