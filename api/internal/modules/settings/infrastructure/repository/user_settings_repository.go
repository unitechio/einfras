//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type UserSettingsRepository interface {
	Create(ctx context.Context, settings *domain.UserSettings) error
	GetByID(ctx context.Context, id string) (*domain.UserSettings, error)
	GetByUserID(ctx context.Context, userID string) (*domain.UserSettings, error)
	Update(ctx context.Context, settings *domain.UserSettings) error
	PartialUpdate(ctx context.Context, userID string, update *domain.UserSettingsUpdate) error
	Delete(ctx context.Context, id string) error
	ResetToDefaults(ctx context.Context, userID string) error
}

type userSettingsRepository struct {
	db *gorm.DB
}

func NewUserSettingsRepository(db *gorm.DB) UserSettingsRepository {
	return &userSettingsRepository{db: db}
}

func (r *userSettingsRepository) Create(ctx context.Context, settings *domain.UserSettings) error {
	return r.db.WithContext(ctx).Create(settings).Error
}

func (r *userSettingsRepository) GetByID(ctx context.Context, id string) (*domain.UserSettings, error) {
	var s domain.UserSettings
	if err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *userSettingsRepository) GetByUserID(ctx context.Context, userID string) (*domain.UserSettings, error) {
	var s domain.UserSettings
	if err := r.db.WithContext(ctx).Where("user_id = ? AND deleted_at IS NULL", userID).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *userSettingsRepository) Update(ctx context.Context, settings *domain.UserSettings) error {
	return r.db.WithContext(ctx).Save(settings).Error
}

func (r *userSettingsRepository) PartialUpdate(ctx context.Context, userID string, upd *domain.UserSettingsUpdate) error {
	updates := make(map[string]interface{})
	// UI settings
	if upd.Theme != nil {
		updates["theme"] = *upd.Theme
	}
	if upd.FontSize != nil {
		updates["font_size"] = *upd.FontSize
	}
	if upd.FontFamily != nil {
		updates["font_family"] = *upd.FontFamily
	}
	if upd.CompactMode != nil {
		updates["compact_mode"] = *upd.CompactMode
	}
	if upd.SidebarCollapsed != nil {
		updates["sidebar_collapsed"] = *upd.SidebarCollapsed
	}
	if upd.Sidebar != nil {
		updates["sidebar"] = *upd.Sidebar
	}
	// Localization
	if upd.Language != nil {
		updates["language"] = *upd.Language
	}
	if upd.Timezone != nil {
		updates["timezone"] = *upd.Timezone
	}
	if upd.DateFormat != nil {
		updates["date_format"] = *upd.DateFormat
	}
	if upd.TimeFormat != nil {
		updates["time_format"] = *upd.TimeFormat
	}
	if upd.Currency != nil {
		updates["currency"] = *upd.Currency
	}
	// Notifications
	if upd.NotificationLevel != nil {
		updates["notification_level"] = *upd.NotificationLevel
	}
	if upd.EmailNotifications != nil {
		updates["email_notifications"] = *upd.EmailNotifications
	}
	if upd.PushNotifications != nil {
		updates["push_notifications"] = *upd.PushNotifications
	}
	if upd.DesktopNotifications != nil {
		updates["desktop_notifications"] = *upd.DesktopNotifications
	}
	if upd.NotificationSound != nil {
		updates["notification_sound"] = *upd.NotificationSound
	}
	if upd.DigestFrequency != nil {
		updates["digest_frequency"] = *upd.DigestFrequency
	}
	// Dashboard
	if upd.DefaultDashboard != nil {
		updates["default_dashboard"] = *upd.DefaultDashboard
	}
	if upd.WidgetLayout != nil {
		updates["widget_layout"] = *upd.WidgetLayout
	}
	// Table
	if upd.DefaultPageSize != nil {
		updates["default_page_size"] = *upd.DefaultPageSize
	}
	if upd.TableDensity != nil {
		updates["table_density"] = *upd.TableDensity
	}
	// Accessibility
	if upd.HighContrast != nil {
		updates["high_contrast"] = *upd.HighContrast
	}
	if upd.ReduceMotion != nil {
		updates["reduce_motion"] = *upd.ReduceMotion
	}
	// Privacy
	if upd.ShowOnlineStatus != nil {
		updates["show_online_status"] = *upd.ShowOnlineStatus
	}
	// Advanced
	if upd.DeveloperMode != nil {
		updates["developer_mode"] = *upd.DeveloperMode
	}
	if upd.BetaFeatures != nil {
		updates["beta_features"] = *upd.BetaFeatures
	}
	if len(updates) == 0 {
		return fmt.Errorf("no fields to update")
	}
	return r.db.WithContext(ctx).Model(&domain.UserSettings{}).Where("user_id = ? AND deleted_at IS NULL", userID).Updates(updates).Error
}

func (r *userSettingsRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.UserSettings{}).Error
}

func (r *userSettingsRepository) ResetToDefaults(ctx context.Context, userID string) error {
	defaults := domain.GetDefaultSettings(userID)
	return r.db.WithContext(ctx).Model(&domain.UserSettings{}).Where("user_id = ? AND deleted_at IS NULL", userID).Updates(defaults).Error
}
