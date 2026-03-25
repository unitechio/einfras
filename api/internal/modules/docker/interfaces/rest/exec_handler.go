//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/errorx"
)

// DockerExecHandler handles Docker exec operations
type DockerExecHandler struct {
	execUsecase usecase.DockerExecUsecase
}

// NewDockerExecHandler creates a new docker exec handler
func NewDockerExecHandler(execUsecase usecase.DockerExecUsecase) *DockerExecHandler {
	return &DockerExecHandler{
		execUsecase: execUsecase,
	}
}

// CreateExecRequest represents request to create exec instance
type CreateExecRequest struct {
	Cmd []string `json:"cmd" binding:"required" example:"[\"/bin/bash\"]"`
	Tty bool     `json:"tty" example:"true"`
}

// CreateExec creates an exec instance in a container
// @Summary Create exec instance
// @Description Create an exec instance for interactive shell or command execution
// @Tags docker-exec
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Param request body CreateExecRequest true "Exec configuration"
// @Success 201 {object} map[string]interface{} "Exec instance created"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/exec [post]
// @Security BearerAuth
func (h *DockerExecHandler) CreateExec(c *gin.Context) {
	containerID := c.Param("id")

	var req CreateExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	execID, err := h.execUsecase.CreateExec(c.Request.Context(), containerID, req.Cmd, req.Tty)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create exec"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"exec_id": execID,
		"message": "Exec instance created successfully",
	})
}

// StartExecRequest represents request to start exec instance
type StartExecRequest struct {
	Tty bool `json:"tty" example:"true"`
}

// StartExec starts an exec instance
// @Summary Start exec instance
// @Description Start an exec instance and return output
// @Tags docker-exec
// @Accept json
// @Produce json
// @Param execId path string true "Exec ID"
// @Param request body StartExecRequest true "Start configuration"
// @Success 200 {object} map[string]interface{} "Exec output"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/exec/{execId}/start [post]
// @Security BearerAuth
func (h *DockerExecHandler) StartExec(c *gin.Context) {
	execID := c.Param("execId")

	var req StartExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	output, err := h.execUsecase.StartExec(c.Request.Context(), execID, req.Tty)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to start exec"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"output": string(output),
	})
}

// InspectExec inspects an exec instance
// @Summary Inspect exec instance
// @Description Get information about an exec instance
// @Tags docker-exec
// @Accept json
// @Produce json
// @Param execId path string true "Exec ID"
// @Success 200 {object} map[string]interface{} "Exec information"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/exec/{execId}/inspect [get]
// @Security BearerAuth
func (h *DockerExecHandler) InspectExec(c *gin.Context) {
	execID := c.Param("execId")

	info, err := h.execUsecase.InspectExec(c.Request.Context(), execID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to inspect exec"))
		return
	}

	c.JSON(http.StatusOK, info)
}

// ResizeExecRequest represents request to resize exec TTY
type ResizeExecRequest struct {
	Height uint `json:"height" binding:"required,min=1" example:"24"`
	Width  uint `json:"width" binding:"required,min=1" example:"80"`
}

// ResizeExec resizes the TTY of an exec instance
// @Summary Resize exec TTY
// @Description Resize the TTY of an exec instance
// @Tags docker-exec
// @Accept json
// @Produce json
// @Param execId path string true "Exec ID"
// @Param request body ResizeExecRequest true "Resize dimensions"
// @Success 200 {object} map[string]interface{} "TTY resized"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/exec/{execId}/resize [post]
// @Security BearerAuth
func (h *DockerExecHandler) ResizeExec(c *gin.Context) {
	execID := c.Param("execId")

	var req ResizeExecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	if err := h.execUsecase.ResizeExec(c.Request.Context(), execID, req.Height, req.Width); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to resize exec"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "TTY resized successfully",
	})
}

// ExecuteCommandRequest represents request to execute a command
type ExecuteCommandRequest struct {
	Cmd []string `json:"cmd" binding:"required" example:"[\"ls\", \"-la\"]"`
}

// ExecuteCommand executes a simple command in a container
// @Summary Execute command
// @Description Execute a command in a container and return output
// @Tags docker-exec
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Param request body ExecuteCommandRequest true "Command to execute"
// @Success 200 {object} map[string]interface{} "Command result"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/command [post]
// @Security BearerAuth
func (h *DockerExecHandler) ExecuteCommand(c *gin.Context) {
	containerID := c.Param("id")

	var req ExecuteCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	result, err := h.execUsecase.ExecuteCommand(c.Request.Context(), containerID, req.Cmd)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to execute command"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"exec_id":   result.ExecID,
		"exit_code": result.ExitCode,
		"output":    result.Output,
		"error":     result.Error,
	})
}
