//go:build legacy
// +build legacy

package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"einfra/api/internal/domain"
)

var (
	ErrRefreshTokenNotFound = errors.New("refresh token not found")
	ErrRefreshTokenExpired  = errors.New("refresh token expired")
	ErrRefreshTokenRevoked  = errors.New("refresh token revoked")
)

type AuthRepository interface {
	// Basic CRUD operations
	SaveRefreshToken(ctx context.Context, token *domain.RefreshToken) error
	GetRefreshTokenByID(ctx context.Context, tokenID string) (*domain.RefreshToken, error)
	GetRefreshTokenByToken(ctx context.Context, token string) (*domain.RefreshToken, error)
	GetRefreshTokensByUserID(ctx context.Context, userID string) ([]*domain.RefreshToken, error)
	UpdateRefreshToken(ctx context.Context, token *domain.RefreshToken) error
	DeleteRefreshToken(ctx context.Context, tokenID string) error

	// Token validation and status
	IsTokenValid(ctx context.Context, token string) (bool, error)
	GetActiveRefreshTokensByUserID(ctx context.Context, userID string) ([]*domain.RefreshToken, error)
	GetUserTokenCount(ctx context.Context, userID string) (int64, error)
	GetActiveUserTokenCount(ctx context.Context, userID string) (int64, error)

	// Token revocation
	RevokeRefreshToken(ctx context.Context, tokenID string) error
	RevokeRefreshTokenByToken(ctx context.Context, token string) error
	RevokeAllRefreshTokensForUser(ctx context.Context, userID string) error
	RevokeOldestTokensForUser(ctx context.Context, userID string, keepCount int) error

	// Token cleanup and maintenance
	DeleteExpiredRefreshTokens(ctx context.Context) error
	DeleteRevokedRefreshTokens(ctx context.Context, olderThan time.Time) error
	CleanupUserTokens(ctx context.Context, userID string, maxTokens int) error

	// Token usage tracking
	UpdateLastUsedAt(ctx context.Context, tokenID string) error
	GetTokenUsageStats(ctx context.Context, userID string) (*TokenUsageStats, error)

	// Batch operations
	SaveRefreshTokens(ctx context.Context, tokens []*domain.RefreshToken) error
	RevokeRefreshTokens(ctx context.Context, tokenIDs []string) error
}

type TokenUsageStats struct {
	TotalTokens   int64
	ActiveTokens  int64
	RevokedTokens int64
	ExpiredTokens int64
	LastUsedAt    *time.Time
}

type authRepository struct {
	db *gorm.DB
}

func NewAuthRepository(db *gorm.DB) AuthRepository {
	return &authRepository{db: db}
}

// Basic CRUD operations

func (r *authRepository) SaveRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	if err := r.db.WithContext(ctx).Create(token).Error; err != nil {
		return fmt.Errorf("failed to save refresh token: %w", err)
	}
	return nil
}

func (r *authRepository) GetRefreshTokenByID(ctx context.Context, tokenID string) (*domain.RefreshToken, error) {
	var refreshToken domain.RefreshToken
	err := r.db.WithContext(ctx).
		First(&refreshToken, "id = ?", tokenID).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, fmt.Errorf("failed to get refresh token by ID: %w", err)
	}

	return &refreshToken, nil
}

func (r *authRepository) GetRefreshTokenByToken(ctx context.Context, token string) (*domain.RefreshToken, error) {
	var refreshToken domain.RefreshToken
	err := r.db.WithContext(ctx).
		First(&refreshToken, "token = ?", token).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, fmt.Errorf("failed to get refresh token: %w", err)
	}

	return &refreshToken, nil
}

func (r *authRepository) GetRefreshTokensByUserID(ctx context.Context, userID string) ([]*domain.RefreshToken, error) {
	var tokens []*domain.RefreshToken
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&tokens).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get refresh tokens by user ID: %w", err)
	}

	return tokens, nil
}

func (r *authRepository) UpdateRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	result := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("id = ?", token.ID).
		Updates(token)

	if result.Error != nil {
		return fmt.Errorf("failed to update refresh token: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

func (r *authRepository) DeleteRefreshToken(ctx context.Context, tokenID string) error {
	result := r.db.WithContext(ctx).
		Delete(&domain.RefreshToken{}, "id = ?", tokenID)

	if result.Error != nil {
		return fmt.Errorf("failed to delete refresh token: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

// Token validation and status

func (r *authRepository) IsTokenValid(ctx context.Context, token string) (bool, error) {
	var refreshToken domain.RefreshToken
	err := r.db.WithContext(ctx).
		Select("id, expires_at, is_revoked").
		First(&refreshToken, "token = ?", token).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, ErrRefreshTokenNotFound
		}
		return false, fmt.Errorf("failed to check token validity: %w", err)
	}

	if refreshToken.IsRevoked {
		return false, ErrRefreshTokenRevoked
	}

	if refreshToken.ExpiresAt.Before(time.Now()) {
		return false, ErrRefreshTokenExpired
	}

	return true, nil
}

func (r *authRepository) GetActiveRefreshTokensByUserID(ctx context.Context, userID string) ([]*domain.RefreshToken, error) {
	var tokens []*domain.RefreshToken
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").
		Find(&tokens).Error

	if err != nil {
		return nil, fmt.Errorf("failed to get active refresh tokens: %w", err)
	}

	return tokens, nil
}

func (r *authRepository) GetUserTokenCount(ctx context.Context, userID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ?", userID).
		Count(&count).Error

	if err != nil {
		return 0, fmt.Errorf("failed to get user token count: %w", err)
	}

	return count, nil
}

func (r *authRepository) GetActiveUserTokenCount(ctx context.Context, userID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, time.Now()).
		Count(&count).Error

	if err != nil {
		return 0, fmt.Errorf("failed to get active user token count: %w", err)
	}

	return count, nil
}

// Token revocation

func (r *authRepository) RevokeRefreshToken(ctx context.Context, tokenID string) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("id = ?", tokenID).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": now,
		})

	if result.Error != nil {
		return fmt.Errorf("failed to revoke refresh token: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

func (r *authRepository) RevokeRefreshTokenByToken(ctx context.Context, token string) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("token = ?", token).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": now,
		})

	if result.Error != nil {
		return fmt.Errorf("failed to revoke refresh token by token: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

func (r *authRepository) RevokeAllRefreshTokensForUser(ctx context.Context, userID string) error {
	now := time.Now()
	err := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ? AND is_revoked = false", userID).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": now,
		}).Error

	if err != nil {
		return fmt.Errorf("failed to revoke all refresh tokens for user: %w", err)
	}

	return nil
}

