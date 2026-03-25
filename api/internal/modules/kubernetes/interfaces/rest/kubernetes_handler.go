//go:build legacy
// +build legacy

package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
)

type KubernetesHandler struct {
	k8sUsecase    domain.KubernetesUsecase
	backupUsecase domain.K8sBackupUsecase
}

// NewKubernetesHandler creates a new Kubernetes handler instance
func NewKubernetesHandler(
	k8sUsecase domain.KubernetesUsecase,
	backupUsecase domain.K8sBackupUsecase,
) *KubernetesHandler {
	return &KubernetesHandler{
		k8sUsecase:    k8sUsecase,
		backupUsecase: backupUsecase,
	}
}

// Cluster Management

// CreateCluster godoc
// @Summary Create Kubernetes cluster
// @Description Register a new Kubernetes cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster body domain.K8sCluster true "Kubernetes cluster object"
// @Success 201 {object} domain.K8sCluster
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters [post]
func (h *KubernetesHandler) CreateCluster(c *gin.Context) {
	var cluster domain.K8sCluster
	if err := c.ShouldBindJSON(&cluster); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.k8sUsecase.CreateCluster(c.Request.Context(), &cluster); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cluster)
}

// ListClusters godoc
// @Summary List Kubernetes clusters
// @Description Get a list of Kubernetes clusters
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param provider query string false "Filter by provider"
// @Param region query string false "Filter by region"
// @Param is_active query boolean false "Filter by active status"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters [get]
func (h *KubernetesHandler) ListClusters(c *gin.Context) {
	var filter domain.K8sClusterFilter

	filter.Provider = c.Query("provider")
	filter.Region = c.Query("region")
	if isActive := c.Query("is_active"); isActive != "" {
		active := isActive == "true"
		filter.IsActive = &active
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filter.Page = page
	filter.PageSize = pageSize

	clusters, total, err := h.k8sUsecase.ListClusters(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      clusters,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetCluster godoc
// @Summary Get Kubernetes cluster
// @Description Get Kubernetes cluster by ID
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param id path string true "Cluster ID"
// @Success 200 {object} domain.K8sCluster
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{id} [get]
func (h *KubernetesHandler) GetCluster(c *gin.Context) {
	id := c.Param("id")

	cluster, err := h.k8sUsecase.GetCluster(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cluster)
}

// UpdateCluster godoc
// @Summary Update Kubernetes cluster
// @Description Update Kubernetes cluster information
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param id path string true "Cluster ID"
// @Param cluster body domain.K8sCluster true "Kubernetes cluster object"
// @Success 200 {object} domain.K8sCluster
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{id} [put]
func (h *KubernetesHandler) UpdateCluster(c *gin.Context) {
	id := c.Param("id")

	var cluster domain.K8sCluster
	if err := c.ShouldBindJSON(&cluster); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster.ID = id

	if err := h.k8sUsecase.UpdateCluster(c.Request.Context(), &cluster); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cluster)
}

// DeleteCluster godoc
// @Summary Delete Kubernetes cluster
// @Description Delete a Kubernetes cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param id path string true "Cluster ID"
// @Success 204
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{id} [delete]
func (h *KubernetesHandler) DeleteCluster(c *gin.Context) {
	id := c.Param("id")

	if err := h.k8sUsecase.DeleteCluster(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// Namespace Management

// ListNamespaces godoc
// @Summary List namespaces
// @Description List all namespaces in a Kubernetes cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Success 200 {array} domain.K8sNamespace
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/namespaces [get]
func (h *KubernetesHandler) ListNamespaces(c *gin.Context) {
	clusterID := c.Param("cluster_id")

	namespaces, err := h.k8sUsecase.ListNamespaces(c.Request.Context(), clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// Deployment Management

// ListDeployments godoc
// @Summary List deployments
// @Description List all deployments in a namespace
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Namespace (default: all namespaces)"
// @Success 200 {array} domain.K8sDeployment
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/deployments [get]
func (h *KubernetesHandler) ListDeployments(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.DefaultQuery("namespace", "")

	deployments, err := h.k8sUsecase.ListDeployments(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// ScaleDeployment godoc
// @Summary Scale deployment
// @Description Scale a Kubernetes deployment
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace path string true "Namespace"
// @Param name path string true "Deployment name"
// @Param request body map[string]int32 true "Replicas count"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/namespaces/{namespace}/deployments/{name}/scale [post]
func (h *KubernetesHandler) ScaleDeployment(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.Param("namespace")
	name := c.Param("name")

	var req struct {
		Replicas int32 `json:"replicas" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.k8sUsecase.ScaleDeployment(c.Request.Context(), clusterID, namespace, name, req.Replicas); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deployment scaled successfully"})
}

// Pod Management

// ListPods godoc
// @Summary List pods
// @Description List all pods in a namespace
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Namespace (default: all namespaces)"
// @Success 200 {array} domain.K8sPod
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/pods [get]
func (h *KubernetesHandler) ListPods(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.DefaultQuery("namespace", "")

	pods, err := h.k8sUsecase.ListPods(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pods)
}

// GetPodLogs godoc
// @Summary Get pod logs
// @Description Get logs from a Kubernetes pod
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace path string true "Namespace"
// @Param pod_name path string true "Pod name"
// @Param container query string false "Container name"
// @Param tail query int false "Number of lines to show from the end of the logs" default(100)
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/namespaces/{namespace}/pods/{pod_name}/logs [get]
func (h *KubernetesHandler) GetPodLogs(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.Param("namespace")
	podName := c.Param("pod_name")
	container := c.DefaultQuery("container", "")
	tail, _ := strconv.Atoi(c.DefaultQuery("tail", "100"))

	logs, err := h.k8sUsecase.GetPodLogs(c.Request.Context(), clusterID, namespace, podName, container, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// Node Management

// ListNodes godoc
// @Summary List nodes
// @Description List all nodes in a Kubernetes cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Success 200 {array} domain.K8sNode
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/nodes [get]
func (h *KubernetesHandler) ListNodes(c *gin.Context) {
	clusterID := c.Param("cluster_id")

	nodes, err := h.k8sUsecase.ListNodes(c.Request.Context(), clusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, nodes)
}

// ConfigMap Management

// ListConfigMaps godoc
// @Summary List ConfigMaps
// @Description List all ConfigMaps in a namespace
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Namespace (default: all namespaces)"
// @Success 200 {array} domain.K8sConfigMap
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/configmaps [get]
func (h *KubernetesHandler) ListConfigMaps(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.DefaultQuery("namespace", "")

	configMaps, err := h.k8sUsecase.ListConfigMaps(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, configMaps)
}

// Secret Management

// ListSecrets godoc
// @Summary List Secrets
// @Description List all Secrets in a namespace
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Namespace (default: all namespaces)"
// @Success 200 {array} domain.K8sSecret
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/secrets [get]
func (h *KubernetesHandler) ListSecrets(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.DefaultQuery("namespace", "")

	secrets, err := h.k8sUsecase.ListSecrets(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, secrets)
}

// Ingress Management

// ListIngresses godoc
// @Summary List Ingresses
// @Description List all Ingresses in a namespace
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Namespace (default: all namespaces)"
// @Success 200 {array} domain.K8sIngress
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/ingresses [get]
func (h *KubernetesHandler) ListIngresses(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.DefaultQuery("namespace", "")

	ingresses, err := h.k8sUsecase.ListIngresses(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ingresses)
}

// Backup Management

// CreateBackup godoc
// @Summary Create K8s backup
// @Description Create a backup of Kubernetes resources
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param request body map[string]string true "Backup details"
// @Success 201 {object} domain.K8sBackup
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/backups [post]
func (h *KubernetesHandler) CreateBackup(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	var req struct {
		Namespace   string `json:"namespace" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: Get user from context
	user := "system"

	backup, err := h.backupUsecase.BackupNamespace(c.Request.Context(), clusterID, req.Namespace, req.Name, req.Description, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, backup)
}

// ListBackups godoc
// @Summary List K8s backups
// @Description List all backups for a cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param cluster_id path string true "Cluster ID"
// @Param namespace query string false "Filter by namespace"
// @Success 200 {array} domain.K8sBackup
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/clusters/{cluster_id}/backups [get]
func (h *KubernetesHandler) ListBackups(c *gin.Context) {
	clusterID := c.Param("cluster_id")
	namespace := c.Query("namespace")

	backups, err := h.backupUsecase.ListBackups(c.Request.Context(), clusterID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, backups)
}

// RestoreBackup godoc
// @Summary Restore K8s backup
// @Description Restore a backup to the cluster
// @Tags kubernetes
// @Accept json
// @Produce json
// @Param id path string true "Backup ID"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/kubernetes/backups/{id}/restore [post]
func (h *KubernetesHandler) RestoreBackup(c *gin.Context) {
	id := c.Param("id")

	// TODO: Get user from context
	user := "system"

	if err := h.backupUsecase.RestoreBackup(c.Request.Context(), id, user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup restore triggered successfully"})
}
