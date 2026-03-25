//go:build legacy
// +build legacy

package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"einfra/api/internal/modules/server/application/doc_uc"
	"einfra/api/internal/dto"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/gin-gonic/gin"
)

type DocumentHandler struct {
	documentusecase usecase.DocumentUsecase
}

func NewDocumentHandler(documentusecase usecase.DocumentUsecase) *DocumentHandler {
	return &DocumentHandler{
		documentusecase: documentusecase,
	}
}

// UploadDocument handles uploading a new document
func (h *DocumentHandler) UploadDocument(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file"})
		return
	}

	// Parse request data
	uploadRequest := dto.DocumentUploadRequest{
		EntityType:   c.PostForm("entity_type"),
		DocumentName: c.PostForm("document_name"),
	}

	// Parse entity ID
	entityIDStr := c.PostForm("entity_id")
	entityID, err := strconv.ParseUint(entityIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity ID"})
		return
	}
	uploadRequest.EntityID = uint(entityID)

	// Validate request data
	if uploadRequest.EntityType == "" || uploadRequest.DocumentName == "" || uploadRequest.EntityID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields"})
		return
	}

	// Upload document
	document, err := h.documentusecase.UploadDocument(c.Request.Context(), file, uploadRequest, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload document: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Document uploaded successfully",
		"document": document,
	})
}

