package repository

import (
	"context"
	"errors"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type serverBackupRepository struct {
	db *gorm.DB
}

// NewServerBackupRepository creates a new server backup repository instance
func NewServerBackupRepository(db *gorm.DB) domain.ServerBackupRepository {
	return &serverBackupRepository{db: db}
}

// Create creates a new backup record
func (r *serverBackupRepository) Create(ctx context.Context, backup *domain.ServerBackup) error {
	return r.db.WithContext(ctx).Create(backup).Error
}

// GetByID retrieves a backup by its ID
func (r *serverBackupRepository) GetByID(ctx context.Context, id string) (*domain.ServerBackup, error) {
	var backup domain.ServerBackup
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&backup).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("backup not found")
		}
		return nil, err
	}

	// Calculate size in GB
	if backup.SizeBytes > 0 {
		backup.SizeGB = float64(backup.SizeBytes) / (1024 * 1024 * 1024)
	}

	return &backup, nil
}

// List retrieves all backups with pagination and filtering
func (r *serverBackupRepository) List(ctx context.Context, filter domain.BackupFilter) ([]*domain.ServerBackup, int64, error) {
	var backups []*domain.ServerBackup
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.ServerBackup{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination
	if filter.Page > 0 && filter.PageSize > 0 {
		offset := (filter.Page - 1) * filter.PageSize
		query = query.Offset(offset).Limit(filter.PageSize)
	}

	// Execute query
	if err := query.Order("created_at DESC").Find(&backups).Error; err != nil {
		return nil, 0, err
	}

	// Calculate size in GB for each backup
	for _, backup := range backups {
		if backup.SizeBytes > 0 {
			backup.SizeGB = float64(backup.SizeBytes) / (1024 * 1024 * 1024)
		}
	}

	return backups, total, nil
}

// Update updates an existing backup
func (r *serverBackupRepository) Update(ctx context.Context, backup *domain.ServerBackup) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", backup.ID).
		Updates(backup)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("backup not found or already deleted")
	}
	return nil
}

// Delete soft deletes a backup
func (r *serverBackupRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerBackup{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("backup not found or already deleted")
	}
	return nil
}

// DeleteExpired deletes expired backups
func (r *serverBackupRepository) DeleteExpired(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).
		Model(&domain.ServerBackup{}).
		Where("expires_at IS NOT NULL AND expires_at < ? AND deleted_at IS NULL", time.Now()).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}

// GetByServerID retrieves all backups for a server
func (r *serverBackupRepository) GetByServerID(ctx context.Context, serverID string) ([]*domain.ServerBackup, error) {
	var backups []*domain.ServerBackup
	err := r.db.WithContext(ctx).
		Where("server_id = ? AND deleted_at IS NULL", serverID).
		Order("created_at DESC").
		Find(&backups).Error

	if err != nil {
		return nil, err
	}

	// Calculate size in GB for each backup
	for _, backup := range backups {
		if backup.SizeBytes > 0 {
			backup.SizeGB = float64(backup.SizeBytes) / (1024 * 1024 * 1024)
		}
	}

	return backups, nil
}
