//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"einfra/api/pkg/docker"
)

// DockerComposeUsecase handles Docker Compose/Stack operations
type DockerComposeUsecase interface {
	// Stack operations
	DeployStack(ctx context.Context, serverID string, config docker.StackDeployConfig) error
	ListStacks(ctx context.Context, serverID string) ([]string, error)
	RemoveStack(ctx context.Context, serverID string, stackName string) error
	GetStackServices(ctx context.Context, serverID string, stackName string) ([]domain.SwarmService, error)
	GetStackTasks(ctx context.Context, serverID string, stackName string) ([]domain.SwarmTask, error)

	// Compose operations
	ValidateCompose(composeData []byte) error
	ConvertCompose(composeData []byte) (interface{}, error)
	ComposeUp(ctx context.Context, serverID string, projectName string, composeData []byte) error
	ComposeDown(ctx context.Context, serverID string, projectName string) error
	GetComposeLogs(ctx context.Context, serverID string, projectName string, tail string, follow bool) ([]byte, error)
}

type dockerComposeUsecase struct {
	serverRepo domain.ServerRepository
}

// NewDockerComposeUsecase creates a new Docker Compose usecase
func NewDockerComposeUsecase(serverRepo domain.ServerRepository) DockerComposeUsecase {
	return &dockerComposeUsecase{
		serverRepo: serverRepo,
	}
}

func (u *dockerComposeUsecase) getDockerClient(ctx context.Context, serverID string) (*docker.Client, error) {
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

func (u *dockerComposeUsecase) DeployStack(ctx context.Context, serverID string, config docker.StackDeployConfig) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.StackDeploy(ctx, config)
}

func (u *dockerComposeUsecase) ListStacks(ctx context.Context, serverID string) ([]string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.StackList(ctx)
}

func (u *dockerComposeUsecase) RemoveStack(ctx context.Context, serverID string, stackName string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.StackRemove(ctx, stackName)
}

func (u *dockerComposeUsecase) GetStackServices(ctx context.Context, serverID string, stackName string) ([]domain.SwarmService, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	services, err := client.StackServices(ctx, stackName)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmService, len(services))
	for i, svc := range services {
		result[i] = domain.SwarmService{
			ID:        svc.ID,
			Name:      svc.Spec.Name,
			Image:     svc.Spec.TaskTemplate.ContainerSpec.Image,
			CreatedAt: svc.CreatedAt,
			UpdatedAt: svc.UpdatedAt,
		}
	}

	return result, nil
}

func (u *dockerComposeUsecase) GetStackTasks(ctx context.Context, serverID string, stackName string) ([]domain.SwarmTask, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	tasks, err := client.StackPS(ctx, stackName)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmTask, len(tasks))
	for i, task := range tasks {
		result[i] = domain.SwarmTask{
			ID:           task.ID,
			ServiceID:    task.ServiceID,
			NodeID:       task.NodeID,
			DesiredState: string(task.DesiredState),
			State:        string(task.Status.State),
			CreatedAt:    task.CreatedAt,
		}
	}

	return result, nil
}

func (u *dockerComposeUsecase) ValidateCompose(composeData []byte) error {
	return docker.ComposeValidate(composeData)
}

func (u *dockerComposeUsecase) ConvertCompose(composeData []byte) (interface{}, error) {
	return docker.ComposeConvert(composeData)
}

func (u *dockerComposeUsecase) ComposeUp(ctx context.Context, serverID string, projectName string, composeData []byte) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ComposeUp(ctx, projectName, composeData)
}

func (u *dockerComposeUsecase) ComposeDown(ctx context.Context, serverID string, projectName string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ComposeDown(ctx, projectName)
}

func (u *dockerComposeUsecase) GetComposeLogs(ctx context.Context, serverID string, projectName string, tail string, follow bool) ([]byte, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	reader, err := client.ComposeLogs(ctx, projectName, tail, follow)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	// Read all logs
	logs := make([]byte, 0)
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			logs = append(logs, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	return logs, nil
}
