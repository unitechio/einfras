//go:build legacy
// +build legacy

package repository

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/google/uuid"
	"einfra/api/internal/domain"
	dto "einfra/api/internal/dto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DocumentRepository interface {
	CreateDocument(ctx context.Context, document *domain.Document) error
	UpdateDocument(ctx context.Context, document *domain.Document) error
	DeleteDocumentByID(ctx context.Context, id uint) error
	GetDocumentByID(ctx context.Context, id uint) (*domain.Document, error)
	GetDocumentByCode(ctx context.Context, code string) (*domain.Document, error)
	GetDocumentByPath(ctx context.Context, path string) (*domain.Document, error)
	GetDocuments(ctx context.Context, filter dto.DocumentFilter) ([]domain.Document, int, int, error)
	GetDocumentsByEntityID(ctx context.Context, entityType string, entityID uint) ([]domain.Document, error)

	// Permission related methods
	CreateDocumentPermission(ctx context.Context, permission *domain.DocumentPermission) error
	UpdateDocumentPermission(ctx context.Context, permission *domain.DocumentPermission) error
	DeleteDocumentPermission(ctx context.Context, id uint) error
	GetDocumentPermissions(ctx context.Context, documentID uint) ([]domain.DocumentPermission, error)
	GetUserDocumentPermission(ctx context.Context, documentID uint, userID uuid.UUID) (*domain.DocumentPermission, error)
	CheckUserPermission(ctx context.Context, documentID uint, userID uuid.UUID, requiredLevel string) (bool, error)

	// Comment related methods
	CreateDocumentComment(ctx context.Context, comment *domain.DocumentComment) error
	UpdateDocumentComment(ctx context.Context, comment *domain.DocumentComment) error
	DeleteDocumentComment(ctx context.Context, id uint) error
	GetDocumentComments(ctx context.Context, documentID uint) ([]domain.DocumentComment, error)

	// Version related methods
	CreateDocumentVersion(ctx context.Context, version *domain.DocumentVersion) error
	GetDocumentVersions(ctx context.Context, documentID uint) ([]domain.DocumentVersion, error)
}

type documentRepository struct {
	db *gorm.DB
}

func NewDocumentRepository(db *gorm.DB) DocumentRepository {
	return &documentRepository{
		db: db,
	}
}

// Document CRUD methods
func (r *documentRepository) CreateDocument(ctx context.Context, document *domain.Document) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}
	return r.db.WithContext(ctx).Create(document).Error
}

func (r *documentRepository) UpdateDocument(ctx context.Context, document *domain.Document) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}
	return r.db.WithContext(ctx).Save(document).Error
}

func (r *documentRepository) DeleteDocumentByID(ctx context.Context, id uint) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}
	// Soft delete
	return r.db.WithContext(ctx).Delete(&domain.Document{}, id).Error
}

func (r *documentRepository) GetDocumentByID(ctx context.Context, id uint) (*domain.Document, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var document domain.Document
	err := r.db.WithContext(ctx).
		Preload("Uploader").
		Preload("DocumentPermissions").
		Preload("DocumentPermissions.User").
		Preload("DocumentPermissions.Role").
		First(&document, id).Error

	if err != nil {
		return nil, err
	}

	return &document, nil
}

func (r *documentRepository) GetDocumentByCode(ctx context.Context, code string) (*domain.Document, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var document domain.Document
	err := r.db.WithContext(ctx).
		Preload("Uploader").
		Preload("DocumentPermissions").
		Preload("DocumentPermissions.User").
		Preload("DocumentPermissions.Role").
		Where("document_code = ?", code).
		First(&document).Error

	if err != nil {
		return nil, err
	}

	return &document, nil
}

func (r *documentRepository) GetDocumentByPath(ctx context.Context, path string) (*domain.Document, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var document domain.Document
	err := r.db.WithContext(ctx).
		Preload("Uploader").
		Where("document_path = ?", path).
		First(&document).Error

	if err != nil {
		return nil, err
	}

	return &document, nil
}

func (r *documentRepository) GetDocuments(ctx context.Context, filter dto.DocumentFilter) ([]domain.Document, int, int, error) {
	if r.db == nil {
		return nil, 0, 0, errors.New("database connection is nil")
	}

	var documents []domain.Document
	var totalCount int64

	// Build query with filters
	query := r.db.WithContext(ctx).Model(&domain.Document{})

	// Apply filters
	if filter.SearchTerm != "" {
		searchTerm := "%" + filter.SearchTerm + "%"
		query = query.Where(
			"document_code LIKE ? OR document_name LIKE ?",
			searchTerm, searchTerm,
		)
	}

	if filter.EntityType != "" {
		query = query.Where("entity_type = ?", filter.EntityType)
	}

	if filter.EntityID != nil {
		query = query.Where("entity_id = ?", *filter.EntityID)
	}

	if filter.DocumentType != "" {
		query = query.Where("document_type = ?", filter.DocumentType)
	}

	if filter.UploadedBy != nil {
		query = query.Where("uploaded_by = ?", *filter.UploadedBy)
	}

	// Count total before pagination
	if err := query.Count(&totalCount).Error; err != nil {
		return nil, 0, 0, err
	}

	// Apply sorting
	if filter.SortBy != "" {
		direction := "ASC"
		if strings.ToUpper(filter.SortDir) == "DESC" {
			direction = "DESC"
		}
		query = query.Order(clause.OrderByColumn{
			Column: clause.Column{Name: filter.SortBy},
			Desc:   direction == "DESC",
		})
	} else {
		// Default sorting by created_at desc
		query = query.Order("created_at DESC")
	}

	// Apply pagination
	if filter.Page < 1 {
		filter.Page = 1
	}

	if filter.PageSize < 1 {
		filter.PageSize = 10
	}

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize)

	// Load documents with related data
	err := query.
		Preload("Uploader").
		Preload("DocumentPermissions", func(db *gorm.DB) *gorm.DB {
			return db.Preload("User").Preload("Role")
		}).
		Find(&documents).Error

	if err != nil {
		return nil, 0, 0, err
	}

	// Calculate total pages
	totalPages := int(math.Ceil(float64(totalCount) / float64(filter.PageSize)))

	return documents, int(totalCount), totalPages, nil
}

