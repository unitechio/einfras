//go:build legacy
// +build legacy

package usecase

import (
	"einfra/api/internal/domain"
)

type SystemSettingUsecase struct {
	repo domain.SystemSettingRepository
}

func NewSystemSettingUsecase(repo domain.SystemSettingRepository) *SystemSettingUsecase {
	return &SystemSettingUsecase{repo: repo}
}

func (uc *SystemSettingUsecase) CreateSystemSetting(setting *domain.SystemSetting) (*domain.SystemSetting, error) {
	return uc.repo.Create(setting)
}

func (uc *SystemSettingUsecase) GetSystemSettingByKey(key string) (*domain.SystemSetting, error) {
	return uc.repo.GetByKey(key)
}

func (uc *SystemSettingUsecase) GetAllSystemSettings() ([]*domain.SystemSetting, error) {
	return uc.repo.GetAll()
}

func (uc *SystemSettingUsecase) GetSystemSettingsByCategory(category string) ([]*domain.SystemSetting, error) {
	return uc.repo.GetByCategory(category)
}

func (uc *SystemSettingUsecase) UpdateSystemSetting(setting *domain.SystemSetting) (*domain.SystemSetting, error) {
	return uc.repo.Update(setting)
}

func (uc *SystemSettingUsecase) DeleteSystemSetting(id string) error {
	return uc.repo.Delete(id)
}
