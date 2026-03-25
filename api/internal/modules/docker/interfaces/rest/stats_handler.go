//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/docker"
	"einfra/api/pkg/errorx"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// DockerStatsHandler handles Docker stats operations
type DockerStatsHandler struct {
	statsUsecase usecase.DockerStatsUsecase
}

// NewDockerStatsHandler creates a new docker stats handler
func NewDockerStatsHandler(statsUsecase usecase.DockerStatsUsecase) *DockerStatsHandler {
	return &DockerStatsHandler{
		statsUsecase: statsUsecase,
	}
}

// GetStatsStream streams container stats via WebSocket
// @Summary Stream container stats
// @Description Stream real-time container statistics via WebSocket
// @Tags docker-stats
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Success 101 {object} docker.ContainerStats "Switching to WebSocket"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/stats [get]
// @Security BearerAuth
func (h *DockerStatsHandler) GetStatsStream(c *gin.Context) {
	containerID := c.Param("id")

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to upgrade to WebSocket"))
		return
	}
	defer conn.Close()

	// Get stats stream
	ctx := c.Request.Context()
	statsChan, errChan, err := h.statsUsecase.GetStatsStream(ctx, containerID)
	if err != nil {
		conn.WriteJSON(map[string]interface{}{
			"error": err.Error(),
		})
		return
	}

	// Stream stats to WebSocket
	for {
		select {
		case stats, ok := <-statsChan:
			if !ok {
				return
			}
			if err := conn.WriteJSON(stats); err != nil {
				return
			}

		case err, ok := <-errChan:
			if !ok {
				return
			}
			conn.WriteJSON(map[string]interface{}{
				"error": err.Error(),
			})
			return

		case <-ctx.Done():
			return
		}
	}
}

// GetStatsOnce gets container stats once (not streaming)
// @Summary Get container stats once
// @Description Get container statistics snapshot
// @Tags docker-stats
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Success 200 {object} docker.ContainerStats "Container stats"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/stats/once [get]
// @Security BearerAuth
func (h *DockerStatsHandler) GetStatsOnce(c *gin.Context) {
	containerID := c.Param("id")

	stats, err := h.statsUsecase.GetStatsOnce(c.Request.Context(), containerID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to get stats"))
		return
	}

	c.JSON(http.StatusOK, stats)
}

// PauseContainer pauses a running container
// @Summary Pause container
// @Description Pause a running container
// @Tags docker-lifecycle
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Success 200 {object} map[string]interface{} "Container paused"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/pause [post]
// @Security BearerAuth
func (h *DockerStatsHandler) PauseContainer(c *gin.Context) {
	containerID := c.Param("id")

	if err := h.statsUsecase.PauseContainer(c.Request.Context(), containerID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to pause container"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Container paused successfully",
		"container_id": containerID,
	})
}

// UnpauseContainer unpauses a paused container
// @Summary Unpause container
// @Description Unpause a paused container
// @Tags docker-lifecycle
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Success 200 {object} map[string]interface{} "Container unpaused"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/unpause [post]
// @Security BearerAuth
func (h *DockerStatsHandler) UnpauseContainer(c *gin.Context) {
	containerID := c.Param("id")

	if err := h.statsUsecase.UnpauseContainer(c.Request.Context(), containerID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to unpause container"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Container unpaused successfully",
		"container_id": containerID,
	})
}

// CommitContainerRequest represents request to commit a container
type CommitContainerRequest struct {
	Repository string            `json:"repository" binding:"required" example:"myapp"`
	Tag        string            `json:"tag" example:"v1.0"`
	Comment    string            `json:"comment" example:"Production snapshot"`
	Author     string            `json:"author" example:"admin@example.com"`
	Pause      bool              `json:"pause" example:"true"`
	Changes    []string          `json:"changes,omitempty" example:"[\"ENV DEBUG=true\"]"`
	Config     map[string]string `json:"config,omitempty"`
}

// CommitContainer commits a container to create a new image
// @Summary Commit container to image
// @Description Commit a container to create a new image
// @Tags docker-lifecycle
// @Accept json
// @Produce json
// @Param id path string true "Container ID"
// @Param request body CommitContainerRequest true "Commit configuration"
// @Success 201 {object} map[string]interface{} "Image created"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/containers/{id}/commit [post]
// @Security BearerAuth
func (h *DockerStatsHandler) CommitContainer(c *gin.Context) {
	containerID := c.Param("id")

	var req CommitContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	config := docker.ContainerCommitConfig{
		ContainerID: containerID,
		Repository:  req.Repository,
		Tag:         req.Tag,
		Comment:     req.Comment,
		Author:      req.Author,
		Pause:       req.Pause,
		Changes:     req.Changes,
		Config:      nil, // TODO: Map map[string]string to *container.Config if needed
	}

	imageID, err := h.statsUsecase.CommitContainer(c.Request.Context(), config)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to commit container"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Container committed successfully",
		"image_id":     imageID,
		"repository":   req.Repository,
		"tag":          req.Tag,
		"container_id": containerID,
	})
}
