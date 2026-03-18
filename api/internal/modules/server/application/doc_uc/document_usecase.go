package usecase

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"strings"
	"time"

	"github.com/google/uuid"
	"einfra/api/internal/modules/server/infrastructure/doc_repo"
	"einfra/api/internal/domain"
	dto "einfra/api/internal/dto"
	storage "einfra/api/internal/shared/infra/filestorage"
)

type documentUsecase struct {
	documentRepo   repository.DocumentRepository
	storageUsecase storage.IStorage
}

func NewDocumentUsecase(documentRepo repository.DocumentRepository, storageUsecase storage.IStorage) DocumentUsecase {
	return &documentUsecase{
		documentRepo:   documentRepo,
		storageUsecase: storageUsecase,
	}
}

func (s *documentUsecase) generateDocumentCode(entityType string) string {
	prefix := "DOC"

	if entityType != "" {
		if len(entityType) >= 3 {
			prefix = entityType[:3]
		} else {
			prefix = entityType
		}
		prefix = strings.ToUpper(prefix)
	}

	// Add timestamp
	timestamp := time.Now().Format("20060102")

	// Add unique identifier (first 8 chars of UUID)
	uniqueID := strings.ReplaceAll(uuid.New().String(), "-", "")[:8]

	return fmt.Sprintf("%s-%s-%s", prefix, timestamp, uniqueID)
}

// getUserPermissionLevel returns the permission level for a user on a document
func (s *documentUsecase) getUserPermissionLevel(ctx context.Context, document *domain.Document, userID uuid.UUID) string {
	// Document uploader always has owner permission
	if document.UploadedBy == userID {
		return domain.PermissionOwner
	}

	// Check permissions
	permission, err := s.documentRepo.GetUserDocumentPermission(ctx, document.ID, userID)
	if err != nil {
		return "" // No permission
	}

	return permission.PermissionLevel
}

// Document CRUD methods

// UploadDocument uploads a new document and stores its metadata
func (s *documentUsecase) UploadDocument(
	ctx context.Context,
	file *multipart.FileHeader,
	uploadRequest dto.DocumentUploadRequest,
	userID uuid.UUID,
) (*domain.Document, error) {
	// Check if file type is allowed
	if !s.storageUsecase.IsAllowedFileType(file.Filename) {
		return nil, errors.New("file type not allowed")
	}

	// Use storage Usecase to upload the file
	storagePath, err := s.storageUsecase.UploadFile(ctx, file, uploadRequest.EntityType, uploadRequest.EntityID)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file to storage: %w", err)
	}

	// Create document record in database
	document := &domain.Document{
		DocumentCode: s.generateDocumentCode(uploadRequest.EntityType),
		EntityType:   uploadRequest.EntityType,
		EntityID:     uploadRequest.EntityID,
		DocumentName: uploadRequest.DocumentName,
		DocumentPath: storagePath,
		DocumentType: file.Header.Get("Content-Type"),
		FileSize:     file.Size,
		UploadedBy:   userID,
	}

	if err := s.documentRepo.CreateDocument(ctx, document); err != nil {
		// Document metadata creation failed, clean up the uploaded file
		cleanupErr := s.storageUsecase.DeleteFile(ctx, storagePath)
		if cleanupErr != nil {
			// Log the cleanup error but continue with the original error
			// In a real implementation, you might want to log this error
		}
		return nil, fmt.Errorf("failed to save document metadata: %w", err)
	}

	// Create initial version record
	version := &domain.DocumentVersion{
		DocumentID:    document.ID,
		VersionNumber: 1,
		DocumentPath:  storagePath,
		FileSize:      file.Size,
		ChangedBy:     userID,
		ChangeNote:    "Initial upload",
	}

	if err := s.documentRepo.CreateDocumentVersion(ctx, version); err != nil {
		// Continue even if version creation fails
		// We don't want to roll back the whole upload for this
		// Just log the error in a real implementation
	}

	return document, nil
}

