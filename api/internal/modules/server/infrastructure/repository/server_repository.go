package repository

import (
	"context"
	"errors"
	"fmt"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/security"
	"gorm.io/gorm"
)

type serverRepository struct {
	db         *gorm.DB
	encryption security.EncryptionService
	auditor    security.CredentialAuditor
}

// NewServerRepository creates a new server repository instance
func NewServerRepository(db *gorm.DB, encryption security.EncryptionService, auditor security.CredentialAuditor) domain.ServerRepository {
	return &serverRepository{
		db:         db,
		encryption: encryption,
		auditor:    auditor,
	}
}

// Create creates a new server record
func (r *serverRepository) Create(ctx context.Context, server *domain.Server) error {
	// Encrypt SSH password before saving
	if server.SSHPassword != "" {
		encrypted, err := r.encryption.Encrypt(server.SSHPassword)
		if err != nil {
			r.auditor.LogEncryption(ctx, server.ID, false, err)
			return fmt.Errorf("failed to encrypt SSH password: %w", err)
		}
		server.SSHPassword = encrypted
		r.auditor.LogEncryption(ctx, server.ID, true, nil)
	}

	return r.db.WithContext(ctx).Create(server).Error
}

// GetByID retrieves a server by its ID
func (r *serverRepository) GetByID(ctx context.Context, id string) (*domain.Server, error) {
	var server domain.Server
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&server).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("server not found")
		}
		return nil, err
	}

	// Decrypt SSH password after retrieving
	if server.SSHPassword != "" {
		decrypted, err := r.encryption.Decrypt(server.SSHPassword)
		if err != nil {
			r.auditor.LogDecryption(ctx, server.ID, false, err)
			return nil, fmt.Errorf("failed to decrypt SSH password: %w", err)
		}
		server.SSHPassword = decrypted
		r.auditor.LogDecryption(ctx, server.ID, true, nil)
	}

	return &server, nil
}

// GetByIPAddress retrieves a server by its IP address
func (r *serverRepository) GetByIPAddress(ctx context.Context, ip string) (*domain.Server, error) {
	var server domain.Server
	err := r.db.WithContext(ctx).Where("ip_address = ? AND deleted_at IS NULL", ip).First(&server).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("server not found")
		}
		return nil, err
	}

	// Decrypt SSH password after retrieving
	if server.SSHPassword != "" {
		decrypted, err := r.encryption.Decrypt(server.SSHPassword)
		if err != nil {
			r.auditor.LogDecryption(ctx, server.ID, false, err)
			return nil, fmt.Errorf("failed to decrypt SSH password: %w", err)
		}
		server.SSHPassword = decrypted
		r.auditor.LogDecryption(ctx, server.ID, true, nil)
	}

	return &server, nil
}

// List retrieves all servers with pagination and filtering
func (r *serverRepository) List(ctx context.Context, filter domain.ServerFilter) ([]*domain.Server, int64, error) {
	var servers []*domain.Server
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Server{}).Where("deleted_at IS NULL")

	// Apply filters
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.OS != "" {
		query = query.Where("os = ?", filter.OS)
	}
	if filter.Location != "" {
		query = query.Where("location = ?", filter.Location)
	}
	if filter.Provider != "" {
		query = query.Where("provider = ?", filter.Provider)
	}
	if len(filter.Tags) > 0 {
		query = query.Where("tags @> ?", filter.Tags)
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
	if err := query.Order("created_at DESC").Find(&servers).Error; err != nil {
		return nil, 0, err
	}

	// Decrypt SSH passwords for all servers
	for _, server := range servers {
		if server.SSHPassword != "" {
			decrypted, err := r.encryption.Decrypt(server.SSHPassword)
			if err != nil {
				r.auditor.LogDecryption(ctx, server.ID, false, err)
				// Don't fail the entire query, just log the error
				continue
			}
			server.SSHPassword = decrypted
			r.auditor.LogDecryption(ctx, server.ID, true, nil)
		}
	}

	return servers, total, nil
}

// Update updates an existing server
func (r *serverRepository) Update(ctx context.Context, server *domain.Server) error {
	// Encrypt SSH password if it's being updated
	if server.SSHPassword != "" {
		encrypted, err := r.encryption.Encrypt(server.SSHPassword)
		if err != nil {
			r.auditor.LogEncryption(ctx, server.ID, false, err)
			return fmt.Errorf("failed to encrypt SSH password: %w", err)
		}
		server.SSHPassword = encrypted
		r.auditor.LogEncryption(ctx, server.ID, true, nil)
	}

	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", server.ID).
		Updates(server)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("server not found or already deleted")
	}
	return nil
}

// Delete soft deletes a server
func (r *serverRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.Server{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("server not found or already deleted")
	}
	return nil
}

// UpdateStatus updates only the status of a server
func (r *serverRepository) UpdateStatus(ctx context.Context, id string, status domain.ServerStatus) error {
	result := r.db.WithContext(ctx).
		Model(&domain.Server{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("status", status)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("server not found or already deleted")
	}
	return nil
}
