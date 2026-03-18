// Package orgstore implements domain.OrganizationRepository using GORM + PostgreSQL.
package orgstore

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"einfra/api/internal/domain"
)

type orgRepo struct {
	db *gorm.DB
}

// New creates a new GORM-backed OrganizationRepository.
func New(db *gorm.DB) domain.OrganizationRepository {
	return &orgRepo{db: db}
}

// ─── Organization CRUD ────────────────────────────────────────────────────────

func (r *orgRepo) Create(ctx context.Context, org *domain.Organization) error {
	return r.db.WithContext(ctx).Create(org).Error
}

func (r *orgRepo) FindByID(ctx context.Context, id string) (*domain.Organization, error) {
	var org domain.Organization
	if err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&org).Error; err != nil {
		return nil, fmt.Errorf("org %q: %w", id, err)
	}
	return &org, nil
}

func (r *orgRepo) FindBySlug(ctx context.Context, slug string) (*domain.Organization, error) {
	var org domain.Organization
	if err := r.db.WithContext(ctx).
		Where("slug = ? AND deleted_at IS NULL", slug).
		First(&org).Error; err != nil {
		return nil, fmt.Errorf("org slug %q: %w", slug, err)
	}
	return &org, nil
}

func (r *orgRepo) List(ctx context.Context, page, pageSize int) ([]*domain.Organization, int64, error) {
	var orgs []*domain.Organization
	var total int64

	q := r.db.WithContext(ctx).Model(&domain.Organization{}).Where("deleted_at IS NULL")
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := q.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&orgs).Error; err != nil {
		return nil, 0, err
	}
	return orgs, total, nil
}

func (r *orgRepo) Update(ctx context.Context, org *domain.Organization) error {
	return r.db.WithContext(ctx).Save(org).Error
}

func (r *orgRepo) Delete(ctx context.Context, id string) error {
	// Soft-delete: set deleted_at
	return r.db.WithContext(ctx).
		Model(&domain.Organization{}).
		Where("id = ?", id).
		Update("deleted_at", "NOW()").Error
}

// ─── Member management ────────────────────────────────────────────────────────

func (r *orgRepo) AddMember(ctx context.Context, member *domain.OrgMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *orgRepo) GetMember(ctx context.Context, orgID, userID string) (*domain.OrgMember, error) {
	var m domain.OrgMember
	if err := r.db.WithContext(ctx).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		First(&m).Error; err != nil {
		return nil, fmt.Errorf("member not found: %w", err)
	}
	return &m, nil
}

func (r *orgRepo) ListMembers(ctx context.Context, orgID string) ([]*domain.OrgMember, error) {
	var members []*domain.OrgMember
	if err := r.db.WithContext(ctx).
		Where("org_id = ?", orgID).
		Preload("User").
		Order("joined_at ASC").
		Find(&members).Error; err != nil {
		return nil, err
	}
	return members, nil
}

func (r *orgRepo) UpdateMemberRole(ctx context.Context, orgID, userID string, role domain.OrgMemberRole) error {
	return r.db.WithContext(ctx).
		Model(&domain.OrgMember{}).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		Update("role", role).Error
}

func (r *orgRepo) RemoveMember(ctx context.Context, orgID, userID string) error {
	return r.db.WithContext(ctx).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		Delete(&domain.OrgMember{}).Error
}
