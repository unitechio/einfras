//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

// AuditHandler handles audit log-related HTTP requests.
type AuditHandler struct {
	auditService usecase.AuditUsecase
}

// NewAuditHandler creates a new AuditHandler instance.
func NewAuditHandler(auditService usecase.AuditUsecase) *AuditHandler {
	return &AuditHandler{
		auditService: auditService,
	}
}

// Log creates a new audit log entry
// @Summary Create audit log entry
// @Description Create a new audit log entry for tracking user actions and system events
// @Tags audit
// @Accept json
// @Produce json
// @Param request body domain.AuditLog true "Audit log data"
// @Success 201 {object} map[string]interface{} "Audit entry logged successfully"
// @Failure 400 {object} errorx.Error "Invalid request body"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/logs [post]
// @Security BearerAuth
func (h *AuditHandler) Log(c *gin.Context) {
	var entry domain.AuditLog
	if err := c.ShouldBindJSON(&entry); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	if err := h.auditService.Log(c.Request.Context(), &entry); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to log audit entry").WithStack())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Audit entry logged successfully",
		"data":    entry,
	})
}

// GetAll retrieves all audit log entries with filtering and pagination
// @Summary List all audit logs
// @Description Get a paginated list of audit logs with optional filtering by user, action, resource, date range, etc.
// @Tags audit
// @Accept json
// @Produce json
// @Param user_id query string false "Filter by user ID"
// @Param username query string false "Filter by username"
// @Param action query string false "Filter by action (create, update, delete, etc.)"
// @Param resource query string false "Filter by resource type"
// @Param resource_id query string false "Filter by resource ID"
// @Param ip_address query string false "Filter by IP address"
// @Param success query boolean false "Filter by success status"
// @Param start_date query string false "Filter by start date (RFC3339 format)"
// @Param end_date query string false "Filter by end date (RFC3339 format)"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Param sort_by query string false "Sort by field (created_at, action, resource)" default(created_at)
// @Param sort_order query string false "Sort order (asc, desc)" default(desc)
// @Success 200 {object} map[string]interface{} "List of audit logs with pagination"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/logs [get]
// @Security BearerAuth
func (h *AuditHandler) GetAll(c *gin.Context) {
	var filter domain.AuditFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request query: "+err.Error()))
		return
	}

	// Set default pagination values if not provided
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	audits, total, err := h.auditService.ListAuditLogs(c.Request.Context(), filter)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get audit entries").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Audit entries retrieved successfully",
		"data":      audits,
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	})
}

// GetByID retrieves a specific audit log entry by ID
// @Summary Get audit log by ID
// @Description Get detailed information about a specific audit log entry
// @Tags audit
// @Accept json
// @Produce json
// @Param id path string true "Audit log ID (UUID)"
// @Success 200 {object} map[string]interface{} "Audit log details"
// @Failure 404 {object} errorx.Error "Audit entry not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/logs/{id} [get]
// @Security BearerAuth
func (h *AuditHandler) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.Error(errorx.New(http.StatusBadRequest, "Audit log ID is required"))
		return
	}

	audit, err := h.auditService.GetAuditLog(c.Request.Context(), id)
	if err != nil {
		c.Error(errorx.New(http.StatusNotFound, "Audit entry not found: "+err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Audit entry retrieved successfully",
		"data":    audit,
	})
}

// GetUserAuditLogs retrieves audit logs for a specific user
// @Summary Get user audit logs
// @Description Get all audit logs for a specific user with optional filtering
// @Tags audit
// @Accept json
// @Produce json
// @Param user_id path string true "User ID (UUID)"
// @Param action query string false "Filter by action"
// @Param resource query string false "Filter by resource type"
// @Param start_date query string false "Filter by start date (RFC3339 format)"
// @Param end_date query string false "Filter by end date (RFC3339 format)"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Success 200 {object} map[string]interface{} "User audit logs"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/users/{user_id}/logs [get]
// @Security BearerAuth
func (h *AuditHandler) GetUserAuditLogs(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.Error(errorx.New(http.StatusBadRequest, "User ID is required"))
		return
	}

	var filter domain.AuditFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request query: "+err.Error()))
		return
	}

	// Set default pagination
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}

	audits, total, err := h.auditService.GetUserAuditLogs(c.Request.Context(), userID, filter)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get user audit logs").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "User audit logs retrieved successfully",
		"data":      audits,
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	})
}

