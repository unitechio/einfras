Feature Flag & License Management System - Implementation Walkthrough
Overview
Đã hoàn thành implementation hệ thống Feature Flag + License Management để thương mại hóa sản phẩm EINFRA CRM. Hệ thống cho phép kiểm soát tính năng dựa trên license tier của khách hàng với 4 tiers: Free, Professional, Enterprise, và Custom.

Architecture
Yes
No
Yes
No
Client Request
License Middleware
License Valid?
Feature Middleware
403 Forbidden
Feature Available?
Handler
403 Feature Restricted
Response
Implemented Components
1. Domain Models
license.go
License
 struct with tier support, usage tracking, and validation
LicenseTier
 enum: Free, Professional, Enterprise, Custom
LicenseStatus
 enum: Active, Expired, Suspended, Revoked
Helper functions: 
GenerateLicenseKey()
, 
GetTierLimits()
, 
IsValid()
, 
IsExpired()
feature_flag.go
Enhanced 
FeatureFlag
 with RequiredTier, IsPremium, MaxUsagePerMonth
IsAvailableForTier()
 method for tier-based checking
Common feature key constants
2. Database Migrations
007_create_licenses_table.up.sql
licenses table with tier, status, limits, usage tracking
license_usage_logs table for detailed usage analytics
Indexes for performance
Auto-update trigger for updated_at
008_update_feature_flags_table.up.sql
Added key, required_tier, is_premium, max_usage_per_month columns
Indexes for tier-based queries
3. Repository Layer
license_repository.go
Full CRUD operations
Usage tracking: 
LogUsage()
, 
GetUsageStats()
, 
ResetMonthlyUsage()
Query methods: 
GetByKey()
, 
GetByOrganization()
, 
GetByTier()
, 
GetByStatus()
feature_flag_repository.go
Added 
GetByKey()
 and 
GetByTier()
 methods
Tier hierarchy logic for feature availability
4. Use Case Layer
license_usecase.go
License Management:

CreateLicense()
 - Generate and create new licenses
ActivateLicense()
 - Activate license for organization
ValidateLicense()
 - Validate license key and get info
CheckLicenseExpiry()
 - Check expiration status
Usage Tracking:

TrackAPICall()
 - Increment API call counter
TrackUserLogin()
 - Log user login events
TrackStorageUsage()
 - Update storage usage
GetUsageStatistics()
 - Get current usage stats
ResetMonthlyUsage()
 - Reset monthly counters
Tier Management:

UpgradeLicense()
 - Upgrade to higher tier
DowngradeLicense()
 - Downgrade tier
Status Management:

SuspendLicense()
 - Suspend license
RevokeLicense()
 - Revoke permanently
ReactivateLicense()
 - Reactivate suspended license
feature_flag_usecase.go
GetFeatureFlagByKey()
 - Get feature by key
GetFeatureFlagsByTier()
 - Get all features for a tier
IsFeatureAvailableForTier()
 - Check feature availability
5. Middleware
license_middleware.go
License Validation:

LicenseMiddleware()
 - Validate license on every request
OptionalLicenseMiddleware()
 - Optional validation for public endpoints
In-memory caching with 5-minute TTL
Automatic API call tracking
Rate Limiting:

RateLimitMiddleware()
 - API rate limiting per tier
Returns X-RateLimit-Limit and X-RateLimit-Remaining headers
Tier Requirements:

RequireTierMiddleware()
 - Require minimum tier for endpoints
feature_middleware.go
FeatureMiddleware()
 - Check feature availability
RequireFeatureMiddleware()
 - Require specific feature
CheckFeatureEnabled()
 - Helper function for conditional logic
6. Handlers
license_handler.go
All endpoints include Swagger documentation:

Public Endpoints:

POST /api/v1/licenses/activate - Activate license
GET /api/v1/licenses/validate - Validate license key
Protected Endpoints:

GET /api/v1/licenses/current - Get current license info
GET /api/v1/licenses/usage - Get usage statistics
POST /api/v1/licenses/upgrade - Upgrade license tier
Admin Endpoints:

POST /api/v1/admin/licenses - Create new license
GET /api/v1/admin/licenses - List all licenses
POST /api/v1/admin/licenses/{key}/suspend - Suspend license
POST /api/v1/admin/licenses/{key}/reactivate - Reactivate license
7. Seed Data
seed_license.go
Default Feature Flags:

Free Tier: Basic User Management, Basic Auth, API Access (1k/month)
Professional Tier: Role Management, Document Management, Email Notifications
Enterprise Tier: Audit Logs, Advanced Reporting, Custom Integrations, White Labeling, Priority Support
Test Licenses:

