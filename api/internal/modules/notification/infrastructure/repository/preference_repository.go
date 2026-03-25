//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type notificationPreferenceRepository struct {
	db *gorm.DB
}

func NewNotificationPreferenceRepository(db *gorm.DB) domain.NotificationPreferenceRepository {
	return &notificationPreferenceRepository{db: db}
}

func (r *notificationPreferenceRepository) Create(ctx context.Context, preference *domain.NotificationPreference) error {
	return r.db.WithContext(ctx).Create(preference).Error
}

func (r *notificationPreferenceRepository) GetByUserID(ctx context.Context, userID string) (*domain.NotificationPreference, error) {
	var preference domain.NotificationPreference
	err := r.db.WithContext(ctx).First(&preference, "user_id = ?", userID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("preference not found")
		}
		return nil, err
	}
	return &preference, nil
}

func (r *notificationPreferenceRepository) Update(ctx context.Context, preference *domain.NotificationPreference) error {
	return r.db.WithContext(ctx).Save(preference).Error
}

func (r *notificationPreferenceRepository) Delete(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Delete(&domain.NotificationPreference{}, "user_id = ?", userID).Error
}
