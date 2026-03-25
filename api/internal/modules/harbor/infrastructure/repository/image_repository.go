//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type ImageRepository interface {
	Create(ctx context.Context, image *domain.Image) error
	UpdatePaths(ctx context.Context, image *domain.Image) error
	GetByID(ctx context.Context, id string) (*domain.Image, error)
	GetByUserID(ctx context.Context, userID string) ([]*domain.Image, error)
}

type imageRepository struct {
	db *gorm.DB
}

func NewImageRepository(db *gorm.DB) ImageRepository {
	return &imageRepository{db: db}
}

func (r *imageRepository) Create(ctx context.Context, image *domain.Image) error {
	return r.db.WithContext(ctx).Create(image).Error
}

func (r *imageRepository) UpdatePaths(ctx context.Context, image *domain.Image) error {
	return r.db.WithContext(ctx).Model(image).Updates(map[string]interface{}{
		"webp_path":      image.WebpPath,
		"thumbnail_path": image.ThumbnailPath,
	}).Error
}

func (r *imageRepository) GetByID(ctx context.Context, id string) (*domain.Image, error) {
	var image domain.Image
	if err := r.db.WithContext(ctx).First(&image, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("image not found")
		}
		return nil, err
	}
	return &image, nil
}

func (r *imageRepository) GetByUserID(ctx context.Context, userID string) ([]*domain.Image, error) {
	var images []*domain.Image
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&images).Error; err != nil {
		return nil, err
	}
	return images, nil
}
