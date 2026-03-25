package serverpostgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, server *domain.Server) error {
	return r.db.WithContext(ctx).Create(server).Error
}

func (r *Repository) GetByID(ctx context.Context, id string) (*domain.Server, error) {
	var server domain.Server
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&server).Error; err != nil {
		return nil, fmt.Errorf("server %q not found: %w", id, err)
	}
	return &server, nil
}

func (r *Repository) GetByIPAddress(ctx context.Context, ip string) (*domain.Server, error) {
	var server domain.Server
	if err := r.db.WithContext(ctx).Where("ip_address = ?", ip).First(&server).Error; err != nil {
		return nil, fmt.Errorf("server with ip %q not found: %w", ip, err)
	}
	return &server, nil
}

func (r *Repository) List(ctx context.Context, filter domain.ServerFilter) ([]*domain.Server, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.Server{})
	if filter.TenantID != "" {
		query = query.Where("tenant_id = ?", filter.TenantID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.OS != "" {
		query = query.Where("os = ?", filter.OS)
	}
	if filter.Location != "" {
		query = query.Where("location = ?", filter.Location)
	}
	if filter.Provider != "" {
		query = query.Where("provider = ?", filter.Provider)
	}
	if filter.Search != "" {
		needle := "%" + filter.Search + "%"
		query = query.Where("name ILIKE ? OR hostname ILIKE ? OR ip_address ILIKE ? OR description ILIKE ?", needle, needle, needle, needle)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	var servers []*domain.Server
	if err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&servers).Error; err != nil {
		return nil, 0, err
	}
	return servers, total, nil
}

func (r *Repository) Update(ctx context.Context, server *domain.Server) error {
	return r.db.WithContext(ctx).Model(&domain.Server{}).Where("id = ?", server.ID).Updates(server).Error
}

func (r *Repository) UpdateStatus(ctx context.Context, id string, status domain.ServerStatus) error {
	return r.db.WithContext(ctx).Model(&domain.Server{}).Where("id = ?", id).Updates(map[string]any{
		"status": status,
	}).Error
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Server{}, "id = ?", id).Error
}
