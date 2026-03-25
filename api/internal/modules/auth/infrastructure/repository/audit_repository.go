//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type AuditLogRepository interface {
	Create(ctx context.Context, log *domain.AuditLog) error
	GetByID(ctx context.Context, id string) (*domain.AuditLog, error)
	List(ctx context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetByUserID(ctx context.Context, userID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetByResource(ctx context.Context, resource, resourceID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetByAction(ctx context.Context, action domain.AuditAction, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetByDateRange(ctx context.Context, startDate, endDate time.Time, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	DeleteOlderThan(ctx context.Context, duration time.Duration) error
	GetStatistics(ctx context.Context, startDate, endDate time.Time) (*domain.AuditStatistics, error)
}

type auditLogRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(ctx context.Context, log *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *auditLogRepository) GetByID(ctx context.Context, id string) (*domain.AuditLog, error) {
	var log domain.AuditLog
	err := r.db.WithContext(ctx).First(&log, "id = ?", id).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("audit log not found")
		}
		return nil, err
	}

	return &log, nil
}

func (r *auditLogRepository) List(ctx context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	var logs []*domain.AuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.AuditLog{})

	query = r.applyFilters(query, filter)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortBy := "created_at"
	if filter.SortBy != "" {
		sortBy = filter.SortBy
	}
	sortOrder := "DESC"
	if filter.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize)

	if err := query.Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

func (r *auditLogRepository) GetByUserID(ctx context.Context, userID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.UserID = &userID
	return r.List(ctx, filter)
}

func (r *auditLogRepository) GetByResource(ctx context.Context, resource, resourceID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.Resource = resource
	filter.ResourceID = resourceID
	return r.List(ctx, filter)
}

func (r *auditLogRepository) GetByAction(ctx context.Context, action domain.AuditAction, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.Action = &action
	return r.List(ctx, filter)
}

func (r *auditLogRepository) GetByDateRange(ctx context.Context, startDate, endDate time.Time, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.StartDate = &startDate
	filter.EndDate = &endDate
	return r.List(ctx, filter)
}

func (r *auditLogRepository) DeleteOlderThan(ctx context.Context, duration time.Duration) error {
	cutoff := time.Now().Add(-duration)
	return r.db.WithContext(ctx).
		Where("created_at < ?", cutoff).
		Delete(&domain.AuditLog{}).Error
}

func (r *auditLogRepository) GetStatistics(ctx context.Context, startDate, endDate time.Time) (*domain.AuditStatistics, error) {
	stats := &domain.AuditStatistics{
		ActionBreakdown:   make(map[domain.AuditAction]int64),
		ResourceBreakdown: make(map[string]int64),
	}

	r.db.WithContext(ctx).
		Model(&domain.AuditLog{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Count(&stats.TotalLogs)

	r.db.WithContext(ctx).
		Model(&domain.AuditLog{}).
		Where("created_at BETWEEN ? AND ? AND success = true", startDate, endDate).
		Count(&stats.SuccessfulActions)

	stats.FailedActions = stats.TotalLogs - stats.SuccessfulActions

	r.db.WithContext(ctx).
		Model(&domain.AuditLog{}).
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Distinct("user_id").
		Count(&stats.UniqueUsers)

	var actionStats []struct {
		Action domain.AuditAction
		Count  int64
	}
	r.db.WithContext(ctx).
		Model(&domain.AuditLog{}).
		Select("action, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Group("action").
		Scan(&actionStats)

	for _, stat := range actionStats {
		stats.ActionBreakdown[stat.Action] = stat.Count
	}

	var resourceStats []struct {
		Resource string
		Count    int64
	}
	r.db.WithContext(ctx).
		Model(&domain.AuditLog{}).
		Select("resource, COUNT(*) as count").
		Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Group("resource").
		Scan(&resourceStats)

	for _, stat := range resourceStats {
		stats.ResourceBreakdown[stat.Resource] = stat.Count
	}

	return stats, nil
}

func (r *auditLogRepository) applyFilters(query *gorm.DB, filter domain.AuditFilter) *gorm.DB {
	if filter.UserID != nil {
		query = query.Where("user_id = ?", *filter.UserID)
	}

	if filter.Username != "" {
		query = query.Where("username ILIKE ?", "%"+filter.Username+"%")
	}

	if filter.Action != nil {
		query = query.Where("action = ?", *filter.Action)
	}

	if filter.Resource != "" {
		query = query.Where("resource = ?", filter.Resource)
	}

	if filter.ResourceID != "" {
		query = query.Where("resource_id = ?", filter.ResourceID)
	}

	if filter.IPAddress != "" {
		query = query.Where("ip_address = ?", filter.IPAddress)
	}

	if filter.Success != nil {
		query = query.Where("success = ?", *filter.Success)
	}

	if filter.StartDate != nil {
		query = query.Where("created_at >= ?", *filter.StartDate)
	}

	if filter.EndDate != nil {
		query = query.Where("created_at <= ?", *filter.EndDate)
	}

	return query
}