func (r *authRepository) RevokeOldestTokensForUser(ctx context.Context, userID string, keepCount int) error {
	// Get all tokens ordered by creation date (newest first)
	var tokens []*domain.RefreshToken
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_revoked = false", userID).
		Order("created_at DESC").
		Find(&tokens).Error

	if err != nil {
		return fmt.Errorf("failed to get tokens for revocation: %w", err)
	}

	// If we have fewer tokens than keepCount, nothing to revoke
	if len(tokens) <= keepCount {
		return nil
	}

	// Get token IDs to revoke (oldest ones)
	tokensToRevoke := tokens[keepCount:]
	tokenIDs := make([]string, len(tokensToRevoke))
	for i, token := range tokensToRevoke {
		tokenIDs[i] = token.ID
	}

	// Revoke the oldest tokens
	now := time.Now()
	err = r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("id IN ?", tokenIDs).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": now,
		}).Error

	if err != nil {
		return fmt.Errorf("failed to revoke oldest tokens: %w", err)
	}

	return nil
}

// Token cleanup and maintenance

func (r *authRepository) DeleteExpiredRefreshTokens(ctx context.Context) error {
	err := r.db.WithContext(ctx).
		Where("expires_at < ?", time.Now()).
		Delete(&domain.RefreshToken{}).Error

	if err != nil {
		return fmt.Errorf("failed to delete expired refresh tokens: %w", err)
	}

	return nil
}

func (r *authRepository) DeleteRevokedRefreshTokens(ctx context.Context, olderThan time.Time) error {
	err := r.db.WithContext(ctx).
		Where("is_revoked = true AND revoked_at < ?", olderThan).
		Delete(&domain.RefreshToken{}).Error

	if err != nil {
		return fmt.Errorf("failed to delete revoked refresh tokens: %w", err)
	}

	return nil
}

func (r *authRepository) CleanupUserTokens(ctx context.Context, userID string, maxTokens int) error {
	// Get count of active tokens
	count, err := r.GetActiveUserTokenCount(ctx, userID)
	if err != nil {
		return err
	}

	// If under limit, no cleanup needed
	if count <= int64(maxTokens) {
		return nil
	}

	// Revoke oldest tokens to bring count down to maxTokens
	return r.RevokeOldestTokensForUser(ctx, userID, maxTokens)
}

// Token usage tracking

func (r *authRepository) UpdateLastUsedAt(ctx context.Context, tokenID string) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("id = ?", tokenID).
		Update("last_used_at", now)

	if result.Error != nil {
		return fmt.Errorf("failed to update last used at: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}

	return nil
}

func (r *authRepository) GetTokenUsageStats(ctx context.Context, userID string) (*TokenUsageStats, error) {
	var stats TokenUsageStats
	now := time.Now()

	// Total tokens
	err := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ?", userID).
		Count(&stats.TotalTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get total token count: %w", err)
	}

	// Active tokens
	err = r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ? AND is_revoked = false AND expires_at > ?", userID, now).
		Count(&stats.ActiveTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get active token count: %w", err)
	}

	// Revoked tokens
	err = r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ? AND is_revoked = true", userID).
		Count(&stats.RevokedTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get revoked token count: %w", err)
	}

	// Expired tokens
	err = r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ? AND is_revoked = false AND expires_at <= ?", userID, now).
		Count(&stats.ExpiredTokens).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get expired token count: %w", err)
	}

	// Last used at
	var lastUsed time.Time
	err = r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("user_id = ?", userID).
		Select("MAX(last_used_at)").
		Scan(&lastUsed).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to get last used at: %w", err)
	}
	if !lastUsed.IsZero() {
		stats.LastUsedAt = &lastUsed
	}

	return &stats, nil
}

// Batch operations

func (r *authRepository) SaveRefreshTokens(ctx context.Context, tokens []*domain.RefreshToken) error {
	if len(tokens) == 0 {
		return nil
	}

	err := r.db.WithContext(ctx).
		CreateInBatches(tokens, 100).Error

	if err != nil {
		return fmt.Errorf("failed to save refresh tokens in batch: %w", err)
	}

	return nil
}

func (r *authRepository) RevokeRefreshTokens(ctx context.Context, tokenIDs []string) error {
	if len(tokenIDs) == 0 {
		return nil
	}

	now := time.Now()
	err := r.db.WithContext(ctx).
		Model(&domain.RefreshToken{}).
		Where("id IN ?", tokenIDs).
		Updates(map[string]interface{}{
			"is_revoked": true,
			"revoked_at": now,
		}).Error

	if err != nil {
		return fmt.Errorf("failed to revoke refresh tokens in batch: %w", err)
	}

	return nil
}
