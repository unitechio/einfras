package usecase

import (
	"context"
)

// KubernetesUsecase defines the interface for Kubernetes operations
type KubernetesUsecase interface {
	// Add methods as needed
	ListClusters(ctx context.Context) (interface{}, error)
	CreateCluster(ctx context.Context, config interface{}) error
	GetCluster(ctx context.Context, clusterID string) (interface{}, error)
	DeleteCluster(ctx context.Context, clusterID string) error
}

// K8sBackupUsecase defines the interface for Kubernetes backup operations
type K8sBackupUsecase interface {
	// Add methods as needed
	CreateBackup(ctx context.Context, clusterID string) error
	RestoreBackup(ctx context.Context, backupID string) error
}
