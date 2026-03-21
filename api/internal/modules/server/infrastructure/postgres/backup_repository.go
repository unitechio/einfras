package serverpostgres

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type BackupRepository struct {
	db *gorm.DB
}

func NewBackupRepository(db *gorm.DB) *BackupRepository {
	return &BackupRepository{db: db}
}

func (r *BackupRepository) Create(ctx context.Context, backup *domain.ServerBackup) error {
	return r.db.WithContext(ctx).Create(backup).Error
}

func (r *BackupRepository) GetByID(ctx context.Context, id string) (*domain.ServerBackup, error) {
	var backup domain.ServerBackup
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&backup).Error; err != nil {
		return nil, fmt.Errorf("backup %q not found: %w", id, err)
	}
	return &backup, nil
}

func (r *BackupRepository) List(ctx context.Context, filter domain.BackupFilter) ([]*domain.ServerBackup, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.ServerBackup{})
	if filter.ServerID != "" {
		query = query.Where("server_id = ?", filter.ServerID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	var backups []*domain.ServerBackup
	if err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&backups).Error; err != nil {
		return nil, 0, err
	}
	return backups, total, nil
}

func (r *BackupRepository) Update(ctx context.Context, backup *domain.ServerBackup) error {
	return r.db.WithContext(ctx).Model(&domain.ServerBackup{}).Where("id = ?", backup.ID).Updates(backup).Error
}

func (r *BackupRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.ServerBackup{}, "id = ?", id).Error
}

func (r *BackupRepository) DeleteExpired(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).Where("expires_at IS NOT NULL AND expires_at < ?", time.Now().UTC()).Delete(&domain.ServerBackup{})
	return result.RowsAffected, result.Error
}
