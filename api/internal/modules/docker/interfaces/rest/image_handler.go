//go:build legacy
// +build legacy

package handler

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/docker"
	"einfra/api/pkg/errorx"
)

// DockerImageHandler handles Docker image operations
type DockerImageHandler struct {
	imageUsecase usecase.DockerImageUsecase
}

// NewDockerImageHandler creates a new Docker image handler
func NewDockerImageHandler(imageUsecase usecase.DockerImageUsecase) *DockerImageHandler {
	return &DockerImageHandler{
		imageUsecase: imageUsecase,
	}
}

// BuildImage builds an image from a Dockerfile
// @Summary Build Docker image
// @Description Build a Docker image from a Dockerfile upload
// @Tags docker-images
// @Accept multipart/form-data
// @Produce application/json
// @Param file formData file true "Build context (tar/tar.gz)"
// @Param dockerfile formData string false "Dockerfile path" default:"Dockerfile"
// @Param tags formData string false "Image tags (comma separated)"
// @Success 200 {object} map[string]interface{} "Build started"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/images/build [post]
// @Security BearerAuth
func (h *DockerImageHandler) BuildImage(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Build context file is required"))
		return
	}
	defer file.Close()

	dockerfile := c.DefaultPostForm("dockerfile", "Dockerfile")
	tags := c.PostFormArray("tags")

	reader, err := h.imageUsecase.BuildImage(c.Request.Context(), dockerfile, file, tags)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to start build"))
		return
	}
	defer reader.Close()

	// Stream build output
	c.Header("Content-Type", "application/json")
	c.Status(http.StatusOK)
	io.Copy(c.Writer, reader)
}

// PushImageRequest represents request to push image
type PushImageRequest struct {
	Image    string `json:"image" binding:"required"`
	Username string `json:"username"`
	Password string `json:"password"`
	Server   string `json:"server"`
}

// PushImage pushes an image to a registry
// @Summary Push Docker image
// @Description Push a Docker image to a registry
// @Tags docker-images
// @Accept json
// @Produce application/json
// @Param request body PushImageRequest true "Push request"
// @Success 200 {object} map[string]interface{} "Push started"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/images/push [post]
// @Security BearerAuth
func (h *DockerImageHandler) PushImage(c *gin.Context) {
	var req PushImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	authConfig := docker.AuthConfig{
		Username:      req.Username,
		Password:      req.Password,
		ServerAddress: req.Server,
	}

	reader, err := h.imageUsecase.PushImage(c.Request.Context(), req.Image, authConfig)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to start push"))
		return
	}
	defer reader.Close()

	// Stream push output
	c.Header("Content-Type", "application/json")
	c.Status(http.StatusOK)
	io.Copy(c.Writer, reader)
}

// InspectImage inspects an image
// @Summary Inspect Docker image
// @Description Get detailed information about a Docker image
// @Tags docker-images
// @Accept json
// @Produce json
// @Param id path string true "Image ID"
// @Success 200 {object} map[string]interface{} "Image details"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/images/{id} [get]
// @Security BearerAuth
func (h *DockerImageHandler) InspectImage(c *gin.Context) {
	imageID := c.Param("id")

	info, err := h.imageUsecase.InspectImage(c.Request.Context(), imageID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to inspect image"))
		return
	}

	c.JSON(http.StatusOK, info)
}

// RemoveImage removes an image
// @Summary Remove Docker image
// @Description Remove a Docker image
// @Tags docker-images
// @Accept json
// @Produce json
// @Param id path string true "Image ID"
// @Param force query bool false "Force removal"
// @Success 200 {object} map[string]interface{} "Image removed"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/images/{id} [delete]
// @Security BearerAuth
func (h *DockerImageHandler) RemoveImage(c *gin.Context) {
	imageID := c.Param("id")
	force := c.Query("force") == "true"

	deleted, err := h.imageUsecase.RemoveImage(c.Request.Context(), imageID, force)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to remove image"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Image removed successfully",
		"deleted": deleted,
	})
}
