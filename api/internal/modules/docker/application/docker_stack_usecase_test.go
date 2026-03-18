package usecase_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
)

// MockDockerStackRepository is a mock implementation of DockerStackRepository
type MockDockerStackRepository struct {
	mock.Mock
}

func (m *MockDockerStackRepository) Create(ctx context.Context, stack *domain.DockerStack) error {
	args := m.Called(ctx, stack)
	return args.Error(0)
}

func (m *MockDockerStackRepository) GetByID(ctx context.Context, id string) (*domain.DockerStack, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.DockerStack), args.Error(1)
}

func (m *MockDockerStackRepository) GetByName(ctx context.Context, name string) (*domain.DockerStack, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.DockerStack), args.Error(1)
}

func (m *MockDockerStackRepository) List(ctx context.Context) ([]*domain.DockerStack, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.DockerStack), args.Error(1)
}

func (m *MockDockerStackRepository) Update(ctx context.Context, stack *domain.DockerStack) error {
	args := m.Called(ctx, stack)
	return args.Error(0)
}

func (m *MockDockerStackRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockDockerStackRepository) UpdateStatus(ctx context.Context, id string, status domain.StackStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockDockerStackRepository) CreateService(ctx context.Context, service *domain.StackService) error {
	args := m.Called(ctx, service)
	return args.Error(0)
}

func (m *MockDockerStackRepository) GetServices(ctx context.Context, stackID string) ([]*domain.StackService, error) {
	args := m.Called(ctx, stackID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domain.StackService), args.Error(1)
}

func (m *MockDockerStackRepository) DeleteServices(ctx context.Context, stackID string) error {
	args := m.Called(ctx, stackID)
	return args.Error(0)
}

// TestDeployStack tests deploying a stack
func TestDeployStack(t *testing.T) {
	mockRepo := new(MockDockerStackRepository)
	u := usecase.NewDockerStackUsecase(mockRepo)
	ctx := context.Background()

	t.Run("Success - Deploy stack", func(t *testing.T) {
		req := domain.StackDeployRequest{
			Name:        "test-stack",
			ComposeFile: "version: '3'",
		}
		userID := "user-123"

		mockRepo.On("GetByName", ctx, req.Name).Return(nil, nil).Once()
		mockRepo.On("Create", ctx, mock.AnythingOfType("*domain.DockerStack")).Return(nil).Once()
		mockRepo.On("UpdateStatus", mock.Anything, mock.AnythingOfType("string"), domain.StackStatusRunning).Return(nil).Maybe()

		stack, err := u.DeployStack(ctx, req, userID)
		assert.NoError(t, err)
		assert.NotNil(t, stack)
		assert.Equal(t, req.Name, stack.Name)
		assert.Equal(t, domain.StackStatusDeploying, stack.Status)

		mockRepo.AssertExpectations(t)
	})

	t.Run("Error - Stack exists", func(t *testing.T) {
		req := domain.StackDeployRequest{
			Name:        "existing-stack",
			ComposeFile: "version: '3'",
		}
		userID := "user-123"
		existingStack := &domain.DockerStack{Name: "existing-stack"}

		mockRepo.On("GetByName", ctx, req.Name).Return(existingStack, nil).Once()

		stack, err := u.DeployStack(ctx, req, userID)
		assert.Error(t, err)
		assert.Nil(t, stack)
		assert.Contains(t, err.Error(), "already exists")

		mockRepo.AssertExpectations(t)
	})
}

// TestRemoveStack tests removing a stack
func TestRemoveStack(t *testing.T) {
	mockRepo := new(MockDockerStackRepository)
	u := usecase.NewDockerStackUsecase(mockRepo)
	ctx := context.Background()

	t.Run("Success - Remove stack", func(t *testing.T) {
		stackID := "stack-123"
		stack := &domain.DockerStack{ID: stackID}

		mockRepo.On("GetByID", ctx, stackID).Return(stack, nil).Once()
		mockRepo.On("DeleteServices", ctx, stackID).Return(nil).Once()
		mockRepo.On("Delete", ctx, stackID).Return(nil).Once()

		err := u.RemoveStack(ctx, stackID)
		assert.NoError(t, err)

		mockRepo.AssertExpectations(t)
	})
}
