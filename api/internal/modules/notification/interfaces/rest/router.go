package handler

import (
	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/notification/application"
)

// NotificationHandlers groups all Notification-related handlers
type NotificationHandlers struct {
	Notification *NotificationHandler
	Email        *EmailHandler
}

// NewNotificationHandlers creates a new Notification handlers instance
func NewNotificationHandlers(
	notificationUC usecase.NotificationUsecase,
	emailUC usecase.EmailUsecase,
) *NotificationHandlers {
	return &NotificationHandlers{
		Notification: NewNotificationHandler(notificationUC),
		Email:        NewEmailHandler(emailUC),
	}
}

// RegisterNotificationRoutes registers all Notification-related routes
func RegisterNotificationRoutes(r *gin.RouterGroup, h *NotificationHandlers) {
	notifications := r.Group("/notifications")
	{
		// Notification CRUD
		notifications.GET("", h.Notification.ListNotifications)
		notifications.POST("", h.Notification.CreateNotification)
		notifications.GET("/:notification_id", h.Notification.GetNotification)
		notifications.PUT("/:notification_id/read", h.Notification.MarkAsRead)
		notifications.PUT("/read-all", h.Notification.MarkAllAsRead)
		notifications.DELETE("/:notification_id", h.Notification.DeleteNotification)

		// User notifications
		notifications.GET("/user/:user_id", h.Notification.GetUserNotifications)
		notifications.GET("/user/:user_id/unread", h.Notification.GetUnreadCount)
	}

	// Email routes
	emails := r.Group("/emails")
	{
		emails.POST("/send", h.Email.SendEmail)
		emails.POST("/send-bulk", h.Email.SendBulkEmail)
		emails.GET("/templates", h.Email.ListEmailTemplates)
		emails.POST("/templates", h.Email.CreateEmailTemplate)
		emails.GET("/templates/:template_id", h.Email.GetEmailTemplate)
		emails.PUT("/templates/:template_id", h.Email.UpdateEmailTemplate)
		emails.DELETE("/templates/:template_id", h.Email.DeleteEmailTemplate)
	}
}
