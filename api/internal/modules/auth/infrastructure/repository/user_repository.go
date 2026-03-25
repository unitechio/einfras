//go:build legacy
// +build legacy

package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id string) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByUsername(ctx context.Context, username string) (*domain.User, error)
	List(ctx context.Context, filter domain.UserFilter) ([]*domain.User, int64, error)
	Update(ctx context.Context, user *domain.User) error
	Delete(ctx context.Context, id string) error
	UpdatePassword(ctx context.Context, userID, passwordHash string) error
	UpdateLastLogin(ctx context.Context, userID, ip string) error
	IncrementFailedLogin(ctx context.Context, userID string) error
	ResetFailedLogin(ctx context.Context, userID string) error
	LockAccount(ctx context.Context, userID string, until time.Time) error
	UnlockAccount(ctx context.Context, userID string) error
	UpdateSettings(ctx context.Context, userID string, settings domain.UserSettings) error
	CreateBatch(ctx context.Context, users []*domain.User) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		First(&user, "id = ?", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		First(&user, "email = ?", email).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *userRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		First(&user, "username = ?", username).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *userRepository) List(ctx context.Context, filter domain.UserFilter) ([]*domain.User, int64, error) {
	var users []*domain.User
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.User{})

	if filter.RoleID != "" {
		query = query.Where("role_id = ?", filter.RoleID)
	}

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if filter.Search != "" {
		searchPattern := "%" + filter.Search + "%"
		query = query.Where(
			"username ILIKE ? OR email ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize)

	query = query.Preload("Role").Preload("Role.Permissions")

	if err := query.Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *userRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *userRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.User{}, "id = ?", id).Error
}

func (r *userRepository) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"password":            passwordHash,
			"password_changed_at": now,
		}).Error
}

func (r *userRepository) UpdateLastLogin(ctx context.Context, userID, ip string) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"last_login_at": now,
			"last_login_ip": ip,
		}).Error
}

func (r *userRepository) IncrementFailedLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Update("failed_login_count", gorm.Expr("failed_login_count + 1")).Error
}

func (r *userRepository) ResetFailedLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Update("failed_login_count", 0).Error
}

func (r *userRepository) LockAccount(ctx context.Context, userID string, until time.Time) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Update("locked_until", until).Error
}

func (r *userRepository) UnlockAccount(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", userID).
		Update("locked_until", nil).Error
}

func (r *userRepository) UpdateSettings(ctx context.Context, userID string, settings domain.UserSettings) error {
	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	query := `UPDATE users SET settings = $1 WHERE id = $2`
	err = r.db.WithContext(ctx).Exec(query, settingsJSON, userID).Error
	if err != nil {
		return fmt.Errorf("failed to update user settings: %w", err)
	}

	return nil
}

func (r *userRepository) CreateBatch(ctx context.Context, users []*domain.User) error {
	return r.db.WithContext(ctx).CreateInBatches(users, 100).Error
}
