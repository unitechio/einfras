package usecase

import (
	"context"
	"fmt"
	"io"

	"einfra/api/pkg/docker"
)

// DockerImageUsecase handles Docker image operations
type DockerImageUsecase interface {
	BuildImage(ctx context.Context, dockerfile string, context io.Reader, tags []string) (io.ReadCloser, error)
	PushImage(ctx context.Context, image string, authConfig docker.AuthConfig) (io.ReadCloser, error)
	PullImage(ctx context.Context, image string, authConfig docker.AuthConfig) (io.ReadCloser, error)
	RemoveImage(ctx context.Context, imageID string, force bool) ([]string, error)
	InspectImage(ctx context.Context, imageID string) (map[string]interface{}, error)
}

type dockerImageUsecase struct {
	dockerClient *docker.Client
}

// NewDockerImageUsecase creates a new Docker image usecase
func NewDockerImageUsecase(dockerClient *docker.Client) DockerImageUsecase {
	return &dockerImageUsecase{
		dockerClient: dockerClient,
	}
}

// BuildImage builds an image from a Dockerfile
func (u *dockerImageUsecase) BuildImage(ctx context.Context, dockerfile string, context io.Reader, tags []string) (io.ReadCloser, error) {
	if context == nil {
		return nil, fmt.Errorf("build context is required")
	}

	config := docker.BuildConfig{
		Dockerfile: dockerfile,
		Context:    context,
		Tags:       tags,
		NoCache:    false,
	}

	return u.dockerClient.ImageBuild(ctx, config)
}

// PushImage pushes an image to a registry
func (u *dockerImageUsecase) PushImage(ctx context.Context, image string, authConfig docker.AuthConfig) (io.ReadCloser, error) {
	if image == "" {
		return nil, fmt.Errorf("image name is required")
	}

	return u.dockerClient.ImagePush(ctx, image, authConfig)
}

// PullImage pulls an image from a registry
func (u *dockerImageUsecase) PullImage(ctx context.Context, image string, authConfig docker.AuthConfig) (io.ReadCloser, error) {
	if image == "" {
		return nil, fmt.Errorf("image name is required")
	}

	return u.dockerClient.ImagePull(ctx, image, authConfig)
}

// RemoveImage removes an image
func (u *dockerImageUsecase) RemoveImage(ctx context.Context, imageID string, force bool) ([]string, error) {
	if imageID == "" {
		return nil, fmt.Errorf("image ID is required")
	}

	return u.dockerClient.ImageRemove(ctx, imageID, force)
}

// InspectImage inspects an image
func (u *dockerImageUsecase) InspectImage(ctx context.Context, imageID string) (map[string]interface{}, error) {
	if imageID == "" {
		return nil, fmt.Errorf("image ID is required")
	}

	return u.dockerClient.ImageInspect(ctx, imageID)
}
