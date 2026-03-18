package application

import (
	"context"

	"einfra/api/internal/modules/server/domain"
)

// The interface acts as the Port for external services (infrastructure).
type AgentDispatcher interface {
	DispatchTask(ctx context.Context, task *domain.AgentTask) error
}