// GetDocuments handles retrieving a list of documents with filtering
func (h *DocumentHandler) GetDocuments(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse filter parameters
	var filter dto.DocumentFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filter parameters"})
		return
	}

	// Set default values if not provided
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 10
	} else if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	// Get documents
	result, err := h.documentusecase.GetDocuments(c.Request.Context(), filter, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get documents: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetDocumentsByEntity handles retrieving documents for a specific entity
func (h *DocumentHandler) GetDocumentsByEntity(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse parameters
	entityType := c.Param("type")
	entityIDStr := c.Param("id")

	entityID, err := strconv.ParseUint(entityIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid entity ID"})
		return
	}

	// Get documents for entity
	documents, err := h.documentusecase.GetDocumentsByEntityID(
		c.Request.Context(),
		entityType,
		uint(entityID),
		userID.(uuid.UUID),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get documents: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, documents)
}

// GetDocumentByID handles retrieving a document by ID
func (h *DocumentHandler) GetDocumentByID(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Get document
	document, err := h.documentusecase.GetDocumentByID(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get document: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, document)
}
func (h *DocumentHandler) GetDocumentViewURL(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Lấy thông tin document
	document, err := h.documentusecase.GetDocumentByID(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// Tạo presigned URL
	minioClient, _ := minio.New("103.186.65.162:9000", &minio.Options{
		Creds:  credentials.NewStaticV4("sRINJxwu3Uu0IEoFQYgs", "Rhtlzp6AlwOwEl7KwJxugXDXV20S4VJQWBYN3WV4", ""),
		Secure: false, // Đổi thành true nếu sử dụng HTTPS
	})

	// Tạo URL với thời hạn 1 giờ
	url, err := minioClient.PresignedGetObject(c.Request.Context(),
		"documents",           // bucket name
		document.DocumentPath, // object name
		time.Hour,             // thời hạn
		nil)                   // các tùy chọn khác

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": url.String()})
}
func (h *DocumentHandler) ViewDocument(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Lấy nội dung file
	fileBytes, contentType, fileName, err := h.documentusecase.DownloadDocument(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get document"})
		return
	}

	// Trả về với content-type thích hợp
	c.Header("Content-Disposition", "inline; filename="+fileName)
	c.Data(http.StatusOK, contentType, fileBytes)
}

// GetDocumentByCode handles retrieving a document by its unique code
func (h *DocumentHandler) GetDocumentByCode(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document code
	code := c.Param("code")

	// Get document
	document, err := h.documentusecase.GetDocumentByCode(c.Request.Context(), code, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get document: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, document)
}

// UpdateDocument handles updating document metadata
func (h *DocumentHandler) UpdateDocument(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Parse request data
	var updateRequest dto.DocumentUpdateRequest
	if err := c.ShouldBindJSON(&updateRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Update document
	document, err := h.documentusecase.UpdateDocument(c.Request.Context(), uint(id), updateRequest, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update document: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Document updated successfully",
		"document": document,
	})
}

// DeleteDocument handles deleting a document
func (h *DocumentHandler) DeleteDocument(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Delete document
	if err := h.documentusecase.DeleteDocument(c.Request.Context(), uint(id), userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete document: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Document deleted successfully"})
}

// DownloadDocument handles downloading a document
func (h *DocumentHandler) DownloadDocument(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Download document
	fileBytes, contentType, fileName, err := h.documentusecase.DownloadDocument(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to download document: %s", err.Error())})
		return
	}

	// Set response headers
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Data(http.StatusOK, contentType, fileBytes)
}

// Permission handlers

// AddDocumentPermission handles adding a new permission for a document
func (h *DocumentHandler) AddDocumentPermission(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse request data
	var permissionRequest dto.DocumentPermissionRequest
	if err := c.ShouldBindJSON(&permissionRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Add permission
	if err := h.documentusecase.AddDocumentPermission(c.Request.Context(), permissionRequest, userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to add permission: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Permission added successfully"})
}

// GetDocumentPermissions handles retrieving permissions for a document
func (h *DocumentHandler) GetDocumentPermissions(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Get permissions
	permissions, err := h.documentusecase.GetDocumentPermissions(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get permissions: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, permissions)
}

// UpdateDocumentPermission handles updating an existing permission
func (h *DocumentHandler) UpdateDocumentPermission(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse permission ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	// Parse request data
	var permissionRequest dto.DocumentPermissionRequest
	if err := c.ShouldBindJSON(&permissionRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Update permission
	if err := h.documentusecase.UpdateDocumentPermission(c.Request.Context(), uint(id), permissionRequest, userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update permission: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Permission updated successfully"})
}

// DeleteDocumentPermission handles removing a permission
func (h *DocumentHandler) DeleteDocumentPermission(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse permission ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	// Delete permission
	if err := h.documentusecase.RemoveDocumentPermission(c.Request.Context(), uint(id), userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete permission: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Permission removed successfully"})
}

// Comment handlers

// AddDocumentComment handles adding a new comment to a document
func (h *DocumentHandler) AddDocumentComment(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse request data
	var commentRequest dto.DocumentCommentRequest
	if err := c.ShouldBindJSON(&commentRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Add comment
	comment, err := h.documentusecase.AddDocumentComment(c.Request.Context(), commentRequest, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to add comment: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Comment added successfully",
		"comment": comment,
	})
}

// GetDocumentComments handles retrieving comments for a document
func (h *DocumentHandler) GetDocumentComments(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Get comments
	comments, err := h.documentusecase.GetDocumentComments(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get comments: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// UpdateDocumentComment handles updating an existing comment
func (h *DocumentHandler) UpdateDocumentComment(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse comment ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	// Parse request data
	var requestData struct {
		Comment string `json:"comment" binding:"required"`
	}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	// Update comment
	comment, err := h.documentusecase.UpdateDocumentComment(c.Request.Context(), uint(id), requestData.Comment, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update comment: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Comment updated successfully",
		"comment": comment,
	})
}

// DeleteDocumentComment handles deleting a comment
func (h *DocumentHandler) DeleteDocumentComment(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse comment ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	// Delete comment
	if err := h.documentusecase.DeleteDocumentComment(c.Request.Context(), uint(id), userID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to delete comment: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}

// Version handlers

// GetDocumentVersions handles retrieving versions of a document
func (h *DocumentHandler) GetDocumentVersions(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse document ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}

	// Get versions
	versions, err := h.documentusecase.GetDocumentVersions(c.Request.Context(), uint(id), userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get versions: %s", err.Error())})
		return
	}

	c.JSON(http.StatusOK, versions)
}
