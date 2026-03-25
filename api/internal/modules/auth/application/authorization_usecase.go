//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"einfra/api/internal/modules/auth/infrastructure"
	_settings "einfra/api/internal/modules/server/infrastructure/settings_repo"
	"einfra/api/internal/domain"
)

type authorizationUsecase struct {
	authRepo repository.AuthorizationRepository
	roleRepo repository.RoleRepository
	userRepo repository.UserRepository
	envRepo  _settings.EnvironmentRepository
}

func NewAuthorizationUsecase(
	authRepo repository.AuthorizationRepository,
	roleRepo repository.RoleRepository,
	userRepo repository.UserRepository,
	envRepo _settings.EnvironmentRepository,
) domain.AuthorizationUsecase {
	return &authorizationUsecase{
		authRepo: authRepo,
		roleRepo: roleRepo,
		userRepo: userRepo,
		envRepo:  envRepo,
	}
}

// CheckPermission checks if a user has a specific permission globally
func (u *authorizationUsecase) CheckPermission(ctx context.Context, userID, permission string) (bool, error) {
	userPerms, err := u.authRepo.GetUserPermissions(ctx, userID)
	if err != nil {
		return false, err
	}

	// Check in effective permissions
	for _, perm := range userPerms.EffectivePermissions {
		// Remove environment and resource context for global check
		basePerm := strings.Split(perm, "@")[0]
		basePerm = strings.Split(basePerm, "#")[0]
		if basePerm == permission {
			return true, nil
		}
	}

	// Check wildcard permissions (e.g., "k8s.*" matches "k8s.deployment.create")
	parts := strings.Split(permission, ".")
	if len(parts) > 1 {
		wildcardPerm := parts[0] + ".*"
		for _, perm := range userPerms.EffectivePermissions {
			basePerm := strings.Split(perm, "@")[0]
			basePerm = strings.Split(basePerm, "#")[0]
			if basePerm == wildcardPerm {
				return true, nil
			}
		}
	}

	return false, nil
}

// CheckEnvironmentPermission checks if a user has a specific permission in an environment
func (u *authorizationUsecase) CheckEnvironmentPermission(ctx context.Context, userID, permission, environmentID string) (bool, error) {
	// First check global permission
	hasGlobal, err := u.CheckPermission(ctx, userID, permission)
	if err != nil {
		return false, err
	}
	if hasGlobal {
		return true, nil
	}

	// Check environment-specific roles
	envRoles, err := u.authRepo.GetUserEnvironmentRolesByEnv(ctx, userID, environmentID)
	if err != nil {
		return false, err
	}

	for _, envRole := range envRoles {
		if envRole.Role != nil {
			for _, perm := range envRole.Role.Permissions {
				if perm.Name == permission {
					return true, nil
				}
				// Check wildcard
				parts := strings.Split(permission, ".")
				if len(parts) > 1 {
					wildcardPerm := parts[0] + ".*"
					if perm.Name == wildcardPerm {
						return true, nil
					}
				}
			}
		}
	}

	return false, nil
}

// CheckResourcePermission checks if a user has a specific permission on a resource
func (u *authorizationUsecase) CheckResourcePermission(ctx context.Context, userID string, resourceType domain.ResourceType, resourceID, action string) (bool, error) {
	// First check global permission
	permissionName := string(resourceType) + "." + action
	hasGlobal, err := u.CheckPermission(ctx, userID, permissionName)
	if err != nil {
		return false, err
	}
	if hasGlobal {
		return true, nil
	}

	// Check resource-specific permission
	resourcePerm, err := u.authRepo.GetUserResourcePermissionByResource(ctx, userID, resourceType, resourceID)
	if err != nil {
		return false, err
	}

	if resourcePerm != nil {
		// Check if permission is expired
		if resourcePerm.IsExpired() {
			return false, nil
		}

		// Check if action is in the allowed actions
		if resourcePerm.HasAction(action) {
			return true, nil
		}
	}

	return false, nil
}

// CheckNamespacePermission checks if a user has permission on a K8s namespace
func (u *authorizationUsecase) CheckNamespacePermission(ctx context.Context, userID, clusterID, namespace, action string) (bool, error) {
	// Check cluster-level permission first
	hasClusterPerm, err := u.CheckResourcePermission(ctx, userID, domain.ResourceTypeK8sCluster, clusterID, action)
	if err != nil {
		return false, err
	}
	if hasClusterPerm {
		return true, nil
	}

	// Check namespace-specific permission
	namespaceResourceID := clusterID + "/" + namespace
	return u.CheckResourcePermission(ctx, userID, domain.ResourceTypeK8sNamespace, namespaceResourceID, action)
}

