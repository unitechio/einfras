package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"einfra/api/pkg/docker"
)

// DockerTemplateUsecase handles Docker Template operations
type DockerTemplateUsecase interface {
	// Template operations
	ListTemplates(category string) []docker.Template
	GetTemplate(templateID string) (*docker.Template, error)
	ListCategories() []string
	DeployTemplate(ctx context.Context, serverID string, template docker.Template, config docker.TemplateDeployConfig) (string, error)
	ValidateTemplate(template docker.Template) error
}

type dockerTemplateUsecase struct {
	serverRepo domain.ServerRepository
}

// NewDockerTemplateUsecase creates a new Docker Template usecase
func NewDockerTemplateUsecase(serverRepo domain.ServerRepository) DockerTemplateUsecase {
	return &dockerTemplateUsecase{
		serverRepo: serverRepo,
	}
}

func (u *dockerTemplateUsecase) getDockerClient(ctx context.Context, serverID string) (*docker.Client, error) {
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

func (u *dockerTemplateUsecase) ListTemplates(category string) []docker.Template {
	return docker.TemplateListByCategory(category)
}

func (u *dockerTemplateUsecase) GetTemplate(templateID string) (*docker.Template, error) {
	return docker.TemplateGetByID(templateID)
}

func (u *dockerTemplateUsecase) ListCategories() []string {
	templates := docker.DefaultTemplates()
	categoryMap := make(map[string]bool)

	for _, template := range templates {
		for _, category := range template.Categories {
			categoryMap[category] = true
		}
	}

	categories := make([]string, 0, len(categoryMap))
	for category := range categoryMap {
		categories = append(categories, category)
	}

	return categories
}

func (u *dockerTemplateUsecase) DeployTemplate(ctx context.Context, serverID string, template docker.Template, config docker.TemplateDeployConfig) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}

	return client.TemplateDeployFromTemplate(ctx, template, config)
}

func (u *dockerTemplateUsecase) ValidateTemplate(template docker.Template) error {
	return docker.TemplateValidate(template)
}
