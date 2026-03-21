package managementapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type CronManager struct {
	servers    domain.ServerRepository
	cronjobs   domain.ServerCronjobRepository
	dispatcher AgentCommandDispatcher
}

func NewCronManager(servers domain.ServerRepository, cronjobs domain.ServerCronjobRepository, dispatcher AgentCommandDispatcher) *CronManager {
	return &CronManager{servers: servers, cronjobs: cronjobs, dispatcher: dispatcher}
}

func (m *CronManager) Create(ctx context.Context, cronjob *domain.ServerCronjob) error {
	if _, err := m.servers.GetByID(ctx, cronjob.ServerID); err != nil {
		return err
	}
	if strings.TrimSpace(cronjob.Name) == "" || strings.TrimSpace(cronjob.CronExpression) == "" || strings.TrimSpace(cronjob.Command) == "" {
		return errors.New("name, cron_expression and command are required")
	}
	now := time.Now().UTC()
	if cronjob.ID == "" {
		cronjob.ID = uuid.NewString()
	}
	if cronjob.Status == "" {
		cronjob.Status = domain.CronjobStatusActive
	}
	cronjob.CreatedAt = now
	cronjob.UpdatedAt = now
	return m.cronjobs.Create(ctx, cronjob)
}

func (m *CronManager) Get(ctx context.Context, id string) (*domain.ServerCronjob, error) {
	return m.cronjobs.GetByID(ctx, id)
}

func (m *CronManager) List(ctx context.Context, filter domain.CronjobFilter) ([]*domain.ServerCronjob, int64, error) {
	return m.cronjobs.List(ctx, filter)
}

func (m *CronManager) Update(ctx context.Context, cronjob *domain.ServerCronjob) error {
	existing, err := m.cronjobs.GetByID(ctx, cronjob.ID)
	if err != nil {
		return err
	}
	cronjob.ServerID = existing.ServerID
	cronjob.CreatedAt = existing.CreatedAt
	cronjob.UpdatedAt = time.Now().UTC()
	return m.cronjobs.Update(ctx, cronjob)
}

func (m *CronManager) Delete(ctx context.Context, id string) error {
	return m.cronjobs.Delete(ctx, id)
}

func (m *CronManager) Execute(ctx context.Context, cronjobID, userID string) (*agent.Command, error) {
	cronjob, err := m.cronjobs.GetByID(ctx, cronjobID)
	if err != nil {
		return nil, err
	}
	startedAt := time.Now().UTC()
	execution := &domain.CronjobExecution{
		ID:        uuid.NewString(),
		CronjobID: cronjobID,
		StartedAt: startedAt,
		CreatedAt: startedAt,
	}
	if err := m.cronjobs.CreateExecution(ctx, execution); err != nil {
		return nil, err
	}
	cmd, err := m.dispatcher.Dispatch(ctx, cronjob.ServerID, userID, cronjob.Command, 3600, "cron-execute:"+cronjobID+":"+execution.ID)
	if err != nil {
		finishedAt := time.Now().UTC()
		execution.FinishedAt = finishedAt
		execution.Success = false
		execution.Error = err.Error()
		_ = m.cronjobs.CreateExecution(ctx, execution)
		return nil, err
	}
	return cmd, nil
}

func (m *CronManager) History(ctx context.Context, cronjobID string, limit int) ([]*domain.CronjobExecution, error) {
	return m.cronjobs.GetExecutions(ctx, cronjobID, limit)
}

func BuildCronInstallCommand(cronjob *domain.ServerCronjob) string {
	expression := strings.TrimSpace(cronjob.CronExpression)
	command := strings.TrimSpace(cronjob.Command)
	user := strings.TrimSpace(cronjob.User)
	if user == "" {
		return fmt.Sprintf("(crontab -l 2>/dev/null; echo \"%s %s\") | crontab -", expression, command)
	}
	return fmt.Sprintf("(sudo crontab -u %s -l 2>/dev/null; echo \"%s %s\") | sudo crontab -u %s -", user, expression, command, user)
}
