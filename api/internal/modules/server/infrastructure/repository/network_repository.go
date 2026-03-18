package repository

import (
	"context"
	"errors"

	domain "einfra/api/internal/modules/server/domain"
	"gorm.io/gorm"
)

type serverNetworkRepository struct {
	db *gorm.DB
}

// NewServerNetworkRepository creates a new server network repository instance
func NewServerNetworkRepository(db *gorm.DB) domain.ServerNetworkRepository {
	return &serverNetworkRepository{db: db}
}

// CreateInterface creates a new network interface record
func (r *serverNetworkRepository) CreateInterface(ctx context.Context, iface *domain.NetworkInterface) error {
	return r.db.WithContext(ctx).Create(iface).Error
}

// GetInterfaceByID retrieves a network interface by its ID
func (r *serverNetworkRepository) GetInterfaceByID(ctx context.Context, id string) (*domain.NetworkInterface, error) {
	var iface domain.NetworkInterface
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(&iface).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("network interface not found")
		}
		return nil, err
	}
	return &iface, nil
}

// GetInterfacesByServerID retrieves all network interfaces for a server
func (r *serverNetworkRepository) GetInterfacesByServerID(ctx context.Context, serverID string) ([]*domain.NetworkInterface, error) {
	var interfaces []*domain.NetworkInterface
	err := r.db.WithContext(ctx).
		Where("server_id = ? AND deleted_at IS NULL", serverID).
		Order("name ASC").
		Find(&interfaces).Error

	if err != nil {
		return nil, err
	}

	return interfaces, nil
}

// UpdateInterface updates an existing network interface
func (r *serverNetworkRepository) UpdateInterface(ctx context.Context, iface *domain.NetworkInterface) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", iface.ID).
		Updates(iface)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("network interface not found or already deleted")
	}
	return nil
}

// DeleteInterface soft deletes a network interface
func (r *serverNetworkRepository) DeleteInterface(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).
		Model(&domain.NetworkInterface{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("CURRENT_TIMESTAMP"))

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("network interface not found or already deleted")
	}
	return nil
}

// CreateConnectivityCheck creates a new connectivity check record
func (r *serverNetworkRepository) CreateConnectivityCheck(ctx context.Context, check *domain.NetworkConnectivityCheck) error {
	return r.db.WithContext(ctx).Create(check).Error
}

// GetConnectivityHistory retrieves connectivity check history
func (r *serverNetworkRepository) GetConnectivityHistory(ctx context.Context, serverID string, limit int) ([]*domain.NetworkConnectivityCheck, error) {
	var checks []*domain.NetworkConnectivityCheck

	query := r.db.WithContext(ctx).
		Where("server_id = ?", serverID).
		Order("tested_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&checks).Error
	if err != nil {
		return nil, err
	}

	return checks, nil
}
