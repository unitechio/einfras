package usecase

import (
	"context"
	"errors"
	"fmt"

	domain "einfra/api/internal/modules/server/domain"
)

type serverBackupUsecase struct {
	backupRepo domain.ServerBackupRepository
	serverRepo domain.ServerRepository
}

// NewServerBackupUsecase creates a new server backup usecase instance
func NewServerBackupUsecase(
	backupRepo domain.ServerBackupRepository,
	serverRepo domain.ServerRepository,
) domain.ServerBackupUsecase {
	return &serverBackupUsecase{
		backupRepo: backupRepo,
		serverRepo: serverRepo,
	}
}

// CreateBackup creates a new backup
func (u *serverBackupUsecase) CreateBackup(ctx context.Context, backup *domain.ServerBackup) error {
	// Validate server exists
	server, err := u.serverRepo.GetByID(ctx, backup.ServerID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Validate backup type
	if backup.Type == "" {
		backup.Type = domain.BackupTypeFull
	}

	// Set initial status
	if backup.Status == "" {
		backup.Status = domain.BackupStatusPending
	}

	// Set default compression
	if !backup.Compressed {
		backup.Compressed = true
	}

	// Create backup record
	if err := u.backupRepo.Create(ctx, backup); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	// TODO: Trigger actual backup process (async job)
	// This would involve:
	// 1. SSH into the server
	// 2. Run backup commands based on OS type
	// 3. Transfer backup file to storage
	// 4. Update backup record with status and size

	return nil
}

// GetBackup retrieves a backup by ID
func (u *serverBackupUsecase) GetBackup(ctx context.Context, id string) (*domain.ServerBackup, error) {
	if id == "" {
		return nil, errors.New("backup ID is required")
	}
	return u.backupRepo.GetByID(ctx, id)
}

// ListBackups retrieves backups with filtering and pagination
func (u *serverBackupUsecase) ListBackups(ctx context.Context, filter domain.BackupFilter) ([]*domain.ServerBackup, int64, error) {
	if filter.Page == 0 {
		filter.Page = 1
	}
	if filter.PageSize == 0 {
		filter.PageSize = 20
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	return u.backupRepo.List(ctx, filter)
}

// RestoreBackup restores a server from a backup
func (u *serverBackupUsecase) RestoreBackup(ctx context.Context, backupID string) error {
	if backupID == "" {
		return errors.New("backup ID is required")
	}

	// Get backup
	backup, err := u.backupRepo.GetByID(ctx, backupID)
	if err != nil {
		return err
	}
	if backup == nil {
		return errors.New("backup not found")
	}

	// Verify backup is completed
	if backup.Status != domain.BackupStatusCompleted {
		return errors.New("backup is not completed")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, backup.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// TODO: Implement actual restore process
	// This would involve:
	// 1. SSH into the server
	// 2. Transfer backup file to server
	// 3. Run restore commands based on OS type
	// 4. Verify restore success

	return nil
}

// DeleteBackup deletes a backup
func (u *serverBackupUsecase) DeleteBackup(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("backup ID is required")
	}

	// Verify backup exists
	backup, err := u.backupRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if backup == nil {
		return errors.New("backup not found")
	}

	// TODO: Delete actual backup file from storage

	return u.backupRepo.Delete(ctx, id)
}

// CleanupExpiredBackups removes expired backups
func (u *serverBackupUsecase) CleanupExpiredBackups(ctx context.Context) (int64, error) {
	// Delete expired backups from database
	count, err := u.backupRepo.DeleteExpired(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired backups: %w", err)
	}

	// TODO: Delete actual backup files from storage

	return count, nil
}

// GetBackupStatus gets the current status of a backup
func (u *serverBackupUsecase) GetBackupStatus(ctx context.Context, backupID string) (*domain.ServerBackup, error) {
	if backupID == "" {
		return nil, errors.New("backup ID is required")
	}
	return u.backupRepo.GetByID(ctx, backupID)
}
