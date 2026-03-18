package usecase

import (
	"context"
	"fmt"

	"einfra/api/pkg/docker"
)

// DockerExecUsecase handles container exec operations
type DockerExecUsecase interface {
	CreateExec(ctx context.Context, containerID string, cmd []string, tty bool) (string, error)
	StartExec(ctx context.Context, execID string, tty bool) ([]byte, error)
	InspectExec(ctx context.Context, execID string) (map[string]interface{}, error)
	ResizeExec(ctx context.Context, execID string, height, width uint) error
	ExecuteCommand(ctx context.Context, containerID string, cmd []string) (*docker.ExecResult, error)
}

type dockerExecUsecase struct {
	dockerClient *docker.Client
}

// NewDockerExecUsecase creates a new docker exec usecase
func NewDockerExecUsecase(dockerClient *docker.Client) DockerExecUsecase {
	return &dockerExecUsecase{
		dockerClient: dockerClient,
	}
}

// CreateExec creates an exec instance in a container
func (u *dockerExecUsecase) CreateExec(ctx context.Context, containerID string, cmd []string, tty bool) (string, error) {
	if containerID == "" {
		return "", fmt.Errorf("container ID is required")
	}

	if len(cmd) == 0 {
		return "", fmt.Errorf("command is required")
	}

	config := docker.ExecConfig{
		ContainerID:  containerID,
		Cmd:          cmd,
		AttachStdin:  tty,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          tty,
	}

	execID, err := u.dockerClient.ContainerExec(ctx, config)
	if err != nil {
		return "", fmt.Errorf("failed to create exec: %w", err)
	}

	return execID, nil
}

// StartExec starts an exec instance
func (u *dockerExecUsecase) StartExec(ctx context.Context, execID string, tty bool) ([]byte, error) {
	if execID == "" {
		return nil, fmt.Errorf("exec ID is required")
	}

	config := docker.ExecStartConfig{
		Detach: false,
		Tty:    tty,
	}

	reader, err := u.dockerClient.ExecStart(ctx, execID, config)
	if err != nil {
		return nil, fmt.Errorf("failed to start exec: %w", err)
	}
	defer reader.Close()

	// Read all output
	output := make([]byte, 0)
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			output = append(output, buf[:n]...)
		}
		if err != nil {
			break
		}
	}

	return output, nil
}

// InspectExec returns information about an exec instance
func (u *dockerExecUsecase) InspectExec(ctx context.Context, execID string) (map[string]interface{}, error) {
	if execID == "" {
		return nil, fmt.Errorf("exec ID is required")
	}

	inspect, err := u.dockerClient.ExecInspect(ctx, execID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect exec: %w", err)
	}

	result := map[string]interface{}{
		"id":           inspect.ExecID,
		"running":      inspect.Running,
		"exit_code":    inspect.ExitCode,
		"pid":          inspect.Pid,
		"container_id": inspect.ContainerID,
	}

	return result, nil
}

// ResizeExec resizes the TTY of an exec instance
func (u *dockerExecUsecase) ResizeExec(ctx context.Context, execID string, height, width uint) error {
	if execID == "" {
		return fmt.Errorf("exec ID is required")
	}

	if height == 0 || width == 0 {
		return fmt.Errorf("height and width must be greater than 0")
	}

	if err := u.dockerClient.ExecResize(ctx, execID, height, width); err != nil {
		return fmt.Errorf("failed to resize exec: %w", err)
	}

	return nil
}

// ExecuteCommand executes a simple command and returns the result
func (u *dockerExecUsecase) ExecuteCommand(ctx context.Context, containerID string, cmd []string) (*docker.ExecResult, error) {
	if containerID == "" {
		return nil, fmt.Errorf("container ID is required")
	}

	if len(cmd) == 0 {
		return nil, fmt.Errorf("command is required")
	}

	result, err := u.dockerClient.ContainerExecSimple(ctx, containerID, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to execute command: %w", err)
	}

	return result, nil
}
