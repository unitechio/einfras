//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type SessionRepository interface {
	Create(ctx context.Context, session *domain.Session) error
	GetByToken(ctx context.Context, token string) (*domain.Session, error)
	GetByUserID(ctx context.Context, userID string) ([]*domain.Session, error)
	Update(ctx context.Context, session *domain.Session) error
	Delete(ctx context.Context, id string) error
	DeleteByToken(ctx context.Context, token string) error
	DeleteAllForUser(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
	UpdateActivity(ctx context.Context, token string) error
}

type sessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &sessionRepository{db: db}
}

func (r *sessionRepository) Create(ctx context.Context, session *domain.Session) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *sessionRepository) GetByToken(ctx context.Context, token string) (*domain.Session, error) {
	var session domain.Session
	err := r.db.WithContext(ctx).
		First(&session, "token = ?", token).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("session not found")
		}
		return nil, err
	}

	return &session, nil
}

func (r *sessionRepository) GetByUserID(ctx context.Context, userID string) ([]*domain.Session, error) {
	var sessions []*domain.Session
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_active = true", userID).
		Order("last_activity DESC").
		Find(&sessions).Error

	if err != nil {
		return nil, err
	}

	return sessions, nil
}

func (r *sessionRepository) Update(ctx context.Context, session *domain.Session) error {
	return r.db.WithContext(ctx).Save(session).Error
}

func (r *sessionRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Session{}, "id = ?", id).Error
}

func (r *sessionRepository) DeleteByToken(ctx context.Context, token string) error {
	return r.db.WithContext(ctx).Delete(&domain.Session{}, "token = ?", token).Error
}

func (r *sessionRepository) DeleteAllForUser(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&domain.Session{}).Error
}

func (r *sessionRepository) DeleteExpired(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ? OR (is_active = false)", time.Now()).
		Delete(&domain.Session{}).Error
}

func (r *sessionRepository) UpdateActivity(ctx context.Context, token string) error {
	return r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("token = ?", token).
		Update("last_activity", time.Now()).Error
}
