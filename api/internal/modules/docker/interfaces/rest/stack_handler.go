package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/errorx"
)

// DockerStackHandler handles Docker stack operations
type DockerStackHandler struct {
	stackUsecase usecase.DockerStackUsecase
}

// NewDockerStackHandler creates a new Docker stack handler
func NewDockerStackHandler(stackUsecase usecase.DockerStackUsecase) *DockerStackHandler {
	return &DockerStackHandler{
		stackUsecase: stackUsecase,
	}
}

// DeployStack deploys a new Docker Compose stack
// @Summary Deploy Docker stack
// @Description Deploy a new Docker Compose stack from YAML
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param request body domain.StackDeployRequest true "Stack deployment configuration"
// @Success 201 {object} domain.DockerStack "Stack deployed successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 409 {object} errorx.Error "Stack already exists"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks [post]
// @Security BearerAuth
func (h *DockerStackHandler) DeployStack(c *gin.Context) {
	var req domain.StackDeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)

	stack, err := h.stackUsecase.DeployStack(c.Request.Context(), req, userIDStr)
	if err != nil {
		if err.Error() == "stack with name "+req.Name+" already exists" {
			c.Error(errorx.New(errorx.CodeConflict, err.Error()))
		} else {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to deploy stack"))
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Stack deployment initiated",
		"stack":   stack,
	})
}

// ListStacks lists all Docker stacks
// @Summary List Docker stacks
// @Description Get a list of all Docker Compose stacks
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Success 200 {array} domain.DockerStack "List of stacks"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks [get]
// @Security BearerAuth
func (h *DockerStackHandler) ListStacks(c *gin.Context) {
	stacks, err := h.stackUsecase.ListStacks(c.Request.Context())
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to list stacks"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stacks": stacks,
		"count":  len(stacks),
	})
}

// GetStack gets a specific stack with services
// @Summary Get Docker stack
// @Description Get detailed information about a Docker stack including services
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Success 200 {object} domain.StackInfo "Stack information"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id} [get]
// @Security BearerAuth
func (h *DockerStackHandler) GetStack(c *gin.Context) {
	stackID := c.Param("id")

	stackInfo, err := h.stackUsecase.GetStack(c.Request.Context(), stackID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeNotFound, "Stack not found"))
		return
	}

	c.JSON(http.StatusOK, stackInfo)
}

// UpdateStack updates an existing stack
// @Summary Update Docker stack
// @Description Update a Docker stack with new compose file
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Param request body domain.StackUpdateRequest true "Stack update configuration"
// @Success 200 {object} map[string]interface{} "Stack updated successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id} [put]
// @Security BearerAuth
func (h *DockerStackHandler) UpdateStack(c *gin.Context) {
	stackID := c.Param("id")

	var req domain.StackUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	if err := h.stackUsecase.UpdateStack(c.Request.Context(), stackID, req); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to update stack"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Stack update initiated",
		"stack_id": stackID,
	})
}

// RemoveStack removes a stack
// @Summary Remove Docker stack
// @Description Remove a Docker stack and all its services
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Success 200 {object} map[string]interface{} "Stack removed successfully"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id} [delete]
// @Security BearerAuth
func (h *DockerStackHandler) RemoveStack(c *gin.Context) {
	stackID := c.Param("id")

	if err := h.stackUsecase.RemoveStack(c.Request.Context(), stackID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to remove stack"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Stack removed successfully",
		"stack_id": stackID,
	})
}

// GetStackLogs gets logs for a stack
// @Summary Get stack logs
// @Description Get logs from all services in a stack
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Param service query string false "Filter by service name"
// @Success 200 {object} map[string]interface{} "Stack logs"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id}/logs [get]
// @Security BearerAuth
func (h *DockerStackHandler) GetStackLogs(c *gin.Context) {
	stackID := c.Param("id")
	serviceFilter := c.Query("service")

	logs, err := h.stackUsecase.GetStackLogs(c.Request.Context(), stackID, serviceFilter)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to get stack logs"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stack_id": stackID,
		"logs":     logs,
	})
}

// StartStack starts a stopped stack
// @Summary Start Docker stack
// @Description Start all services in a stopped stack
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Success 200 {object} map[string]interface{} "Stack started successfully"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id}/start [post]
// @Security BearerAuth
func (h *DockerStackHandler) StartStack(c *gin.Context) {
	stackID := c.Param("id")

	if err := h.stackUsecase.StartStack(c.Request.Context(), stackID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to start stack"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Stack started successfully",
		"stack_id": stackID,
	})
}

// StopStack stops a running stack
// @Summary Stop Docker stack
// @Description Stop all services in a running stack
// @Tags docker-stacks
// @Accept json
// @Produce json
// @Param id path string true "Stack ID"
// @Success 200 {object} map[string]interface{} "Stack stopped successfully"
// @Failure 404 {object} errorx.Error "Stack not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/stacks/{id}/stop [post]
// @Security BearerAuth
func (h *DockerStackHandler) StopStack(c *gin.Context) {
	stackID := c.Param("id")

	if err := h.stackUsecase.StopStack(c.Request.Context(), stackID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to stop stack"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Stack stopped successfully",
		"stack_id": stackID,
	})
}
