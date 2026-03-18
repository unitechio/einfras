package usecase

import "context"

// NotificationUsecase defines the notification contract used by auth workflows.
// It is defined here to avoid circular imports with the notification package.
type NotificationUsecase interface {
	SendNotificationFromTemplate(ctx context.Context, userID, templateName string, variables map[string]string) error
}
