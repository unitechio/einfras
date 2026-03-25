package iam

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"strings"
	"time"
)

type PublicLoginConfiguration struct {
	Enabled     bool   `json:"enabled"`
	Title       string `json:"title"`
	Message     string `json:"message"`
	Severity    string `json:"severity"`
	HelpText    string `json:"help_text"`
	ButtonLabel string `json:"button_label"`
}

type UpsertSystemSettingRequest struct {
	Key         string         `json:"key"`
	Category    string         `json:"category"`
	Value       string         `json:"value"`
	Description string         `json:"description"`
	Sensitive   bool           `json:"sensitive"`
	Metadata    map[string]any `json:"metadata"`
}

type BulkUpsertSystemSettingsRequest struct {
	Items []UpsertSystemSettingRequest `json:"items"`
}

type UpsertFeatureFlagRequest struct {
	Key         string         `json:"key"`
	Name        string         `json:"name"`
	Category    string         `json:"category"`
	Description string         `json:"description"`
	Enabled     bool           `json:"enabled"`
	Metadata    map[string]any `json:"metadata"`
}

type BulkUpsertFeatureFlagsRequest struct {
	Items []UpsertFeatureFlagRequest `json:"items"`
}

type UpsertLicenseRequest struct {
	LicenseKey   string         `json:"license_key"`
	Tier         string         `json:"tier"`
	Status       string         `json:"status"`
	ContactEmail string         `json:"contact_email"`
	ExpiresAt    string         `json:"expires_at"`
	Metadata     map[string]any `json:"metadata"`
}

type UpsertUserSettingsRequest struct {
	Payload map[string]any `json:"payload"`
}

type GenerateLicenseKeyRequest struct {
	Tier string `json:"tier"`
}

type UpsertLicenseKeyRequest struct {
	Name      string         `json:"name"`
	Tier      string         `json:"tier"`
	Status    string         `json:"status"`
	IssuedTo  string         `json:"issued_to"`
	ExpiresAt string         `json:"expires_at"`
	IsPrimary bool           `json:"is_primary"`
	Features  []string       `json:"features"`
	Metadata  map[string]any `json:"metadata"`
}

func (s *Service) ListSystemSettings(ctx context.Context, principal *Principal, category string) ([]SystemSettingRecord, error) {
	var items []SystemSettingRecord
	query := s.db.WithContext(ctx).Where("organization_id = ?", principal.OrganizationID).Order("category asc, key asc")
	if strings.TrimSpace(category) != "" {
		query = query.Where("category = ?", strings.TrimSpace(category))
	}
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) BulkUpsertSystemSettings(ctx context.Context, principal *Principal, req BulkUpsertSystemSettingsRequest) ([]SystemSettingRecord, error) {
	items := make([]SystemSettingRecord, 0, len(req.Items))
	for _, input := range req.Items {
		item, err := s.upsertSystemSetting(ctx, principal, input)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, nil
}

func (s *Service) GetPublicLoginConfiguration(ctx context.Context, organizationSlug string) (*PublicLoginConfiguration, error) {
	slug := strings.TrimSpace(organizationSlug)
	if slug == "" {
		slug = "default"
	}
	var organization Organization
	if err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&organization).Error; err != nil {
		return &PublicLoginConfiguration{
			Enabled:     false,
			Title:       "Workspace notice",
			Message:     "",
			Severity:    "info",
			HelpText:    "Banner settings can be managed from General Settings once signed in.",
			ButtonLabel: "Review workspace notice",
		}, nil
	}
	var items []SystemSettingRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ? AND key IN ?", organization.ID, []string{
			"login_banner",
			"login_banner_title",
			"login_banner_message",
			"login_banner_severity",
			"login_banner_help_text",
			"login_banner_button_label",
		}).
		Find(&items).Error; err != nil {
		return nil, err
	}
	values := map[string]string{}
	for _, item := range items {
		values[item.Key] = strings.TrimSpace(item.Value)
	}
	return &PublicLoginConfiguration{
		Enabled:     strings.EqualFold(values["login_banner"], "true"),
		Title:       defaultString(values["login_banner_title"], "Workspace notice"),
		Message:     values["login_banner_message"],
		Severity:    defaultString(values["login_banner_severity"], "info"),
		HelpText:    defaultString(values["login_banner_help_text"], "Banner settings can be managed from General Settings once signed in."),
		ButtonLabel: defaultString(values["login_banner_button_label"], "Review workspace notice"),
	}, nil
}

