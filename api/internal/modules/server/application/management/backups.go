package managementapp

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type BackupManager struct {
	servers    domain.ServerRepository
	backups    domain.ServerBackupRepository
	dispatcher AgentCommandDispatcher
}

func NewBackupManager(servers domain.ServerRepository, backups domain.ServerBackupRepository, dispatcher AgentCommandDispatcher) *BackupManager {
	return &BackupManager{servers: servers, backups: backups, dispatcher: dispatcher}
}

func (m *BackupManager) Create(ctx context.Context, backup *domain.ServerBackup, userID string, sourcePaths []string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, backup.ServerID); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if backup.ID == "" {
		backup.ID = uuid.NewString()
	}
	if backup.Name == "" {
		backup.Name = "server-backup-" + now.Format("20060102-150405")
	}
	if backup.Type == "" {
		backup.Type = domain.BackupTypeFull
	}
	if backup.BackupPath == "" {
		backup.BackupPath = filepath.ToSlash(filepath.Join("/var/backups/einfra", backup.ServerID, backup.Name+".tar.gz"))
	}
	backup.Status = domain.BackupStatusInProgress
	backup.Compressed = true
	backup.CreatedAt = now
	backup.UpdatedAt = now
	backup.StartedAt = &now
	if err := m.backups.Create(ctx, backup); err != nil {
		return nil, err
	}

	paths := sanitizeBackupPaths(sourcePaths)
	cmdText := fmt.Sprintf(
		"mkdir -p %s && tar -czf %s %s && stat -c %%s %s",
		filepath.ToSlash(filepath.Dir(backup.BackupPath)),
		backup.BackupPath,
		strings.Join(paths, " "),
		backup.BackupPath,
	)
	command, err := m.dispatcher.Dispatch(ctx, backup.ServerID, userID, cmdText, 3600, "backup-create:"+backup.ID)
	if err != nil {
		backup.Status = domain.BackupStatusFailed
		backup.ErrorMessage = err.Error()
		backup.UpdatedAt = time.Now().UTC()
		_ = m.backups.Update(ctx, backup)
		return nil, err
	}
	return command, nil
}

func (m *BackupManager) Get(ctx context.Context, id string) (*domain.ServerBackup, error) {
	return m.backups.GetByID(ctx, id)
}

func (m *BackupManager) List(ctx context.Context, filter domain.BackupFilter) ([]*domain.ServerBackup, int64, error) {
	return m.backups.List(ctx, filter)
}

func (m *BackupManager) Delete(ctx context.Context, id string) error {
	return m.backups.Delete(ctx, id)
}

func (m *BackupManager) Restore(ctx context.Context, backupID, userID string) (*agent.Command, error) {
	backup, err := m.backups.GetByID(ctx, backupID)
	if err != nil {
		return nil, err
	}
	cmdText := fmt.Sprintf("tar -xzf %s -C /", backup.BackupPath)
	return m.dispatcher.Dispatch(ctx, backup.ServerID, userID, cmdText, 3600, "backup-restore:"+backupID)
}

func sanitizeBackupPaths(paths []string) []string {
	if len(paths) == 0 {
		return []string{"/etc", "/opt", "/srv", "/var/www"}
	}
	items := make([]string, 0, len(paths))
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" || strings.ContainsAny(path, "'\";&|") {
			continue
		}
		items = append(items, path)
	}
	if len(items) == 0 {
		return []string{"/etc"}
	}
	return items
}
