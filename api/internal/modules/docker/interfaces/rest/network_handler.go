//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/errorx"
)

// DockerNetworkHandler handles Docker network operations
type DockerNetworkHandler struct {
	networkUsecase usecase.DockerNetworkUsecase
}

// NewDockerNetworkHandler creates a new Docker network handler
func NewDockerNetworkHandler(networkUsecase usecase.DockerNetworkUsecase) *DockerNetworkHandler {
	return &DockerNetworkHandler{
		networkUsecase: networkUsecase,
	}
}

// ConnectContainerRequest represents request to connect container to network
type ConnectContainerRequest struct {
	ContainerID string `json:"container_id" binding:"required"`
}

// ConnectContainer connects a container to a network
// @Summary Connect container to network
// @Description Connect a container to a Docker network
// @Tags docker-networks
// @Accept json
// @Produce json
// @Param id path string true "Network ID"
// @Param request body ConnectContainerRequest true "Connection request"
// @Success 200 {object} map[string]interface{} "Connected successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/networks/{id}/connect [post]
// @Security BearerAuth
func (h *DockerNetworkHandler) ConnectContainer(c *gin.Context) {
	networkID := c.Param("id")

	var req ConnectContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	if err := h.networkUsecase.ConnectContainer(c.Request.Context(), networkID, req.ContainerID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to connect container"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Container connected successfully",
		"network_id":   networkID,
		"container_id": req.ContainerID,
	})
}

// DisconnectContainerRequest represents request to disconnect container from network
type DisconnectContainerRequest struct {
	ContainerID string `json:"container_id" binding:"required"`
}

// DisconnectContainer disconnects a container from a network
// @Summary Disconnect container from network
// @Description Disconnect a container from a Docker network
// @Tags docker-networks
// @Accept json
// @Produce json
// @Param id path string true "Network ID"
// @Param request body DisconnectContainerRequest true "Disconnection request"
// @Success 200 {object} map[string]interface{} "Disconnected successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/networks/{id}/disconnect [post]
// @Security BearerAuth
func (h *DockerNetworkHandler) DisconnectContainer(c *gin.Context) {
	networkID := c.Param("id")

	var req DisconnectContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	if err := h.networkUsecase.DisconnectContainer(c.Request.Context(), networkID, req.ContainerID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to disconnect container"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Container disconnected successfully",
		"network_id":   networkID,
		"container_id": req.ContainerID,
	})
}

// CreateNetworkRequest represents request to create network
type CreateNetworkRequest struct {
	Name   string `json:"name" binding:"required"`
	Driver string `json:"driver" example:"bridge"`
}

// CreateNetwork creates a new network
// @Summary Create network
// @Description Create a new Docker network
// @Tags docker-networks
// @Accept json
// @Produce json
// @Param request body CreateNetworkRequest true "Network creation request"
// @Success 201 {object} map[string]interface{} "Network created successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/networks [post]
// @Security BearerAuth
func (h *DockerNetworkHandler) CreateNetwork(c *gin.Context) {
	var req CreateNetworkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	id, err := h.networkUsecase.CreateNetwork(c.Request.Context(), req.Name, req.Driver)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create network"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Network created successfully",
		"network_id": id,
		"name":       req.Name,
		"driver":     req.Driver,
	})
}

// RemoveNetwork removes a network
// @Summary Remove network
// @Description Remove a Docker network
// @Tags docker-networks
// @Accept json
// @Produce json
// @Param id path string true "Network ID"
// @Success 200 {object} map[string]interface{} "Network removed successfully"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/networks/{id} [delete]
// @Security BearerAuth
func (h *DockerNetworkHandler) RemoveNetwork(c *gin.Context) {
	networkID := c.Param("id")

	if err := h.networkUsecase.RemoveNetwork(c.Request.Context(), networkID); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to remove network"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Network removed successfully",
		"network_id": networkID,
	})
}

// InspectNetwork inspects a network
// @Summary Inspect network
// @Description Get detailed information about a Docker network
// @Tags docker-networks
// @Accept json
// @Produce json
// @Param id path string true "Network ID"
// @Success 200 {object} map[string]interface{} "Network details"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/docker/networks/{id} [get]
// @Security BearerAuth
func (h *DockerNetworkHandler) InspectNetwork(c *gin.Context) {
	networkID := c.Param("id")

	info, err := h.networkUsecase.InspectNetwork(c.Request.Context(), networkID)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to inspect network"))
		return
	}

	c.JSON(http.StatusOK, info)
}
