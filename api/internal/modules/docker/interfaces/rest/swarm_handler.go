//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/docker/application"
	"einfra/api/pkg/docker"
)

// DockerSwarmHandler handles Docker Swarm HTTP requests
type DockerSwarmHandler struct {
	swarmUsecase usecase.DockerSwarmUsecase
}

// NewDockerSwarmHandler creates a new Docker Swarm handler
func NewDockerSwarmHandler(swarmUsecase usecase.DockerSwarmUsecase) *DockerSwarmHandler {
	return &DockerSwarmHandler{
		swarmUsecase: swarmUsecase,
	}
}

// InitSwarm initializes a new swarm
// @Summary Initialize swarm
// @Description Initialize a new Docker Swarm cluster
// @Tags Docker Swarm
// @Accept json
// @Produce json
// @Param server_id path string true "Server ID"
// @Param request body docker.SwarmInitRequest true "Swarm init request"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/init [post]
func (h *DockerSwarmHandler) InitSwarm(c *gin.Context) {
	serverID := c.Param("server_id")

	var req docker.SwarmInitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	nodeID, err := h.swarmUsecase.InitSwarm(c.Request.Context(), serverID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"node_id": nodeID,
		"message": "Swarm initialized successfully",
	})
}

// JoinSwarm joins a swarm
// @Summary Join swarm
// @Description Join an existing Docker Swarm cluster
// @Tags Docker Swarm
// @Accept json
// @Produce json
// @Param server_id path string true "Server ID"
// @Param request body docker.SwarmJoinRequest true "Swarm join request"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/join [post]
func (h *DockerSwarmHandler) JoinSwarm(c *gin.Context) {
	serverID := c.Param("server_id")

	var req docker.SwarmJoinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.swarmUsecase.JoinSwarm(c.Request.Context(), serverID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Joined swarm successfully"})
}

// LeaveSwarm leaves the swarm
// @Summary Leave swarm
// @Description Leave the Docker Swarm cluster
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Param force query bool false "Force leave"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/leave [post]
func (h *DockerSwarmHandler) LeaveSwarm(c *gin.Context) {
	serverID := c.Param("server_id")
	force := c.Query("force") == "true"

	err := h.swarmUsecase.LeaveSwarm(c.Request.Context(), serverID, force)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Left swarm successfully"})
}

// InspectSwarm inspects the swarm
// @Summary Inspect swarm
// @Description Get detailed information about the swarm
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Success 200 {object} docker.SwarmInfo
// @Router /api/v1/docker/servers/{server_id}/swarm [get]
func (h *DockerSwarmHandler) InspectSwarm(c *gin.Context) {
	serverID := c.Param("server_id")

	info, err := h.swarmUsecase.InspectSwarm(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, info)
}

// CreateService creates a new service
// @Summary Create service
// @Description Create a new Docker Swarm service
// @Tags Docker Swarm
// @Accept json
// @Produce json
// @Param server_id path string true "Server ID"
// @Param request body docker.ServiceCreateConfig true "Service create config"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/services [post]
func (h *DockerSwarmHandler) CreateService(c *gin.Context) {
	serverID := c.Param("server_id")

	var config docker.ServiceCreateConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serviceID, err := h.swarmUsecase.CreateService(c.Request.Context(), serverID, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"service_id": serviceID,
		"message":    "Service created successfully",
	})
}

// ListServices lists all services
// @Summary List services
// @Description List all Docker Swarm services
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Success 200 {array} domain.SwarmService
// @Router /api/v1/docker/servers/{server_id}/swarm/services [get]
func (h *DockerSwarmHandler) ListServices(c *gin.Context) {
	serverID := c.Param("server_id")

	services, err := h.swarmUsecase.ListServices(c.Request.Context(), serverID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

// ScaleService scales a service
// @Summary Scale service
// @Description Scale a Docker Swarm service
// @Tags Docker Swarm
// @Accept json
// @Produce json
// @Param server_id path string true "Server ID"
// @Param service_id path string true "Service ID"
// @Param request body map[string]uint64 true "Scale request"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/services/{service_id}/scale [post]
func (h *DockerSwarmHandler) ScaleService(c *gin.Context) {
	serverID := c.Param("server_id")
	serviceID := c.Param("service_id")

	var req struct {
		Replicas uint64 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.swarmUsecase.ScaleService(c.Request.Context(), serverID, serviceID, req.Replicas)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service scaled successfully"})
}

// ListNodes lists all nodes
// @Summary List nodes
// @Description List all Docker Swarm nodes
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Success 200 {array} domain.SwarmNode
// @Router /api/v1/docker/servers/{server_id}/swarm/nodes [get]
func (h *DockerSwarmHandler) ListNodes(c *gin.Context) {
	serverID := c.Param("server_id")

	nodes, err := h.swarmUsecase.ListNodes(c.Request.Context(), serverID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, nodes)
}

// PromoteNode promotes a node to manager
// @Summary Promote node
// @Description Promote a worker node to manager
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Param node_id path string true "Node ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/nodes/{node_id}/promote [post]
func (h *DockerSwarmHandler) PromoteNode(c *gin.Context) {
	serverID := c.Param("server_id")
	nodeID := c.Param("node_id")

	err := h.swarmUsecase.PromoteNode(c.Request.Context(), serverID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Node promoted successfully"})
}

// DemoteNode demotes a manager node to worker
// @Summary Demote node
// @Description Demote a manager node to worker
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Param node_id path string true "Node ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/nodes/{node_id}/demote [post]
func (h *DockerSwarmHandler) DemoteNode(c *gin.Context) {
	serverID := c.Param("server_id")
	nodeID := c.Param("node_id")

	err := h.swarmUsecase.DemoteNode(c.Request.Context(), serverID, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Node demoted successfully"})
}

// CreateSecret creates a new secret
// @Summary Create secret
// @Description Create a new Docker Swarm secret
// @Tags Docker Swarm
// @Accept json
// @Produce json
// @Param server_id path string true "Server ID"
// @Param request body docker.SecretCreateConfig true "Secret create config"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/docker/servers/{server_id}/swarm/secrets [post]
func (h *DockerSwarmHandler) CreateSecret(c *gin.Context) {
	serverID := c.Param("server_id")

	var config docker.SecretCreateConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	secretID, err := h.swarmUsecase.CreateSecret(c.Request.Context(), serverID, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"secret_id": secretID,
		"message":   "Secret created successfully",
	})
}

// ListSecrets lists all secrets
// @Summary List secrets
// @Description List all Docker Swarm secrets
// @Tags Docker Swarm
// @Produce json
// @Param server_id path string true "Server ID"
// @Success 200 {array} domain.SwarmSecret
// @Router /api/v1/docker/servers/{server_id}/swarm/secrets [get]
func (h *DockerSwarmHandler) ListSecrets(c *gin.Context) {
	serverID := c.Param("server_id")

	secrets, err := h.swarmUsecase.ListSecrets(c.Request.Context(), serverID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, secrets)
}