// UpdateDocument updates document metadata
func (s *documentUsecase) UpdateDocument(
	ctx context.Context,
	id uint,
	updateRequest dto.DocumentUpdateRequest,
	userID uuid.UUID,
) (*domain.Document, error) {
	// Get existing document
	document, err := s.documentRepo.GetDocumentByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	// Check permission
	hasPermission, err := s.CheckUserPermission(ctx, id, userID, domain.PermissionEdit)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasPermission {
		return nil, errors.New("permission denied: you don't have edit permission for this document")
	}

	// Update fields
	document.DocumentName = updateRequest.DocumentName
	document.UpdatedAt = time.Now()

	if err := s.documentRepo.UpdateDocument(ctx, document); err != nil {
		return nil, fmt.Errorf("failed to update document: %w", err)
	}

	return document, nil
}

// DeleteDocument soft-deletes a document
func (s *documentUsecase) DeleteDocument(ctx context.Context, id uint, userID uuid.UUID) error {
	// Get existing document
	document, err := s.documentRepo.GetDocumentByID(ctx, id)
	if err != nil {
		return fmt.Errorf("document not found: %w", err)
	}

	// Check permission (only owner can delete)
	hasPermission, err := s.CheckUserPermission(ctx, id, userID, domain.PermissionOwner)
	if err != nil {
		return fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return errors.New("permission denied: only the document owner can delete it")
	}

	// Soft delete the document
	return s.documentRepo.DeleteDocumentByID(ctx, id)
}

// GetDocumentByID retrieves a document by ID with permission check
func (s *documentUsecase) GetDocumentByID(ctx context.Context, id uint, userID uuid.UUID) (*domain.Document, error) {
	// Get document
	document, err := s.documentRepo.GetDocumentByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	// Check permission (at least view)
	hasPermission, err := s.CheckUserPermission(ctx, id, userID, domain.PermissionView)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have view permission for this document")
	}

	return document, nil
}

// GetDocumentByCode retrieves a document by its unique code with permission check
func (s *documentUsecase) GetDocumentByCode(ctx context.Context, code string, userID uuid.UUID) (*domain.Document, error) {
	// Get document
	document, err := s.documentRepo.GetDocumentByCode(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	// Check permission (at least view)
	hasPermission, err := s.CheckUserPermission(ctx, document.ID, userID, domain.PermissionView)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have view permission for this document")
	}

	return document, nil
}

// GetDocuments retrieves documents with filtering and pagination
func (s *documentUsecase) GetDocuments(ctx context.Context, filter dto.DocumentFilter, userID uuid.UUID) (*dto.PaginatedDocumentsResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}

	if filter.PageSize < 1 {
		filter.PageSize = 10
	}

	documents, totalCount, totalPages, err := s.documentRepo.GetDocuments(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve documents: %w", err)
	}

	// Map to response DTO with permissions
	response := &dto.PaginatedDocumentsResponse{
		Data:       make([]dto.DocumentResponse, 0, len(documents)),
		TotalCount: totalCount,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	}

	for _, doc := range documents {
		// Check if user has permission to see this document
		permissionLevel := s.getUserPermissionLevel(ctx, &doc, userID)

		// Skip documents the user doesn't have access to
		if permissionLevel == "" && doc.UploadedBy != userID {
			continue
		}

		// If owner uploaded it, they have owner permission
		if doc.UploadedBy == userID && permissionLevel == "" {
			permissionLevel = domain.PermissionOwner
		}

		docResponse := dto.DocumentResponse{
			ID:             doc.ID,
			DocumentCode:   doc.DocumentCode,
			EntityType:     doc.EntityType,
			EntityID:       doc.EntityID,
			DocumentName:   doc.DocumentName,
			DocumentType:   doc.DocumentType,
			FileSize:       doc.FileSize,
			UploadedBy:     doc.UploadedBy,
			UploaderName:   doc.Uploader.Username,
			CreatedAt:      doc.CreatedAt.Format(time.RFC3339),
			UpdatedAt:      doc.UpdatedAt.Format(time.RFC3339),
			UserPermission: permissionLevel,
		}

		response.Data = append(response.Data, docResponse)
	}

	return response, nil
}

