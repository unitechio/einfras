//go:build legacy
// +build legacy

// Package orgstore — audit_repo.go
// GORM-backed AuditWriter for the middleware.AuditWriter interface.
package orgstore

import (
	"context"

	"gorm.io/gorm"

	"einfra/api/internal/domain"
)

type auditRepo struct {
	db *gorm.DB
}

// NewAuditWriter creates an audit log writer backed by PostgreSQL.
func NewAuditWriter(db *gorm.DB) *auditRepo {
	return &auditRepo{db: db}
}

// Write persists an AuditLog entry. Called in goroutine — must not panic.
func (r *auditRepo) Write(ctx context.Context, entry *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(entry).Error
}
