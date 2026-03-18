package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
)

type HarborHandler struct {
	harborUsecase          domain.HarborUsecase
	imageDeploymentUsecase domain.ImageDeploymentUsecase
}

// NewHarborHandler creates a new Harbor handler instance
func NewHarborHandler(
	harborUsecase domain.HarborUsecase,
	imageDeploymentUsecase domain.ImageDeploymentUsecase,
) *HarborHandler {
	return &HarborHandler{
		harborUsecase:          harborUsecase,
		imageDeploymentUsecase: imageDeploymentUsecase,
	}
}

// Registry Management

// CreateRegistry godoc
// @Summary Create Harbor registry
// @Description Register a new Harbor registry
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry body domain.HarborRegistry true "Harbor registry object"
// @Success 201 {object} domain.HarborRegistry
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries [post]
func (h *HarborHandler) CreateRegistry(c *gin.Context) {
	var registry domain.HarborRegistry
	if err := c.ShouldBindJSON(&registry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.harborUsecase.CreateRegistry(c.Request.Context(), &registry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, registry)
}

// ListRegistries godoc
// @Summary List Harbor registries
// @Description Get a list of Harbor registries
// @Tags harbor
// @Accept json
// @Produce json
// @Param is_active query boolean false "Filter by active status"
// @Param is_default query boolean false "Filter by default status"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries [get]
func (h *HarborHandler) ListRegistries(c *gin.Context) {
	var filter domain.HarborRegistryFilter

	if isActive := c.Query("is_active"); isActive != "" {
		active := isActive == "true"
		filter.IsActive = &active
	}
	if isDefault := c.Query("is_default"); isDefault != "" {
		def := isDefault == "true"
		filter.IsDefault = &def
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	registries, total, err := h.harborUsecase.ListRegistries(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      registries,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetRegistry godoc
// @Summary Get Harbor registry
// @Description Get Harbor registry by ID
// @Tags harbor
// @Accept json
// @Produce json
// @Param id path string true "Registry ID"
// @Success 200 {object} domain.HarborRegistry
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{id} [get]
func (h *HarborHandler) GetRegistry(c *gin.Context) {
	id := c.Param("id")

	registry, err := h.harborUsecase.GetRegistry(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, registry)
}

// UpdateRegistry godoc
// @Summary Update Harbor registry
// @Description Update Harbor registry information
// @Tags harbor
// @Accept json
// @Produce json
// @Param id path string true "Registry ID"
// @Param registry body domain.HarborRegistry true "Harbor registry object"
// @Success 200 {object} domain.HarborRegistry
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{id} [put]
func (h *HarborHandler) UpdateRegistry(c *gin.Context) {
	id := c.Param("id")

	var registry domain.HarborRegistry
	if err := c.ShouldBindJSON(&registry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	registry.ID = id

	if err := h.harborUsecase.UpdateRegistry(c.Request.Context(), &registry); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, registry)
}

// DeleteRegistry godoc
// @Summary Delete Harbor registry
// @Description Delete a Harbor registry
// @Tags harbor
// @Accept json
// @Produce json
// @Param id path string true "Registry ID"
// @Success 204
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{id} [delete]
func (h *HarborHandler) DeleteRegistry(c *gin.Context) {
	id := c.Param("id")

	if err := h.harborUsecase.DeleteRegistry(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Project Management

// ListProjects godoc
// @Summary List Harbor projects
// @Description List all projects in a Harbor registry
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry_id path string true "Registry ID"
// @Param public query boolean false "Filter by public status"
// @Success 200 {array} domain.HarborProject
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{registry_id}/projects [get]
func (h *HarborHandler) ListProjects(c *gin.Context) {
	registryID := c.Param("registry_id")

	var public *bool
	if publicStr := c.Query("public"); publicStr != "" {
		p := publicStr == "true"
		public = &p
	}

	projects, err := h.harborUsecase.ListProjects(c.Request.Context(), registryID, public)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// Repository Management

// ListRepositories godoc
// @Summary List Harbor repositories
// @Description List all repositories in a Harbor project
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry_id path string true "Registry ID"
// @Param project_name query string true "Project name"
// @Success 200 {array} domain.HarborRepository
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{registry_id}/repositories [get]
func (h *HarborHandler) ListRepositories(c *gin.Context) {
	registryID := c.Param("registry_id")
	projectName := c.Query("project_name")

	repositories, err := h.harborUsecase.ListRepositories(c.Request.Context(), registryID, projectName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, repositories)
}

// Artifact Management

// ListArtifacts godoc
// @Summary List Harbor artifacts
// @Description List all artifacts in a Harbor repository
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry_id path string true "Registry ID"
// @Param repository_name query string true "Repository name"
// @Success 200 {array} domain.HarborArtifact
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{registry_id}/artifacts [get]
func (h *HarborHandler) ListArtifacts(c *gin.Context) {
	registryID := c.Param("registry_id")
	repositoryName := c.Query("repository_name")

	artifacts, err := h.harborUsecase.ListArtifacts(c.Request.Context(), registryID, repositoryName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, artifacts)
}

// Vulnerability Scanning

// ScanArtifact godoc
// @Summary Scan Harbor artifact
// @Description Trigger vulnerability scan for an artifact
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry_id path string true "Registry ID"
// @Param request body map[string]string true "Repository name and reference"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{registry_id}/scan [post]
func (h *HarborHandler) ScanArtifact(c *gin.Context) {
	registryID := c.Param("registry_id")

	var req struct {
		RepositoryName string `json:"repository_name" binding:"required"`
		Reference      string `json:"reference" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.harborUsecase.ScanArtifact(c.Request.Context(), registryID, req.RepositoryName, req.Reference); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Scan triggered successfully"})
}

// GetScanReport godoc
// @Summary Get scan report
// @Description Get vulnerability scan report for an artifact
// @Tags harbor
// @Accept json
// @Produce json
// @Param registry_id path string true "Registry ID"
// @Param repository_name query string true "Repository name"
// @Param reference query string true "Reference (tag or digest)"
// @Success 200 {object} domain.HarborScanOverview
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/registries/{registry_id}/scan-report [get]
func (h *HarborHandler) GetScanReport(c *gin.Context) {
	registryID := c.Param("registry_id")
	repositoryName := c.Query("repository_name")
	reference := c.Query("reference")

	report, err := h.harborUsecase.GetScanReport(c.Request.Context(), registryID, repositoryName, reference)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

// Image Deployment Tracking

// TrackDeployment godoc
// @Summary Track image deployment
// @Description Record a new image deployment to a cluster
// @Tags harbor
// @Accept json
// @Produce json
// @Param request body map[string]string true "Deployment details"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/deployments [post]
func (h *HarborHandler) TrackDeployment(c *gin.Context) {
	var req struct {
		ClusterID      string `json:"cluster_id" binding:"required"`
		Namespace      string `json:"namespace" binding:"required"`
		DeploymentName string `json:"deployment_name" binding:"required"`
		ContainerName  string `json:"container_name" binding:"required"`
		ImageRepo      string `json:"image_repo" binding:"required"`
		ImageTag       string `json:"image_tag" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user from context
	user := "system"

	if err := h.imageDeploymentUsecase.TrackDeployment(
		c.Request.Context(),
		req.ClusterID,
		req.Namespace,
		req.DeploymentName,
		req.ContainerName,
		req.ImageRepo,
		req.ImageTag,
		user,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Deployment tracked successfully"})
}

// GetDeploymentHistory godoc
// @Summary Get deployment history
// @Description Get history of image deployments for a workload
// @Tags harbor
// @Accept json
// @Produce json
// @Param cluster_id query string true "Cluster ID"
// @Param namespace query string true "Namespace"
// @Param deployment_name query string true "Deployment Name"
// @Success 200 {array} domain.ImageDeployment
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/deployments/history [get]
func (h *HarborHandler) GetDeploymentHistory(c *gin.Context) {
	clusterID := c.Query("cluster_id")
	namespace := c.Query("namespace")
	deploymentName := c.Query("deployment_name")

	history, err := h.imageDeploymentUsecase.GetDeploymentHistory(c.Request.Context(), clusterID, namespace, deploymentName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

// GetCurrentDeployments godoc
// @Summary Get current deployments
// @Description Get all currently active image deployments for a cluster
// @Tags harbor
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Success 200 {array} domain.ImageDeployment
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/deployments/{cluster_id}/active [get]
func (h *HarborHandler) GetCurrentDeployments(c *gin.Context) {
	clusterID := c.Param("cluster_id")

	deployments, err := h.imageDeploymentUsecase.GetCurrentDeployments(c.Request.Context(), clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// SyncDeployments godoc
// @Summary Sync deployments from K8s
// @Description Sync current deployment state from Kubernetes cluster
// @Tags harbor
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/harbor/deployments/{cluster_id}/sync [post]
func (h *HarborHandler) SyncDeployments(c *gin.Context) {
	clusterID := c.Param("cluster_id")

	if err := h.imageDeploymentUsecase.SyncDeploymentsFromK8s(c.Request.Context(), clusterID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sync triggered successfully"})
}