func (s *Service) upsertSystemSetting(ctx context.Context, principal *Principal, req UpsertSystemSettingRequest) (*SystemSettingRecord, error) {
	key := strings.TrimSpace(req.Key)
	if key == "" {
		return nil, fmt.Errorf("key is required")
	}
	var item SystemSettingRecord
	err := s.db.WithContext(ctx).
		Where("organization_id = ? AND key = ?", principal.OrganizationID, key).
		First(&item).Error
	if err != nil {
		item = SystemSettingRecord{
			OrganizationID: principal.OrganizationID,
			Key:            key,
		}
	}
	item.Category = defaultString(req.Category, "general")
	item.Value = req.Value
	item.Description = strings.TrimSpace(req.Description)
	item.Sensitive = req.Sensitive
	item.Metadata = JSONObject(req.Metadata)
	if item.ID == "" {
		if err := s.db.WithContext(ctx).Create(&item).Error; err != nil {
			return nil, err
		}
	} else if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) ListFeatureFlags(ctx context.Context, principal *Principal) ([]FeatureFlagRecord, error) {
	var items []FeatureFlagRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("category asc, key asc").
		Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) > 0 {
		return items, nil
	}
	defaults := []FeatureFlagRecord{
		{OrganizationID: principal.OrganizationID, Key: "runtime_topology", Name: "Runtime Topology", Category: "docker", Description: "Enable the topology experience and node detail panel.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "docker_compose_runtime", Name: "Docker Compose Runtime", Category: "docker", Description: "Allow multi-service compose deployment and YAML synthesis.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "docker_tree_view", Name: "Docker Tree View", Category: "docker", Description: "Enable grouped tree view on the containers page.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "custom_templates", Name: "Custom Templates", Category: "docker", Description: "Enable editable app templates and parameterized YAML helpers.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "integration_providers", Name: "Integration Providers", Category: "notifications", Description: "Enable provider adapters for Telegram, WhatsApp, GitHub and GitLab.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "notification_routing", Name: "Notification Routing Rules", Category: "notifications", Description: "Enable standalone routing rules for provider delivery and tag-aware alert fanout.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "notifications_inbox", Name: "Notifications Inbox", Category: "notifications", Description: "Enable persisted inbox management and user notification actions.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "native_integrations", Name: "Native Provider Adapters", Category: "notifications", Description: "Use Telegram, WhatsApp, GitHub Actions and GitLab CI/CD native connectors.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "edge_compute", Name: "Edge Compute", Category: "runtime", Description: "Enable edge sync and distributed runtime controls.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "tags_catalog", Name: "Tags Catalog", Category: "catalog", Description: "Enable managed tags across deploy, audit, routing, and filtering flows.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "applications_catalog", Name: "Applications Catalog", Category: "catalog", Description: "Enable persisted applications inventory and dashboard summaries.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "runtime_audit", Name: "Runtime Audit Trail", Category: "audit", Description: "Enable detailed runtime audit history with filters and tag metadata.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "license_management", Name: "License Management", Category: "settings", Description: "Allow operators to generate and maintain license keys and feature entitlements.", Enabled: true},
		{OrganizationID: principal.OrganizationID, Key: "dashboard_overview", Name: "Dashboard Overview", Category: "dashboard", Description: "Enable the richer administration and environment dashboard experience.", Enabled: true},
	}
	for index := range defaults {
		if err := s.db.WithContext(ctx).Create(&defaults[index]).Error; err != nil {
			return nil, err
		}
	}
	return defaults, nil
}

