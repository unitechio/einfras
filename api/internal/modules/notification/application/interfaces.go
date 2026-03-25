//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"time"

	"einfra/api/internal/domain"
)

type EmailUsecase interface {
	// Basic sending
	SendEmail(ctx context.Context, to []string, subject, body string) error
	SendHTMLEmail(ctx context.Context, to []string, subject, htmlBody string) error
	SendEmailWithCC(ctx context.Context, to, cc []string, subject, body string) error
	SendEmailWithBCC(ctx context.Context, to, bcc []string, subject, body string) error

	// Template-based sending
	SendEmailWithTemplate(ctx context.Context, to []string, templateName string, data interface{}) error
	SendTemplateEmailWithCC(ctx context.Context, to, cc []string, templateName string, data interface{}) error

	// Attachments
	SendEmailWithAttachment(ctx context.Context, to []string, subject, body string, attachments []domain.EmailAttachment) error
	SendEmailWithInlineImage(ctx context.Context, to []string, subject, htmlBody string, images []domain.EmailAttachment) error

	// Bulk operations
	SendBulkEmail(ctx context.Context, emails []domain.EmailData) error
	SendBulkTemplateEmail(ctx context.Context, recipients []string, templateName string, data interface{}) error

	// Advanced features
	SendPriorityEmail(ctx context.Context, to []string, subject, body string, priority domain.EmailPriority) error
	SendEmailWithReplyTo(ctx context.Context, to []string, subject, body, replyTo string) error
	SendEmailWithHeaders(ctx context.Context, to []string, subject, body string, headers map[string]string) error

	// Scheduling (for future implementation)
	ScheduleEmail(ctx context.Context, sendAt time.Time, data domain.EmailData) error

	// Validation
	ValidateEmail(email string) bool
	ValidateEmailList(emails []string) (valid []string, invalid []string)

	// Logs and tracking
	GetEmailLog(ctx context.Context, id string) (*domain.EmailLog, error)
	ListEmailLogs(ctx context.Context, filter domain.EmailLogFilter) ([]*domain.EmailLog, error)
	GetEmailStatus(ctx context.Context, id string) (domain.EmailStatus, error)

	// Utilities
	ParseEmailAddresses(addresses string) []string
	FormatEmailAddress(name, email string) string
}

type NotificationUsecase interface {
	SendNotification(ctx context.Context, notification *domain.Notification) error
	SendNotificationFromTemplate(ctx context.Context, userID, templateName string, variables map[string]string) error
	SendBulkNotification(ctx context.Context, userIDs []string, notification *domain.Notification) error
	GetNotification(ctx context.Context, id string) (*domain.Notification, error)
	GetUserNotifications(ctx context.Context, userID string, filter domain.NotificationFilter) ([]*domain.Notification, int64, error)
	GetUnreadCount(ctx context.Context, userID string) (int64, error)
	MarkAsRead(ctx context.Context, id string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	DeleteNotification(ctx context.Context, id string) error
	CleanupOldNotifications(ctx context.Context, retentionDays int) error
	GetUserPreferences(ctx context.Context, userID string) (*domain.NotificationPreference, error)
	UpdateUserPreferences(ctx context.Context, userID string, preferences *domain.NotificationPreference) error
}
