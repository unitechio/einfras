package handler

import (
	"net/http"
	"strconv"

	domain "einfra/api/internal/modules/server/domain"

	"github.com/gin-gonic/gin"
)

type ServerHandler struct {
	serverUsecase  domain.ServerUsecase
	backupUsecase  domain.ServerBackupUsecase
	serviceUsecase domain.ServerServiceUsecase
	cronjobUsecase domain.ServerCronjobUsecase
	networkUsecase domain.ServerNetworkUsecase
	iptableUsecase domain.ServerIPTableUsecase
}

// NewServerHandler creates a new server handler instance
func NewServerHandler(
	serverUsecase domain.ServerUsecase,
	backupUsecase domain.ServerBackupUsecase,
	serviceUsecase domain.ServerServiceUsecase,
	cronjobUsecase domain.ServerCronjobUsecase,
	networkUsecase domain.ServerNetworkUsecase,
	iptableUsecase domain.ServerIPTableUsecase,
) *ServerHandler {
	return &ServerHandler{
		serverUsecase:  serverUsecase,
		backupUsecase:  backupUsecase,
		serviceUsecase: serviceUsecase,
		cronjobUsecase: cronjobUsecase,
		networkUsecase: networkUsecase,
		iptableUsecase: iptableUsecase,
	}
}

// Create godoc
// @Summary Create a new server
// @Description Create a new server with hardware specifications
// @Tags servers
// @Accept json
// @Produce json
// @Param server body domain.Server true "Server object"
// @Success 201 {object} domain.Server
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers [post]
func (h *ServerHandler) Create(c *gin.Context) {
	var server domain.Server
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.serverUsecase.CreateServer(c.Request.Context(), &server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, server)
}

// List godoc
// @Summary List servers
// @Description Get a list of servers with filtering and pagination
// @Tags servers
// @Accept json
// @Produce json
// @Param status query string false "Filter by status (online, offline, maintenance, error)"
// @Param os query string false "Filter by OS (linux, windows, macos)"
// @Param location query string false "Filter by location"
// @Param provider query string false "Filter by provider"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers [get]
func (h *ServerHandler) List(c *gin.Context) {
	var filter domain.ServerFilter

	// Parse query parameters
	if status := c.Query("status"); status != "" {
		filter.Status = domain.ServerStatus(status)
	}
	if os := c.Query("os"); os != "" {
		filter.OS = domain.ServerOS(os)
	}
	filter.Location = c.Query("location")
	filter.Provider = c.Query("provider")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	servers, total, err := h.serverUsecase.ListServers(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      servers,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// Get godoc
// @Summary Get server by ID
// @Description Get detailed information about a specific server
// @Tags servers
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {object} domain.Server
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id} [get]
func (h *ServerHandler) Get(c *gin.Context) {
	id := c.Param("id")

	server, err := h.serverUsecase.GetServer(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, server)
}

// Update godoc
// @Summary Update server
// @Description Update server information
// @Tags servers
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param server body domain.Server true "Server object"
// @Success 200 {object} domain.Server
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id} [put]
func (h *ServerHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var server domain.Server
	if err := c.ShouldBindJSON(&server); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server.ID = id

	if err := h.serverUsecase.UpdateServer(c.Request.Context(), &server); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, server)
}

// Delete godoc
// @Summary Delete server
// @Description Soft delete a server
// @Tags servers
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id} [delete]
func (h *ServerHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	if err := h.serverUsecase.DeleteServer(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetMetrics godoc
// @Summary Get server metrics
// @Description Get real-time metrics for a server
// @Tags servers
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {object} domain.ServerMetrics
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/metrics [get]
func (h *ServerHandler) GetMetrics(c *gin.Context) {
	id := c.Param("id")

	metrics, err := h.serverUsecase.GetServerMetrics(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// HealthCheck godoc
// @Summary Perform health check
// @Description Perform a health check on a server
// @Tags servers
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/health-check [post]
func (h *ServerHandler) HealthCheck(c *gin.Context) {
	id := c.Param("id")

	isHealthy, err := h.serverUsecase.HealthCheck(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"server_id": id,
		"healthy":   isHealthy,
	})
}