// GetResourceAuditLogs retrieves audit logs for a specific resource
// @Summary Get resource audit logs
// @Description Get all audit logs for a specific resource with optional filtering
// @Tags audit
// @Accept json
// @Produce json
// @Param resource path string true "Resource type (e.g., server, user, database)"
// @Param resource_id path string true "Resource ID"
// @Param action query string false "Filter by action"
// @Param start_date query string false "Filter by start date (RFC3339 format)"
// @Param end_date query string false "Filter by end date (RFC3339 format)"
// @Param page query int false "Page number (default: 1)" default(1)
// @Param page_size query int false "Page size (default: 20, max: 100)" default(20)
// @Success 200 {object} map[string]interface{} "Resource audit logs"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/resources/{resource}/{resource_id}/logs [get]
// @Security BearerAuth
func (h *AuditHandler) GetResourceAuditLogs(c *gin.Context) {
	resource := c.Param("resource")
	resourceID := c.Param("resource_id")

	if resource == "" || resourceID == "" {
		c.Error(errorx.New(http.StatusBadRequest, "Resource type and resource ID are required"))
		return
	}

	var filter domain.AuditFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request query: "+err.Error()))
		return
	}

	// Set default pagination
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}

	audits, total, err := h.auditService.GetResourceAuditLogs(c.Request.Context(), resource, resourceID, filter)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get resource audit logs").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Resource audit logs retrieved successfully",
		"data":      audits,
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	})
}

// GetStatistics retrieves audit log statistics
// @Summary Get audit statistics
// @Description Get statistical information about audit logs including action breakdown, resource breakdown, and hourly activity
// @Tags audit
// @Accept json
// @Produce json
// @Param start_date query string false "Start date for statistics (RFC3339 format)"
// @Param end_date query string false "End date for statistics (RFC3339 format)"
// @Success 200 {object} map[string]interface{} "Audit statistics"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/statistics [get]
// @Security BearerAuth
func (h *AuditHandler) GetStatistics(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	// Default to last 30 days if not provided
	if startDateStr == "" {
		startDate = time.Now().AddDate(0, 0, -30)
	} else {
		startDate, err = time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			c.Error(errorx.New(http.StatusBadRequest, "Invalid start_date format. Use RFC3339 format"))
			return
		}
	}

	if endDateStr == "" {
		endDate = time.Now()
	} else {
		endDate, err = time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			c.Error(errorx.New(http.StatusBadRequest, "Invalid end_date format. Use RFC3339 format"))
			return
		}
	}

	stats, err := h.auditService.GetAuditStatistics(c.Request.Context(), startDate, endDate)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get audit statistics").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Audit statistics retrieved successfully",
		"data":    stats,
		"period": gin.H{
			"start_date": startDate,
			"end_date":   endDate,
		},
	})
}

// CleanupOldLogs removes old audit logs based on retention policy
// @Summary Cleanup old audit logs
// @Description Delete audit logs older than the specified retention period
// @Tags audit
// @Accept json
// @Produce json
// @Param retention_days query int false "Number of days to retain logs (default: 90)" default(90)
// @Success 200 {object} map[string]interface{} "Cleanup successful"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/cleanup [post]
// @Security BearerAuth
func (h *AuditHandler) CleanupOldLogs(c *gin.Context) {
	retentionDaysStr := c.DefaultQuery("retention_days", "90")
	retentionDays, err := strconv.Atoi(retentionDaysStr)
	if err != nil || retentionDays < 1 {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid retention_days parameter"))
		return
	}

	if err := h.auditService.CleanupOldLogs(c.Request.Context(), retentionDays); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to cleanup old logs").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Old audit logs cleaned up successfully",
		"retention_days": retentionDays,
	})
}

// ExportAuditLogs exports audit logs in specified format
// @Summary Export audit logs
// @Description Export audit logs to CSV or JSON format with optional filtering
// @Tags audit
// @Accept json
// @Produce json
// @Param format query string false "Export format (csv, json)" default(json)
// @Param user_id query string false "Filter by user ID"
// @Param action query string false "Filter by action"
// @Param resource query string false "Filter by resource type"
// @Param start_date query string false "Filter by start date (RFC3339 format)"
// @Param end_date query string false "Filter by end date (RFC3339 format)"
// @Success 200 {object} map[string]interface{} "Export file path or data"
// @Failure 400 {object} errorx.Error "Invalid request parameters"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /audit/export [get]
// @Security BearerAuth
func (h *AuditHandler) ExportAuditLogs(c *gin.Context) {
	format := c.DefaultQuery("format", "json")
	if format != "json" && format != "csv" {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid format. Supported formats: json, csv"))
		return
	}

	var filter domain.AuditFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request query: "+err.Error()))
		return
	}

	exportPath, err := h.auditService.ExportAuditLogs(c.Request.Context(), filter, format)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to export audit logs: "+err.Error()).WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Audit logs exported successfully",
		"export_path": exportPath,
		"format":      format,
	})
}
