//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type notificationTemplateRepository struct {
	db *gorm.DB
}

func NewNotificationTemplateRepository(db *gorm.DB) domain.NotificationTemplateRepository {
	return &notificationTemplateRepository{db: db}
}

func (r *notificationTemplateRepository) Create(ctx context.Context, template *domain.NotificationTemplate) error {
	return r.db.WithContext(ctx).Create(template).Error
}

func (r *notificationTemplateRepository) GetByID(ctx context.Context, id string) (*domain.NotificationTemplate, error) {
	var template domain.NotificationTemplate
	err := r.db.WithContext(ctx).First(&template, "id = ?", id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("template not found")
		}
		return nil, err
	}
	return &template, nil
}

func (r *notificationTemplateRepository) GetByName(ctx context.Context, name string) (*domain.NotificationTemplate, error) {
	var template domain.NotificationTemplate
	err := r.db.WithContext(ctx).First(&template, "name = ?", name).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("template not found")
		}
		return nil, err
	}
	return &template, nil
}

func (r *notificationTemplateRepository) List(ctx context.Context, filter domain.NotificationTemplateFilter) ([]*domain.NotificationTemplate, int64, error) {
	var templates []*domain.NotificationTemplate
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.NotificationTemplate{})

	if filter.Type != nil {
		query = query.Where("type = ?", *filter.Type)
	}
	if filter.Channel != nil {
		query = query.Where("channel = ?", *filter.Channel)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.PageSize
	query = query.Offset(offset).Limit(filter.PageSize).Order("created_at DESC")

	if err := query.Find(&templates).Error; err != nil {
		return nil, 0, err
	}

	return templates, total, nil
}

func (r *notificationTemplateRepository) Update(ctx context.Context, template *domain.NotificationTemplate) error {
	return r.db.WithContext(ctx).Save(template).Error
}

func (r *notificationTemplateRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.NotificationTemplate{}, "id = ?", id).Error
}
