package iam

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TagRecord struct {
	ID             string     `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string     `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Name           string     `json:"name" gorm:"column:name;index;not null"`
	Type           string     `json:"type" gorm:"column:type;index;not null"`
	Color          string     `json:"color" gorm:"column:color;not null"`
	Count          int        `json:"count" gorm:"column:count;default:0"`
	Description    string     `json:"description" gorm:"column:description;type:text"`
	Metadata       JSONObject `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time  `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (TagRecord) TableName() string { return "tags_runtime" }

func (t *TagRecord) BeforeCreate(_ *gorm.DB) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	return nil
}

type ApplicationRecord struct {
	ID             string      `json:"id" gorm:"column:id;primaryKey;type:uuid"`
	OrganizationID string      `json:"organization_id" gorm:"column:organization_id;index;not null"`
	Name           string      `json:"name" gorm:"column:name;index;not null"`
	Platform       string      `json:"platform" gorm:"column:platform;index;not null"`
	Environment    string      `json:"environment" gorm:"column:environment;index;not null"`
	Status         string      `json:"status" gorm:"column:status;index;not null"`
	Uptime         string      `json:"uptime" gorm:"column:uptime"`
	Services       int         `json:"services" gorm:"column:services;default:0"`
	Instances      int         `json:"instances" gorm:"column:instances;default:0"`
	CPU            string      `json:"cpu" gorm:"column:cpu"`
	RAM            string      `json:"ram" gorm:"column:ram"`
	LastDeployAt   *time.Time  `json:"last_deploy_at,omitempty" gorm:"column:last_deploy_at"`
	PublicURL      string      `json:"public_url" gorm:"column:public_url"`
	Tags           StringSlice `json:"tags" gorm:"column:tags;type:jsonb"`
	CPUPct         int         `json:"cpu_pct" gorm:"column:cpu_pct;default:0"`
	Metadata       JSONObject  `json:"metadata" gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time   `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt      time.Time   `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

func (ApplicationRecord) TableName() string { return "applications_runtime" }

func (a *ApplicationRecord) BeforeCreate(_ *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	return nil
}