func (r *documentRepository) GetDocumentsByEntityID(ctx context.Context, entityType string, entityID uint) ([]domain.Document, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var documents []domain.Document
	err := r.db.WithContext(ctx).
		Preload("Uploader").
		Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("created_at DESC").
		Find(&documents).Error

	if err != nil {
		return nil, err
	}

	return documents, nil
}

// Permission related methods
func (r *documentRepository) CreateDocumentPermission(ctx context.Context, permission *domain.DocumentPermission) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Create(permission).Error
}

func (r *documentRepository) UpdateDocumentPermission(ctx context.Context, permission *domain.DocumentPermission) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Save(permission).Error
}

func (r *documentRepository) DeleteDocumentPermission(ctx context.Context, id uint) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Delete(&domain.DocumentPermission{}, id).Error
}

func (r *documentRepository) GetDocumentPermissions(ctx context.Context, documentID uint) ([]domain.DocumentPermission, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var permissions []domain.DocumentPermission
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Role").
		Preload("Creator").
		Where("document_id = ?", documentID).
		Find(&permissions).Error

	if err != nil {
		return nil, err
	}

	return permissions, nil
}

func (r *documentRepository) GetUserDocumentPermission(ctx context.Context, documentID uint, userID uuid.UUID) (*domain.DocumentPermission, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var permission domain.DocumentPermission

	// First check for direct user permission
	err := r.db.WithContext(ctx).
		Where("document_id = ? AND user_id = ?", documentID, userID).
		First(&permission).Error

	if err == nil {
		return &permission, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// If no direct permission, check for role-based permissions
	// Get user roles first
	var userRoleIDs []uint
	if err := r.db.WithContext(ctx).
		Table("user_roles").
		Select("role_id").
		Where("user_id = ?", userID).
		Pluck("role_id", &userRoleIDs).Error; err != nil {
		return nil, err
	}

	if len(userRoleIDs) > 0 {
		err = r.db.WithContext(ctx).
			Where("document_id = ? AND role_id IN ?", documentID, userRoleIDs).
			Order("CASE permission_level " +
				"WHEN 'owner' THEN 1 " +
				"WHEN 'edit' THEN 2 " +
				"WHEN 'comment' THEN 3 " +
				"WHEN 'view' THEN 4 END").
			First(&permission).Error

		if err == nil {
			return &permission, nil
		}

		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	// No permission found
	return nil, gorm.ErrRecordNotFound
}

func (r *documentRepository) CheckUserPermission(ctx context.Context, documentID uint, userID uuid.UUID, requiredLevel string) (bool, error) {
	if r.db == nil {
		return false, errors.New("database connection is nil")
	}

	// First check if user is the document owner/uploader
	var document domain.Document
	if err := r.db.WithContext(ctx).
		Select("uploaded_by").
		First(&document, documentID).Error; err != nil {
		return false, err
	}

	// Document uploader always has owner permission
	if document.UploadedBy == userID {
		return true, nil
	}

	// Get the user's highest permission level for this document
	permission, err := r.GetUserDocumentPermission(ctx, documentID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	// Check if permission level is sufficient
	switch requiredLevel {
	case domain.PermissionView:
		// Any permission level allows viewing
		return true, nil
	case domain.PermissionComment:
		return permission.PermissionLevel == domain.PermissionComment ||
			permission.PermissionLevel == domain.PermissionEdit ||
			permission.PermissionLevel == domain.PermissionOwner, nil
	case domain.PermissionEdit:
		return permission.PermissionLevel == domain.PermissionEdit ||
			permission.PermissionLevel == domain.PermissionOwner, nil
	case domain.PermissionOwner:
		return permission.PermissionLevel == domain.PermissionOwner, nil
	default:
		return false, errors.New("invalid permission level")
	}
}

// Comment related methods
func (r *documentRepository) CreateDocumentComment(ctx context.Context, comment *domain.DocumentComment) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *documentRepository) UpdateDocumentComment(ctx context.Context, comment *domain.DocumentComment) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Save(comment).Error
}

func (r *documentRepository) DeleteDocumentComment(ctx context.Context, id uint) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	// Soft delete for comments
	return r.db.WithContext(ctx).Delete(&domain.DocumentComment{}, id).Error
}

func (r *documentRepository) GetDocumentComments(ctx context.Context, documentID uint) ([]domain.DocumentComment, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var comments []domain.DocumentComment
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("document_id = ?", documentID).
		Order("created_at ASC").
		Find(&comments).Error

	if err != nil {
		return nil, err
	}

	return comments, nil
}

// Version related methods
func (r *documentRepository) CreateDocumentVersion(ctx context.Context, version *domain.DocumentVersion) error {
	if r.db == nil {
		return errors.New("database connection is nil")
	}

	return r.db.WithContext(ctx).Create(version).Error
}

func (r *documentRepository) GetDocumentVersions(ctx context.Context, documentID uint) ([]domain.DocumentVersion, error) {
	if r.db == nil {
		return nil, errors.New("database connection is nil")
	}

	var versions []domain.DocumentVersion
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("document_id = ?", documentID).
		Order("version_number DESC").
		Find(&versions).Error

	if err != nil {
		return nil, err
	}

	return versions, nil
}
