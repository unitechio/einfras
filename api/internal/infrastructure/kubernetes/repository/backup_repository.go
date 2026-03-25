//go:build legacy
// +build legacy

package repository

import (
	"context"
	"errors"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type k8sBackupRepository struct {
	db *gorm.DB
}

// NewK8sBackupRepository creates a new K8s backup repository
func NewK8sBackupRepository(db *gorm.DB) domain.K8sBackupRepository {
	return &k8sBackupRepository{
		db: db,
	}
}

// Create creates a new backup record
func (r *k8sBackupRepository) Create(ctx context.Context, backup *domain.K8sBackup) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(backup).Error; err != nil {
			return err
		}

		if len(backup.Resources) > 0 {
			if err := tx.Create(&backup.Resources).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// GetByID retrieves a backup by ID
func (r *k8sBackupRepository) GetByID(ctx context.Context, id string) (*domain.K8sBackup, error) {
	var backup domain.K8sBackup
	if err := r.db.WithContext(ctx).Preload("Resources").First(&backup, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &backup, nil
}

// List retrieves all backups for a cluster
func (r *k8sBackupRepository) List(ctx context.Context, clusterID, namespace string) ([]*domain.K8sBackup, error) {
	var backups []*domain.K8sBackup
	query := r.db.WithContext(ctx).Where("cluster_id = ?", clusterID)
	if namespace != "" {
		query = query.Where("namespace = ?", namespace)
	}
	if err := query.Order("created_at DESC").Find(&backups).Error; err != nil {
		return nil, err
	}
	return backups, nil
}

// Delete deletes a backup
func (r *k8sBackupRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.K8sBackup{}, "id = ?", id).Error
}
