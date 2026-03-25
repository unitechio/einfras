package iam

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal([]string(s))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (s *StringSlice) Scan(value any) error {
	if value == nil {
		*s = []string{}
		return nil
	}
	switch raw := value.(type) {
	case []byte:
		return json.Unmarshal(raw, s)
	case string:
		return json.Unmarshal([]byte(raw), s)
	default:
		return errors.New("unsupported StringSlice value")
	}
}

type JSONObject map[string]any

func (o JSONObject) Value() (driver.Value, error) {
	if o == nil {
		return "{}", nil
	}
	b, err := json.Marshal(map[string]any(o))
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (o *JSONObject) Scan(value any) error {
	if value == nil {
		*o = JSONObject{}
		return nil
	}
	switch raw := value.(type) {
	case []byte:
		return json.Unmarshal(raw, o)
	case string:
		return json.Unmarshal([]byte(raw), o)
	default:
		return errors.New("unsupported JSONObject value")
	}
}

type User struct {
	ID                string      `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	Username          string      `json:"username" gorm:"column:username;uniqueIndex;not null"`
	Email             string      `json:"email" gorm:"column:email;uniqueIndex;not null"`
	FullName          string      `json:"full_name" gorm:"column:full_name"`
	PasswordHash      string      `json:"-" gorm:"column:password_hash;not null"`
	IsActive          bool        `json:"is_active" gorm:"column:is_active;default:true"`
	EmailVerifiedAt   *time.Time  `json:"email_verified_at,omitempty" gorm:"column:email_verified_at"`
	PasswordChangedAt *time.Time  `json:"password_changed_at,omitempty" gorm:"column:password_changed_at"`
	TOTPEnabled       bool        `json:"totp_enabled" gorm:"column:totp_enabled;default:false"`
	TOTPSecret        string      `json:"-" gorm:"column:totp_secret"`
	RecoveryCodes     StringSlice `json:"-" gorm:"column:recovery_codes;type:jsonb"`
	CreatedAt         time.Time   `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt         time.Time   `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (User) TableName() string { return "users" }

func (u *User) BeforeCreate(_ *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	return nil
}

type Organization struct {
	ID        string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	Name      string    `json:"name" gorm:"column:name;not null"`
	Slug      string    `json:"slug" gorm:"column:slug;uniqueIndex;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (Organization) TableName() string { return "organizations" }

func (o *Organization) BeforeCreate(_ *gorm.DB) error {
	if o.ID == "" {
		o.ID = uuid.NewString()
	}
	return nil
}

type UserOrganization struct {
	ID             string      `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string      `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string      `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Status         string      `json:"status" gorm:"column:status;not null;default:'active'"`
	IsDefault      bool        `json:"is_default" gorm:"column:is_default;default:false"`
	Teams          StringSlice `json:"teams,omitempty" gorm:"column:teams;type:jsonb"`
	CreatedAt      time.Time   `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time   `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (UserOrganization) TableName() string { return "user_organizations" }

func (uo *UserOrganization) BeforeCreate(_ *gorm.DB) error {
	if uo.ID == "" {
		uo.ID = uuid.NewString()
	}
	return nil
}

type Role struct {
	ID             string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID *string   `json:"organization_id,omitempty" gorm:"column:organization_id;index"`
	Name           string    `json:"name" gorm:"column:name;not null"`
	Slug           string    `json:"slug" gorm:"column:slug;not null"`
	Description    string    `json:"description" gorm:"column:description"`
	IsSystem       bool      `json:"is_system" gorm:"column:is_system;default:false"`
	CreatedAt      time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (Role) TableName() string { return "roles" }

func (r *Role) BeforeCreate(_ *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	return nil
}

type Permission struct {
	ID          string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	Resource    string    `json:"resource" gorm:"column:resource;index;not null"`
	Action      string    `json:"action" gorm:"column:action;index;not null"`
	Description string    `json:"description" gorm:"column:description"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (Permission) TableName() string { return "permissions" }

func (p *Permission) BeforeCreate(_ *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	return nil
}

type RolePermission struct {
	ID           string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	RoleID       string    `json:"role_id" gorm:"column:role_id;index;not null"`
	PermissionID string    `json:"permission_id" gorm:"column:permission_id;index;not null"`
	CreatedAt    time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (RolePermission) TableName() string { return "role_permissions" }

func (rp *RolePermission) BeforeCreate(_ *gorm.DB) error {
	if rp.ID == "" {
		rp.ID = uuid.NewString()
	}
	return nil
}

type UserRole struct {
	ID             string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string    `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string    `json:"organization_id" gorm:"column:organization_id;index;not null"`
	RoleID         string    `json:"role_id" gorm:"column:role_id;index;not null"`
	CreatedAt      time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (UserRole) TableName() string { return "user_roles" }

func (ur *UserRole) BeforeCreate(_ *gorm.DB) error {
	if ur.ID == "" {
		ur.ID = uuid.NewString()
	}
	return nil
}

type ResourceScope struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Resource       string     `json:"resource" gorm:"column:resource;index;not null"`
	ResourceID     string     `json:"resource_id" gorm:"column:resource_id;index;not null"`
	Env            string     `json:"env" gorm:"column:env;index"`
	OwnerUserID    string     `json:"owner_user_id" gorm:"column:owner_user_id;index"`
	Attributes     JSONObject `json:"attributes" gorm:"column:attributes;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (ResourceScope) TableName() string { return "resource_scopes" }

func (rs *ResourceScope) BeforeCreate(_ *gorm.DB) error {
	if rs.ID == "" {
		rs.ID = uuid.NewString()
	}
	return nil
}

type UserPermission struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	PermissionID   string     `json:"permission_id" gorm:"column:permission_id;index;not null"`
	Effect         string     `json:"effect" gorm:"column:effect;not null"`
	ResourceID     string     `json:"resource_id" gorm:"column:resource_id;index"`
	Env            string     `json:"env" gorm:"column:env;index"`
	Conditions     JSONObject `json:"conditions" gorm:"column:conditions;type:jsonb"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty" gorm:"column:expires_at"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (UserPermission) TableName() string { return "user_permissions" }

func (up *UserPermission) BeforeCreate(_ *gorm.DB) error {
	if up.ID == "" {
		up.ID = uuid.NewString()
	}
	return nil
}

type RefreshToken struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	TokenHash      string     `json:"-" gorm:"column:token_hash;uniqueIndex;not null"`
	UserAgent      string     `json:"user_agent" gorm:"column:user_agent"`
	IPAddress      string     `json:"ip_address" gorm:"column:ip_address"`
	ExpiresAt      time.Time  `json:"expires_at" gorm:"column:expires_at;index"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty" gorm:"column:last_used_at"`
	RevokedAt      *time.Time `json:"revoked_at,omitempty" gorm:"column:revoked_at"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }

func (rt *RefreshToken) BeforeCreate(_ *gorm.DB) error {
	if rt.ID == "" {
		rt.ID = uuid.NewString()
	}
	return nil
}

type SessionPresenceRecord struct {
	ID             string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string    `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string    `json:"organization_id" gorm:"column:organization_id;index;not null"`
	SessionKey     string    `json:"session_key" gorm:"column:session_key;uniqueIndex;not null"`
	UserAgent      string    `json:"user_agent" gorm:"column:user_agent"`
	IPAddress      string    `json:"ip_address" gorm:"column:ip_address"`
	LastSeenAt     time.Time `json:"last_seen_at" gorm:"column:last_seen_at;index;not null"`
	ExpiresAt      time.Time `json:"expires_at" gorm:"column:expires_at;index;not null"`
	CreatedAt      time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (SessionPresenceRecord) TableName() string { return "session_presences" }

func (sp *SessionPresenceRecord) BeforeCreate(_ *gorm.DB) error {
	if sp.ID == "" {
		sp.ID = uuid.NewString()
	}
	return nil
}

type AuthActionToken struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index"`
	Kind           string     `json:"kind" gorm:"column:kind;index;not null"`
	TokenHash      string     `json:"-" gorm:"column:token_hash;uniqueIndex;not null"`
	Payload        JSONObject `json:"payload" gorm:"column:payload;type:jsonb"`
	ExpiresAt      time.Time  `json:"expires_at" gorm:"column:expires_at;index"`
	ConsumedAt     *time.Time `json:"consumed_at,omitempty" gorm:"column:consumed_at"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (AuthActionToken) TableName() string { return "auth_action_tokens" }

func (at *AuthActionToken) BeforeCreate(_ *gorm.DB) error {
	if at.ID == "" {
		at.ID = uuid.NewString()
	}
	return nil
}

type AuditLog struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;index"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index"`
	Action         string     `json:"action" gorm:"column:action;index;not null"`
	Resource       string     `json:"resource" gorm:"column:resource;index;not null"`
	ResourceID     string     `json:"resource_id" gorm:"column:resource_id;index"`
	Environment    string     `json:"environment" gorm:"column:environment;index"`
	Status         string     `json:"status" gorm:"column:status;index;not null"`
	IPAddress      string     `json:"ip_address" gorm:"column:ip_address"`
	UserAgent      string     `json:"user_agent" gorm:"column:user_agent"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"timestamp" gorm:"column:created_at;autoCreateTime"`
}

func (AuditLog) TableName() string { return "audit_logs" }

func (al *AuditLog) BeforeCreate(_ *gorm.DB) error {
	if al.ID == "" {
		al.ID = uuid.NewString()
	}
	return nil
}

type Team struct {
	ID             string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string    `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Name           string    `json:"name" gorm:"column:name;not null"`
	Slug           string    `json:"slug" gorm:"column:slug;not null"`
	Description    string    `json:"description" gorm:"column:description"`
	CreatedAt      time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (Team) TableName() string { return "teams" }

func (t *Team) BeforeCreate(_ *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	return nil
}

type TeamMember struct {
	ID        string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	TeamID    string    `json:"team_id" gorm:"column:team_id;index;not null"`
	UserID    string    `json:"user_id" gorm:"column:user_id;index;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (TeamMember) TableName() string { return "team_members" }

func (tm *TeamMember) BeforeCreate(_ *gorm.DB) error {
	if tm.ID == "" {
		tm.ID = uuid.NewString()
	}
	return nil
}

type Principal struct {
	UserID         string    `json:"user_id"`
	OrganizationID string    `json:"organization_id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	Roles          []string  `json:"roles"`
	Permissions    []string  `json:"permissions"`
	Teams          []string  `json:"teams"`
	ExpiresAt      time.Time `json:"expires_at"`
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type LoginResponse struct {
	TokenPair
	User          *User          `json:"user,omitempty"`
	Organizations []Organization `json:"organizations,omitempty"`
	Principal     *Principal     `json:"principal,omitempty"`
	RequiresMFA   bool           `json:"requires_mfa"`
	MFAToken      string         `json:"mfa_token,omitempty"`
}