func (s *Service) BulkUpsertFeatureFlags(ctx context.Context, principal *Principal, req BulkUpsertFeatureFlagsRequest) ([]FeatureFlagRecord, error) {
	items := make([]FeatureFlagRecord, 0, len(req.Items))
	for _, input := range req.Items {
		key := strings.TrimSpace(input.Key)
		if key == "" {
			return nil, fmt.Errorf("feature flag key is required")
		}
		var item FeatureFlagRecord
		err := s.db.WithContext(ctx).
			Where("organization_id = ? AND key = ?", principal.OrganizationID, key).
			First(&item).Error
		if err != nil {
			item = FeatureFlagRecord{
				OrganizationID: principal.OrganizationID,
				Key:            key,
			}
		}
		item.Name = defaultString(input.Name, key)
		item.Category = defaultString(input.Category, "general")
		item.Description = strings.TrimSpace(input.Description)
		item.Enabled = input.Enabled
		item.Metadata = JSONObject(input.Metadata)
		if item.ID == "" {
			if err := s.db.WithContext(ctx).Create(&item).Error; err != nil {
				return nil, err
			}
		} else if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) GetLicense(ctx context.Context, principal *Principal) (*LicenseRecord, error) {
	var item LicenseRecord
	err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		First(&item).Error
	if err == nil {
		return &item, nil
	}
	item = LicenseRecord{
		OrganizationID: principal.OrganizationID,
		LicenseKey:     generateLicenseKey("free"),
		Tier:           "free",
		Status:         "active",
		Metadata: JSONObject{
			"max_users":        10,
			"max_environments": 3,
			"max_edge_nodes":   25,
			"support_plan":     "community",
			"features": []string{
				"runtime_topology",
				"docker_compose_runtime",
				"integration_providers",
				"notification_routing",
				"dashboard_overview",
			},
		},
	}
	if createErr := s.db.WithContext(ctx).Create(&item).Error; createErr != nil {
		return nil, createErr
	}
	return &item, nil
}

func (s *Service) UpsertLicense(ctx context.Context, principal *Principal, req UpsertLicenseRequest) (*LicenseRecord, error) {
	item, err := s.GetLicense(ctx, principal)
	if err != nil {
		return nil, err
	}
	item.LicenseKey = strings.TrimSpace(req.LicenseKey)
	item.Tier = defaultString(req.Tier, "free")
	item.Status = defaultString(req.Status, "active")
	item.ContactEmail = strings.TrimSpace(req.ContactEmail)
	item.Metadata = JSONObject(req.Metadata)
	if expiresAt := strings.TrimSpace(req.ExpiresAt); expiresAt != "" {
		parsed, parseErr := time.Parse(time.RFC3339, expiresAt)
		if parseErr != nil {
			return nil, fmt.Errorf("expires_at must be RFC3339")
		}
		item.ExpiresAt = &parsed
	} else {
		item.ExpiresAt = nil
	}
	if err := s.db.WithContext(ctx).Save(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) GenerateLicenseKey(ctx context.Context, principal *Principal, req GenerateLicenseKeyRequest) (*LicenseRecord, error) {
	item, err := s.GetLicense(ctx, principal)
	if err != nil {
		return nil, err
	}
	tier := defaultString(strings.TrimSpace(req.Tier), item.Tier)
	item.Tier = tier
	item.LicenseKey = generateLicenseKey(tier)
	if item.Metadata == nil {
		item.Metadata = JSONObject{}
	}
	if _, exists := item.Metadata["features"]; !exists {
		item.Metadata["features"] = []string{
			"runtime_topology",
			"docker_compose_runtime",
			"integration_providers",
			"notification_routing",
		}
	}
	if err := s.db.WithContext(ctx).Save(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) ListLicenseKeys(ctx context.Context, principal *Principal) ([]LicenseKeyRecord, error) {
	var items []LicenseKeyRecord
	if err := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("is_primary desc, created_at desc").
		Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) > 0 {
		return items, nil
	}
	license, err := s.GetLicense(ctx, principal)
	if err != nil {
		return nil, err
	}
	features := metadataStringSlice(license.Metadata, "features")
	seed := LicenseKeyRecord{
		OrganizationID: principal.OrganizationID,
		Name:           "Primary Workspace Key",
		LicenseKey:     license.LicenseKey,
		Tier:           license.Tier,
		Status:         "active",
		IsPrimary:      true,
		ExpiresAt:      license.ExpiresAt,
		Features:       features,
		Metadata:       license.Metadata,
	}
	if err := s.db.WithContext(ctx).Create(&seed).Error; err != nil {
		return nil, err
	}
	return []LicenseKeyRecord{seed}, nil
}

func (s *Service) CreateLicenseKey(ctx context.Context, principal *Principal, req UpsertLicenseKeyRequest) (*LicenseKeyRecord, error) {
	item := &LicenseKeyRecord{
		OrganizationID: principal.OrganizationID,
		Name:           defaultString(req.Name, "Generated License Key"),
		LicenseKey:     generateLicenseKey(defaultString(req.Tier, "free")),
		Tier:           defaultString(req.Tier, "free"),
		Status:         defaultString(req.Status, "draft"),
		IssuedTo:       strings.TrimSpace(req.IssuedTo),
		IsPrimary:      req.IsPrimary,
		Features:       sanitizeStringSlice(req.Features),
		Metadata:       JSONObject(req.Metadata),
	}
	if len(item.Features) == 0 {
		item.Features = metadataStringSlice(item.Metadata, "features")
	}
	if raw := strings.TrimSpace(req.ExpiresAt); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, fmt.Errorf("expires_at must be RFC3339")
		}
		item.ExpiresAt = &parsed
	}
	if item.IsPrimary {
		if err := s.clearPrimaryLicenseKeys(ctx, principal.OrganizationID); err != nil {
			return nil, err
		}
	}
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	if item.IsPrimary {
		_, _ = s.promoteLicenseFromKey(ctx, principal, item)
	}
	return item, nil
}

