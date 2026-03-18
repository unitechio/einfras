package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/ssh"

	"github.com/robfig/cron/v3"
)

type serverCronjobUsecase struct {
	cronjobRepo domain.ServerCronjobRepository
	serverRepo  domain.ServerRepository
}

// NewServerCronjobUsecase creates a new server cronjob usecase instance
func NewServerCronjobUsecase(
	cronjobRepo domain.ServerCronjobRepository,
	serverRepo domain.ServerRepository,
) domain.ServerCronjobUsecase {
	return &serverCronjobUsecase{
		cronjobRepo: cronjobRepo,
		serverRepo:  serverRepo,
	}
}

// CreateCronjob creates a new cronjob
func (u *serverCronjobUsecase) CreateCronjob(ctx context.Context, cronjob *domain.ServerCronjob) error {
	// Verify server exists
	server, err := u.serverRepo.GetByID(ctx, cronjob.ServerID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Validate cron expression
	if err := u.ValidateCronExpression(cronjob.CronExpression); err != nil {
		return err
	}

	// Set default status
	if cronjob.Status == "" {
		cronjob.Status = domain.CronjobStatusActive
	}

	// Calculate next run time
	nextRun, err := u.calculateNextRun(cronjob.CronExpression)
	if err == nil {
		cronjob.NextRunAt = &nextRun
	}

	// Create cronjob record
	if err := u.cronjobRepo.Create(ctx, cronjob); err != nil {
		return fmt.Errorf("failed to create cronjob: %w", err)
	}

	// TODO: Install cronjob on the server via SSH
	// This would involve:
	// 1. SSH into the server
	// 2. Add crontab entry (Linux) or scheduled task (Windows)

	return nil
}

// GetCronjob retrieves a cronjob by ID
func (u *serverCronjobUsecase) GetCronjob(ctx context.Context, id string) (*domain.ServerCronjob, error) {
	if id == "" {
		return nil, errors.New("cronjob ID is required")
	}
	return u.cronjobRepo.GetByID(ctx, id)
}

// ListCronjobs retrieves cronjobs with filtering and pagination
func (u *serverCronjobUsecase) ListCronjobs(ctx context.Context, filter domain.CronjobFilter) ([]*domain.ServerCronjob, int64, error) {
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	return u.cronjobRepo.List(ctx, filter)
}

// UpdateCronjob updates a cronjob
func (u *serverCronjobUsecase) UpdateCronjob(ctx context.Context, cronjob *domain.ServerCronjob) error {
	if cronjob.ID == "" {
		return errors.New("cronjob ID is required")
	}

	// Verify cronjob exists
	existing, err := u.cronjobRepo.GetByID(ctx, cronjob.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("cronjob not found")
	}

	// Validate cron expression if changed
	if cronjob.CronExpression != existing.CronExpression {
		if err := u.ValidateCronExpression(cronjob.CronExpression); err != nil {
			return err
		}

		// Recalculate next run time
		nextRun, err := u.calculateNextRun(cronjob.CronExpression)
		if err == nil {
			cronjob.NextRunAt = &nextRun
		}
	}

	// Update cronjob record
	if err := u.cronjobRepo.Update(ctx, cronjob); err != nil {
		return fmt.Errorf("failed to update cronjob: %w", err)
	}

	// TODO: Update cronjob on the server via SSH

	return nil
}

// DeleteCronjob deletes a cronjob
func (u *serverCronjobUsecase) DeleteCronjob(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("cronjob ID is required")
	}

	// Verify cronjob exists
	cronjob, err := u.cronjobRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if cronjob == nil {
		return errors.New("cronjob not found")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, cronjob.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Remove cronjob from the server via SSH
	if err := u.removeCronjobFromServer(ctx, server, cronjob); err != nil {
		return fmt.Errorf("failed to remove cronjob from server: %w", err)
	}

	return u.cronjobRepo.Delete(ctx, id)
}

func (u *serverCronjobUsecase) removeCronjobFromServer(ctx context.Context, server *domain.Server, cronjob *domain.ServerCronjob) error {
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return err
	}
	defer sshClient.Close()

	// Logic: List crontab, filter out the lines with our marker, and save back.
	commentMarker := fmt.Sprintf("# EINFRA_CRON_%s", cronjob.ID)
	cmd := fmt.Sprintf("crontab -l | grep -v '%s' | crontab -", commentMarker)

	_, err = sshClient.ExecuteCommand(ctx, cmd)
	return err
}

