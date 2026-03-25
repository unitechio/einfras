//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/pkg/docker"
)

// DockerNetworkUsecase handles Docker network operations
type DockerNetworkUsecase interface {
	ConnectContainer(ctx context.Context, networkID, containerID string) error
	DisconnectContainer(ctx context.Context, networkID, containerID string) error
	CreateNetwork(ctx context.Context, name, driver string) (string, error)
	RemoveNetwork(ctx context.Context, networkID string) error
	InspectNetwork(ctx context.Context, networkID string) (map[string]interface{}, error)
}

type dockerNetworkUsecase struct {
	dockerClient *docker.Client
}

// NewDockerNetworkUsecase creates a new Docker network usecase
func NewDockerNetworkUsecase(dockerClient *docker.Client) DockerNetworkUsecase {
	return &dockerNetworkUsecase{
		dockerClient: dockerClient,
	}
}

// ConnectContainer connects a container to a network
func (u *dockerNetworkUsecase) ConnectContainer(ctx context.Context, networkID, containerID string) error {
	if networkID == "" {
		return fmt.Errorf("network ID is required")
	}
	if containerID == "" {
		return fmt.Errorf("container ID is required")
	}

	if err := u.dockerClient.NetworkConnect(ctx, networkID, containerID); err != nil {
		return fmt.Errorf("failed to connect container to network: %w", err)
	}

	return nil
}

// DisconnectContainer disconnects a container from a network
func (u *dockerNetworkUsecase) DisconnectContainer(ctx context.Context, networkID, containerID string) error {
	if networkID == "" {
		return fmt.Errorf("network ID is required")
	}
	if containerID == "" {
		return fmt.Errorf("container ID is required")
	}

	if err := u.dockerClient.NetworkDisconnect(ctx, networkID, containerID); err != nil {
		return fmt.Errorf("failed to disconnect container from network: %w", err)
	}

	return nil
}

// CreateNetwork creates a new network
func (u *dockerNetworkUsecase) CreateNetwork(ctx context.Context, name, driver string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("network name is required")
	}
	if driver == "" {
		driver = "bridge"
	}

	id, err := u.dockerClient.NetworkCreate(ctx, name, driver)
	if err != nil {
		return "", fmt.Errorf("failed to create network: %w", err)
	}

	return id, nil
}

// RemoveNetwork removes a network
func (u *dockerNetworkUsecase) RemoveNetwork(ctx context.Context, networkID string) error {
	if networkID == "" {
		return fmt.Errorf("network ID is required")
	}

	if err := u.dockerClient.NetworkRemove(ctx, networkID); err != nil {
		return fmt.Errorf("failed to remove network: %w", err)
	}

	return nil
}

// InspectNetwork inspects a network
func (u *dockerNetworkUsecase) InspectNetwork(ctx context.Context, networkID string) (map[string]interface{}, error) {
	if networkID == "" {
		return nil, fmt.Errorf("network ID is required")
	}

	info, err := u.dockerClient.NetworkInspect(ctx, networkID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect network: %w", err)
	}

	return info, nil
}
