package iam

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type UpsertTagRequest struct {
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	Color       string         `json:"color"`
	Count       int            `json:"count"`
	Description string         `json:"description"`
	Metadata    map[string]any `json:"metadata"`
}

type UpsertApplicationRequest struct {
	Name        string         `json:"name"`
	Platform    string         `json:"platform"`
	Environment string         `json:"environment"`
	Status      string         `json:"status"`
	Uptime      string         `json:"uptime"`
	Services    int            `json:"services"`
	Instances   int            `json:"instances"`
	CPU         string         `json:"cpu"`
	RAM         string         `json:"ram"`
	LastDeploy  string         `json:"last_deploy"`
	PublicURL   string         `json:"public_url"`
	Tags        []string       `json:"tags"`
	CPUPct      int            `json:"cpu_pct"`
	Metadata    map[string]any `json:"metadata"`
}

func (s *Service) ListTags(ctx context.Context, principal *Principal, search string) ([]TagRecord, error) {
	if err := s.ensureCatalogSeed(ctx, principal.OrganizationID); err != nil {
		return nil, err
	}
	var items []TagRecord
	query := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("name asc")
	if search = strings.TrimSpace(search); search != "" {
		query = query.Where("name ILIKE ? OR type ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) CreateTag(ctx context.Context, principal *Principal, req UpsertTagRequest) (*TagRecord, error) {
	item := &TagRecord{
		OrganizationID: principal.OrganizationID,
		Name:           strings.TrimSpace(req.Name),
		Type:           defaultString(req.Type, "General"),
		Color:          defaultString(req.Color, "indigo"),
		Count:          req.Count,
		Description:    strings.TrimSpace(req.Description),
		Metadata:       JSONObject(req.Metadata),
	}
	if item.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) UpdateTag(ctx context.Context, principal *Principal, id string, req UpsertTagRequest) (*TagRecord, error) {
	var item TagRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		First(&item).Error; err != nil {
		return nil, err
	}
	item.Name = defaultString(req.Name, item.Name)
	item.Type = defaultString(req.Type, item.Type)
	item.Color = defaultString(req.Color, item.Color)
	item.Count = req.Count
	item.Description = strings.TrimSpace(req.Description)
	item.Metadata = JSONObject(req.Metadata)
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) DeleteTag(ctx context.Context, principal *Principal, id string) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		Delete(&TagRecord{}).Error
}

func (s *Service) ListApplications(ctx context.Context, principal *Principal, search, status string) ([]ApplicationRecord, error) {
	if err := s.ensureCatalogSeed(ctx, principal.OrganizationID); err != nil {
		return nil, err
	}
	var items []ApplicationRecord
	query := s.db.WithContext(ctx).
		Where("organization_id = ?", principal.OrganizationID).
		Order("name asc")
	if search = strings.TrimSpace(search); search != "" {
		query = query.Where("name ILIKE ? OR platform ILIKE ? OR environment ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	if status = strings.TrimSpace(status); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) CreateApplication(ctx context.Context, principal *Principal, req UpsertApplicationRequest) (*ApplicationRecord, error) {
	item, err := applicationFromRequest(principal.OrganizationID, req)
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) UpdateApplication(ctx context.Context, principal *Principal, id string, req UpsertApplicationRequest) (*ApplicationRecord, error) {
	var item ApplicationRecord
	if err := s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		First(&item).Error; err != nil {
		return nil, err
	}
	updated, err := applicationFromRequest(principal.OrganizationID, req)
	if err != nil {
		return nil, err
	}
	item.Name = updated.Name
	item.Platform = updated.Platform
	item.Environment = updated.Environment
	item.Status = updated.Status
	item.Uptime = updated.Uptime
	item.Services = updated.Services
	item.Instances = updated.Instances
	item.CPU = updated.CPU
	item.RAM = updated.RAM
	item.LastDeployAt = updated.LastDeployAt
	item.PublicURL = updated.PublicURL
	item.Tags = updated.Tags
	item.CPUPct = updated.CPUPct
	item.Metadata = updated.Metadata
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) DeleteApplication(ctx context.Context, principal *Principal, id string) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND organization_id = ?", id, principal.OrganizationID).
		Delete(&ApplicationRecord{}).Error
}

func applicationFromRequest(orgID string, req UpsertApplicationRequest) (*ApplicationRecord, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	var lastDeployAt *time.Time
	if raw := strings.TrimSpace(req.LastDeploy); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			lastDeployAt = &parsed
		}
	}
	return &ApplicationRecord{
		OrganizationID: orgID,
		Name:           name,
		Platform:       defaultString(req.Platform, "Docker"),
		Environment:    defaultString(req.Environment, "Production"),
		Status:         defaultString(req.Status, "Healthy"),
		Uptime:         defaultString(req.Uptime, "99.9%"),
		Services:       req.Services,
		Instances:      req.Instances,
		CPU:            req.CPU,
		RAM:            req.RAM,
		LastDeployAt:   lastDeployAt,
		PublicURL:      strings.TrimSpace(req.PublicURL),
		Tags:           req.Tags,
		CPUPct:         req.CPUPct,
		Metadata:       JSONObject(req.Metadata),
	}, nil
}

func (s *Service) ensureCatalogSeed(ctx context.Context, organizationID string) error {
	var appCount int64
	if err := s.db.WithContext(ctx).Model(&ApplicationRecord{}).Where("organization_id = ?", organizationID).Count(&appCount).Error; err != nil {
		return err
	}
	if appCount > 0 {
		return nil
	}
	now := time.Now().UTC()
	lastDeploy1 := now.Add(-2 * time.Hour)
	lastDeploy2 := now.Add(-24 * time.Hour)
	lastDeploy3 := now.Add(-5 * 24 * time.Hour)
	tags := []TagRecord{
		{OrganizationID: organizationID, Name: "production", Count: 12, Color: "emerald", Type: "Environment"},
		{OrganizationID: organizationID, Name: "frontend", Count: 8, Color: "blue", Type: "Layer"},
		{OrganizationID: organizationID, Name: "database", Count: 5, Color: "amber", Type: "Stack"},
		{OrganizationID: organizationID, Name: "core", Count: 14, Color: "indigo", Type: "Criticality"},
	}
	apps := []ApplicationRecord{
		{OrganizationID: organizationID, Name: "EINFRA Dashboard", Platform: "Kubernetes", Environment: "Production", Status: "Healthy", Uptime: "99.9%", Services: 12, Instances: 24, CPU: "1.2 Core", RAM: "2.4 GB", LastDeployAt: &lastDeploy1, Tags: StringSlice{"frontend", "core"}, PublicURL: "https://app.einfra.io", CPUPct: 22},
		{OrganizationID: organizationID, Name: "Auth Service", Platform: "Docker", Environment: "Staging", Status: "Healthy", Uptime: "98.5%", Services: 4, Instances: 6, CPU: "0.5 Core", RAM: "1.1 GB", LastDeployAt: &lastDeploy2, Tags: StringSlice{"backend", "auth"}, PublicURL: "https://auth-stg.einfra.io", CPUPct: 15},
		{OrganizationID: organizationID, Name: "PostgreSQL Cluster", Platform: "Kubernetes", Environment: "Production", Status: "Degraded", Uptime: "94.2%", Services: 3, Instances: 3, CPU: "4.0 Core", RAM: "16.0 GB", LastDeployAt: &lastDeploy3, Tags: StringSlice{"database", "critical"}, CPUPct: 85},
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for index := range tags {
			if err := tx.Create(&tags[index]).Error; err != nil {
				return err
			}
		}
		for index := range apps {
			if err := tx.Create(&apps[index]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
