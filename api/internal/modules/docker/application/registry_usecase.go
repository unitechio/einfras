//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"einfra/api/pkg/docker"
)

// DockerRegistryUsecase handles Docker Registry operations
type DockerRegistryUsecase interface {
	// Registry operations
	LoginRegistry(ctx context.Context, serverID string, auth docker.RegistryAuth) error
	SearchRegistry(ctx context.Context, serverID string, term string, limit int, auth *docker.RegistryAuth) ([]docker.RegistrySearchResult, error)
	PullImage(ctx context.Context, serverID string, imageName string, auth *docker.RegistryAuth) error
	PushImage(ctx context.Context, serverID string, imageName string, auth *docker.RegistryAuth) error
	TagImage(ctx context.Context, serverID string, sourceImage, targetRegistry, targetRepo, targetTag string) error
	DeployFromRegistry(ctx context.Context, serverID string, config docker.ContainerCreateConfig, auth *docker.RegistryAuth) (string, error)

	// Registry management
	AddRegistry(ctx context.Context, config docker.RegistryConfig) error
	ListRegistries(ctx context.Context) ([]docker.RegistryConfig, error)
	RemoveRegistry(ctx context.Context, registryID string) error
}

type dockerRegistryUsecase struct {
	serverRepo domain.ServerRepository
}

// NewDockerRegistryUsecase creates a new Docker Registry usecase
func NewDockerRegistryUsecase(serverRepo domain.ServerRepository) DockerRegistryUsecase {
	return &dockerRegistryUsecase{
		serverRepo: serverRepo,
	}
}

func (u *dockerRegistryUsecase) getDockerClient(ctx context.Context, serverID string) (*docker.Client, error) {
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	if server.DockerClient == nil {
		return nil, fmt.Errorf("server does not have Docker client configured")
	}

	client, ok := server.DockerClient.(*docker.Client)
	if !ok {
		return nil, fmt.Errorf("invalid Docker client type")
	}

	return client, nil
}

func (u *dockerRegistryUsecase) LoginRegistry(ctx context.Context, serverID string, auth docker.RegistryAuth) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.RegistryLogin(ctx, auth)
}

func (u *dockerRegistryUsecase) SearchRegistry(ctx context.Context, serverID string, term string, limit int, auth *docker.RegistryAuth) ([]docker.RegistrySearchResult, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.RegistrySearch(ctx, term, limit, auth)
}

func (u *dockerRegistryUsecase) PullImage(ctx context.Context, serverID string, imageName string, auth *docker.RegistryAuth) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	reader, err := client.RegistryPullImage(ctx, imageName, auth)
	if err != nil {
		return err
	}
	defer reader.Close()

	// Read and discard output (could be logged)
	buf := make([]byte, 4096)
	for {
		_, err := reader.Read(buf)
		if err != nil {
			break
		}
	}

	return nil
}

func (u *dockerRegistryUsecase) PushImage(ctx context.Context, serverID string, imageName string, auth *docker.RegistryAuth) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	reader, err := client.RegistryPushImage(ctx, imageName, auth)
	if err != nil {
		return err
	}
	defer reader.Close()

	// Read and discard output
	buf := make([]byte, 4096)
	for {
		_, err := reader.Read(buf)
		if err != nil {
			break
		}
	}

	return nil
}

func (u *dockerRegistryUsecase) TagImage(ctx context.Context, serverID string, sourceImage, targetRegistry, targetRepo, targetTag string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.RegistryTagImage(ctx, sourceImage, targetRegistry, targetRepo, targetTag)
}

func (u *dockerRegistryUsecase) DeployFromRegistry(ctx context.Context, serverID string, config docker.ContainerCreateConfig, auth *docker.RegistryAuth) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.RegistryDeployImage(ctx, config, auth)
}

// Registry management (would typically be stored in database)
func (u *dockerRegistryUsecase) AddRegistry(ctx context.Context, config docker.RegistryConfig) error {
	// TODO: Store in database
	return nil
}

func (u *dockerRegistryUsecase) ListRegistries(ctx context.Context) ([]docker.RegistryConfig, error) {
	// TODO: Retrieve from database
	return []docker.RegistryConfig{}, nil
}

func (u *dockerRegistryUsecase) RemoveRegistry(ctx context.Context, registryID string) error {
	// TODO: Remove from database
	return nil
}