Generates test licenses for each tier (development only)
Prints license keys to console for testing
License Tiers
Tier	Max Users	API Calls/Month	Storage	Features
Free	5	1,000	1 GB	Basic features
Professional	50	50,000	50 GB	+ RBAC, Documents, Emails
Enterprise	Unlimited	Unlimited	Unlimited	+ Audit, Reporting, Integrations
Custom	Custom	Custom	Custom	Fully customizable
Usage Examples
1. License Activation
curl -X POST http://localhost:8080/api/v1/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "EINFRA-XXXX-XXXX-XXXX-XXXX",
    "organization_id": "org-123",
    "organization_name": "Acme Corp",
    "contact_email": "admin@acme.com"
  }'
2. Making API Calls with License
curl -X GET http://localhost:8080/api/v1/users \
  -H "X-License-Key: EINFRA-XXXX-XXXX-XXXX-XXXX"
3. Check License Usage
curl -X GET http://localhost:8080/api/v1/licenses/usage \
  -H "X-License-Key: EINFRA-XXXX-XXXX-XXXX-XXXX"
Integration Steps
Step 1: Update 
main.go
// Add to repositories section
licenseRepo := repository.NewLicenseRepository(db)
// Add to usecases section
licenseUsecase := usecase.NewLicenseUsecase(licenseRepo)
featureFlagUsecase := usecase.NewFeatureFlagUsecase(featureFlagRepo)
// Add to handlers section
licenseHandler := handler.NewLicenseHandler(licenseUsecase)
featureFlagHandler := handler.NewFeatureFlagHandler(featureFlagUsecase)
Step 2: Update Router
Add license and feature flag routes to 
router.go
:

// License routes
licenses := v1.Group("/licenses")
{
    licenses.POST("/activate", licenseHandler.ActivateLicense)
    licenses.GET("/validate", licenseHandler.ValidateLicense)
}
// Protected license routes
protected.GET("/licenses/current", licenseHandler.GetCurrentLicense)
protected.GET("/licenses/usage", licenseHandler.GetUsageStatistics)
protected.POST("/licenses/upgrade", licenseHandler.UpgradeLicense)
// Admin license routes
admin := protected.Group("/admin")
{
    admin.POST("/licenses", licenseHandler.CreateLicense)
    admin.GET("/licenses", licenseHandler.ListLicenses)
    admin.POST("/licenses/:license_key/suspend", licenseHandler.SuspendLicense)
    admin.POST("/licenses/:license_key/reactivate", licenseHandler.ReactivateLicense)
}
Step 3: Apply Middleware
// Apply license middleware to protected routes
protected.Use(middleware.LicenseMiddleware(licenseUsecase))
protected.Use(middleware.RateLimitMiddleware(licenseUsecase))
// Require specific features
documents := protected.Group("/documents")
documents.Use(middleware.RequireFeatureMiddleware(domain.FeatureDocumentManagement, featureFlagUsecase))
Step 4: Run Migrations and Seeds
// In database.AutoMigrate or SeedDefaultData
if err := SeedFeatureFlags(db); err != nil {
    log.Printf("Warning: Failed to seed feature flags: %v", err)
}
// For development only
if cfg.Server.Mode == "debug" {
    if err := SeedTestLicenses(db); err != nil {
        log.Printf("Warning: Failed to seed test licenses: %v", err)
    }
}
Testing
Test License Keys (After Seeding)
Check console output for generated test license keys for each tier.

Manual Testing Checklist
 Activate a license
 Make API calls with valid license
 Verify rate limiting (exceed API limits)
 Test feature restrictions (access premium features with free tier)
 Test license expiry
 Test license suspension/reactivation
 Upgrade/downgrade license tier
Next Steps
Integrate with existing auth system - Link licenses to user organizations
Add admin UI - Create admin panel for license management
Implement license renewal - Add renewal workflow and notifications
Add analytics dashboard - Show usage trends and license statistics
Implement offline validation - For air-gapped environments
Add hardware binding - Bind licenses to specific servers (optional)
Security Notes
CAUTION

License keys are generated server-side only
Never expose license generation logic to clients
Validate licenses on every request via middleware
Cache validation results to reduce database load
Track failed validation attempts for security monitoring
Summary
✅ Completed:

Full license management system with 4 tiers
Feature flag system with tier-based restrictions
License validation middleware with caching
Rate limiting per tier
Usage tracking and analytics
Comprehensive API with Swagger docs
Seed data for testing
🎯 Ready for:

Production deployment
Integration with existing systems
Commercial licensing model