// GetDocumentsByEntityID retrieves documents for a specific entity
func (s *documentUsecase) GetDocumentsByEntityID(
	ctx context.Context,
	entityType string,
	entityID uint,
	userID uuid.UUID,
) ([]dto.DocumentResponse, error) {
	// Get documents for entity
	documents, err := s.documentRepo.GetDocumentsByEntityID(ctx, entityType, entityID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve documents: %w", err)
	}

	// Map to response DTO with permissions
	response := make([]dto.DocumentResponse, 0, len(documents))

	for _, doc := range documents {
		// Check if user has permission to see this document
		permissionLevel := s.getUserPermissionLevel(ctx, &doc, userID)

		// Skip documents the user doesn't have access to
		if permissionLevel == "" && doc.UploadedBy != userID {
			continue
		}

		// If owner uploaded it, they have owner permission
		if doc.UploadedBy == userID && permissionLevel == "" {
			permissionLevel = domain.PermissionOwner
		}

		docResponse := dto.DocumentResponse{
			ID:             doc.ID,
			DocumentCode:   doc.DocumentCode,
			EntityType:     doc.EntityType,
			EntityID:       doc.EntityID,
			DocumentName:   doc.DocumentName,
			DocumentType:   doc.DocumentType,
			FileSize:       doc.FileSize,
			UploadedBy:     doc.UploadedBy,
			UploaderName:   doc.Uploader.Username,
			CreatedAt:      doc.CreatedAt.Format(time.RFC3339),
			UpdatedAt:      doc.UpdatedAt.Format(time.RFC3339),
			UserPermission: permissionLevel,
		}

		response = append(response, docResponse)
	}

	return response, nil
}

// DownloadDocument retrieves a document's content with permission check
func (s *documentUsecase) DownloadDocument(
	ctx context.Context,
	id uint,
	userID uuid.UUID,
) ([]byte, string, string, error) {
	// Get document with permission check
	document, err := s.GetDocumentByID(ctx, id, userID)
	if err != nil {
		return nil, "", "", err
	}

	// Download the file from storage
	fileBytes, err := s.storageUsecase.DownloadFile(ctx, document.DocumentPath)
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to download file: %w", err)
	}

	return fileBytes, document.DocumentType, document.DocumentName, nil
}

// Permission management methods

