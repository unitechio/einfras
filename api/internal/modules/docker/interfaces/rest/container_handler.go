package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
)

type DockerHandler struct {
	dockerUsecase domain.DockerUsecase
}

// NewDockerHandler creates a new Docker handler instance
func NewDockerHandler(dockerUsecase domain.DockerUsecase) *DockerHandler {
	return &DockerHandler{
		dockerUsecase: dockerUsecase,
	}
}

// Docker Host Management

// CreateHost godoc
// @Summary Create Docker host
// @Description Register a new Docker host
// @Tags docker
// @Accept json
// @Produce json
// @Param host body domain.DockerHost true "Docker host object"
// @Success 201 {object} domain.DockerHost
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts [post]
func (h *DockerHandler) CreateHost(c *gin.Context) {
	var host domain.DockerHost
	if err := c.ShouldBindJSON(&host); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.dockerUsecase.CreateDockerHost(c.Request.Context(), &host); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, host)
}

// ListHosts godoc
// @Summary List Docker hosts
// @Description Get a list of Docker hosts
// @Tags docker
// @Accept json
// @Produce json
// @Param server_id query string false "Filter by server ID"
// @Param is_active query boolean false "Filter by active status"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts [get]
func (h *DockerHandler) ListHosts(c *gin.Context) {
	var filter domain.DockerHostFilter

	if serverID := c.Query("server_id"); serverID != "" {
		filter.ServerID = &serverID
	}
	if isActive := c.Query("is_active"); isActive != "" {
		active := isActive == "true"
		filter.IsActive = &active
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	hosts, total, err := h.dockerUsecase.ListDockerHosts(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      hosts,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetHost godoc
// @Summary Get Docker host
// @Description Get Docker host by ID
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Docker host ID"
// @Success 200 {object} domain.DockerHost
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{id} [get]
func (h *DockerHandler) GetHost(c *gin.Context) {
	id := c.Param("id")

	host, err := h.dockerUsecase.GetDockerHost(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, host)
}

// UpdateHost godoc
// @Summary Update Docker host
// @Description Update Docker host information
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Docker host ID"
// @Param host body domain.DockerHost true "Docker host object"
// @Success 200 {object} domain.DockerHost
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{id} [put]
func (h *DockerHandler) UpdateHost(c *gin.Context) {
	id := c.Param("id")

	var host domain.DockerHost
	if err := c.ShouldBindJSON(&host); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	host.ID = id

	if err := h.dockerUsecase.UpdateDockerHost(c.Request.Context(), &host); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, host)
}

// DeleteHost godoc
// @Summary Delete Docker host
// @Description Delete a Docker host
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Docker host ID"
// @Success 204
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{id} [delete]
func (h *DockerHandler) DeleteHost(c *gin.Context) {
	id := c.Param("id")

	if err := h.dockerUsecase.DeleteDockerHost(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Container Management

// ListContainers godoc
// @Summary List containers
// @Description List all containers on a Docker host
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Param all query boolean false "Show all containers (default shows just running)" default(false)
// @Success 200 {array} domain.Container
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/containers [get]
func (h *DockerHandler) ListContainers(c *gin.Context) {
	hostID := c.Param("host_id")
	all := c.DefaultQuery("all", "false") == "true"

	containers, err := h.dockerUsecase.ListContainers(c.Request.Context(), hostID, all)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, containers)
}

// StartContainer godoc
// @Summary Start container
// @Description Start a Docker container
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Param container_id path string true "Container ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/containers/{container_id}/start [post]
func (h *DockerHandler) StartContainer(c *gin.Context) {
	hostID := c.Param("host_id")
	containerID := c.Param("container_id")

	if err := h.dockerUsecase.StartContainer(c.Request.Context(), hostID, containerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Container started successfully"})
}

// StopContainer godoc
// @Summary Stop container
// @Description Stop a Docker container
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Param container_id path string true "Container ID"
// @Param timeout query int false "Timeout in seconds" default(10)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/containers/{container_id}/stop [post]
func (h *DockerHandler) StopContainer(c *gin.Context) {
	hostID := c.Param("host_id")
	containerID := c.Param("container_id")
	timeout, _ := strconv.Atoi(c.DefaultQuery("timeout", "10"))

	if err := h.dockerUsecase.StopContainer(c.Request.Context(), hostID, containerID, timeout); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Container stopped successfully"})
}

// GetContainerLogs godoc
// @Summary Get container logs
// @Description Get logs from a Docker container
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Param container_id path string true "Container ID"
// @Param tail query int false "Number of lines to show from the end of the logs" default(100)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/containers/{container_id}/logs [get]
func (h *DockerHandler) GetContainerLogs(c *gin.Context) {
	hostID := c.Param("host_id")
	containerID := c.Param("container_id")
	tail, _ := strconv.Atoi(c.DefaultQuery("tail", "100"))

	logs, err := h.dockerUsecase.GetContainerLogs(c.Request.Context(), hostID, containerID, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// Image Management

// ListImages godoc
// @Summary List images
// @Description List all images on a Docker host
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Success 200 {array} domain.DockerImage
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/images [get]
func (h *DockerHandler) ListImages(c *gin.Context) {
	hostID := c.Param("host_id")

	images, err := h.dockerUsecase.ListImages(c.Request.Context(), hostID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, images)
}

// PullImage godoc
// @Summary Pull image
// @Description Pull a Docker image
// @Tags docker
// @Accept json
// @Produce json
// @Param host_id path string true "Docker host ID"
// @Param request body map[string]string true "Image name"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/docker/hosts/{host_id}/images/pull [post]
func (h *DockerHandler) PullImage(c *gin.Context) {
	hostID := c.Param("host_id")

	var req struct {
		ImageName string `json:"image_name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.dockerUsecase.PullImage(c.Request.Context(), hostID, req.ImageName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Image pulled successfully"})
}
