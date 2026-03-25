//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"errors"

	"einfra/api/internal/modules/server/infrastructure/settings_repo"
	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type userSettingsUsecase struct {
	repo repository.UserSettingsRepository
}

func NewUserSettingsUsecase(repo repository.UserSettingsRepository) UserSettingsUsecase {
	return &userSettingsUsecase{repo: repo}
}

func (u *userSettingsUsecase) GetUserSettings(ctx context.Context, userID string) (*domain.UserSettings, error) {
	settings, err := u.repo.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			defaults := domain.GetDefaultSettings(userID)
			if err := u.repo.Create(ctx, defaults); err != nil {
				return nil, err
			}
			return defaults, nil
		}
		return nil, err
	}
	return settings, nil
}

func (u *userSettingsUsecase) UpdateUserSettings(ctx context.Context, userID string, settings *domain.UserSettingsUpdate) error {
	// Ensure the record exists
	if _, err := u.repo.GetByUserID(ctx, userID); err != nil {
		return err
	}
	// Use PartialUpdate since we're receiving UserSettingsUpdate
	return u.repo.PartialUpdate(ctx, userID, settings)
}

// PartialUpdateUserSettings updates selected fields
func (u *userSettingsUsecase) PartialUpdateUserSettings(ctx context.Context, userID string, upd *domain.UserSettingsUpdate) error {
	// Ensure user settings exist
	if _, err := u.repo.GetByUserID(ctx, userID); err != nil {
		return err
	}
	return u.repo.PartialUpdate(ctx, userID, upd)
}

// ResetToDefaults resets a user's settings to the default configuration
func (u *userSettingsUsecase) ResetToDefaults(ctx context.Context, userID string) error {
	return u.repo.ResetToDefaults(ctx, userID)
}

// GetOrCreateSettings returns existing settings or creates defaults if missing
func (u *userSettingsUsecase) GetOrCreateSettings(ctx context.Context, userID string) (*domain.UserSettings, error) {
	settings, err := u.repo.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			defaults := domain.GetDefaultSettings(userID)
			if err := u.repo.Create(ctx, defaults); err != nil {
				return nil, err
			}
			return defaults, nil
		}
		return nil, err
	}
	return settings, nil
}