// AddDocumentPermission adds a new permission for a user or role
func (s *documentUsecase) AddDocumentPermission(
	ctx context.Context,
	request dto.DocumentPermissionRequest,
	userID uuid.UUID,
) error {
	// Verify the document exists
	document, err := s.documentRepo.GetDocumentByID(ctx, request.DocumentID)
	if err != nil {
		return fmt.Errorf("document not found: %w", err)
	}

	// Check if requester has owner permission
	hasPermission, err := s.CheckUserPermission(ctx, request.DocumentID, userID, domain.PermissionOwner)
	if err != nil {
		return fmt.Errorf("failed to check permission: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return errors.New("permission denied: only the document owner can manage permissions")
	}

	// Validate request
	if request.UserID == nil && request.JobTitle == "" {
		return errors.New("either userId or roleId must be provided")
	}

	// Create permission record
	permission := &domain.DocumentPermission{
		DocumentID:      request.DocumentID,
		UserID:          uuid.Nil,
		JobTitle:        "",
		PermissionLevel: request.PermissionLevel,
		CreatedBy:       userID,
	}

	if request.UserID != nil {
		permission.UserID = *request.UserID
	}

	if request.JobTitle != "" {
		permission.JobTitle = request.JobTitle
	}

	return s.documentRepo.CreateDocumentPermission(ctx, permission)
}

// UpdateDocumentPermission updates an existing permission
func (s *documentUsecase) UpdateDocumentPermission(
	ctx context.Context,
	id uint,
	request dto.DocumentPermissionRequest,
	userID uuid.UUID,
) error {
	// Check if requester has owner permission on the document
	hasPermission, err := s.CheckUserPermission(ctx, request.DocumentID, userID, domain.PermissionOwner)
	if err != nil {
		return fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, request.DocumentID)
	if err != nil {
		return fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return errors.New("permission denied: only the document owner can manage permissions")
	}

	// Get the existing permission
	permissions, err := s.documentRepo.GetDocumentPermissions(ctx, request.DocumentID)
	if err != nil {
		return fmt.Errorf("failed to retrieve permissions: %w", err)
	}

	var permissionToUpdate *domain.DocumentPermission
	for i, p := range permissions {
		if p.ID == id {
			permissionToUpdate = &permissions[i]
			break
		}
	}

	if permissionToUpdate == nil {
		return errors.New("permission not found")
	}

	// Update permission
	permissionToUpdate.PermissionLevel = request.PermissionLevel
	permissionToUpdate.UpdatedAt = time.Now()

	return s.documentRepo.UpdateDocumentPermission(ctx, permissionToUpdate)
}

// RemoveDocumentPermission removes a permission
func (s *documentUsecase) RemoveDocumentPermission(
	ctx context.Context,
	id uint,
	userID uuid.UUID,
) error {
	// Get the permission to find the document ID
	permissions, err := s.documentRepo.GetDocumentPermissions(ctx, 0) // We don't know document ID yet
	if err != nil {
		return fmt.Errorf("failed to retrieve permissions: %w", err)
	}

	var permissionToDelete *domain.DocumentPermission
	for i, p := range permissions {
		if p.ID == id {
			permissionToDelete = &permissions[i]
			break
		}
	}

	if permissionToDelete == nil {
		return errors.New("permission not found")
	}

	// Check if requester has owner permission
	hasPermission, err := s.CheckUserPermission(ctx, permissionToDelete.DocumentID, userID, domain.PermissionOwner)
	if err != nil {
		return fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, permissionToDelete.DocumentID)
	if err != nil {
		return fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return errors.New("permission denied: only the document owner can manage permissions")
	}

	return s.documentRepo.DeleteDocumentPermission(ctx, id)
}

// GetDocumentPermissions retrieves all permissions for a document
func (s *documentUsecase) GetDocumentPermissions(
	ctx context.Context,
	documentID uint,
	userID uuid.UUID,
) ([]domain.DocumentPermission, error) {
	// Check if requester has permission to view permissions
	hasPermission, err := s.CheckUserPermission(ctx, documentID, userID, domain.PermissionEdit)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, documentID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have permission to view this document's permissions")
	}

	return s.documentRepo.GetDocumentPermissions(ctx, documentID)
}

// CheckUserPermission checks if a user has a specific permission level on a document
func (s *documentUsecase) CheckUserPermission(
	ctx context.Context,
	documentID uint,
	userID uuid.UUID,
	requiredLevel string,
) (bool, error) {
	return s.documentRepo.CheckUserPermission(ctx, documentID, userID, requiredLevel)
}

// Document comments methods

// AddDocumentComment adds a new comment to a document
func (s *documentUsecase) AddDocumentComment(
	ctx context.Context,
	request dto.DocumentCommentRequest,
	userID uuid.UUID,
) (*domain.DocumentComment, error) {
	// Check if user has comment permission
	hasPermission, err := s.CheckUserPermission(ctx, request.DocumentID, userID, domain.PermissionComment)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, request.DocumentID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have permission to comment on this document")
	}

	// Create comment
	comment := &domain.DocumentComment{
		DocumentID: request.DocumentID,
		UserID:     userID,
		Comment:    request.Comment,
	}

	if err := s.documentRepo.CreateDocumentComment(ctx, comment); err != nil {
		return nil, fmt.Errorf("failed to create comment: %w", err)
	}

	return comment, nil
}

