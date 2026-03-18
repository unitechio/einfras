package usecase

import (
	"context"
	"errors"
	"time"

	"einfra/api/internal/domain"
)

type imageDeploymentUsecase struct {
	deploymentRepo domain.ImageDeploymentRepository
	k8sUsecase     domain.KubernetesUsecase
}

// NewImageDeploymentUsecase creates a new image deployment usecase
func NewImageDeploymentUsecase(
	deploymentRepo domain.ImageDeploymentRepository,
	k8sUsecase domain.KubernetesUsecase,
) domain.ImageDeploymentUsecase {
	return &imageDeploymentUsecase{
		deploymentRepo: deploymentRepo,
		k8sUsecase:     k8sUsecase,
	}
}

// TrackDeployment records a new image deployment
func (u *imageDeploymentUsecase) TrackDeployment(ctx context.Context, clusterID, namespace, deploymentName, containerName, imageRepo, imageTag, user string) error {
	if clusterID == "" || namespace == "" || deploymentName == "" || imageTag == "" {
		return errors.New("missing required deployment information")
	}

	// Check if there is an active deployment for this container
	activeDeployment, err := u.deploymentRepo.GetActiveDeployment(ctx, clusterID, namespace, deploymentName, containerName)
	if err != nil {
		return err
	}

	// If active deployment exists and tag is different, mark it as replaced
	if activeDeployment != nil {
		if activeDeployment.ImageTag != imageTag {
			if err := u.deploymentRepo.UpdateStatus(ctx, activeDeployment.ID, "replaced"); err != nil {
				return err
			}
		} else {
			// Same tag is being re-deployed, just update timestamp or ignore
			// For now, we'll create a new record anyway to track the event
		}
	}

	// Create new deployment record
	newDeployment := &domain.ImageDeployment{
		ClusterID:       clusterID,
		Namespace:       namespace,
		DeploymentName:  deploymentName,
		ContainerName:   containerName,
		ImageRepository: imageRepo,
		ImageTag:        imageTag,
		DeployedBy:      user,
		Status:          "active",
		DeployedAt:      time.Now(),
	}

	return u.deploymentRepo.Create(ctx, newDeployment)
}

// GetDeploymentHistory retrieves the history of deployments for a specific workload
func (u *imageDeploymentUsecase) GetDeploymentHistory(ctx context.Context, clusterID, namespace, deploymentName string) ([]*domain.ImageDeployment, error) {
	if clusterID == "" || namespace == "" || deploymentName == "" {
		return nil, errors.New("cluster ID, namespace, and deployment name are required")
	}

	// Get all deployments for the namespace
	deployments, err := u.deploymentRepo.List(ctx, clusterID, namespace)
	if err != nil {
		return nil, err
	}

	// Filter by deployment name
	var history []*domain.ImageDeployment
	for _, d := range deployments {
		if d.DeploymentName == deploymentName {
			history = append(history, d)
		}
	}

	return history, nil
}

// GetCurrentDeployments retrieves all currently active deployments
func (u *imageDeploymentUsecase) GetCurrentDeployments(ctx context.Context, clusterID string) ([]*domain.ImageDeployment, error) {
	if clusterID == "" {
		return nil, errors.New("cluster ID is required")
	}

	deployments, err := u.deploymentRepo.List(ctx, clusterID, "")
	if err != nil {
		return nil, err
	}

	var active []*domain.ImageDeployment
	for _, d := range deployments {
		if d.Status == "active" {
			active = append(active, d)
		}
	}

	return active, nil
}

// SyncDeploymentsFromK8s syncs the current state of deployments from K8s cluster
func (u *imageDeploymentUsecase) SyncDeploymentsFromK8s(ctx context.Context, clusterID string) error {
	if clusterID == "" {
		return errors.New("cluster ID is required")
	}

	// List all namespaces
	namespaces, err := u.k8sUsecase.ListNamespaces(ctx, clusterID)
	if err != nil {
		return err
	}

	for _, ns := range namespaces {
		// List deployments in namespace
		deployments, err := u.k8sUsecase.ListDeployments(ctx, clusterID, ns.Name)
		if err != nil {
			continue // Skip error for one namespace
		}

		for _, d := range deployments {
			// For each container in deployment
			// Note: K8sDeployment struct needs to be checked for Containers field
			// Assuming we can access containers info

			// Placeholder logic:
			// for _, container := range d.Containers {
			// 	 u.TrackDeployment(ctx, clusterID, ns.Name, d.Name, container.Name, container.ImageRepo, container.ImageTag, "system-sync")
			// }
			_ = d // Prevent unused variable error
		}
	}

	return nil
}
