package usecase

import (
	"context"
	"fmt"
	"strings"

	"einfra/api/internal/domain"
	"einfra/api/internal/modules/docker/infrastructure"
)

// DockerStackUsecase handles Docker stack operations
type DockerStackUsecase interface {
	DeployStack(ctx context.Context, req domain.StackDeployRequest, userID string) (*domain.DockerStack, error)
	UpdateStack(ctx context.Context, stackID string, req domain.StackUpdateRequest) error
	GetStack(ctx context.Context, stackID string) (*domain.StackInfo, error)
	ListStacks(ctx context.Context) ([]*domain.DockerStack, error)
	RemoveStack(ctx context.Context, stackID string) error
	GetStackLogs(ctx context.Context, stackID string, serviceFilter string) (string, error)
	StartStack(ctx context.Context, stackID string) error
	StopStack(ctx context.Context, stackID string) error
}

type dockerStackUsecase struct {
	stackRepo repository.DockerStackRepository
}

// NewDockerStackUsecase creates a new Docker stack usecase
func NewDockerStackUsecase(stackRepo repository.DockerStackRepository) DockerStackUsecase {
	return &dockerStackUsecase{
		stackRepo: stackRepo,
	}
}

// DeployStack deploys a new Docker Compose stack
func (u *dockerStackUsecase) DeployStack(ctx context.Context, req domain.StackDeployRequest, userID string) (*domain.DockerStack, error) {
	// Validate request
	if req.Name == "" {
		return nil, fmt.Errorf("stack name is required")
	}

	if req.ComposeFile == "" {
		return nil, fmt.Errorf("compose file is required")
	}

	// Check if stack with same name exists
	existing, err := u.stackRepo.GetByName(ctx, req.Name)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("stack with name %s already exists", req.Name)
	}

	// Create stack entity
	stack := &domain.DockerStack{
		Name:        req.Name,
		ComposeFile: req.ComposeFile,
		EnvVars:     req.EnvVars,
		Status:      domain.StackStatusDeploying,
		DockerHost:  req.DockerHost,
		ProjectName: sanitizeProjectName(req.Name),
		CreatedBy:   userID,
	}

	// Save to database
	if err := u.stackRepo.Create(ctx, stack); err != nil {
		return nil, fmt.Errorf("failed to create stack: %w", err)
	}

	// TODO: Deploy to Docker using docker-compose
	// For now, just update status to running
	go func() {
		// Simulate deployment
		u.stackRepo.UpdateStatus(context.Background(), stack.ID, domain.StackStatusRunning)
	}()

	return stack, nil
}

// UpdateStack updates an existing stack
func (u *dockerStackUsecase) UpdateStack(ctx context.Context, stackID string, req domain.StackUpdateRequest) error {
	if stackID == "" {
		return fmt.Errorf("stack ID is required")
	}

	// Get existing stack
	stack, err := u.stackRepo.GetByID(ctx, stackID)
	if err != nil {
		return fmt.Errorf("stack not found: %w", err)
	}

	// Update stack
	stack.ComposeFile = req.ComposeFile
	stack.EnvVars = req.EnvVars
	stack.Status = domain.StackStatusUpdating

	if err := u.stackRepo.Update(ctx, stack); err != nil {
		return fmt.Errorf("failed to update stack: %w", err)
	}

	// TODO: Redeploy to Docker
	go func() {
		// Simulate update
		u.stackRepo.UpdateStatus(context.Background(), stackID, domain.StackStatusRunning)
	}()

	return nil
}

// GetStack retrieves stack with services
func (u *dockerStackUsecase) GetStack(ctx context.Context, stackID string) (*domain.StackInfo, error) {
	if stackID == "" {
		return nil, fmt.Errorf("stack ID is required")
	}

	stack, err := u.stackRepo.GetByID(ctx, stackID)
	if err != nil {
		return nil, fmt.Errorf("stack not found: %w", err)
	}

	services, err := u.stackRepo.GetServices(ctx, stackID)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}

	return &domain.StackInfo{
		Stack:    *stack,
		Services: convertServicesToSlice(services),
	}, nil
}

// ListStacks lists all stacks
func (u *dockerStackUsecase) ListStacks(ctx context.Context) ([]*domain.DockerStack, error) {
	stacks, err := u.stackRepo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list stacks: %w", err)
	}

	return stacks, nil
}

// RemoveStack removes a stack
func (u *dockerStackUsecase) RemoveStack(ctx context.Context, stackID string) error {
	if stackID == "" {
		return fmt.Errorf("stack ID is required")
	}

	// Get stack
	stack, err := u.stackRepo.GetByID(ctx, stackID)
	if err != nil {
		return fmt.Errorf("stack not found: %w", err)
	}

	// TODO: Remove from Docker
	// docker-compose down

	// Delete services
	if err := u.stackRepo.DeleteServices(ctx, stackID); err != nil {
		return fmt.Errorf("failed to delete services: %w", err)
	}

	// Delete stack
	if err := u.stackRepo.Delete(ctx, stackID); err != nil {
		return fmt.Errorf("failed to delete stack: %w", err)
	}

	_ = stack // Use stack variable
	return nil
}

// GetStackLogs retrieves logs for a stack
func (u *dockerStackUsecase) GetStackLogs(ctx context.Context, stackID string, serviceFilter string) (string, error) {
	if stackID == "" {
		return "", fmt.Errorf("stack ID is required")
	}

	// Get stack
	_, err := u.stackRepo.GetByID(ctx, stackID)
	if err != nil {
		return "", fmt.Errorf("stack not found: %w", err)
	}

	// TODO: Get logs from Docker
	// docker-compose logs [service]

	return "Stack logs placeholder", nil
}

// StartStack starts a stopped stack
func (u *dockerStackUsecase) StartStack(ctx context.Context, stackID string) error {
	if stackID == "" {
		return fmt.Errorf("stack ID is required")
	}

	// TODO: Start stack
	// docker-compose start

	return u.stackRepo.UpdateStatus(ctx, stackID, domain.StackStatusRunning)
}

// StopStack stops a running stack
func (u *dockerStackUsecase) StopStack(ctx context.Context, stackID string) error {
	if stackID == "" {
		return fmt.Errorf("stack ID is required")
	}

	// TODO: Stop stack
	// docker-compose stop

	return u.stackRepo.UpdateStatus(ctx, stackID, domain.StackStatusStopped)
}

// Helper functions

func sanitizeProjectName(name string) string {
	// Docker Compose project names must be lowercase and alphanumeric
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")
	return name
}

func convertServicesToSlice(services []*domain.StackService) []domain.StackService {
	result := make([]domain.StackService, len(services))
	for i, svc := range services {
		result[i] = *svc
	}
	return result
}