func (s *Service) UpdateLicenseKey(ctx context.Context, principal *Principal, id string, req UpsertLicenseKeyRequest) (*LicenseKeyRecord, error) {
	var item LicenseKeyRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		First(&item).Error; err != nil {
		return nil, err
	}
	item.Name = defaultString(req.Name, item.Name)
	item.Tier = defaultString(req.Tier, item.Tier)
	item.Status = defaultString(req.Status, item.Status)
	item.IssuedTo = strings.TrimSpace(req.IssuedTo)
	item.IsPrimary = req.IsPrimary
	if len(req.Features) > 0 {
		item.Features = sanitizeStringSlice(req.Features)
	}
	item.Metadata = mergeJSONObjects(item.Metadata, JSONObject(req.Metadata))
	if raw := strings.TrimSpace(req.ExpiresAt); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, fmt.Errorf("expires_at must be RFC3339")
		}
		item.ExpiresAt = &parsed
	} else if req.ExpiresAt == "" {
		item.ExpiresAt = nil
	}
	if item.IsPrimary {
		if err := s.clearPrimaryLicenseKeys(ctx, principal.OrganizationID); err != nil {
			return nil, err
		}
		item.IsPrimary = true
	}
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	if item.IsPrimary {
		_, _ = s.promoteLicenseFromKey(ctx, principal, &item)
	}
	return &item, nil
}

func (s *Service) DeleteLicenseKey(ctx context.Context, principal *Principal, id string) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		Delete(&LicenseKeyRecord{}).Error
}

func (s *Service) clearPrimaryLicenseKeys(ctx context.Context, organizationID string) error {
	return s.db.WithContext(ctx).
		Model(&LicenseKeyRecord{}).
		Where("organization_id = ?", organizationID).
		Update("is_primary", false).Error
}

func (s *Service) promoteLicenseFromKey(ctx context.Context, principal *Principal, key *LicenseKeyRecord) (*LicenseRecord, error) {
	if key == nil {
		return nil, fmt.Errorf("license key is required")
	}
	return s.UpsertLicense(ctx, principal, UpsertLicenseRequest{
		LicenseKey: key.LicenseKey,
		Tier:       key.Tier,
		Status:     key.Status,
		ExpiresAt:  formatRFC3339(key.ExpiresAt),
		Metadata: map[string]any{
			"features": key.Features,
			"source":   "license_keys_runtime",
		},
	})
}

func sanitizeStringSlice(values []string) []string {
	seen := map[string]struct{}{}
	items := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		items = append(items, value)
	}
	return items
}

func metadataStringSlice(metadata JSONObject, key string) StringSlice {
	if metadata == nil {
		return nil
	}
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return nil
	}
	switch value := raw.(type) {
	case []string:
		return sanitizeStringSlice(value)
	case []any:
		items := make([]string, 0, len(value))
		for _, item := range value {
			items = append(items, fmt.Sprint(item))
		}
		return sanitizeStringSlice(items)
	default:
		return nil
	}
}

func mergeJSONObjects(base, patch JSONObject) JSONObject {
	if base == nil {
		base = JSONObject{}
	}
	for key, value := range patch {
		base[key] = value
	}
	return base
}

func formatRFC3339(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func generateLicenseKey(tier string) string {
	buffer := make([]byte, 15)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("EINFRA-%s-%d", strings.ToUpper(defaultString(tier, "free")), time.Now().UTC().Unix())
	}
	encoded := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buffer)
	encoded = strings.ToUpper(encoded)
	chunks := []string{
		encoded[0:5],
		encoded[5:10],
		encoded[10:15],
		encoded[15:20],
		encoded[20:24],
	}
	return fmt.Sprintf("EINFRA-%s-%s", strings.ToUpper(defaultString(tier, "free")), strings.Join(chunks, "-"))
}

func (s *Service) GetUserSettings(ctx context.Context, principal *Principal) (*UserSettingRecord, error) {
	var item UserSettingRecord
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND organization_id = ?", principal.UserID, principal.OrganizationID).
		First(&item).Error
	if err == nil {
		return &item, nil
	}
	item = UserSettingRecord{
		UserID:         principal.UserID,
		OrganizationID: principal.OrganizationID,
		Payload: JSONObject{
			"theme":                 "system",
			"timezone":              "Asia/Saigon",
			"language":              "vi",
			"sidebar_collapsed":     false,
			"default_notifications": true,
		},
	}
	if createErr := s.db.WithContext(ctx).Create(&item).Error; createErr != nil {
		return nil, createErr
	}
	return &item, nil
}

func (s *Service) UpsertUserSettings(ctx context.Context, principal *Principal, req UpsertUserSettingsRequest) (*UserSettingRecord, error) {
	item, err := s.GetUserSettings(ctx, principal)
	if err != nil {
		return nil, err
	}
	item.Payload = JSONObject(req.Payload)
	if item.Payload == nil {
		item.Payload = JSONObject{}
	}
	if err := s.db.WithContext(ctx).Save(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}
