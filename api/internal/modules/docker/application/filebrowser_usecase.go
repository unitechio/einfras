package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"einfra/api/pkg/docker"
)

// DockerFileBrowserUsecase handles Docker File Browser operations
type DockerFileBrowserUsecase interface {
	// File operations
	ListFiles(ctx context.Context, serverID string, containerID string, path string) ([]docker.FileInfo, error)
	DownloadFile(ctx context.Context, serverID string, containerID string, path string) ([]byte, error)
	UploadFile(ctx context.Context, serverID string, containerID string, path string, filename string, content []byte) error
	DeleteFile(ctx context.Context, serverID string, containerID string, path string) error
	CreateDirectory(ctx context.Context, serverID string, containerID string, path string) error
	RenameFile(ctx context.Context, serverID string, containerID string, oldPath string, newPath string) error
	GetFileContent(ctx context.Context, serverID string, containerID string, path string) (string, error)
	SaveFileContent(ctx context.Context, serverID string, containerID string, path string, content string) error
}

type dockerFileBrowserUsecase struct {
	serverRepo domain.ServerRepository
}

// NewDockerFileBrowserUsecase creates a new Docker File Browser usecase
func NewDockerFileBrowserUsecase(serverRepo domain.ServerRepository) DockerFileBrowserUsecase {
	return &dockerFileBrowserUsecase{
		serverRepo: serverRepo,
	}
}

func (u *dockerFileBrowserUsecase) getDockerClient(ctx context.Context, serverID string) (*docker.Client, error) {
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

func (u *dockerFileBrowserUsecase) ListFiles(ctx context.Context, serverID string, containerID string, path string) ([]docker.FileInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	return client.FileBrowserList(ctx, docker.FileBrowserListRequest{
		ContainerID: containerID,
		Path:        path,
	})
}

func (u *dockerFileBrowserUsecase) DownloadFile(ctx context.Context, serverID string, containerID string, path string) ([]byte, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	return client.FileBrowserDownload(ctx, docker.FileBrowserDownloadRequest{
		ContainerID: containerID,
		Path:        path,
	})
}

func (u *dockerFileBrowserUsecase) UploadFile(ctx context.Context, serverID string, containerID string, path string, filename string, content []byte) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	return client.FileBrowserUpload(ctx, docker.FileBrowserUploadRequest{
		ContainerID: containerID,
		Path:        path,
		Filename:    filename,
		Content:     content,
	})
}

func (u *dockerFileBrowserUsecase) DeleteFile(ctx context.Context, serverID string, containerID string, path string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	return client.FileBrowserDelete(ctx, docker.FileBrowserDeleteRequest{
		ContainerID: containerID,
		Path:        path,
	})
}

func (u *dockerFileBrowserUsecase) CreateDirectory(ctx context.Context, serverID string, containerID string, path string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	return client.FileBrowserCreateDir(ctx, docker.FileBrowserCreateDirRequest{
		ContainerID: containerID,
		Path:        path,
	})
}

func (u *dockerFileBrowserUsecase) RenameFile(ctx context.Context, serverID string, containerID string, oldPath string, newPath string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	return client.FileBrowserRename(ctx, containerID, oldPath, newPath)
}

func (u *dockerFileBrowserUsecase) GetFileContent(ctx context.Context, serverID string, containerID string, path string) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}

	return client.FileBrowserGetFileContent(ctx, containerID, path)
}

func (u *dockerFileBrowserUsecase) SaveFileContent(ctx context.Context, serverID string, containerID string, path string, content string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}

	return client.FileBrowserSaveFileContent(ctx, containerID, path, content)
}
