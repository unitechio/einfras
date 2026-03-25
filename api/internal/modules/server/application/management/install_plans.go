package managementapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	domain "einfra/api/internal/modules/server/domain"
)

type ServiceInstallPlanManager struct {
	servers domain.ServerRepository
	plans   domain.ServerServiceInstallPlanRepository
}

func NewServiceInstallPlanManager(servers domain.ServerRepository, plans domain.ServerServiceInstallPlanRepository) *ServiceInstallPlanManager {
	return &ServiceInstallPlanManager{
		servers: servers,
		plans:   plans,
	}
}

func (m *ServiceInstallPlanManager) Create(ctx context.Context, plan *domain.ServerServiceInstallPlan) error {
	if plan == nil {
		return errors.New("install plan payload is required")
	}
	if _, err := m.servers.GetByID(ctx, plan.ServerID); err != nil {
		return err
	}
	plan.Mode = domain.ServiceInstallPlanMode(strings.ToLower(strings.TrimSpace(string(plan.Mode))))
	switch plan.Mode {
	case domain.ServiceInstallPlanModePrivate:
		if strings.TrimSpace(plan.ArtifactName) == "" {
			return errors.New("artifact_name is required for private install plans")
		}
	case domain.ServiceInstallPlanModeRelay:
		if strings.TrimSpace(plan.PackageName) == "" {
			return errors.New("package_name is required for relay install plans")
		}
		if strings.TrimSpace(plan.RelayHost) == "" {
			return errors.New("relay_host is required for relay install plans")
		}
	default:
		return errors.New("unsupported install plan mode")
	}
	plan.ID = uuid.NewString()
	plan.Status = domain.ServiceInstallPlanStatusPlanned
	plan.CreatedAt = time.Now().UTC()
	plan.UpdatedAt = plan.CreatedAt
	return m.plans.Create(ctx, plan)
}

func (m *ServiceInstallPlanManager) List(ctx context.Context, serverID string) ([]*domain.ServerServiceInstallPlan, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.plans.ListByServerID(ctx, serverID)
}
