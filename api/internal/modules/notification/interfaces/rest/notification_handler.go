//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"einfra/api/internal/domain"
	"einfra/api/internal/shared/platform/logger"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

// NotificationHandler handles notification API requests.
type NotificationHandler struct {
	uc  usecase.NotificationUsecase
	log logger.Logger
}

// NewNotificationHandler creates a new notification handler.
func NewNotificationHandler(uc usecase.NotificationUsecase, log logger.Logger) *NotificationHandler {
	return &NotificationHandler{uc: uc, log: log}
}

// createNotificationRequest represents the request body for creating a notification.
type createNotificationRequest struct {
	UserID   string                      `json:"user_id" binding:"required"`
	Type     domain.NotificationType     `json:"type" binding:"required"`
	Channel  domain.NotificationChannel  `json:"channel" binding:"required"`
	Priority domain.NotificationPriority `json:"priority" binding:"required"`
	Title    string                      `json:"title" binding:"required"`
	Message  string                      `json:"message" binding:"required"`
}

// GetUserNotifications godoc
// @Summary Get user notifications
// @Description Get notifications for a specific user with filtering
// @Tags notifications
// @Produce json
// @Param user_id path string true "User ID"
// @Param page query int false "Page number"
// @Param page_size query int false "Page size"
// @Param type query string false "Notification type"
// @Param channel query string false "Notification channel"
// @Param is_read query boolean false "Is read status"
// @Success 200 {object} gin.H
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /users/{user_id}/notifications [get]
func (h *NotificationHandler) GetUserNotifications(c *gin.Context) {
	userID := c.Param("user_id")
	var filter domain.NotificationFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		h.log.Error(c.Request.Context(), "Invalid query parameters", logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusBadRequest, "Invalid query parameters"))
		return
	}

	notifications, total, err := h.uc.GetUserNotifications(c.Request.Context(), userID, filter)
	if err != nil {
		h.log.Error(c.Request.Context(), "Failed to get user notifications", logger.LogField{Key: "user_id", Value: userID}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get user notifications").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  notifications,
		"total": total,
		"page":  filter.Page,
	})
}

// GetByID godoc
// @Summary Get a notification by ID
// @Description Get a notification by its ID
// @Tags notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} domain.Notification
// @Failure 404 {object} gin.H
// @Router /notifications/{id} [get]
func (h *NotificationHandler) GetByID(c *gin.Context) {
	id := c.Param("id")
	notification, err := h.uc.GetNotification(c.Request.Context(), id)
	if err != nil {
		h.log.Error(c.Request.Context(), "Notification not found", logger.LogField{Key: "id", Value: id}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusNotFound, "Notification not found"))
		return
	}
	c.JSON(http.StatusOK, notification)
}

// Create godoc
// @Summary Create a new notification
// @Description Create a new notification manually
// @Tags notifications
// @Accept json
// @Produce json
// @Param notification body createNotificationRequest true "Notification details"
// @Success 201 {object} domain.Notification
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /notifications [post]
func (h *NotificationHandler) Create(c *gin.Context) {
	var req createNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Error(c.Request.Context(), "Invalid request body", logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	notification := &domain.Notification{
		ID:        uuid.New().String(),
		UserID:    req.UserID,
		Type:      req.Type,
		Channel:   req.Channel,
		Priority:  req.Priority,
		Title:     req.Title,
		Message:   req.Message,
		CreatedAt: time.Now(),
		IsRead:    false,
		IsSent:    false,
	}

	if err := h.uc.SendNotification(c.Request.Context(), notification); err != nil {
		h.log.Error(c.Request.Context(), "Failed to create notification", logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to create notification").WithStack())
		return
	}

	c.JSON(http.StatusCreated, notification)
}

// MarkAsRead godoc
// @Summary Mark a notification as read
// @Description Mark a notification as read by its ID
// @Tags notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /notifications/{id}/read [put]
func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	id := c.Param("id")
	if err := h.uc.MarkAsRead(c.Request.Context(), id); err != nil {
		h.log.Error(c.Request.Context(), "Failed to mark notification as read", logger.LogField{Key: "id", Value: id}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to mark notification as read").WithStack())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllAsRead godoc
// @Summary Mark all notifications as read
// @Description Mark all notifications as read for a user
// @Tags notifications
// @Produce json
// @Param user_id path string true "User ID"
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /users/{user_id}/notifications/read-all [put]
func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID := c.Param("user_id")
	if err := h.uc.MarkAllAsRead(c.Request.Context(), userID); err != nil {
		h.log.Error(c.Request.Context(), "Failed to mark all notifications as read", logger.LogField{Key: "user_id", Value: userID}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to mark all notifications as read").WithStack())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// GetUnreadCount godoc
// @Summary Get unread notification count
// @Description Get the count of unread notifications for a user
// @Tags notifications
// @Produce json
// @Param user_id path string true "User ID"
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /users/{user_id}/notifications/unread-count [get]
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := c.Param("user_id")
	count, err := h.uc.GetUnreadCount(c.Request.Context(), userID)
	if err != nil {
		h.log.Error(c.Request.Context(), "Failed to get unread count", logger.LogField{Key: "user_id", Value: userID}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to get unread count").WithStack())
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// Delete godoc
// @Summary Delete a notification
// @Description Delete a notification by its ID
// @Tags notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /notifications/{id} [delete]
func (h *NotificationHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.uc.DeleteNotification(c.Request.Context(), id); err != nil {
		h.log.Error(c.Request.Context(), "Failed to delete notification", logger.LogField{Key: "id", Value: id}, logger.LogField{Key: "error", Value: err})
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to delete notification").WithStack())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}
