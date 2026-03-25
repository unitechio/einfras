//go:build legacy
// +build legacy

package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/docker/application"

	"einfra/api/pkg/errorx"
)

// FileBrowserHandler handles file browser operations
type FileBrowserHandler struct {
	fileBrowserUsecase usecase.FileBrowserUsecase
}

// NewFileBrowserHandler creates a new file browser handler
func NewFileBrowserHandler(fileBrowserUsecase usecase.FileBrowserUsecase) *FileBrowserHandler {
	return &FileBrowserHandler{
		fileBrowserUsecase: fileBrowserUsecase,
	}
}

// ListFiles lists files in a volume
// @Summary List files in volume
// @Description List all files and directories in a Docker volume path
// @Tags file-browser
// @Accept json
// @Produce json
// @Param volume_name path string true "Volume name"
// @Param path query string false "Path within volume" default:"/"
// @Success 200 {array} domain.FileInfo "List of files"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/browse [get]
// @Security BearerAuth
func (h *FileBrowserHandler) ListFiles(c *gin.Context) {
	volumeName := c.Param("volume_name")
	path := c.DefaultQuery("path", "/")

	files, err := h.fileBrowserUsecase.ListFiles(c.Request.Context(), volumeName, path)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to list files"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"volume": volumeName,
		"path":   path,
		"files":  files,
		"count":  len(files),
	})
}

// UploadFile uploads a file to a volume
// @Summary Upload file to volume
// @Description Upload a file to a Docker volume
// @Tags file-browser
// @Accept multipart/form-data
// @Produce json
// @Param volume_name path string true "Volume name"
// @Param path formData string true "Destination path"
// @Param file formData file true "File to upload"
// @Success 200 {object} map[string]interface{} "File uploaded successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/upload [post]
// @Security BearerAuth
func (h *FileBrowserHandler) UploadFile(c *gin.Context) {
	volumeName := c.Param("volume_name")
	path := c.PostForm("path")

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "File is required"))
		return
	}
	defer file.Close()

	if err := h.fileBrowserUsecase.UploadFile(c.Request.Context(), volumeName, path, header.Filename, file); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to upload file"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "File uploaded successfully",
		"volume":   volumeName,
		"path":     path,
		"filename": header.Filename,
	})
}

// DownloadFile downloads a file from a volume
// @Summary Download file from volume
// @Description Download a file from a Docker volume
// @Tags file-browser
// @Accept json
// @Produce application/octet-stream
// @Param volume_name path string true "Volume name"
// @Param path query string true "File path"
// @Success 200 {file} binary "File content"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 404 {object} errorx.Error "File not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/download [get]
// @Security BearerAuth
func (h *FileBrowserHandler) DownloadFile(c *gin.Context) {
	volumeName := c.Param("volume_name")
	path := c.Query("path")

	if path == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Path is required"))
		return
	}

	reader, err := h.fileBrowserUsecase.DownloadFile(c.Request.Context(), volumeName, path)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to download file"))
		return
	}
	defer reader.Close()

	c.Header("Content-Disposition", "attachment; filename="+path)
	c.Header("Content-Type", "application/octet-stream")
	c.DataFromReader(http.StatusOK, -1, "application/octet-stream", reader, nil)
}

// DeleteFile deletes a file from a volume
// @Summary Delete file from volume
// @Description Delete a file or directory from a Docker volume
// @Tags file-browser
// @Accept json
// @Produce json
// @Param volume_name path string true "Volume name"
// @Param path query string true "File path"
// @Success 200 {object} map[string]interface{} "File deleted successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/files [delete]
// @Security BearerAuth
func (h *FileBrowserHandler) DeleteFile(c *gin.Context) {
	volumeName := c.Param("volume_name")
	path := c.Query("path")

	if path == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Path is required"))
		return
	}

	if err := h.fileBrowserUsecase.DeleteFile(c.Request.Context(), volumeName, path); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to delete file"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File deleted successfully",
		"volume":  volumeName,
		"path":    path,
	})
}

// CreateFolderRequest represents create folder request
type CreateFolderRequest struct {
	Path       string `json:"path" binding:"required"`
	FolderName string `json:"folder_name" binding:"required"`
}

// CreateFolder creates a folder in a volume
// @Summary Create folder in volume
// @Description Create a new folder in a Docker volume
// @Tags file-browser
// @Accept json
// @Produce json
// @Param volume_name path string true "Volume name"
// @Param request body CreateFolderRequest true "Folder creation request"
// @Success 201 {object} map[string]interface{} "Folder created successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/mkdir [post]
// @Security BearerAuth
func (h *FileBrowserHandler) CreateFolder(c *gin.Context) {
	volumeName := c.Param("volume_name")

	var req CreateFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	if err := h.fileBrowserUsecase.CreateFolder(c.Request.Context(), volumeName, req.Path, req.FolderName); err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to create folder"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Folder created successfully",
		"volume":      volumeName,
		"path":        req.Path,
		"folder_name": req.FolderName,
	})
}

// ReadFile reads a text file from a volume
// @Summary Read file content
// @Description Read the content of a text file from a Docker volume
// @Tags file-browser
// @Accept json
// @Produce json
// @Param volume_name path string true "Volume name"
// @Param path query string true "File path"
// @Success 200 {object} map[string]interface{} "File content"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/volumes/{volume_name}/read [get]
// @Security BearerAuth
func (h *FileBrowserHandler) ReadFile(c *gin.Context) {
	volumeName := c.Param("volume_name")
	path := c.Query("path")

	if path == "" {
		c.Error(errorx.New(errorx.CodeBadRequest, "Path is required"))
		return
	}

	content, err := h.fileBrowserUsecase.ReadFile(c.Request.Context(), volumeName, path)
	if err != nil {
		c.Error(errorx.Wrap(err, errorx.CodeInternalError, "Failed to read file"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"volume":  volumeName,
		"path":    path,
		"content": content,
	})
}
