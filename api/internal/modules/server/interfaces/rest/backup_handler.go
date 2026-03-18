package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
)

// ==================== BACKUP ENDPOINTS ====================

// CreateBackup godoc
// @Summary Create a server backup
// @Description Create a new backup for a server
// @Tags server-backups
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param backup body domain.ServerBackup true "Backup object"
// @Success 201 {object} domain.ServerBackup
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/backups [post]
func (h *ServerHandler) CreateBackup(c *gin.Context) {
	serverID := c.Param("id")

	var backup domain.ServerBackup
	if err := c.ShouldBindJSON(&backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	backup.ServerID = serverID

	if err := h.backupUsecase.CreateBackup(c.Request.Context(), &backup); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, backup)
}

// ListBackups godoc
// @Summary List server backups
// @Description Get a list of backups for a server
// @Tags server-backups
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param type query string false "Filter by backup type"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/backups [get]
func (h *ServerHandler) ListBackups(c *gin.Context) {
	serverID := c.Param("id")

	var filter domain.BackupFilter
	filter.ServerID = serverID

	if backupType := c.Query("type"); backupType != "" {
		filter.Type = domain.BackupType(backupType)
	}
	if status := c.Query("status"); status != "" {
		filter.Status = domain.BackupStatus(status)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	backups, total, err := h.backupUsecase.ListBackups(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      backups,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetBackup godoc
// @Summary Get backup details
// @Description Get detailed information about a specific backup
// @Tags server-backups
// @Accept json
// @Produce json
// @Param backupId path string true "Backup ID"
// @Success 200 {object} domain.ServerBackup
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/backups/{backupId} [get]
func (h *ServerHandler) GetBackup(c *gin.Context) {
	backupID := c.Param("backupId")

	backup, err := h.backupUsecase.GetBackup(c.Request.Context(), backupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, backup)
}

// RestoreBackup godoc
// @Summary Restore from backup
// @Description Restore a server from a backup
// @Tags server-backups
// @Accept json
// @Produce json
// @Param backupId path string true "Backup ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/backups/{backupId}/restore [post]
func (h *ServerHandler) RestoreBackup(c *gin.Context) {
	backupID := c.Param("backupId")

	if err := h.backupUsecase.RestoreBackup(c.Request.Context(), backupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup restore initiated successfully"})
}

// DeleteBackup godoc
// @Summary Delete backup
// @Description Delete a server backup
// @Tags server-backups
// @Accept json
// @Produce json
// @Param backupId path string true "Backup ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/backups/{backupId} [delete]
func (h *ServerHandler) DeleteBackup(c *gin.Context) {
	backupID := c.Param("backupId")

	if err := h.backupUsecase.DeleteBackup(c.Request.Context(), backupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ==================== SERVICE ENDPOINTS ====================

// ListServices godoc
// @Summary List server services
// @Description Get a list of services running on a server
// @Tags server-services
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {array} domain.ServerService
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/services [get]
func (h *ServerHandler) ListServices(c *gin.Context) {
	serverID := c.Param("id")

	services, err := h.serviceUsecase.ListServices(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

// GetServiceStatus godoc
// @Summary Get service status
// @Description Get the current status of a specific service
// @Tags server-services
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param serviceName path string true "Service name"
// @Success 200 {object} domain.ServerService
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/services/{serviceName} [get]
func (h *ServerHandler) GetServiceStatus(c *gin.Context) {
	serverID := c.Param("id")
	serviceName := c.Param("serviceName")

	service, err := h.serviceUsecase.GetServiceStatus(c.Request.Context(), serverID, serviceName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, service)
}

// PerformServiceAction godoc
// @Summary Perform service action
// @Description Perform an action on a service (start, stop, restart, etc.)
// @Tags server-services
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param serviceName path string true "Service name"
// @Param action body domain.ServiceActionRequest true "Action to perform"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/services/{serviceName}/action [post]
func (h *ServerHandler) PerformServiceAction(c *gin.Context) {
	serverID := c.Param("id")
	serviceName := c.Param("serviceName")

	var req domain.ServiceActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.serviceUsecase.PerformAction(c.Request.Context(), serverID, serviceName, req.Action); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Service action performed successfully",
		"service": serviceName,
		"action":  req.Action,
	})
}

// GetServiceLogs godoc
// @Summary Get service logs
// @Description Retrieve recent logs for a service
// @Tags server-services
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param serviceName path string true "Service name"
// @Param lines query int false "Number of log lines" default(50)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/services/{serviceName}/logs [get]
func (h *ServerHandler) GetServiceLogs(c *gin.Context) {
	serverID := c.Param("id")
	serviceName := c.Param("serviceName")
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "50"))

	logs, err := h.serviceUsecase.GetServiceLogs(c.Request.Context(), serverID, serviceName, lines)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"service": serviceName,
		"logs":    logs,
	})
}

// ==================== CRONJOB ENDPOINTS ====================

// CreateCronjob godoc
// @Summary Create a cronjob
// @Description Create a new scheduled task on a server
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param cronjob body domain.ServerCronjob true "Cronjob object"
// @Success 201 {object} domain.ServerCronjob
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/cronjobs [post]
func (h *ServerHandler) CreateCronjob(c *gin.Context) {
	serverID := c.Param("id")

	var cronjob domain.ServerCronjob
	if err := c.ShouldBindJSON(&cronjob); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cronjob.ServerID = serverID

	if err := h.cronjobUsecase.CreateCronjob(c.Request.Context(), &cronjob); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cronjob)
}

// ListCronjobs godoc
// @Summary List cronjobs
// @Description Get a list of cronjobs for a server
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/cronjobs [get]
func (h *ServerHandler) ListCronjobs(c *gin.Context) {
	serverID := c.Param("id")

	var filter domain.CronjobFilter
	filter.ServerID = serverID

	if status := c.Query("status"); status != "" {
		filter.Status = domain.CronjobStatus(status)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	cronjobs, total, err := h.cronjobUsecase.ListCronjobs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      cronjobs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetCronjob godoc
// @Summary Get cronjob details
// @Description Get detailed information about a specific cronjob
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param cronjobId path string true "Cronjob ID"
// @Success 200 {object} domain.ServerCronjob
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/cronjobs/{cronjobId} [get]
func (h *ServerHandler) GetCronjob(c *gin.Context) {
	cronjobID := c.Param("cronjobId")

	cronjob, err := h.cronjobUsecase.GetCronjob(c.Request.Context(), cronjobID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cronjob)
}

// UpdateCronjob godoc
// @Summary Update cronjob
// @Description Update an existing cronjob
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param cronjobId path string true "Cronjob ID"
// @Param cronjob body domain.ServerCronjob true "Cronjob object"
// @Success 200 {object} domain.ServerCronjob
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/cronjobs/{cronjobId} [put]
func (h *ServerHandler) UpdateCronjob(c *gin.Context) {
	cronjobID := c.Param("cronjobId")

	var cronjob domain.ServerCronjob
	if err := c.ShouldBindJSON(&cronjob); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cronjob.ID = cronjobID

	if err := h.cronjobUsecase.UpdateCronjob(c.Request.Context(), &cronjob); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cronjob)
}

// DeleteCronjob godoc
// @Summary Delete cronjob
// @Description Delete a cronjob
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param cronjobId path string true "Cronjob ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/cronjobs/{cronjobId} [delete]
func (h *ServerHandler) DeleteCronjob(c *gin.Context) {
	cronjobID := c.Param("cronjobId")

	if err := h.cronjobUsecase.DeleteCronjob(c.Request.Context(), cronjobID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ExecuteCronjob godoc
// @Summary Execute cronjob manually
// @Description Manually trigger a cronjob execution
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param cronjobId path string true "Cronjob ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/cronjobs/{cronjobId}/execute [post]
func (h *ServerHandler) ExecuteCronjob(c *gin.Context) {
	cronjobID := c.Param("cronjobId")

	if err := h.cronjobUsecase.ExecuteCronjob(c.Request.Context(), cronjobID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cronjob executed successfully"})
}

// GetCronjobHistory godoc
// @Summary Get cronjob execution history
// @Description Retrieve execution history for a cronjob
// @Tags server-cronjobs
// @Accept json
// @Produce json
// @Param cronjobId path string true "Cronjob ID"
// @Param limit query int false "Number of records" default(50)
// @Success 200 {array} domain.CronjobExecution
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/cronjobs/{cronjobId}/history [get]
func (h *ServerHandler) GetCronjobHistory(c *gin.Context) {
	cronjobID := c.Param("cronjobId")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	history, err := h.cronjobUsecase.GetExecutionHistory(c.Request.Context(), cronjobID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

// ==================== NETWORK ENDPOINTS ====================

// GetNetworkInterfaces godoc
// @Summary Get network interfaces
// @Description Get all network interfaces for a server
// @Tags server-network
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {array} domain.NetworkInterface
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/network/interfaces [get]
func (h *ServerHandler) GetNetworkInterfaces(c *gin.Context) {
	serverID := c.Param("id")

	interfaces, err := h.networkUsecase.GetNetworkInterfaces(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, interfaces)
}

// CheckConnectivity godoc
// @Summary Check network connectivity
// @Description Test network connectivity to a target host
// @Tags server-network
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param target query string true "Target host"
// @Param port query int false "Target port"
// @Param protocol query string false "Protocol (tcp/udp/icmp)" default(tcp)
// @Success 200 {object} domain.NetworkConnectivityCheck
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/network/check [post]
func (h *ServerHandler) CheckConnectivity(c *gin.Context) {
	serverID := c.Param("id")
	target := c.Query("target")
	port, _ := strconv.Atoi(c.Query("port"))
	protocol := c.DefaultQuery("protocol", "tcp")

	if target == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "target host is required"})
		return
	}

	check, err := h.networkUsecase.CheckConnectivity(c.Request.Context(), serverID, target, port, protocol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, check)
}

// TestPort godoc
// @Summary Test port connectivity
// @Description Test connectivity to a specific port
// @Tags server-network
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param request body domain.PortCheckRequest true "Port check request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/network/test-port [post]
func (h *ServerHandler) TestPort(c *gin.Context) {
	serverID := c.Param("id")

	var req domain.PortCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	success, err := h.networkUsecase.TestPort(c.Request.Context(), serverID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": success,
		"host":    req.Host,
		"port":    req.Port,
	})
}

// GetConnectivityHistory godoc
// @Summary Get connectivity history
// @Description Retrieve connectivity check history for a server
// @Tags server-network
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param limit query int false "Number of records" default(50)
// @Success 200 {array} domain.NetworkConnectivityCheck
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/network/history [get]
func (h *ServerHandler) GetConnectivityHistory(c *gin.Context) {
	serverID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	history, err := h.networkUsecase.GetConnectivityHistory(c.Request.Context(), serverID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

// ==================== IPTABLES ENDPOINTS ====================

// ListIPTableRules godoc
// @Summary List iptables rules
// @Description Get all iptables rules for a server
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {array} domain.ServerIPTable
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/iptables [get]
func (h *ServerHandler) ListIPTableRules(c *gin.Context) {
	serverID := c.Param("id")

	rules, err := h.iptableUsecase.ListRules(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rules)
}

// AddIPTableRule godoc
// @Summary Add iptables rule
// @Description Add a new iptables rule to a server
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param rule body domain.ServerIPTable true "IPTable rule object"
// @Success 201 {object} domain.ServerIPTable
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/iptables [post]
func (h *ServerHandler) AddIPTableRule(c *gin.Context) {
	serverID := c.Param("id")

	var rule domain.ServerIPTable
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule.ServerID = serverID

	if err := h.iptableUsecase.AddRule(c.Request.Context(), &rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// UpdateIPTableRule godoc
// @Summary Update iptables rule
// @Description Update an existing iptables rule
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param ruleId path string true "Rule ID"
// @Param rule body domain.ServerIPTable true "IPTable rule object"
// @Success 200 {object} domain.ServerIPTable
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/iptables/{ruleId} [put]
func (h *ServerHandler) UpdateIPTableRule(c *gin.Context) {
	ruleID := c.Param("ruleId")

	var rule domain.ServerIPTable
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule.ID = ruleID

	if err := h.iptableUsecase.UpdateRule(c.Request.Context(), &rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// DeleteIPTableRule godoc
// @Summary Delete iptables rule
// @Description Delete an iptables rule
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param ruleId path string true "Rule ID"
// @Success 204
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/iptables/{ruleId} [delete]
func (h *ServerHandler) DeleteIPTableRule(c *gin.Context) {
	ruleID := c.Param("ruleId")

	if err := h.iptableUsecase.DeleteRule(c.Request.Context(), ruleID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ApplyIPTableRules godoc
// @Summary Apply iptables rules
// @Description Apply all enabled iptables rules to the server
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/iptables/apply [post]
func (h *ServerHandler) ApplyIPTableRules(c *gin.Context) {
	serverID := c.Param("id")

	if err := h.iptableUsecase.ApplyRules(c.Request.Context(), serverID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IPTables rules applied successfully"})
}

// BackupIPTableConfig godoc
// @Summary Backup iptables configuration
// @Description Create a backup of current iptables configuration
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param id path string true "Server ID"
// @Param request body map[string]string true "Backup request with name and description"
// @Success 201 {object} domain.IPTableBackup
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/servers/{id}/iptables/backup [post]
func (h *ServerHandler) BackupIPTableConfig(c *gin.Context) {
	serverID := c.Param("id")

	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	backup, err := h.iptableUsecase.BackupConfiguration(c.Request.Context(), serverID, req.Name, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, backup)
}

// RestoreIPTableConfig godoc
// @Summary Restore iptables configuration
// @Description Restore iptables from a backup
// @Tags server-iptables
// @Accept json
// @Produce json
// @Param backupId path string true "Backup ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/iptables/backups/{backupId}/restore [post]
func (h *ServerHandler) RestoreIPTableConfig(c *gin.Context) {
	backupID := c.Param("backupId")

	if err := h.iptableUsecase.RestoreConfiguration(c.Request.Context(), backupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "IPTables configuration restored successfully"})
}