// GrantResourcePermission grants a resource permission to a user
func (u *authorizationUsecase) GrantResourcePermission(ctx context.Context, req *domain.GrantPermissionRequest, grantedBy string) error {
	// Validate user exists
	_, err := u.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Validate environment if specified
	if req.EnvironmentID != nil {
		_, err := u.envRepo.GetByID(ctx, *req.EnvironmentID)
		if err != nil {
			return fmt.Errorf("environment not found")
		}
	}

	// Validate resource type
	validResourceTypes := []string{
		string(domain.ResourceTypeServer),
		string(domain.ResourceTypeK8sCluster),
		string(domain.ResourceTypeK8sNamespace),
		string(domain.ResourceTypeDockerContainer),
		string(domain.ResourceTypeHarborProject),
	}
	isValidType := false
	for _, rt := range validResourceTypes {
		if req.ResourceType == rt {
			isValidType = true
			break
		}
	}
	if !isValidType {
		return fmt.Errorf("invalid resource type: %s", req.ResourceType)
	}

	// Check if permission already exists
	existing, _ := u.authRepo.GetUserResourcePermissionByResource(ctx, req.UserID, domain.ResourceType(req.ResourceType), req.ResourceID)
	if existing != nil {
		// Update existing permission
		existing.Actions = req.Actions
		existing.EnvironmentID = req.EnvironmentID
		existing.ExpiresAt = req.ExpiresAt
		existing.Reason = req.Reason
		existing.UpdatedAt = time.Now()
		return u.authRepo.UpdateResourcePermission(ctx, existing)
	}

	// Create new permission
	resourcePerm := &domain.ResourcePermission{
		UserID:        req.UserID,
		ResourceType:  domain.ResourceType(req.ResourceType),
		ResourceID:    req.ResourceID,
		Actions:       req.Actions,
		EnvironmentID: req.EnvironmentID,
		ExpiresAt:     req.ExpiresAt,
		GrantedBy:     grantedBy,
		Reason:        req.Reason,
	}

	return u.authRepo.CreateResourcePermission(ctx, resourcePerm)
}

// RevokeResourcePermission revokes a resource permission from a user
func (u *authorizationUsecase) RevokeResourcePermission(ctx context.Context, req *domain.RevokePermissionRequest, revokedBy string) error {
	// Check if permission exists
	_, err := u.authRepo.GetResourcePermission(ctx, req.PermissionID)
	if err != nil {
		return fmt.Errorf("permission not found")
	}

	// TODO: Log the revocation with reason and revokedBy in audit log

	return u.authRepo.DeleteResourcePermission(ctx, req.PermissionID)
}

// AssignEnvironmentRole assigns a role to a user in a specific environment
func (u *authorizationUsecase) AssignEnvironmentRole(ctx context.Context, userID, roleID string, environmentID *string, assignedBy string) error {
	// Validate user exists
	_, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Validate role exists
	_, err = u.roleRepo.GetByID(ctx, roleID)
	if err != nil {
		return fmt.Errorf("role not found")
	}

	// Validate environment if specified
	if environmentID != nil {
		_, err := u.envRepo.GetByID(ctx, *environmentID)
		if err != nil {
			return fmt.Errorf("environment not found")
		}
	}

	// Create user environment role
	uer := &domain.UserEnvironmentRole{
		UserID:        userID,
		EnvironmentID: environmentID,
		RoleID:        roleID,
		CreatedBy:     assignedBy,
	}

	return u.authRepo.CreateUserEnvironmentRole(ctx, uer)
}

// RemoveEnvironmentRole removes an environment role assignment
func (u *authorizationUsecase) RemoveEnvironmentRole(ctx context.Context, id string) error {
	return u.authRepo.DeleteUserEnvironmentRole(ctx, id)
}

// ListUserPermissions lists all permissions for a user
func (u *authorizationUsecase) ListUserPermissions(ctx context.Context, userID string) (*domain.UserPermissions, error) {
	return u.authRepo.GetUserPermissions(ctx, userID)
}

// ListResourcePermissions lists all permissions for a specific resource
func (u *authorizationUsecase) ListResourcePermissions(ctx context.Context, resourceType domain.ResourceType, resourceID string) ([]*domain.ResourcePermission, error) {
	return u.authRepo.GetResourcePermissions(ctx, resourceType, resourceID)
}

// CleanupExpiredPermissions removes expired resource permissions
func (u *authorizationUsecase) CleanupExpiredPermissions(ctx context.Context) (int64, error) {
	return u.authRepo.CleanupExpiredPermissions(ctx)
}
