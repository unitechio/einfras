package iam

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID         string     `json:"user_id" gorm:"column:user_id;index;not null"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Title          string     `json:"title" gorm:"column:title;not null"`
	Description    string     `json:"description" gorm:"column:description;type:text"`
	Type           string     `json:"type" gorm:"column:type;index;not null"`
	Channel        string     `json:"channel" gorm:"column:channel;index;not null"`
	Priority       string     `json:"priority" gorm:"column:priority;index;not null"`
	Status         string     `json:"status" gorm:"column:status;index;not null;default:'open'"`
	Read           bool       `json:"read" gorm:"column:is_read;index;default:false"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (NotificationRecord) TableName() string { return "notifications" }

func (n *NotificationRecord) BeforeCreate(_ *gorm.DB) error {
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	return nil
}

type NotificationPreferenceRecord struct {
	ID               string    `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	UserID           string    `json:"user_id" gorm:"column:user_id;uniqueIndex;not null"`
	OrganizationID   string    `json:"organization_id" gorm:"column:organization_id;index;not null"`
	InAppEnabled     bool      `json:"in_app_enabled" gorm:"column:in_app_enabled;default:true"`
	EmailEnabled     bool      `json:"email_enabled" gorm:"column:email_enabled;default:true"`
	TelegramEnabled  bool      `json:"telegram_enabled" gorm:"column:telegram_enabled;default:false"`
	WhatsAppEnabled  bool      `json:"whatsapp_enabled" gorm:"column:whatsapp_enabled;default:false"`
	OnlyHighPriority bool      `json:"only_high_priority" gorm:"column:only_high_priority;default:false"`
	Digest           string    `json:"digest" gorm:"column:digest;default:'realtime'"`
	CreatedAt        time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt        time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (NotificationPreferenceRecord) TableName() string { return "notification_preferences" }

func (n *NotificationPreferenceRecord) BeforeCreate(_ *gorm.DB) error {
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	return nil
}

type IntegrationPluginRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Kind           string     `json:"kind" gorm:"column:kind;index;not null"`
	Name           string     `json:"name" gorm:"column:name;not null"`
	Enabled        bool       `json:"enabled" gorm:"column:enabled;default:false"`
	Status         string     `json:"status" gorm:"column:status;default:'Not configured'"`
	Endpoint       string     `json:"endpoint" gorm:"column:endpoint"`
	Secret         string     `json:"secret" gorm:"column:secret"`
	Events         string     `json:"events" gorm:"column:events"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (IntegrationPluginRecord) TableName() string { return "integration_plugins" }

func (i *IntegrationPluginRecord) BeforeCreate(_ *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.NewString()
	}
	return nil
}

type NotificationRoutingRuleRecord struct {
	ID              string      `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID  string      `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Name            string      `json:"name" gorm:"column:name;not null"`
	Description     string      `json:"description" gorm:"column:description;type:text"`
	Enabled         bool        `json:"enabled" gorm:"column:enabled;default:true"`
	IntegrationKind string      `json:"integration_kind" gorm:"column:integration_kind;index;not null"`
	EventTypes      StringSlice `json:"event_types" gorm:"column:event_types;type:jsonb"`
	Priorities      StringSlice `json:"priorities" gorm:"column:priorities;type:jsonb"`
	Channels        StringSlice `json:"channels" gorm:"column:channels;type:jsonb"`
	Statuses        StringSlice `json:"statuses" gorm:"column:statuses;type:jsonb"`
	Tags            StringSlice `json:"tags" gorm:"column:tags;type:jsonb"`
	TagPrefixes     StringSlice `json:"tag_prefixes" gorm:"column:tag_prefixes;type:jsonb"`
	Metadata        JSONObject  `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt       time.Time   `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt       time.Time   `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (NotificationRoutingRuleRecord) TableName() string { return "notification_routing_rules" }

func (n *NotificationRoutingRuleRecord) BeforeCreate(_ *gorm.DB) error {
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	return nil
}
