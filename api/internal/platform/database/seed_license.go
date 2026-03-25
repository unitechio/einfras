//go:build legacy
// +build legacy

package database

import (
	"fmt"
	"log"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

// SeedFeatureFlags seeds default feature flags for all tiers
func SeedFeatureFlags(db *gorm.DB) error {
	features := []domain.FeatureFlag{
		// Free Tier Features
		{
			Name:             "Basic User Management",
			Key:              domain.FeatureUserManagement,
			Category:         "Core",
			Enabled:          true,
			RequiredTier:     domain.TierFree,
			IsPremium:        false,
			MaxUsagePerMonth: 0,
			Description:      "Basic user management with up to 5 users",
		},
		{
			Name:             "Basic Authentication",
			Key:              "basic_auth",
			Category:         "Core",
			Enabled:          true,
			RequiredTier:     domain.TierFree,
			IsPremium:        false,
			MaxUsagePerMonth: 0,
			Description:      "Basic authentication features",
		},
		{
			Name:             "API Access",
			Key:              domain.FeatureAPIAccess,
			Category:         "Integration",
			Enabled:          true,
			RequiredTier:     domain.TierFree,
			IsPremium:        false,
			MaxUsagePerMonth: 1000,
			Description:      "API access with rate limiting",
		},

		// Professional Tier Features
		{
			Name:             "Advanced Role Management",
			Key:              domain.FeatureRoleManagement,
			Category:         "Core",
			Enabled:          true,
			RequiredTier:     domain.TierPro,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Advanced RBAC with custom roles",
		},
		{
			Name:             "Document Management",
			Key:              domain.FeatureDocumentManagement,
			Category:         "Features",
			Enabled:          true,
			RequiredTier:     domain.TierPro,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Full document management system",
		},
		{
			Name:             "Email Notifications",
			Key:              domain.FeatureEmailNotifications,
			Category:         "Communication",
			Enabled:          true,
			RequiredTier:     domain.TierPro,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Automated email notifications",
		},

		// Enterprise Tier Features
		{
			Name:             "Audit Logs",
			Key:              domain.FeatureAuditLogs,
			Category:         "Security",
			Enabled:          true,
			RequiredTier:     domain.TierEnterprise,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Comprehensive audit logging",
		},
		{
			Name:             "Advanced Reporting",
			Key:              domain.FeatureAdvancedReporting,
			Category:         "Analytics",
			Enabled:          true,
			RequiredTier:     domain.TierEnterprise,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Advanced analytics and reporting",
		},
		{
			Name:             "Custom Integrations",
			Key:              domain.FeatureCustomIntegrations,
			Category:         "Integration",
			Enabled:          true,
			RequiredTier:     domain.TierEnterprise,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "Custom integration capabilities",
		},
		{
			Name:             "White Labeling",
			Key:              domain.FeatureWhiteLabeling,
			Category:         "Branding",
			Enabled:          true,
			RequiredTier:     domain.TierEnterprise,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "White label the application",
		},
		{
			Name:             "Priority Support",
			Key:              domain.FeaturePrioritySupport,
			Category:         "Support",
			Enabled:          true,
			RequiredTier:     domain.TierEnterprise,
			IsPremium:        true,
			MaxUsagePerMonth: 0,
			Description:      "24/7 priority support",
		},
	}

	for _, feature := range features {
		// Check if feature already exists
		var existing domain.FeatureFlag
		if err := db.Where("key = ?", feature.Key).First(&existing).Error; err == nil {
			// Feature exists, skip
			continue
		}

		// Create feature
		if err := db.Create(&feature).Error; err != nil {
			log.Printf("Warning: Failed to seed feature flag %s: %v", feature.Key, err)
		} else {
			log.Printf("✓ Seeded feature flag: %s (%s tier)", feature.Name, feature.RequiredTier)
		}
	}

	return nil
}

// SeedTestLicenses creates test licenses for each tier (for development only)
func SeedTestLicenses(db *gorm.DB) error {
	licenses := []struct {
		tier domain.LicenseTier
		org  string
	}{
		{domain.TierFree, "Free Tier Test Org"},
		{domain.TierPro, "Professional Tier Test Org"},
		{domain.TierEnterprise, "Enterprise Tier Test Org"},
	}

	for _, l := range licenses {
		// Generate license key
		key, err := domain.GenerateLicenseKey()
		if err != nil {
			return fmt.Errorf("failed to generate license key: %w", err)
		}

		maxUsers, maxAPICalls, maxStorage := domain.GetTierLimits(l.tier)

		license := domain.License{
			LicenseKey:       key,
			Tier:             l.tier,
			Status:           domain.LicenseStatusActive,
			OrganizationName: l.org,
			ContactEmail:     fmt.Sprintf("test-%s@example.com", l.tier),
			MaxUsers:         maxUsers,
			MaxAPICall:       maxAPICalls,
			MaxStorage:       maxStorage,
		}

		// Check if test license for this tier already exists
		var existing domain.License
		if err := db.Where("organization_name = ?", l.org).First(&existing).Error; err == nil {
			// License exists, skip
			continue
		}

		if err := db.Create(&license).Error; err != nil {
			log.Printf("Warning: Failed to seed test license for %s: %v", l.tier, err)
		} else {
			log.Printf("✓ Seeded test license for %s tier: %s", l.tier, key)
		}
	}

	return nil
}