// ExecuteCronjob manually executes a cronjob
func (u *serverCronjobUsecase) ExecuteCronjob(ctx context.Context, cronjobID string) error {
	if cronjobID == "" {
		return errors.New("cronjob ID is required")
	}

	// Get cronjob
	cronjob, err := u.cronjobRepo.GetByID(ctx, cronjobID)
	if err != nil {
		return err
	}
	if cronjob == nil {
		return errors.New("cronjob not found")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, cronjob.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Create execution record
	execution := &domain.CronjobExecution{
		CronjobID: cronjobID,
		StartedAt: time.Now(),
	}

	// Execute command via SSH
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		execution.Error = fmt.Sprintf("failed to create SSH client: %v", err)
		execution.Success = false
		u.cronjobRepo.CreateExecution(ctx, execution)
		return err
	}
	defer sshClient.Close()

	// Build command
	command := cronjob.Command
	if cronjob.WorkingDir != "" {
		command = fmt.Sprintf("cd %s && %s", cronjob.WorkingDir, command)
	}
	if cronjob.User != "" {
		command = fmt.Sprintf("sudo -u %s %s", cronjob.User, command)
	}

	// Execute command
	result, err := sshClient.ExecuteCommand(ctx, command)
	execution.FinishedAt = time.Now()
	execution.Duration = int(execution.FinishedAt.Sub(execution.StartedAt).Seconds())

	if err != nil {
		execution.Error = err.Error()
		execution.Success = false
		execution.ExitCode = -1
	} else {
		execution.ExitCode = result.ExitCode
		execution.Output = result.Stdout
		execution.Error = result.Stderr
		execution.Success = result.ExitCode == 0
	}

	// Save execution record
	if err := u.cronjobRepo.CreateExecution(ctx, execution); err != nil {
		return fmt.Errorf("failed to save execution record: %w", err)
	}

	// Update cronjob
	cronjob.LastRunAt = &execution.StartedAt
	cronjob.LastExitCode = execution.ExitCode
	cronjob.LastOutput = execution.Output
	cronjob.LastError = execution.Error
	cronjob.ExecutionCount++
	if !execution.Success {
		cronjob.FailureCount++
	}

	// Calculate next run time
	nextRun, err := u.calculateNextRun(cronjob.CronExpression)
	if err == nil {
		cronjob.NextRunAt = &nextRun
	}

	if err := u.cronjobRepo.Update(ctx, cronjob); err != nil {
		return fmt.Errorf("failed to update cronjob: %w", err)
	}

	if !execution.Success {
		return fmt.Errorf("cronjob execution failed with exit code %d", execution.ExitCode)
	}

	return nil
}

// ValidateCronExpression validates a cron expression
func (u *serverCronjobUsecase) ValidateCronExpression(expression string) error {
	if expression == "" {
		return errors.New("cron expression is required")
	}

	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expression)
	if err != nil {
		return fmt.Errorf("invalid cron expression: %w", err)
	}

	return nil
}

// calculateNextRun calculates the next run time for a cron expression
func (u *serverCronjobUsecase) calculateNextRun(expression string) (time.Time, error) {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(expression)
	if err != nil {
		return time.Time{}, err
	}

	return schedule.Next(time.Now()), nil
}

// GetExecutionHistory retrieves execution history for a cronjob
func (u *serverCronjobUsecase) GetExecutionHistory(ctx context.Context, cronjobID string, limit int) ([]*domain.CronjobExecution, error) {
	if cronjobID == "" {
		return nil, errors.New("cronjob ID is required")
	}

	if limit <= 0 {
		limit = 50
	}

	return u.cronjobRepo.GetExecutions(ctx, cronjobID, limit)
}
