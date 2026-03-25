//go:build legacy
// +build legacy

package repository

import (
	"context"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type LoginAttemptRepository interface {
	Create(ctx context.Context, attempt *domain.LoginAttempt) error
	GetRecentAttempts(ctx context.Context, username, ipAddress string, duration time.Duration) ([]*domain.LoginAttempt, error)
	GetFailedAttempts(ctx context.Context, username, ipAddress string, duration time.Duration) (int64, error)
	DeleteOlderThan(ctx context.Context, duration time.Duration) error
}

type loginAttemptRepository struct {
	db *gorm.DB
}

func NewLoginAttemptRepository(db *gorm.DB) LoginAttemptRepository {
	return &loginAttemptRepository{db: db}
}

func (r *loginAttemptRepository) Create(ctx context.Context, attempt *domain.LoginAttempt) error {
	return r.db.WithContext(ctx).Create(attempt).Error
}

func (r *loginAttemptRepository) GetRecentAttempts(ctx context.Context, username, ipAddress string, duration time.Duration) ([]*domain.LoginAttempt, error) {
	var attempts []*domain.LoginAttempt
	since := time.Now().Add(-duration)

	err := r.db.WithContext(ctx).
		Where("username = ? AND ip_address = ? AND created_at > ?", username, ipAddress, since).
		Order("created_at DESC").
		Find(&attempts).Error

	if err != nil {
		return nil, err
	}

	return attempts, nil
}

func (r *loginAttemptRepository) GetFailedAttempts(ctx context.Context, username, ipAddress string, duration time.Duration) (int64, error) {
	var count int64
	since := time.Now().Add(-duration)

	err := r.db.WithContext(ctx).
		Model(&domain.LoginAttempt{}).
		Where("username = ? AND ip_address = ? AND success = false AND created_at > ?", username, ipAddress, since).
		Count(&count).Error

	if err != nil {
		return 0, err
	}

	return count, nil
}

func (r *loginAttemptRepository) DeleteOlderThan(ctx context.Context, duration time.Duration) error {
	cutoff := time.Now().Add(-duration)
	return r.db.WithContext(ctx).
		Where("created_at < ?", cutoff).
		Delete(&domain.LoginAttempt{}).Error
}
