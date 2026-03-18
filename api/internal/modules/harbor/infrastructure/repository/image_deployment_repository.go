package repository

import (
	"context"
	"errors"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type imageDeploymentRepository struct {
	db *gorm.DB
}

// NewImageDeploymentRepository creates a new image deployment repository
func NewImageDeploymentRepository(db *gorm.DB) domain.ImageDeploymentRepository {
	return &imageDeploymentRepository{
		db: db,
	}
}

// Create creates a new image deployment record
func (r *imageDeploymentRepository) Create(ctx context.Context, deployment *domain.ImageDeployment) error {
	return r.db.WithContext(ctx).Create(deployment).Error
}

// GetByID retrieves a deployment by ID
func (r *imageDeploymentRepository) GetByID(ctx context.Context, id string) (*domain.ImageDeployment, error) {
	var deployment domain.ImageDeployment
	if err := r.db.WithContext(ctx).First(&deployment, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &deployment, nil
}

// List retrieves deployments for a cluster and namespace
func (r *imageDeploymentRepository) List(ctx context.Context, clusterID, namespace string) ([]*domain.ImageDeployment, error) {
	var deployments []*domain.ImageDeployment
	query := r.db.WithContext(ctx).Where("cluster_id = ?", clusterID)
	if namespace != "" {
		query = query.Where("namespace = ?", namespace)
	}
	if err := query.Order("deployed_at DESC").Find(&deployments).Error; err != nil {
		return nil, err
	}
	return deployments, nil
}

// GetActiveDeployment retrieves the currently active deployment for a container
func (r *imageDeploymentRepository) GetActiveDeployment(ctx context.Context, clusterID, namespace, deploymentName, containerName string) (*domain.ImageDeployment, error) {
	var deployment domain.ImageDeployment
	err := r.db.WithContext(ctx).
		Where("cluster_id = ? AND namespace = ? AND deployment_name = ? AND container_name = ? AND status = 'active'",
			clusterID, namespace, deploymentName, containerName).
		Order("deployed_at DESC").
		First(&deployment).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &deployment, nil
}

// UpdateStatus updates the status of a deployment
func (r *imageDeploymentRepository) UpdateStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&domain.ImageDeployment{}).Where("id = ?", id).Update("status", status).Error
}
