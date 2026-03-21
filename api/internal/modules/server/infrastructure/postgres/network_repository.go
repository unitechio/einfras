package serverpostgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	domain "einfra/api/internal/modules/server/domain"
)

type NetworkRepository struct {
	db *gorm.DB
}

func NewNetworkRepository(db *gorm.DB) *NetworkRepository {
	return &NetworkRepository{db: db}
}

func (r *NetworkRepository) CreateInterface(ctx context.Context, iface *domain.NetworkInterface) error {
	return r.db.WithContext(ctx).Create(iface).Error
}

func (r *NetworkRepository) GetInterfacesByServerID(ctx context.Context, serverID string) ([]*domain.NetworkInterface, error) {
	var items []*domain.NetworkInterface
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("name asc").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *NetworkRepository) UpdateInterface(ctx context.Context, iface *domain.NetworkInterface) error {
	return r.db.WithContext(ctx).Model(&domain.NetworkInterface{}).Where("id = ?", iface.ID).Updates(iface).Error
}

func (r *NetworkRepository) DeleteInterfacesByServerID(ctx context.Context, serverID string) error {
	return r.db.WithContext(ctx).Delete(&domain.NetworkInterface{}, "server_id = ?", serverID).Error
}

func (r *NetworkRepository) CreateConnectivityCheck(ctx context.Context, check *domain.NetworkConnectivityCheck) error {
	return r.db.WithContext(ctx).Create(check).Error
}

func (r *NetworkRepository) GetConnectivityCheckByID(ctx context.Context, id string) (*domain.NetworkConnectivityCheck, error) {
	var item domain.NetworkConnectivityCheck
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&item).Error; err != nil {
		return nil, fmt.Errorf("load connectivity check %q: %w", id, err)
	}
	return &item, nil
}

func (r *NetworkRepository) UpdateConnectivityCheck(ctx context.Context, check *domain.NetworkConnectivityCheck) error {
	return r.db.WithContext(ctx).Model(&domain.NetworkConnectivityCheck{}).
		Where("id = ?", check.ID).
		Updates(check).Error
}

func (r *NetworkRepository) GetConnectivityHistory(ctx context.Context, serverID string, limit int) ([]*domain.NetworkConnectivityCheck, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []*domain.NetworkConnectivityCheck
	if err := r.db.WithContext(ctx).Where("server_id = ?", serverID).Order("tested_at desc").Limit(limit).Find(&items).Error; err != nil {
		return nil, fmt.Errorf("load connectivity history: %w", err)
	}
	return items, nil
}
