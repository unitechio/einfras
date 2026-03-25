//go:build legacy
// +build legacy

// Package orgstore — permission_checker.go
// Redis-cached RBAC permission checker.
// First checks Redis (TTL 60s), falls back to DB on cache miss.
package orgstore

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const permCacheTTL = 60 * time.Second
const permCachePrefix = "perm:"

// PermChecker implements middleware.PermissionChecker with Redis caching.
type PermChecker struct {
	db    *gorm.DB
	cache *redis.Client // optional; nil = no cache
}

// NewPermChecker creates a permission checker.
// Pass nil for cache to disable Redis caching (useful in tests).
func NewPermChecker(db *gorm.DB, cache *redis.Client) *PermChecker {
	return &PermChecker{db: db, cache: cache}
}

// HasPermission checks if userID has a given permission in orgID.
// Permission is checked via:
//  1. Redis cache (key: perm:<userID>:<orgID>:<permission>)
//  2. DB: org member role → role permissions lookup
//  3. Cache result in Redis on hit
func (c *PermChecker) HasPermission(ctx context.Context, userID, orgID, permission string) (bool, error) {
	cacheKey := fmt.Sprintf("%s%s:%s:%s", permCachePrefix, userID, orgID, permission)

	// 1. Try Redis cache
	if c.cache != nil {
		val, err := c.cache.Get(ctx, cacheKey).Result()
		if err == nil {
			return val == "1", nil
		}
		if err != redis.Nil {
			// Cache error — log but continue with DB
			log.Warn().Err(err).Str("key", cacheKey).Msg("[perm] redis error, falling back to DB")
		}
	}

	// 2. DB check
	allowed, err := c.checkDB(ctx, userID, orgID, permission)
	if err != nil {
		return false, err
	}

	// 3. Cache result
	if c.cache != nil {
		val := "0"
		if allowed {
			val = "1"
		}
		_ = c.cache.Set(ctx, cacheKey, val, permCacheTTL).Err()
	}

	return allowed, nil
}

// InvalidateUser clears all cached permissions for a user (call on role change).
func (c *PermChecker) InvalidateUser(ctx context.Context, userID string) {
	if c.cache == nil {
		return
	}
	pattern := fmt.Sprintf("%s%s:*", permCachePrefix, userID)
	keys, err := c.cache.Keys(ctx, pattern).Result()
	if err != nil || len(keys) == 0 {
		return
	}
	_ = c.cache.Del(ctx, keys...).Err()
	log.Info().Str("user_id", userID).Int("keys", len(keys)).Msg("[perm] cache invalidated")
}

// checkDB resolves permission via DB: member role → role → permissions.
func (c *PermChecker) checkDB(ctx context.Context, userID, orgID, permission string) (bool, error) {
	// Global admin check (role.name = "admin" with global scope)
	var globalAdmin int64
	c.db.WithContext(ctx).
		Table("users u").
		Joins("JOIN roles r ON r.id = u.role_id").
		Where("u.id = ? AND r.name = 'admin' AND u.deleted_at IS NULL", userID).
		Count(&globalAdmin)
	if globalAdmin > 0 {
		return true, nil
	}

	// Org member → role → permission check
	var count int64
	err := c.db.WithContext(ctx).
		Table("org_members om").
		Joins("JOIN roles r ON r.name = om.role").
		Joins("JOIN role_permissions rp ON rp.role_id = r.id").
		Joins("JOIN permissions p ON p.id = rp.permission_id").
		Where("om.user_id = ? AND om.org_id = ? AND p.name = ?", userID, orgID, permission).
		Where("r.deleted_at IS NULL AND p.deleted_at IS NULL").
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("permission DB check: %w", err)
	}
	return count > 0, nil
}
