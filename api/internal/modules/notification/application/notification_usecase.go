//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	authrepo "einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/modules/notification/infrastructure"
	"einfra/api/internal/domain"
	"einfra/api/internal/shared/platform/logger"
	"einfra/api/internal/socket"
)

type notificationUsecase struct {
	repo         repository.NotificationRepository
	templateRepo domain.NotificationTemplateRepository
	prefRepo     domain.NotificationPreferenceRepository
	userRepo     authrepo.UserRepository
	emailUsecase EmailUsecase
	hub          *socket.Hub
	log          logger.Logger
}

func NewNotificationUsecase(
	repo repository.NotificationRepository,
	templateRepo domain.NotificationTemplateRepository,
	prefRepo domain.NotificationPreferenceRepository,
	userRepo authrepo.UserRepository,
	emailUsecase EmailUsecase,
	hub *socket.Hub,
	log logger.Logger,
) NotificationUsecase {
	return &notificationUsecase{
		repo:         repo,
		templateRepo: templateRepo,
		prefRepo:     prefRepo,
		userRepo:     userRepo,
		emailUsecase: emailUsecase,
		hub:          hub,
		log:          log,
	}
}

func (u *notificationUsecase) SendNotification(ctx context.Context, notification *domain.Notification) error {
	// Check user preferences
	prefs, err := u.prefRepo.GetByUserID(ctx, notification.UserID)
	if err == nil && prefs != nil {
		// Check if notification type is enabled
		if notification.Channel == domain.NotificationChannelInApp && !prefs.EnableInApp {
			return nil // Skip
		}
		if notification.Channel == domain.NotificationChannelEmail && !prefs.EnableEmail {
			return nil // Skip
		}
		// Check quiet hours
		if prefs.IsInQuietHours() && notification.Priority != domain.NotificationPriorityUrgent {
			u.log.Info(ctx, "Notification skipped due to quiet hours", logger.LogField{Key: "user_id", Value: notification.UserID})
			return nil
		}
	}

	// Save to DB
	if err := u.repo.Create(ctx, notification); err != nil {
		return err
	}

	// Send to socket Hub
	if notification.Channel == domain.NotificationChannelInApp || notification.Channel == "" {
		if u.hub != nil {
			// TODO: Convert notification to socket.Message type
			// u.hub.SendToUser(notification.UserID, notification)
		}
	}

	// Send Email
	if notification.Channel == domain.NotificationChannelEmail {
		user, err := u.userRepo.GetByID(ctx, notification.UserID)
		if err != nil {
			u.log.Error(ctx, "Failed to get user for email notification", logger.LogField{Key: "user_id", Value: notification.UserID}, logger.LogField{Key: "error", Value: err})
			return nil // Don't fail the whole operation? Or should we?
		}
		if user.Email != "" {
			if err := u.emailUsecase.SendEmail(ctx, []string{user.Email}, notification.Title, notification.Message); err != nil {
				u.log.Error(ctx, "Failed to send email notification", logger.LogField{Key: "user_id", Value: notification.UserID}, logger.LogField{Key: "error", Value: err})
				// Update IsSent status?
			} else {
				// Update IsSent to true
				notification.IsSent = true
				_ = u.repo.Update(ctx, notification)
			}
		}
	}

	return nil
}

func (u *notificationUsecase) SendNotificationFromTemplate(ctx context.Context, userID, templateName string, variables map[string]string) error {
	template, err := u.templateRepo.GetByName(ctx, templateName)
	if err != nil {
		return fmt.Errorf("template not found: %w", err)
	}

	if !template.IsActive {
		return fmt.Errorf("template is inactive")
	}

	// Replace variables in Subject and Body
	subject := template.Subject
	body := template.BodyText // Or BodyHTML
	for k, v := range variables {
		subject = strings.ReplaceAll(subject, "{{"+k+"}}", v)
		body = strings.ReplaceAll(body, "{{"+k+"}}", v)
	}

	notification := &domain.Notification{
		UserID:   userID,
		Type:     template.Type,
		Channel:  template.Channel,
		Priority: template.Priority,
		Title:    subject,
		Message:  body,
		IsSent:   false,
	}

	return u.SendNotification(ctx, notification)
}

func (u *notificationUsecase) SendBulkNotification(ctx context.Context, userIDs []string, notification *domain.Notification) error {
	for _, userID := range userIDs {
		n := *notification // Copy
		n.UserID = userID
		n.ID = "" // Reset ID to let DB generate new one
		if err := u.SendNotification(ctx, &n); err != nil {
			u.log.Error(ctx, "Failed to send bulk notification", logger.LogField{Key: "user_id", Value: userID}, logger.LogField{Key: "error", Value: err})
			// Continue with others
		}
	}
	return nil
}

func (u *notificationUsecase) GetNotification(ctx context.Context, id string) (*domain.Notification, error) {
	return u.repo.GetByID(ctx, id)
}

func (u *notificationUsecase) GetUserNotifications(ctx context.Context, userID string, filter domain.NotificationFilter) ([]*domain.Notification, int64, error) {
	return u.repo.GetByUserID(ctx, userID, filter)
}

func (u *notificationUsecase) GetUnreadCount(ctx context.Context, userID string) (int64, error) {
	return u.repo.GetUnreadCount(ctx, userID)
}

func (u *notificationUsecase) MarkAsRead(ctx context.Context, id string) error {
	return u.repo.MarkAsRead(ctx, id)
}

func (u *notificationUsecase) MarkAllAsRead(ctx context.Context, userID string) error {
	return u.repo.MarkAllAsRead(ctx, userID)
}

func (u *notificationUsecase) DeleteNotification(ctx context.Context, id string) error {
	return u.repo.Delete(ctx, id)
}

func (u *notificationUsecase) CleanupOldNotifications(ctx context.Context, retentionDays int) error {
	duration := time.Duration(retentionDays) * 24 * time.Hour
	return u.repo.DeleteOlderThan(ctx, duration)
}

func (u *notificationUsecase) GetUserPreferences(ctx context.Context, userID string) (*domain.NotificationPreference, error) {
	pref, err := u.prefRepo.GetByUserID(ctx, userID)
	if err != nil {
		// If not found, return default preferences
		return &domain.NotificationPreference{
			UserID:      userID,
			EnableInApp: true,
			EnableEmail: true,
			EnablePush:  true,
		}, nil
	}
	return pref, nil
}

func (u *notificationUsecase) UpdateUserPreferences(ctx context.Context, userID string, preferences *domain.NotificationPreference) error {
	existing, err := u.prefRepo.GetByUserID(ctx, userID)
	if err != nil {
		// Create if not exists
		preferences.UserID = userID
		return u.prefRepo.Create(ctx, preferences)
	}
	preferences.ID = existing.ID
	preferences.UserID = userID
	return u.prefRepo.Update(ctx, preferences)
}
