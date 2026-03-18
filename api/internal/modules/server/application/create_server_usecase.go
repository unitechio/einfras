package application

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"einfra/api/internal/modules/server/domain"
)

// DTOs
type CreateServerCommand struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name" binding:"required"`
	IPAddress string    `json:"ip_address" binding:"required"`
}

type ServerDTO struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	IPAddress string    `json:"ip_address"`
	Status    string    `json:"status"`
}

// Usecase Orchestrator
type CreateServerUsecase struct {
	serverRepo  domain.ServerRepository
	eventBus    domain.EventPublisher
	agentClient AgentDispatcher // Dependency explicitly passed for abstraction
}

func NewCreateServerUsecase(repo domain.ServerRepository, bus domain.EventPublisher, agentClient AgentDispatcher) *CreateServerUsecase {
	return &CreateServerUsecase{
		serverRepo:  repo,
		eventBus:    bus,
		agentClient: agentClient, // for distributed tasks mapping
	}
}

func (uc *CreateServerUsecase) Execute(ctx context.Context, cmd CreateServerCommand) (*ServerDTO, error) {
	// 1. Validation Logic
	if cmd.Name == "" || cmd.IPAddress == "" {
		return nil, errors.New("invalid command payload")
	}

	// 2. Load constraints (if exist)
	existing, _ := uc.serverRepo.GetByIP(ctx, cmd.IPAddress, cmd.TenantID)
	if existing != nil {
		return nil, errors.New("server with this IP already exists in tenant")
	}

	// 3. Call Domain Logic (Aggregate Constructor)
	server, err := domain.NewServer(cmd.TenantID, cmd.Name, cmd.IPAddress)
	if err != nil {
		return nil, err
	}

	// 4. Save to Repository
	if err := uc.serverRepo.Save(ctx, server); err != nil {
		return nil, err
	}

	// 5. Publish Domain Events
	for _, event := range server.PopEvents() {
		// Ideally done transactionally with outbox pattern, but straightforward here.
		if uc.eventBus != nil {
			uc.eventBus.Publish(event)
		}
	}

	// 6. Output DTO Mapping
	dto := &ServerDTO{
		ID:        server.ID,
		Name:      server.Name,
		IPAddress: server.IPAddress,
		Status:    string(server.Status),
	}
	return dto, nil
}
