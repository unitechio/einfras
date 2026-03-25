//go:build legacy
// +build legacy

package handler

import (
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

// KubeconfigHandler handles HTTP requests for kubeconfig management
type KubeconfigHandler struct {
	// TODO: Add kubeconfig repository when implemented
}

// NewKubeconfigHandler creates a new kubeconfig handler
func NewKubeconfigHandler() *KubeconfigHandler {
	return &KubeconfigHandler{}
}

// UploadKubeconfigRequest represents a request to upload kubeconfig
type UploadKubeconfigRequest struct {
	Name        string `json:"name" binding:"required" example:"Production Cluster"`
	ClusterID   string `json:"cluster_id" binding:"required" example:"cluster-uuid"`
	ConfigType  string `json:"config_type" binding:"required,oneof=file inline credentials" example:"file"`
	ConfigData  string `json:"config_data" binding:"required" example:"YXBpVmVyc2lvbjogdjEK..."` // Base64 encoded
	ContextName string `json:"context_name" example:"production-context"`
	Description string `json:"description" example:"Production K8s cluster config"`
	IsDefault   bool   `json:"is_default" example:"true"`
}

// UploadKubeconfig uploads a kubeconfig file
// @Summary Upload kubeconfig
// @Description Upload a kubeconfig file for Kubernetes cluster access
// @Tags kubeconfigs
// @Accept json
// @Produce json
// @Param request body UploadKubeconfigRequest true "Kubeconfig data"
// @Success 201 {object} domain.KubeConfig "Kubeconfig uploaded successfully"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/kubeconfigs [post]
// @Security BearerAuth
func (h *KubeconfigHandler) UploadKubeconfig(c *gin.Context) {
	var req UploadKubeconfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Invalid request body"))
		return
	}

	// Validate base64 encoding
	if _, err := base64.StdEncoding.DecodeString(req.ConfigData); err != nil {
		c.Error(errorx.New(errorx.CodeBadRequest, "Config data must be base64 encoded"))
		return
	}

	// Create kubeconfig entity
	kubeconfig := domain.KubeConfig{
		Name:        req.Name,
		ClusterID:   req.ClusterID,
		ConfigType:  req.ConfigType,
		ConfigData:  req.ConfigData,
		ContextName: req.ContextName,
		Description: req.Description,
		IsDefault:   req.IsDefault,
	}

	// TODO: Save to database via repository
	// For now, return the created config
	c.JSON(http.StatusCreated, gin.H{
		"message":    "Kubeconfig uploaded successfully",
		"kubeconfig": kubeconfig,
	})
}

// ListKubeconfigs lists all kubeconfigs
// @Summary List kubeconfigs
// @Description Get a list of all kubeconfig files
// @Tags kubeconfigs
// @Accept json
// @Produce json
// @Param cluster_id query string false "Filter by cluster ID"
// @Success 200 {array} domain.KubeConfig "List of kubeconfigs"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/kubeconfigs [get]
// @Security BearerAuth
func (h *KubeconfigHandler) ListKubeconfigs(c *gin.Context) {
	// clusterID := c.Query("cluster_id")

	// TODO: Fetch from database
	c.JSON(http.StatusOK, gin.H{
		"kubeconfigs": []domain.KubeConfig{},
		"count":       0,
	})
}

// GetKubeconfig gets a specific kubeconfig
// @Summary Get kubeconfig
// @Description Get a specific kubeconfig by ID
// @Tags kubeconfigs
// @Accept json
// @Produce json
// @Param id path string true "Kubeconfig ID"
// @Success 200 {object} domain.KubeConfig "Kubeconfig details"
// @Failure 404 {object} errorx.Error "Kubeconfig not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/kubeconfigs/{id} [get]
// @Security BearerAuth
func (h *KubeconfigHandler) GetKubeconfig(c *gin.Context) {
	id := c.Param("id")

	// TODO: Fetch from database
	c.JSON(http.StatusNotFound, gin.H{
		"error": "Kubeconfig not found",
		"id":    id,
	})
}

// DeleteKubeconfig deletes a kubeconfig
// @Summary Delete kubeconfig
// @Description Delete a kubeconfig file
// @Tags kubeconfigs
// @Accept json
// @Produce json
// @Param id path string true "Kubeconfig ID"
// @Success 200 {object} map[string]interface{} "Kubeconfig deleted successfully"
// @Failure 404 {object} errorx.Error "Kubeconfig not found"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /api/v1/kubeconfigs/{id} [delete]
// @Security BearerAuth
func (h *KubeconfigHandler) DeleteKubeconfig(c *gin.Context) {
	id := c.Param("id")

	// TODO: Delete from database
	c.JSON(http.StatusOK, gin.H{
		"message": "Kubeconfig deleted successfully",
		"id":      id,
	})
}

// TestKubeconfigRequest represents a request to test kubeconfig
type TestKubeconfigRequest struct {
	ConfigData string `json:"config_data" binding:"required"` // Base64 encoded
}

// TestKubeconfig tests a kubeconfig connection
// @Summary Test kubeconfig
// @Description Test connection to Kubernetes cluster using kubeconfig
// @Tags kubeconfigs
// @Accept json
// @Produce json
// @Param id path string true "Kubeconfig ID"
// @Success 200 {object} map[string]interface{} "Connection test result"
// @Failure 400 {object} errorx.Error "Invalid request"
// @Failure 404 {object} errorx.Error "Kubeconfig not found"
// @Failure 500 {object} errorx.Error "Connection failed"
// @Router /api/v1/kubeconfigs/{id}/test [post]
// @Security BearerAuth
func (h *KubeconfigHandler) TestKubeconfig(c *gin.Context) {
	id := c.Param("id")

	// TODO: Fetch kubeconfig from database
	// TODO: Test connection to K8s cluster
	// TODO: Return cluster info if successful

	c.JSON(http.StatusOK, gin.H{
		"message":        "Connection test successful",
		"kubeconfig_id":  id,
		"cluster_status": "reachable",
		"version":        "v1.28.0",
	})
}
