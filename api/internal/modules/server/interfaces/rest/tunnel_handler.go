package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/pkg/errorx"
	"einfra/api/pkg/ssh"
)

// TunnelHandler handles HTTP requests for SSH tunnel management
type TunnelHandler struct {
	tunnelManager *ssh.TunnelManager
}

// NewTunnelHandler creates a new tunnel handler
func NewTunnelHandler(tunnelManager *ssh.TunnelManager) *TunnelHandler {
	return &TunnelHandler{
		tunnelManager: tunnelManager,
	}
}

// CreateTunnelRequest represents a request to create a tunnel
type CreateTunnelRequest struct {
	ID         string `json:"id" binding:"required" example:"server-tunnel-1"`
	SSHHost    string `json:"ssh_host" binding:"required" example:"bastion.example.com"`
	SSHPort    int    `json:"ssh_port" binding:"required,min=1,max=65535" example:"22"`
	SSHUser    string `json:"ssh_user" binding:"required" example:"tunnel-user"`
	SSHKeyPath string `json:"ssh_key_path" binding:"required" example:"/keys/tunnel-key.pem"`
	LocalAddr  string `json:"local_addr" binding:"required" example:"localhost:3307"`
	RemoteAddr string `json:"remote_addr" binding:"required" example:"10.0.1.100:3306"`
}

// CreateTunnel creates and starts a new SSH tunnel
// @Summary Create SSH tunnel
// @Description Create and start a new SSH tunnel for secure connections
// @Tags tunnels
// @Accept json
// @Produce json
// @Param request body CreateTunnelRequest true "Tunnel configuration"
// @Success 201 {object} map[string]interface{} "Tunnel created successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 409 {object} errorx.Error "Tunnel already exists"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/tunnels [post]
// @Security BearerAuth
func (h *TunnelHandler) CreateTunnel(c *gin.Context) {
	var req CreateTunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	// Create tunnel configuration
	tunnelCfg := ssh.TunnelConfig{
		SSHConfig: ssh.Config{
			Host:    req.SSHHost,
			Port:    req.SSHPort,
			User:    req.SSHUser,
			KeyPath: req.SSHKeyPath,
		},
		LocalAddr:  req.LocalAddr,
		RemoteAddr: req.RemoteAddr,
	}

	// Create and start tunnel
	if err := h.tunnelManager.CreateTunnel(req.ID, tunnelCfg); err != nil {
		if err.Error() == "tunnel with id "+req.ID+" already exists" {
			c.Error(errorx.New(errorx.CodeConflict, err.Error()))
		} else {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create tunnel"))
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Tunnel created successfully",
		"id":      req.ID,
	})
}

// ListTunnels lists all active tunnels
// @Summary List active tunnels
// @Description Get a list of all active SSH tunnels with statistics
// @Tags tunnels
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of active tunnels"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/tunnels [get]
// @Security BearerAuth
func (h *TunnelHandler) ListTunnels(c *gin.Context) {
	tunnels := h.tunnelManager.ListTunnels()

	c.JSON(http.StatusOK, gin.H{
		"tunnels": tunnels,
		"count":   len(tunnels),
	})
}

// GetTunnelStats gets statistics for a specific tunnel
// @Summary Get tunnel statistics
// @Description Get detailed statistics for a specific tunnel
// @Tags tunnels
// @Accept json
// @Produce json
// @Param id path string true "Tunnel ID"
// @Success 200 {object} map[string]interface{} "Tunnel statistics"
// @Failure 404 {object} errorx.Error "Tunnel not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/tunnels/{id}/stats [get]
// @Security BearerAuth
func (h *TunnelHandler) GetTunnelStats(c *gin.Context) {
	id := c.Param("id")

	tunnel, err := h.tunnelManager.GetTunnel(id)
	if err != nil {
		c.Error(errorx.New(errorx.CodeNotFound, "Tunnel not found"))
		return
	}

	stats := tunnel.GetStats()
	c.JSON(http.StatusOK, stats)
}

// StopTunnel stops and removes a tunnel
// @Summary Stop tunnel
// @Description Stop and remove an active SSH tunnel
// @Tags tunnels
// @Accept json
// @Produce json
// @Param id path string true "Tunnel ID"
// @Success 200 {object} map[string]interface{} "Tunnel stopped successfully"
// @Failure 404 {object} errorx.Error "Tunnel not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/tunnels/{id} [delete]
// @Security BearerAuth
func (h *TunnelHandler) StopTunnel(c *gin.Context) {
	id := c.Param("id")

	if err := h.tunnelManager.StopTunnel(id); err != nil {
		if err.Error() == "tunnel with id "+id+" not found" {
			c.Error(errorx.New(errorx.CodeNotFound, "Tunnel not found"))
		} else {
			c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to stop tunnel"))
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tunnel stopped successfully",
		"id":      id,
	})
}

// StopAllTunnels stops all active tunnels
// @Summary Stop all tunnels
// @Description Stop and remove all active SSH tunnels
// @Tags tunnels
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "All tunnels stopped"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/tunnels/stop-all [post]
// @Security BearerAuth
func (h *TunnelHandler) StopAllTunnels(c *gin.Context) {
	if err := h.tunnelManager.StopAll(); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to stop all tunnels"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "All tunnels stopped successfully",
	})
}