// UpdateDocumentComment updates an existing comment
func (s *documentUsecase) UpdateDocumentComment(
	ctx context.Context,
	id uint,
	comment string,
	userID uuid.UUID,
) (*domain.DocumentComment, error) {
	// Get document comments
	comments, err := s.documentRepo.GetDocumentComments(ctx, 0) // We don't know document ID yet
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve comments: %w", err)
	}

	var commentToUpdate *domain.DocumentComment
	for i, c := range comments {
		if c.ID == id {
			commentToUpdate = &comments[i]
			break
		}
	}

	if commentToUpdate == nil {
		return nil, errors.New("comment not found")
	}

	// Check if user is the comment author
	if commentToUpdate.UserID != userID {
		return nil, errors.New("permission denied: you can only edit your own comments")
	}

	// Update comment
	commentToUpdate.Comment = comment
	commentToUpdate.UpdatedAt = time.Now()

	if err := s.documentRepo.UpdateDocumentComment(ctx, commentToUpdate); err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	return commentToUpdate, nil
}

// DeleteDocumentComment deletes a comment
func (s *documentUsecase) DeleteDocumentComment(ctx context.Context, id uint, userID uuid.UUID) error {
	// Get document comments
	comments, err := s.documentRepo.GetDocumentComments(ctx, 0) // We don't know document ID yet
	if err != nil {
		return fmt.Errorf("failed to retrieve comments: %w", err)
	}

	var commentToDelete *domain.DocumentComment
	for i, c := range comments {
		if c.ID == id {
			commentToDelete = &comments[i]
			break
		}
	}

	if commentToDelete == nil {
		return errors.New("comment not found")
	}

	// Check if user is the comment author or document owner
	if commentToDelete.UserID != userID {
		// Check if user is document owner
		document, err := s.documentRepo.GetDocumentByID(ctx, commentToDelete.DocumentID)
		if err != nil {
			return fmt.Errorf("document not found: %w", err)
		}

		if document.UploadedBy != userID {
			// Check if user has owner permission
			hasPermission, err := s.CheckUserPermission(ctx, commentToDelete.DocumentID, userID, domain.PermissionOwner)
			if err != nil {
				return fmt.Errorf("failed to check permission: %w", err)
			}

			if !hasPermission {
				return errors.New("permission denied: you can only delete your own comments or comments on documents you own")
			}
		}
	}

	return s.documentRepo.DeleteDocumentComment(ctx, id)
}

// GetDocumentComments retrieves all comments for a document
func (s *documentUsecase) GetDocumentComments(
	ctx context.Context,
	documentID uint,
	userID uuid.UUID,
) ([]domain.DocumentComment, error) {
	// Check if user has view permission
	hasPermission, err := s.CheckUserPermission(ctx, documentID, userID, domain.PermissionView)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, documentID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have permission to view comments on this document")
	}

	return s.documentRepo.GetDocumentComments(ctx, documentID)
}

// Document versions methods

// GetDocumentVersions retrieves all versions of a document
func (s *documentUsecase) GetDocumentVersions(ctx context.Context, documentID uint, userID uuid.UUID) ([]domain.DocumentVersion, error) {
	hasPermission, err := s.CheckUserPermission(ctx, documentID, userID, domain.PermissionView)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	// Get document to check if user is the uploader
	document, err := s.documentRepo.GetDocumentByID(ctx, documentID)
	if err != nil {
		return nil, fmt.Errorf("document not found: %w", err)
	}

	if !hasPermission && document.UploadedBy != userID {
		return nil, errors.New("permission denied: you don't have permission to view versions of this document")
	}

	return s.documentRepo.GetDocumentVersions(ctx, documentID)
}
