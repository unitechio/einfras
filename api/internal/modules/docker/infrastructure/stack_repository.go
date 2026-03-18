package repository

import (
	"context"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

// DockerStackRepository handles database operations for Docker stacks
type DockerStackRepository interface {
	Create(ctx context.Context, stack *domain.DockerStack) error
	GetByID(ctx context.Context, id string) (*domain.DockerStack, error)
	GetByName(ctx context.Context, name string) (*domain.DockerStack, error)
	List(ctx context.Context) ([]*domain.DockerStack, error)
	Update(ctx context.Context, stack *domain.DockerStack) error
	Delete(ctx context.Context, id string) error
	UpdateStatus(ctx context.Context, id string, status domain.StackStatus) error

	// Service operations
	CreateService(ctx context.Context, service *domain.StackService) error
	GetServices(ctx context.Context, stackID string) ([]*domain.StackService, error)
	DeleteServices(ctx context.Context, stackID string) error
}

type dockerStackRepository struct {
	db *gorm.DB
}

// NewDockerStackRepository creates a new Docker stack repository
func NewDockerStackRepository(db *gorm.DB) DockerStackRepository {
	return &dockerStackRepository{db: db}
}

// Create creates a new Docker stack
func (r *dockerStackRepository) Create(ctx context.Context, stack *domain.DockerStack) error {
	return r.db.WithContext(ctx).Create(stack).Error
}

// GetByID retrieves a stack by ID
func (r *dockerStackRepository) GetByID(ctx context.Context, id string) (*domain.DockerStack, error) {
	var stack domain.DockerStack
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&stack).Error
	if err != nil {
		return nil, err
	}
	return &stack, nil
}

// GetByName retrieves a stack by name
func (r *dockerStackRepository) GetByName(ctx context.Context, name string) (*domain.DockerStack, error) {
	var stack domain.DockerStack
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&stack).Error
	if err != nil {
		return nil, err
	}
	return &stack, nil
}

// List retrieves all stacks
func (r *dockerStackRepository) List(ctx context.Context) ([]*domain.DockerStack, error) {
	var stacks []*domain.DockerStack
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&stacks).Error
	return stacks, err
}

// Update updates a stack
func (r *dockerStackRepository) Update(ctx context.Context, stack *domain.DockerStack) error {
	return r.db.WithContext(ctx).Save(stack).Error
}

// Delete deletes a stack
func (r *dockerStackRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.DockerStack{}, "id = ?", id).Error
}

// UpdateStatus updates stack status
func (r *dockerStackRepository) UpdateStatus(ctx context.Context, id string, status domain.StackStatus) error {
	return r.db.WithContext(ctx).Model(&domain.DockerStack{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// CreateService creates a new stack service
func (r *dockerStackRepository) CreateService(ctx context.Context, service *domain.StackService) error {
	return r.db.WithContext(ctx).Create(service).Error
}

// GetServices retrieves all services for a stack
func (r *dockerStackRepository) GetServices(ctx context.Context, stackID string) ([]*domain.StackService, error) {
	var services []*domain.StackService
	err := r.db.WithContext(ctx).Where("stack_id = ?", stackID).Find(&services).Error
	return services, err
}

// DeleteServices deletes all services for a stack
func (r *dockerStackRepository) DeleteServices(ctx context.Context, stackID string) error {
	return r.db.WithContext(ctx).Delete(&domain.StackService{}, "stack_id = ?", stackID).Error
}
