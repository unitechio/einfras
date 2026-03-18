package usecase

import (
	"context"
)

// HarborUsecase defines the interface for Harbor operations
type HarborUsecase interface {
	// Add methods as needed
	ListProjects(ctx context.Context) (interface{}, error)
	CreateProject(ctx context.Context, config interface{}) error
}

// ImageDeploymentUsecase defines the interface for image deployment tracking
type ImageDeploymentUsecase interface {
	// Add methods as needed
	TrackDeployment(ctx context.Context, deployment interface{}) error
	ListDeployments(ctx context.Context) (interface{}, error)
}
