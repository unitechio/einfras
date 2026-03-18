package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
)

func FeatureMiddleware(featureKey string, featureFlagUsecase usecase.FeatureFlagUsecase) gin.HandlerFunc {
	return func(c *gin.Context) {
		tier, exists := c.Get("license_tier")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "License information not found",
				"code":  "LICENSE_MISSING",
			})
			c.Abort()
			return
		}

		feature, err := featureFlagUsecase.GetFeatureFlagByKey(featureKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to check feature availability",
				"code":  "FEATURE_CHECK_FAILED",
			})
			c.Abort()
			return
		}

		// Check if feature is globally enabled
		if !feature.Enabled {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Feature is currently disabled",
				"code":    "FEATURE_DISABLED",
				"feature": featureKey,
			})
			c.Abort()
			return
		}

		// Check if feature is available for the license tier
		licenseTier := tier.(domain.LicenseTier)
		if !feature.IsAvailableForTier(licenseTier) {
			c.JSON(http.StatusForbidden, gin.H{
				"error":         "Feature not available for your license tier",
				"code":          "FEATURE_TIER_RESTRICTED",
				"feature":       featureKey,
				"current_tier":  tier,
				"required_tier": feature.RequiredTier,
				"message":       "This feature requires a higher license tier. Please upgrade your license.",
			})
			c.Abort()
			return
		}

		// Set feature info in context
		c.Set("feature_key", featureKey)
		c.Set("feature_name", feature.Name)

		c.Next()
	}
}

// RequireFeatureMiddleware is a convenience function to require a specific feature
func RequireFeatureMiddleware(featureKey string, featureFlagUsecase usecase.FeatureFlagUsecase) gin.HandlerFunc {
	return FeatureMiddleware(featureKey, featureFlagUsecase)
}

// CheckFeatureEnabled checks if a feature is enabled without blocking the request
func CheckFeatureEnabled(c *gin.Context, featureKey string, featureFlagUsecase usecase.FeatureFlagUsecase) bool {
	tier, exists := c.Get("license_tier")
	if !exists {
		return false
	}

	feature, err := featureFlagUsecase.GetFeatureFlagByKey(featureKey)
	if err != nil || !feature.Enabled {
		return false
	}

	licenseTier := tier.(domain.LicenseTier)
	return feature.IsAvailableForTier(licenseTier)
}
