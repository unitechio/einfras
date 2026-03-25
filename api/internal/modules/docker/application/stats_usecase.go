//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/pkg/docker"
)

// DockerStatsUsecase handles container stats operations
type DockerStatsUsecase interface {
	GetStatsStream(ctx context.Context, containerID string) (<-chan *docker.ContainerStats, <-chan error, error)
	GetStatsOnce(ctx context.Context, containerID string) (*docker.ContainerStats, error)
	PauseContainer(ctx context.Context, containerID string) error
	UnpauseContainer(ctx context.Context, containerID string) error
	CommitContainer(ctx context.Context, config docker.ContainerCommitConfig) (string, error)
}

type dockerStatsUsecase struct {
	dockerClient *docker.Client
}

// NewDockerStatsUsecase creates a new docker stats usecase
func NewDockerStatsUsecase(dockerClient *docker.Client) DockerStatsUsecase {
	return &dockerStatsUsecase{
		dockerClient: dockerClient,
	}
}

// GetStatsStream gets container stats as a stream
func (u *dockerStatsUsecase) GetStatsStream(ctx context.Context, containerID string) (<-chan *docker.ContainerStats, <-chan error, error) {
	if containerID == "" {
		return nil, nil, fmt.Errorf("container ID is required")
	}

	statsChan, errChan, err := u.dockerClient.ContainerStatsStream(ctx, containerID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get stats stream: %w", err)
	}

	return statsChan, errChan, nil
}

// GetStatsOnce gets container stats once (not streaming)
func (u *dockerStatsUsecase) GetStatsOnce(ctx context.Context, containerID string) (*docker.ContainerStats, error) {
	if containerID == "" {
		return nil, fmt.Errorf("container ID is required")
	}

	stats, err := u.dockerClient.ContainerStatsOnce(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	return stats, nil
}

// PauseContainer pauses a running container
func (u *dockerStatsUsecase) PauseContainer(ctx context.Context, containerID string) error {
	if containerID == "" {
		return fmt.Errorf("container ID is required")
	}

	if err := u.dockerClient.ContainerPause(ctx, containerID); err != nil {
		return fmt.Errorf("failed to pause container: %w", err)
	}

	return nil
}

// UnpauseContainer unpauses a paused container
func (u *dockerStatsUsecase) UnpauseContainer(ctx context.Context, containerID string) error {
	if containerID == "" {
		return fmt.Errorf("container ID is required")
	}

	if err := u.dockerClient.ContainerUnpause(ctx, containerID); err != nil {
		return fmt.Errorf("failed to unpause container: %w", err)
	}

	return nil
}

// CommitContainer commits a container to create a new image
func (u *dockerStatsUsecase) CommitContainer(ctx context.Context, config docker.ContainerCommitConfig) (string, error) {
	if config.ContainerID == "" {
		return "", fmt.Errorf("container ID is required")
	}

	if config.Repository == "" {
		return "", fmt.Errorf("repository name is required")
	}

	if config.Tag == "" {
		config.Tag = "latest"
	}

	imageID, err := u.dockerClient.ContainerCommit(ctx, config)
	if err != nil {
		return "", fmt.Errorf("failed to commit container: %w", err)
	}

	return imageID, nil
}
