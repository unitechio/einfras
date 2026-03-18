package repository

import (
	"context"
	"errors"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type k8sClusterRepository struct {
	db *gorm.DB
}

// NewK8sClusterRepository creates a new Kubernetes cluster repository instance
func NewK8sClusterRepository(db *gorm.DB) domain.K8sClusterRepository {
	return &k8sClusterRepository{db: db}
}

// Create creates a new Kubernetes cluster record
func (r *k8sClusterRepository) Create(ctx context.Context, cluster *domain.K8sCluster) error {
	return r.db.WithContext(ctx).Create(cluster).Error
}

// GetByID retrieves a cluster by ID
func (r *k8sClusterRepository) GetByID(ctx context.Context, id string) (*domain.K8sCluster, error) {
	var cluster domain.K8sCluster
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&cluster).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("kubernetes cluster not found")
		}
		return nil, err
	}
	return &cluster, nil
}

// List retrieves all clusters with filtering
func (r *k8sClusterRepository) List(ctx context.Context, filter domain.K8sClusterFilter) ([]*domain.K8sCluster, int64, error) {
	var clusters []*domain.K8sCluster
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.K8sCluster{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.Provider != "" {
		query = query.Where("provider = ?", filter.Provider)
	}
	if filter.Region != "" {
		query = query.Where("region = ?", filter.Region)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	if filter.Page > 0 && filter.PageSize > 0 {
		offset := (filter.Page - 1) * filter.PageSize
		query = query.Offset(offset).Limit(filter.PageSize)
	}

	// Execute query
	if err := query.Order("created_at DESC").Find(&clusters).Error; err != nil {
		return nil, 0, err
	}

	return clusters, total, nil
}

// Update updates a cluster
func (r *k8sClusterRepository) Update(ctx context.Context, cluster *domain.K8sCluster) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", cluster.ID).
		Updates(cluster)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("kubernetes cluster not found or already deleted")
	}
	return nil
}

// Delete soft deletes a cluster
func (r *k8sClusterRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.K8sCluster{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("kubernetes cluster not found or already deleted")
	}
	return nil
}
