//go:build legacy
// +build legacy

package repository

import (
	"context"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type AuthorizationRepository interface {
	CreateUserEnvironmentRole(ctx context.Context, uer *domain.UserEnvironmentRole) error
	GetUserEnvironmentRoles(ctx context.Context, userID string) ([]*domain.UserEnvironmentRole, error)
	GetUserEnvironmentRolesByEnv(ctx context.Context, userID, environmentID string) ([]*domain.UserEnvironmentRole, error)
	DeleteUserEnvironmentRole(ctx context.Context, id string) error

	// ResourcePermission operations
	CreateResourcePermission(ctx context.Context, rp *domain.ResourcePermission) error
	GetResourcePermission(ctx context.Context, id string) (*domain.ResourcePermission, error)
	GetUserResourcePermissions(ctx context.Context, userID string) ([]*domain.ResourcePermission, error)
	GetResourcePermissions(ctx context.Context, resourceType domain.ResourceType, resourceID string) ([]*domain.ResourcePermission, error)
	GetUserResourcePermissionByResource(ctx context.Context, userID string, resourceType domain.ResourceType, resourceID string) (*domain.ResourcePermission, error)
	UpdateResourcePermission(ctx context.Context, rp *domain.ResourcePermission) error
	DeleteResourcePermission(ctx context.Context, id string) error
	CleanupExpiredPermissions(ctx context.Context) (int64, error)

	// Permission checking
	GetUserPermissions(ctx context.Context, userID string) (*domain.UserPermissions, error)
}
type authorizationRepository struct {
	db *gorm.DB
}

func NewAuthorizationRepository(db *gorm.DB) AuthorizationRepository {
	return &authorizationRepository{db: db}
}

func (r *authorizationRepository) CreateUserEnvironmentRole(ctx context.Context, uer *domain.UserEnvironmentRole) error {
	return r.db.WithContext(ctx).Create(uer).Error
}

func (r *authorizationRepository) GetUserEnvironmentRoles(ctx context.Context, userID string) ([]*domain.UserEnvironmentRole, error) {
	var roles []*domain.UserEnvironmentRole
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Preload("Environment").
		Where("user_id = ?", userID).
		Find(&roles).Error
	return roles, err
}

func (r *authorizationRepository) GetUserEnvironmentRolesByEnv(ctx context.Context, userID, environmentID string) ([]*domain.UserEnvironmentRole, error) {
	var roles []*domain.UserEnvironmentRole
	err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Preload("Environment").
		Where("user_id = ? AND (environment_id = ? OR environment_id IS NULL)", userID, environmentID).
		Find(&roles).Error
	return roles, err
}

func (r *authorizationRepository) DeleteUserEnvironmentRole(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.UserEnvironmentRole{}).Error
}

// ResourcePermission operations

func (r *authorizationRepository) CreateResourcePermission(ctx context.Context, rp *domain.ResourcePermission) error {
	return r.db.WithContext(ctx).Create(rp).Error
}

func (r *authorizationRepository) GetResourcePermission(ctx context.Context, id string) (*domain.ResourcePermission, error) {
	var rp domain.ResourcePermission
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Environment").
		Where("id = ?", id).
		First(&rp).Error
	if err != nil {
		return nil, err
	}
	return &rp, nil
}

func (r *authorizationRepository) GetUserResourcePermissions(ctx context.Context, userID string) ([]*domain.ResourcePermission, error) {
	var permissions []*domain.ResourcePermission
	err := r.db.WithContext(ctx).
		Preload("Environment").
		Where("user_id = ? AND (expires_at IS NULL OR expires_at > ?)", userID, time.Now()).
		Find(&permissions).Error
	return permissions, err
}

func (r *authorizationRepository) GetResourcePermissions(ctx context.Context, resourceType domain.ResourceType, resourceID string) ([]*domain.ResourcePermission, error) {
	var permissions []*domain.ResourcePermission
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Environment").
		Where("resource_type = ? AND resource_id = ? AND (expires_at IS NULL OR expires_at > ?)", resourceType, resourceID, time.Now()).
		Find(&permissions).Error
	return permissions, err
}

func (r *authorizationRepository) GetUserResourcePermissionByResource(ctx context.Context, userID string, resourceType domain.ResourceType, resourceID string) (*domain.ResourcePermission, error) {
	var rp domain.ResourcePermission
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND resource_type = ? AND resource_id = ? AND (expires_at IS NULL OR expires_at > ?)",
			userID, resourceType, resourceID, time.Now()).
		First(&rp).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &rp, nil
}

func (r *authorizationRepository) UpdateResourcePermission(ctx context.Context, rp *domain.ResourcePermission) error {
	return r.db.WithContext(ctx).Save(rp).Error
}

func (r *authorizationRepository) DeleteResourcePermission(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.ResourcePermission{}).Error
}

func (r *authorizationRepository) CleanupExpiredPermissions(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).
		Where("expires_at IS NOT NULL AND expires_at < ?", time.Now()).
		Delete(&domain.ResourcePermission{})
	return result.RowsAffected, result.Error
}

// Permission checking

func (r *authorizationRepository) GetUserPermissions(ctx context.Context, userID string) (*domain.UserPermissions, error) {
	userPerms := &domain.UserPermissions{
		UserID:               userID,
		GlobalRoles:          []*domain.Role{},
		EnvironmentRoles:     []*domain.UserEnvironmentRole{},
		ResourcePermissions:  []*domain.ResourcePermission{},
		EffectivePermissions: []string{},
	}

	// Get user's global role
	var user domain.User
	if err := r.db.WithContext(ctx).
		Preload("Role").
		Preload("Role.Permissions").
		Where("id = ?", userID).
		First(&user).Error; err == nil && user.Role != nil {
		userPerms.GlobalRoles = append(userPerms.GlobalRoles, user.Role)

		// Add global role permissions to effective permissions
		for _, perm := range user.Role.Permissions {
			userPerms.EffectivePermissions = append(userPerms.EffectivePermissions, perm.Name)
		}
	}

	// Get environment-specific roles
	envRoles, err := r.GetUserEnvironmentRoles(ctx, userID)
	if err == nil {
		userPerms.EnvironmentRoles = envRoles

		// Add environment role permissions to effective permissions
		for _, envRole := range envRoles {
			if envRole.Role != nil {
				for _, perm := range envRole.Role.Permissions {
					// Add with environment context if applicable
					if envRole.EnvironmentID != nil {
						userPerms.EffectivePermissions = append(userPerms.EffectivePermissions, perm.Name+"@"+*envRole.EnvironmentID)
					} else {
						userPerms.EffectivePermissions = append(userPerms.EffectivePermissions, perm.Name)
					}
				}
			}
		}
	}

	// Get resource-specific permissions
	resourcePerms, err := r.GetUserResourcePermissions(ctx, userID)
	if err == nil {
		userPerms.ResourcePermissions = resourcePerms

		// Add resource permissions to effective permissions
		for _, rp := range resourcePerms {
			for _, action := range rp.Actions {
				permName := string(rp.ResourceType) + "." + action + "#" + rp.ResourceID
				userPerms.EffectivePermissions = append(userPerms.EffectivePermissions, permName)
			}
		}
	}

	return userPerms, nil
}
