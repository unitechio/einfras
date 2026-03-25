//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/domain"
)

type AuditUsecase interface {
	Log(ctx context.Context, log *domain.AuditLog) error
	LogUserAction(ctx context.Context, userID, username string, action domain.AuditAction, resource, resourceID, description string) error
	LogSystemAction(ctx context.Context, action domain.AuditAction, resource, resourceID, description string) error
	GetAuditLog(ctx context.Context, id string) (*domain.AuditLog, error)
	ListAuditLogs(ctx context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetUserAuditLogs(ctx context.Context, userID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetResourceAuditLogs(ctx context.Context, resource, resourceID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error)
	GetAuditStatistics(ctx context.Context, startDate, endDate time.Time) (*domain.AuditStatistics, error)
	CleanupOldLogs(ctx context.Context, retentionDays int) error
	ExportAuditLogs(ctx context.Context, filter domain.AuditFilter, format string) (string, error)
}

type auditUsecase struct {
	auditRepo repository.AuditLogRepository
}

func NewAuditUsecase(auditRepo repository.AuditLogRepository) AuditUsecase {
	return &auditUsecase{
		auditRepo: auditRepo,
	}
}

func (u *auditUsecase) Log(ctx context.Context, log *domain.AuditLog) error {
	return u.auditRepo.Create(ctx, log)
}

func (u *auditUsecase) LogUserAction(ctx context.Context, userID, username string, action domain.AuditAction, resource, resourceID, description string) error {
	log := &domain.AuditLog{
		UserID:      &userID,
		Username:    username,
		Action:      action,
		Resource:    resource,
		ResourceID:  &resourceID,
		Description: description,
		CreatedAt:   time.Now(),
		Success:     true,
	}
	return u.auditRepo.Create(ctx, log)
}

func (u *auditUsecase) LogSystemAction(ctx context.Context, action domain.AuditAction, resource, resourceID, description string) error {
	log := &domain.AuditLog{
		Username:    "SYSTEM",
		Action:      action,
		Resource:    resource,
		ResourceID:  &resourceID,
		Description: description,
		CreatedAt:   time.Now(),
		Success:     true,
	}
	return u.auditRepo.Create(ctx, log)
}

func (u *auditUsecase) GetAuditLog(ctx context.Context, id string) (*domain.AuditLog, error) {
	return u.auditRepo.GetByID(ctx, id)
}

func (u *auditUsecase) ListAuditLogs(ctx context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	return u.auditRepo.List(ctx, filter)
}

func (u *auditUsecase) GetUserAuditLogs(ctx context.Context, userID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.UserID = &userID
	return u.auditRepo.List(ctx, filter)
}

func (u *auditUsecase) GetResourceAuditLogs(ctx context.Context, resource, resourceID string, filter domain.AuditFilter) ([]*domain.AuditLog, int64, error) {
	filter.Resource = resource
	filter.ResourceID = resourceID
	return u.auditRepo.List(ctx, filter)
}

func (u *auditUsecase) GetAuditStatistics(ctx context.Context, startDate, endDate time.Time) (*domain.AuditStatistics, error) {
	return u.auditRepo.GetStatistics(ctx, startDate, endDate)
}

func (u *auditUsecase) CleanupOldLogs(ctx context.Context, retentionDays int) error {
	return u.auditRepo.DeleteOlderThan(ctx, time.Duration(retentionDays)*24*time.Hour)
}

func (u *auditUsecase) ExportAuditLogs(ctx context.Context, filter domain.AuditFilter, format string) (string, error) {
	return "", fmt.Errorf("not implemented")
}
