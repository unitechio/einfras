package iam

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SystemSettingRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;uniqueIndex:uq_system_settings_runtime_org_key,priority:1;not null"`
	Key            string     `json:"key" gorm:"column:key;uniqueIndex:uq_system_settings_runtime_org_key,priority:2;not null"`
	Category       string     `json:"category" gorm:"column:category;index:idx_system_settings_runtime_category;not null"`
	Value          string     `json:"value" gorm:"column:value;type:text"`
	Description    string     `json:"description" gorm:"column:description;type:text"`
	Sensitive      bool       `json:"sensitive" gorm:"column:sensitive;default:false"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (SystemSettingRecord) TableName() string { return "system_settings_runtime" }

func (s *SystemSettingRecord) BeforeCreate(_ *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	return nil
}

type FeatureFlagRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;uniqueIndex:uq_feature_flags_runtime_org_key,priority:1;not null"`
	Key            string     `json:"key" gorm:"column:key;uniqueIndex:uq_feature_flags_runtime_org_key,priority:2;not null"`
	Name           string     `json:"name" gorm:"column:name;not null"`
	Category       string     `json:"category" gorm:"column:category;index:idx_feature_flags_runtime_category"`
	Description    string     `json:"description" gorm:"column:description;type:text"`
	Enabled        bool       `json:"enabled" gorm:"column:enabled;default:false"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (FeatureFlagRecord) TableName() string { return "feature_flags_runtime" }

func (f *FeatureFlagRecord) BeforeCreate(_ *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.NewString()
	}
	return nil
}

type LicenseRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;not null"`
	LicenseKey     string     `json:"license_key" gorm:"column:license_key"`
	Tier           string     `json:"tier" gorm:"column:tier;default:'free'"`
	Status         string     `json:"status" gorm:"column:status;default:'active'"`
	ContactEmail   string     `json:"contact_email" gorm:"column:contact_email"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty" gorm:"column:expires_at"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (LicenseRecord) TableName() string { return "licenses_runtime" }

func (l *LicenseRecord) BeforeCreate(_ *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.NewString()
	}
	return nil
}

type UserSettingRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;uniqueIndex:uq_user_settings_runtime_user_org,priority:1;not null"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;uniqueIndex:uq_user_settings_runtime_user_org,priority:2;not null"`
	Payload        JSONObject `json:"payload" gorm:"column:payload;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (UserSettingRecord) TableName() string { return "user_settings_runtime" }

func (u *UserSettingRecord) BeforeCreate(_ *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	return nil
}

type LicenseKeyRecord struct {
	ID             string      `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string      `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Name           string      `json:"name" gorm:"column:name;not null"`
	LicenseKey     string      `json:"license_key" gorm:"column:license_key;uniqueIndex;not null"`
	Tier           string      `json:"tier" gorm:"column:tier;default:'free'"`
	Status         string      `json:"status" gorm:"column:status;default:'draft'"`
	IsPrimary      bool        `json:"is_primary" gorm:"column:is_primary;default:false"`
	IssuedTo       string      `json:"issued_to" gorm:"column:issued_to"`
	ExpiresAt      *time.Time  `json:"expires_at,omitempty" gorm:"column:expires_at"`
	ActivatedAt    *time.Time  `json:"activated_at,omitempty" gorm:"column:activated_at"`
	RevokedAt      *time.Time  `json:"revoked_at,omitempty" gorm:"column:revoked_at"`
	Features       StringSlice `json:"features" gorm:"column:features;type:jsonb"`
	Metadata       JSONObject  `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time   `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time   `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (LicenseKeyRecord) TableName() string { return "license_keys_runtime" }

func (l *LicenseKeyRecord) BeforeCreate(_ *gorm.DB) error {
	if l.ID == "" {
		l.ID = uuid.NewString()
	}
	return nil
}
