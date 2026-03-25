//go:build legacy
// +build legacy

package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/usecase"
)

// License validation cache
type licenseCache struct {
	mu    sync.RWMutex
	cache map[string]cacheEntry
}

type cacheEntry struct {
	valid   bool
	expiry  time.Time
	tier    string
	message string
}

var (
	cache = &licenseCache{
		cache: make(map[string]cacheEntry),
	}
	cacheTTL = 5 * time.Minute
)

// LicenseMiddleware validates the license on every request
func LicenseMiddleware(licenseUsecase usecase.LicenseUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get license key from header
		licenseKey := c.GetHeader("X-License-Key")
		if licenseKey == "" {
			// Try to get from query param (for testing)
			licenseKey = c.Query("license_key")
		}

		if licenseKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "License key required",
				"code":  "LICENSE_MISSING",
			})
			c.Abort()
			return
		}

		// Check cache first
		if entry, ok := getCachedLicense(licenseKey); ok {
			if !entry.valid {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "Invalid license",
					"code":    "LICENSE_INVALID",
					"message": entry.message,
				})
				c.Abort()
				return
			}

			// Set license info in context
			c.Set("license_key", licenseKey)
			c.Set("license_tier", entry.tier)
			c.Next()
			return
		}

		// Validate license
		validation, err := licenseUsecase.ValidateLicense(licenseKey)
		if err != nil || !validation.Valid {
			message := "Invalid or expired license"
			if validation != nil {
				message = validation.Message
			}

			// Cache invalid result
			cacheLicense(licenseKey, false, "", message)

			c.JSON(http.StatusForbidden, gin.H{
				"error":   "License validation failed",
				"code":    "LICENSE_INVALID",
				"message": message,
			})
			c.Abort()
			return
		}

		// Cache valid result
		cacheLicense(licenseKey, true, string(validation.Tier), "")

		// Set license info in context for downstream handlers
		c.Set("license_key", licenseKey)
		c.Set("license_tier", validation.Tier)
		c.Set("license_limits", validation.Limits)

		// Track API call (async to not block request)
		go func() {
			_ = licenseUsecase.TrackAPICall(licenseKey)
		}()

		c.Next()
	}
}

// OptionalLicenseMiddleware validates license but doesn't block if missing (for public endpoints)
func OptionalLicenseMiddleware(licenseUsecase usecase.LicenseUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		licenseKey := c.GetHeader("X-License-Key")
		if licenseKey == "" {
			licenseKey = c.Query("license_key")
		}

		if licenseKey != "" {
			validation, err := licenseUsecase.ValidateLicense(licenseKey)
			if err == nil && validation.Valid {
				c.Set("license_key", licenseKey)
				c.Set("license_tier", validation.Tier)
				c.Set("license_limits", validation.Limits)
			}
		}

		c.Next()
	}
}

// getCachedLicense retrieves a cached license validation result
func getCachedLicense(key string) (cacheEntry, bool) {
	cache.mu.RLock()
	defer cache.mu.RUnlock()

	entry, ok := cache.cache[key]
	if !ok {
		return cacheEntry{}, false
	}

	// Check if expired
	if time.Now().After(entry.expiry) {
		return cacheEntry{}, false
	}

	return entry, true
}

// cacheLicense caches a license validation result
func cacheLicense(key string, valid bool, tier string, message string) {
	cache.mu.Lock()
	defer cache.mu.Unlock()

	cache.cache[key] = cacheEntry{
		valid:   valid,
		expiry:  time.Now().Add(cacheTTL),
		tier:    tier,
		message: message,
	}
}

// ClearLicenseCache clears the license cache (useful for testing or admin operations)
func ClearLicenseCache() {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	cache.cache = make(map[string]cacheEntry)
}

// RateLimitMiddleware implements API rate limiting based on license tier
func RateLimitMiddleware(licenseUsecase usecase.LicenseUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		licenseKey, exists := c.Get("license_key")
		if !exists {
			c.Next()
			return
		}

		// Get usage statistics
		stats, err := licenseUsecase.GetUsageStatistics(licenseKey.(string))
		if err != nil {
			c.Next()
			return
		}

		// Check if API limit exceeded
		if stats.MaxAPICalls > 0 && stats.CurrentAPICalls >= stats.MaxAPICalls {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "API call limit exceeded",
				"code":    "RATE_LIMIT_EXCEEDED",
				"limit":   stats.MaxAPICalls,
				"current": stats.CurrentAPICalls,
				"message": "Your monthly API call limit has been reached. Please upgrade your license.",
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", string(rune(stats.MaxAPICalls)))
		c.Header("X-RateLimit-Remaining", string(rune(stats.MaxAPICalls-stats.CurrentAPICalls)))

		c.Next()
	}
}

// RequireTierMiddleware requires a minimum license tier
func RequireTierMiddleware(minTier string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tier, exists := c.Get("license_tier")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "License tier information not found",
				"code":  "TIER_MISSING",
			})
			c.Abort()
			return
		}

		// Tier hierarchy
		tierOrder := map[string]int{
			"free":         1,
			"professional": 2,
			"enterprise":   3,
			"custom":       4,
		}

		currentTierLevel := tierOrder[strings.ToLower(tier.(string))]
		requiredTierLevel := tierOrder[strings.ToLower(minTier)]

		if currentTierLevel < requiredTierLevel {
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "Insufficient license tier",
				"code":          "TIER_INSUFFICIENT",
				"current_tier":  tier,
				"required_tier": minTier,
				"message":       "This feature requires a higher license tier. Please upgrade your license.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
