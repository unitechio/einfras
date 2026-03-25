package iam

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"gopkg.in/gomail.v2"
	"gorm.io/gorm"
)

type Mailer interface {
	Send(ctx context.Context, to, subject, htmlBody string) error
}

type Service struct {
	db      *gorm.DB
	cache   *redis.Client
	tokens  *TokenManager
	mailer  Mailer
	baseURL string
}

func NewService(db *gorm.DB, cache *redis.Client, tokens *TokenManager, mailer Mailer, baseURL string) *Service {
	return &Service{db: db, cache: cache, tokens: tokens, mailer: mailer, baseURL: strings.TrimRight(baseURL, "/")}
}

type LoginRequest struct {
	Identifier     string `json:"identifier"`
	Password       string `json:"password"`
	OrganizationID string `json:"organization_id"`
}

type LoginTOTPRequest struct {
	MFAToken string `json:"mfa_token"`
	Code     string `json:"code"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetConfirmRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

type MFASetupResponse struct {
	SetupToken    string   `json:"setup_token"`
	Secret        string   `json:"secret"`
	OTPAuthURL    string   `json:"otpauth_url"`
	RecoveryCodes []string `json:"recovery_codes"`
}

type MFAConfirmRequest struct {
	SetupToken string `json:"setup_token"`
	Code       string `json:"code"`
}

type MFAResetConfirmRequest struct {
	Token string `json:"token"`
}

type UserDTO struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Email     string   `json:"email"`
	FullName  string   `json:"full_name"`
	IsActive  bool     `json:"is_active"`
	Roles     []string `json:"roles"`
	Teams     []string `json:"teams"`
	CreatedAt string   `json:"created_at"`
}

type UpsertUserRequest struct {
	Username string   `json:"username"`
	Email    string   `json:"email"`
	FullName string   `json:"full_name"`
	Password string   `json:"password"`
	Roles    []string `json:"roles"`
	TeamIDs  []string `json:"team_ids"`
	IsActive *bool    `json:"is_active"`
}

type RoleDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
	IsSystem    bool     `json:"is_system"`
}

type UpsertRoleRequest struct {
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type TeamDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	MemberIDs   []string `json:"member_ids"`
	MemberCount int      `json:"member_count"`
}

type ListMeta struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
}

type UserListOptions struct {
	Page     int
	PageSize int
	Search   string
	Status   string
	SortBy   string
	SortDir  string
}

type RoleListOptions struct {
	Page     int
	PageSize int
	Search   string
	System   *bool
	SortBy   string
	SortDir  string
}

type TeamListOptions struct {
	Page     int
	PageSize int
	Search   string
	SortBy   string
	SortDir  string
}

type AuditLogDTO struct {
	ID          string     `json:"id"`
	UserID      string     `json:"user_id"`
	UserEmail   string     `json:"user_email"`
	Action      string     `json:"action"`
	Resource    string     `json:"resource"`
	ResourceID  string     `json:"resource_id"`
	Environment string     `json:"environment"`
	Status      string     `json:"status"`
	IPAddress   string     `json:"ip_address"`
	UserAgent   string     `json:"user_agent"`
	Metadata    JSONObject `json:"metadata"`
	Timestamp   string     `json:"timestamp"`
}

type UpsertTeamRequest struct {
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	MemberIDs   []string `json:"member_ids"`
}

type permissionDecision struct {
	Allowed bool
	Reason  string
}

func (s *Service) AutoMigrate(ctx context.Context) error {
	if err := s.db.WithContext(ctx).AutoMigrate(
		&User{},
		&Organization{},
		&UserOrganization{},
		&Role{},
		&Permission{},
		&RolePermission{},
		&UserRole{},
		&ResourceScope{},
		&UserPermission{},
		&RefreshToken{},
		&SessionPresenceRecord{},
		&AuthActionToken{},
		&AuditLog{},
		&Team{},
		&TeamMember{},
		&TagRecord{},
		&ApplicationRecord{},
		&NotificationRecord{},
		&NotificationPreferenceRecord{},
		&IntegrationPluginRecord{},
		&NotificationRoutingRuleRecord{},
		&LicenseKeyRecord{},
	); err != nil {
		return err
	}
	if err := s.normalizeUUIDColumns(ctx); err != nil {
		return err
	}
	return s.normalizeAuditLogRows(ctx)
}

func (s *Service) SeedDefaults(ctx context.Context) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&User{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		_, err := s.ensurePermissionsCatalogTx(s.db.WithContext(ctx))
		return err
	}

	org := &Organization{Name: "Default Organization", Slug: "default"}
	adminHash, err := s.tokens.HashPassword("Admin123!")
	if err != nil {
		return err
	}
	user := &User{
		Username:     "admin",
		Email:        "admin@einfra.local",
		FullName:     "EINFRA Admin",
		PasswordHash: adminHash,
		IsActive:     true,
	}
	now := time.Now().UTC()
	user.EmailVerifiedAt = &now

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(org).Error; err != nil {
			return err
		}
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(&UserOrganization{
			UserID:         user.ID,
			OrganizationID: org.ID,
			Status:         "active",
			IsDefault:      true,
			Teams:          StringSlice{"platform"},
		}).Error; err != nil {
			return err
		}
		return s.seedPermissionsAndRolesTx(tx, org.ID, user.ID)
	})
}

func (s *Service) seedPermissionsAndRolesTx(tx *gorm.DB, orgID, adminUserID string) error {
	permissions, err := s.ensurePermissionsCatalogTx(tx)
	if err != nil {
		return err
	}

	var scopedOrgID *string
	if orgID != "" {
		scopedOrgID = &orgID
	}
	roles := []Role{
		{Name: "Admin", Slug: "admin", Description: "Full access", IsSystem: true, OrganizationID: scopedOrgID},
		{Name: "DevOps", Slug: "devops", Description: "Operational access", IsSystem: true, OrganizationID: scopedOrgID},
		{Name: "Viewer", Slug: "viewer", Description: "Read-only access", IsSystem: true, OrganizationID: scopedOrgID},
	}
	for i := range roles {
		var existing Role
		query := tx.Where("slug = ?", roles[i].Slug)
		if orgID == "" {
			query = query.Where("organization_id IS NULL")
		} else {
			query = query.Where("organization_id = ?", orgID)
		}
		err := query.First(&existing).Error
		if err == nil {
			roles[i].ID = existing.ID
			continue
		}
		if err := tx.Create(&roles[i]).Error; err != nil {
			return err
		}
	}

	rolePerms := map[string][]string{
		"admin":  {"server:read", "server:write", "server:delete", "server:execute", "firewall:read", "firewall:write", "firewall:delete", "ssh_key:read", "ssh_key:write", "ssh_key:execute", "audit_log:read"},
		"devops": {"server:read", "server:write", "server:execute", "firewall:read", "firewall:write", "ssh_key:read", "ssh_key:write", "ssh_key:execute", "audit_log:read"},
		"viewer": {"server:read", "firewall:read", "ssh_key:read", "audit_log:read"},
	}
	permByKey := map[string]string{}
	for _, perm := range permissions {
		permByKey[perm.Resource+":"+perm.Action] = perm.ID
	}
	for _, role := range roles {
		for _, key := range rolePerms[role.Slug] {
			var rp RolePermission
			if err := tx.Where("role_id = ? AND permission_id = ?", role.ID, permByKey[key]).First(&rp).Error; err == nil {
				continue
			}
			if err := tx.Create(&RolePermission{RoleID: role.ID, PermissionID: permByKey[key]}).Error; err != nil {
				return err
			}
		}
		if adminUserID != "" && role.Slug == "admin" {
			if err := tx.Where("user_id = ? AND organization_id = ? AND role_id = ?", adminUserID, orgID, role.ID).First(&UserRole{}).Error; err == nil {
				continue
			}
			if err := tx.Create(&UserRole{UserID: adminUserID, OrganizationID: orgID, RoleID: role.ID}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) ensurePermissionsCatalogTx(tx *gorm.DB) ([]Permission, error) {
	permissions := []Permission{
		{Resource: "server", Action: "read", Description: "Read servers"},
		{Resource: "server", Action: "write", Description: "Create and update servers"},
		{Resource: "server", Action: "delete", Description: "Delete servers"},
		{Resource: "server", Action: "execute", Description: "SSH and terminal execution"},
		{Resource: "firewall", Action: "read", Description: "Read firewall rules"},
		{Resource: "firewall", Action: "write", Description: "Change firewall rules"},
		{Resource: "firewall", Action: "delete", Description: "Delete firewall rules"},
		{Resource: "ssh_key", Action: "read", Description: "Read SSH keys"},
		{Resource: "ssh_key", Action: "write", Description: "Manage SSH keys"},
		{Resource: "ssh_key", Action: "execute", Description: "Use SSH access"},
		{Resource: "audit_log", Action: "read", Description: "Read audit logs"},
	}
	for i := range permissions {
		var existing Permission
		err := tx.Where("resource = ? AND action = ?", permissions[i].Resource, permissions[i].Action).First(&existing).Error
		if err == nil {
			permissions[i].ID = existing.ID
			continue
		}
		if err := tx.Create(&permissions[i]).Error; err != nil {
			return nil, err
		}
	}
	return permissions, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest, ipAddress, userAgent string) (*LoginResponse, error) {
	req.Identifier = strings.TrimSpace(req.Identifier)
	req.OrganizationID = strings.TrimSpace(req.OrganizationID)
	if req.Identifier == "" || req.Password == "" || req.OrganizationID == "" {
		return nil, fmt.Errorf("identifier, password and organization_id are required")
	}
	resolvedOrgID, err := s.resolveOrganizationID(ctx, req.OrganizationID)
	if err != nil {
		return nil, err
	}
	req.OrganizationID = resolvedOrgID
	user, membership, err := s.lookupUserMembership(ctx, req.Identifier, req.OrganizationID)
	if err != nil {
		s.recordAuthEvent(ctx, req.OrganizationID, "", "login", "failure", ipAddress, userAgent, JSONObject{
			"identifier": req.Identifier,
			"reason":     err.Error(),
		})
		return nil, err
	}
	if !user.IsActive || membership.Status != "active" {
		s.recordAuthEvent(ctx, req.OrganizationID, user.ID, "login", "failure", ipAddress, userAgent, JSONObject{
			"identifier": req.Identifier,
			"reason":     "account_inactive",
		})
		return nil, fmt.Errorf("account is inactive")
	}
	if err := s.tokens.ComparePassword(user.PasswordHash, req.Password); err != nil {
		s.recordAuthEvent(ctx, req.OrganizationID, user.ID, "login", "failure", ipAddress, userAgent, JSONObject{
			"identifier": req.Identifier,
			"reason":     "invalid_credentials",
		})
		return nil, fmt.Errorf("invalid credentials")
	}
	if user.TOTPEnabled {
		raw, hashed, genErr := s.tokens.GenerateActionToken()
		if genErr != nil {
			return nil, genErr
		}
		if err := s.db.WithContext(ctx).Create(&AuthActionToken{
			UserID:         user.ID,
			OrganizationID: req.OrganizationID,
			Kind:           "login_mfa",
			TokenHash:      hashed,
			Payload: JSONObject{
				"organization_id": req.OrganizationID,
				"ip_address":      ipAddress,
				"user_agent":      userAgent,
			},
			ExpiresAt: time.Now().UTC().Add(5 * time.Minute),
		}).Error; err != nil {
			return nil, err
		}
		s.recordAuthEvent(ctx, req.OrganizationID, user.ID, "login_challenge", "success", ipAddress, userAgent, JSONObject{
			"identifier": req.Identifier,
			"method":     "totp",
		})
		return &LoginResponse{RequiresMFA: true, MFAToken: raw}, nil
	}
	resp, err := s.issueLogin(ctx, user, membership, ipAddress, userAgent)
	if err == nil {
		s.recordAuthEvent(ctx, req.OrganizationID, user.ID, "login", "success", ipAddress, userAgent, JSONObject{
			"identifier": req.Identifier,
			"method":     "password",
		})
	}
	return resp, err
}

func (s *Service) VerifyLoginTOTP(ctx context.Context, req LoginTOTPRequest) (*LoginResponse, error) {
	action, err := s.getActionToken(ctx, "login_mfa", req.MFAToken)
	if err != nil {
		return nil, err
	}
	user, membership, err := s.lookupUserMembershipByUserID(ctx, action.UserID, action.OrganizationID)
	if err != nil {
		return nil, err
	}
	if !s.consumeTOTP(user, req.Code) {
		s.recordAuthEvent(ctx, action.OrganizationID, user.ID, "login_mfa", "failure", stringValueFromMap(action.Payload, "ip_address"), stringValueFromMap(action.Payload, "user_agent"), JSONObject{
			"reason": "invalid_totp",
		})
		return nil, fmt.Errorf("invalid authenticator code")
	}
	now := time.Now().UTC()
	_ = s.db.WithContext(ctx).Model(&AuthActionToken{}).Where("id = ?", action.ID).Update("consumed_at", &now).Error
	resp, err := s.issueLogin(ctx, user, membership, stringValueFromMap(action.Payload, "ip_address"), stringValueFromMap(action.Payload, "user_agent"))
	if err == nil {
		s.recordAuthEvent(ctx, action.OrganizationID, user.ID, "login_mfa", "success", stringValueFromMap(action.Payload, "ip_address"), stringValueFromMap(action.Payload, "user_agent"), JSONObject{
			"method": "totp",
		})
	}
	return resp, err
}

func (s *Service) Refresh(ctx context.Context, req RefreshRequest, ipAddress, userAgent string) (*LoginResponse, error) {
	var refresh RefreshToken
	if err := s.db.WithContext(ctx).Where("token_hash = ?", s.tokens.HashToken(strings.TrimSpace(req.RefreshToken))).First(&refresh).Error; err != nil {
		s.recordAuthEvent(ctx, "", "", "refresh", "failure", ipAddress, userAgent, JSONObject{"reason": "invalid_refresh"})
		return nil, fmt.Errorf("invalid refresh token")
	}
	if refresh.RevokedAt != nil || refresh.ExpiresAt.Before(time.Now().UTC()) {
		s.recordAuthEvent(ctx, refresh.OrganizationID, refresh.UserID, "refresh", "failure", ipAddress, userAgent, JSONObject{"reason": "expired_refresh"})
		return nil, fmt.Errorf("refresh token expired")
	}
	user, membership, err := s.lookupUserMembershipByUserID(ctx, refresh.UserID, refresh.OrganizationID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	_ = s.db.WithContext(ctx).Model(&RefreshToken{}).Where("id = ?", refresh.ID).Updates(map[string]any{
		"revoked_at":   &now,
		"last_used_at": &now,
	}).Error
	resp, err := s.issueLogin(ctx, user, membership, ipAddress, userAgent)
	if err == nil {
		s.recordAuthEvent(ctx, refresh.OrganizationID, refresh.UserID, "refresh", "success", ipAddress, userAgent, JSONObject{})
	}
	return resp, err
}

func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	var user User
	if err := s.db.WithContext(ctx).Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).First(&user).Error; err != nil {
		return nil
	}
	raw, hashed, err := s.tokens.GenerateActionToken()
	if err != nil {
		return err
	}
	if err := s.db.WithContext(ctx).Create(&AuthActionToken{
		UserID:    user.ID,
		Kind:      "password_reset",
		TokenHash: hashed,
		ExpiresAt: time.Now().UTC().Add(30 * time.Minute),
	}).Error; err != nil {
		return err
	}
	return s.sendSecurityEmail(ctx, user.Email, "Password reset request", passwordResetEmailHTML(s.baseURL, raw))
}

func (s *Service) ResetPassword(ctx context.Context, req PasswordResetConfirmRequest) error {
	action, err := s.getActionToken(ctx, "password_reset", req.Token)
	if err != nil {
		return err
	}
	if len(req.NewPassword) < 8 {
		return fmt.Errorf("new_password must be at least 8 characters")
	}
	hash, err := s.tokens.HashPassword(req.NewPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", action.UserID).Updates(map[string]any{
			"password_hash":       hash,
			"password_changed_at": &now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&RefreshToken{}).Where("user_id = ? AND revoked_at IS NULL", action.UserID).Update("revoked_at", &now).Error; err != nil {
			return err
		}
		return tx.Model(&AuthActionToken{}).Where("id = ?", action.ID).Update("consumed_at", &now).Error
	}); err != nil {
		return err
	}
	var user User
	if err := s.db.WithContext(ctx).First(&user, "id = ?", action.UserID).Error; err == nil {
		_ = s.sendSecurityEmail(ctx, user.Email, "Password changed", genericSecurityEmailHTML("Your EINFRA password was changed successfully."))
	}
	return nil
}

func (s *Service) RequestMFAReset(ctx context.Context, email string) error {
	var user User
	if err := s.db.WithContext(ctx).Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).First(&user).Error; err != nil {
		return nil
	}
	raw, hashed, err := s.tokens.GenerateActionToken()
	if err != nil {
		return err
	}
	if err := s.db.WithContext(ctx).Create(&AuthActionToken{
		UserID:    user.ID,
		Kind:      "mfa_reset",
		TokenHash: hashed,
		ExpiresAt: time.Now().UTC().Add(30 * time.Minute),
	}).Error; err != nil {
		return err
	}
	return s.sendSecurityEmail(ctx, user.Email, "Authenticator reset request", mfaResetEmailHTML(s.baseURL, raw))
}

func (s *Service) ConfirmMFAReset(ctx context.Context, req MFAResetConfirmRequest) error {
	action, err := s.getActionToken(ctx, "mfa_reset", req.Token)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", action.UserID).Updates(map[string]any{
			"totp_enabled":   false,
			"totp_secret":    "",
			"recovery_codes": StringSlice{},
		}).Error; err != nil {
			return err
		}
		return tx.Model(&AuthActionToken{}).Where("id = ?", action.ID).Update("consumed_at", &now).Error
	}); err != nil {
		return err
	}
	return nil
}

func (s *Service) BeginMFASetup(ctx context.Context, principal *Principal) (*MFASetupResponse, error) {
	user, _, err := s.lookupUserMembershipByUserID(ctx, principal.UserID, principal.OrganizationID)
	if err != nil {
		return nil, err
	}
	key, secret, codes, err := s.tokens.GenerateTOTP(user)
	if err != nil {
		return nil, err
	}
	raw, hashed, err := s.tokens.GenerateActionToken()
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Create(&AuthActionToken{
		UserID:         user.ID,
		OrganizationID: principal.OrganizationID,
		Kind:           "mfa_setup",
		TokenHash:      hashed,
		Payload: JSONObject{
			"secret":         secret,
			"recovery_codes": []string(codes),
			"otpauth_url":    key.URL(),
		},
		ExpiresAt: time.Now().UTC().Add(10 * time.Minute),
	}).Error; err != nil {
		return nil, err
	}
	return &MFASetupResponse{
		SetupToken:    raw,
		Secret:        secret,
		OTPAuthURL:    key.URL(),
		RecoveryCodes: codes,
	}, nil
}

func (s *Service) ConfirmMFASetup(ctx context.Context, principal *Principal, req MFAConfirmRequest) error {
	action, err := s.getActionToken(ctx, "mfa_setup", req.SetupToken)
	if err != nil {
		return err
	}
	if action.UserID != principal.UserID {
		return fmt.Errorf("setup token does not belong to user")
	}
	secret := stringValueFromMap(action.Payload, "secret")
	if !s.tokens.VerifyTOTP(secret, req.Code) {
		return fmt.Errorf("invalid authenticator code")
	}
	now := time.Now().UTC()
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&User{}).Where("id = ?", principal.UserID).Updates(map[string]any{
			"totp_enabled":   true,
			"totp_secret":    secret,
			"recovery_codes": StringSlice(stringSliceFromMap(action.Payload, "recovery_codes")),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&AuthActionToken{}).Where("id = ?", action.ID).Update("consumed_at", &now).Error
	})
}

func (s *Service) Me(ctx context.Context, principal *Principal) (*LoginResponse, error) {
	user, _, err := s.lookupUserMembershipByUserID(ctx, principal.UserID, principal.OrganizationID)
	if err != nil {
		return nil, err
	}
	orgs, err := s.organizationsForUser(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	return &LoginResponse{
		User:          user,
		Organizations: orgs,
		Principal:     principal,
		TokenPair:     TokenPair{TokenType: "Bearer", ExpiresAt: principal.ExpiresAt},
		RequiresMFA:   user.TOTPEnabled,
	}, nil
}

func (s *Service) ListUsers(ctx context.Context, orgID string) ([]UserDTO, error) {
	var users []User
	if err := s.db.WithContext(ctx).
		Table("users u").
		Select("u.*").
		Joins("join user_organizations uo on uo.user_id = u.id").
		Where("uo.organization_id = ?", orgID).
		Order("u.created_at asc").
		Scan(&users).Error; err != nil {
		return nil, err
	}
	result := make([]UserDTO, 0, len(users))
	for _, user := range users {
		roles, teams, err := s.userRoleAndTeams(ctx, user.ID, orgID)
		if err != nil {
			return nil, err
		}
		result = append(result, UserDTO{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			FullName:  user.FullName,
			IsActive:  user.IsActive,
			Roles:     roles,
			Teams:     teams,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		})
	}
	return result, nil
}

func (s *Service) ListUsersPage(ctx context.Context, orgID string, opts UserListOptions) ([]UserDTO, ListMeta, error) {
	page, pageSize := normalizePage(opts.Page, opts.PageSize)
	query := s.db.WithContext(ctx).
		Table("users u").
		Joins("join user_organizations uo on uo.user_id = u.id").
		Where("uo.organization_id = ?", orgID)
	if search := strings.TrimSpace(opts.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where("lower(u.username) like ? OR lower(u.email) like ? OR lower(u.full_name) like ?", like, like, like)
	}
	switch strings.ToLower(strings.TrimSpace(opts.Status)) {
	case "active":
		query = query.Where("u.is_active = ?", true)
	case "inactive":
		query = query.Where("u.is_active = ?", false)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, ListMeta{}, err
	}
	var users []User
	orderBy := normalizeSortClause(opts.SortBy, opts.SortDir, map[string]string{
		"name":       "lower(coalesce(u.full_name, u.username))",
		"username":   "lower(u.username)",
		"email":      "lower(u.email)",
		"status":     "u.is_active",
		"created_at": "u.created_at",
	}, "u.created_at DESC, lower(u.username) ASC")
	if err := query.Select("u.*").Order(orderBy).Offset((page - 1) * pageSize).Limit(pageSize).Scan(&users).Error; err != nil {
		return nil, ListMeta{}, err
	}
	items := make([]UserDTO, 0, len(users))
	for _, user := range users {
		roles, teams, err := s.userRoleAndTeams(ctx, user.ID, orgID)
		if err != nil {
			return nil, ListMeta{}, err
		}
		items = append(items, UserDTO{
			ID:        user.ID,
			Username:  user.Username,
			Email:     user.Email,
			FullName:  user.FullName,
			IsActive:  user.IsActive,
			Roles:     roles,
			Teams:     teams,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		})
	}
	return items, ListMeta{Page: page, PageSize: pageSize, Total: int(total)}, nil
}

func (s *Service) CreateUser(ctx context.Context, orgID string, req UpsertUserRequest) (*UserDTO, error) {
	if req.Username == "" || req.Email == "" || req.Password == "" {
		return nil, fmt.Errorf("username, email and password are required")
	}
	passwordHash, err := s.tokens.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}
	user := &User{
		Username:     strings.TrimSpace(req.Username),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		FullName:     strings.TrimSpace(req.FullName),
		PasswordHash: passwordHash,
		IsActive:     true,
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	now := time.Now().UTC()
	user.EmailVerifiedAt = &now
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(&UserOrganization{
			UserID:         user.ID,
			OrganizationID: orgID,
			Status:         "active",
		}).Error; err != nil {
			return err
		}
		if err := s.replaceUserRolesTx(ctx, tx, user.ID, orgID, req.Roles); err != nil {
			return err
		}
		if err := s.replaceTeamMembersForUserTx(ctx, tx, orgID, user.ID, req.TeamIDs); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	items, err := s.ListUsers(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == user.ID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("user created but not found")
}

func (s *Service) UpdateUser(ctx context.Context, orgID, userID string, req UpsertUserRequest) (*UserDTO, error) {
	updates := map[string]any{}
	if strings.TrimSpace(req.Username) != "" {
		updates["username"] = strings.TrimSpace(req.Username)
	}
	if strings.TrimSpace(req.Email) != "" {
		updates["email"] = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if req.FullName != "" {
		updates["full_name"] = strings.TrimSpace(req.FullName)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.Password != "" {
		hash, err := s.tokens.HashPassword(req.Password)
		if err != nil {
			return nil, err
		}
		updates["password_hash"] = hash
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
				return err
			}
		}
		if err := s.replaceUserRolesTx(ctx, tx, userID, orgID, req.Roles); err != nil {
			return err
		}
		if err := s.replaceTeamMembersForUserTx(ctx, tx, orgID, userID, req.TeamIDs); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	items, err := s.ListUsers(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == userID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("user not found")
}

func (s *Service) DeleteUser(ctx context.Context, orgID, userID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("organization_id = ?", orgID).Delete(&UserRole{}, "user_id = ?", userID).Error; err != nil {
			return err
		}
		if err := tx.Exec("delete from team_members where user_id = ? and team_id in (select id from teams where organization_id = ?)", userID, orgID).Error; err != nil {
			return err
		}
		if err := tx.Where("organization_id = ?", orgID).Delete(&UserOrganization{}, "user_id = ?", userID).Error; err != nil {
			return err
		}
		return tx.Delete(&User{}, "id = ?", userID).Error
	})
}

func (s *Service) ListRoles(ctx context.Context, orgID string) ([]RoleDTO, error) {
	var roles []Role
	if err := s.db.WithContext(ctx).Where("organization_id = ? OR organization_id IS NULL", orgID).Find(&roles).Error; err != nil {
		return nil, err
	}
	roles = dedupeRolesBySlug(roles, orgID)
	sortRoles(roles, "", "")
	result := make([]RoleDTO, 0, len(roles))
	for _, role := range roles {
		var permissions []struct {
			Resource string
			Action   string
		}
		if err := s.db.WithContext(ctx).Table("role_permissions rp").
			Select("p.resource, p.action").
			Joins("join permissions p on p.id = rp.permission_id").
			Where("rp.role_id = ?", role.ID).
			Scan(&permissions).Error; err != nil {
			return nil, err
		}
		items := make([]string, 0, len(permissions))
		for _, permission := range permissions {
			items = append(items, permission.Resource+":"+permission.Action)
		}
		sort.Strings(items)
		result = append(result, RoleDTO{
			ID:          role.ID,
			Name:        role.Name,
			Slug:        role.Slug,
			Description: role.Description,
			Permissions: items,
			IsSystem:    role.IsSystem,
		})
	}
	return result, nil
}

func (s *Service) ListRolesPage(ctx context.Context, orgID string, opts RoleListOptions) ([]RoleDTO, ListMeta, error) {
	page, pageSize := normalizePage(opts.Page, opts.PageSize)
	query := s.db.WithContext(ctx).Model(&Role{}).Where("organization_id = ? OR organization_id IS NULL", orgID)
	if search := strings.TrimSpace(opts.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where("lower(name) like ? OR lower(slug) like ? OR lower(description) like ?", like, like, like)
	}
	if opts.System != nil {
		query = query.Where("is_system = ?", *opts.System)
	}
	var roles []Role
	if err := query.Find(&roles).Error; err != nil {
		return nil, ListMeta{}, err
	}
	roles = dedupeRolesBySlug(roles, orgID)
	sortRoles(roles, opts.SortBy, opts.SortDir)
	total := len(roles)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	pagedRoles := roles[start:end]
	result := make([]RoleDTO, 0, len(pagedRoles))
	for _, role := range pagedRoles {
		var permissions []struct {
			Resource string
			Action   string
		}
		if err := s.db.WithContext(ctx).Table("role_permissions rp").
			Select("p.resource, p.action").
			Joins("join permissions p on p.id = rp.permission_id").
			Where("rp.role_id = ?", role.ID).
			Scan(&permissions).Error; err != nil {
			return nil, ListMeta{}, err
		}
		items := make([]string, 0, len(permissions))
		for _, permission := range permissions {
			items = append(items, permission.Resource+":"+permission.Action)
		}
		sort.Strings(items)
		result = append(result, RoleDTO{
			ID:          role.ID,
			Name:        role.Name,
			Slug:        role.Slug,
			Description: role.Description,
			Permissions: items,
			IsSystem:    role.IsSystem,
		})
	}
	return result, ListMeta{Page: page, PageSize: pageSize, Total: total}, nil
}

func (s *Service) CreateRole(ctx context.Context, orgID string, req UpsertRoleRequest) (*RoleDTO, error) {
	role := &Role{
		OrganizationID: &orgID,
		Name:           strings.TrimSpace(req.Name),
		Slug:           strings.ToLower(strings.TrimSpace(req.Slug)),
		Description:    strings.TrimSpace(req.Description),
	}
	if role.Name == "" || role.Slug == "" {
		return nil, fmt.Errorf("name and slug are required")
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(role).Error; err != nil {
			return err
		}
		return s.replaceRolePermissionsTx(ctx, tx, role.ID, req.Permissions)
	}); err != nil {
		return nil, err
	}
	roles, err := s.ListRoles(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range roles {
		if item.ID == role.ID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("role not found")
}

func (s *Service) UpdateRole(ctx context.Context, orgID, roleID string, req UpsertRoleRequest) (*RoleDTO, error) {
	updates := map[string]any{
		"name":        strings.TrimSpace(req.Name),
		"slug":        strings.ToLower(strings.TrimSpace(req.Slug)),
		"description": strings.TrimSpace(req.Description),
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Role{}).Where("id = ? AND organization_id = ?", roleID, orgID).Updates(updates).Error; err != nil {
			return err
		}
		return s.replaceRolePermissionsTx(ctx, tx, roleID, req.Permissions)
	}); err != nil {
		return nil, err
	}
	roles, err := s.ListRoles(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range roles {
		if item.ID == roleID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("role not found")
}

func (s *Service) DeleteRole(ctx context.Context, orgID, roleID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&RolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Where("role_id = ?", roleID).Delete(&UserRole{}).Error; err != nil {
			return err
		}
		return tx.Where("organization_id = ? AND is_system = false", orgID).Delete(&Role{}, "id = ?", roleID).Error
	})
}

func (s *Service) ListTeams(ctx context.Context, orgID string) ([]TeamDTO, error) {
	var teams []Team
	if err := s.db.WithContext(ctx).Where("organization_id = ?", orgID).Order("name asc").Find(&teams).Error; err != nil {
		return nil, err
	}
	result := make([]TeamDTO, 0, len(teams))
	for _, team := range teams {
		var memberIDs []string
		if err := s.db.WithContext(ctx).Table("team_members").Where("team_id = ?", team.ID).Pluck("user_id", &memberIDs).Error; err != nil {
			return nil, err
		}
		result = append(result, TeamDTO{
			ID:          team.ID,
			Name:        team.Name,
			Slug:        team.Slug,
			Description: team.Description,
			MemberIDs:   memberIDs,
			MemberCount: len(memberIDs),
		})
	}
	return result, nil
}

func (s *Service) ListTeamsPage(ctx context.Context, orgID string, opts TeamListOptions) ([]TeamDTO, ListMeta, error) {
	page, pageSize := normalizePage(opts.Page, opts.PageSize)
	query := s.db.WithContext(ctx).Model(&Team{}).Where("organization_id = ?", orgID)
	if search := strings.TrimSpace(opts.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where("lower(name) like ? OR lower(slug) like ? OR lower(description) like ?", like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, ListMeta{}, err
	}
	var teams []Team
	orderBy := normalizeSortClause(opts.SortBy, opts.SortDir, map[string]string{
		"name":       "lower(name)",
		"slug":       "lower(slug)",
		"created_at": "created_at",
		"updated_at": "updated_at",
	}, "lower(name) ASC")
	if err := query.Order(orderBy).Offset((page - 1) * pageSize).Limit(pageSize).Find(&teams).Error; err != nil {
		return nil, ListMeta{}, err
	}
	result := make([]TeamDTO, 0, len(teams))
	for _, team := range teams {
		var memberIDs []string
		if err := s.db.WithContext(ctx).Table("team_members").Where("team_id = ?", team.ID).Pluck("user_id", &memberIDs).Error; err != nil {
			return nil, ListMeta{}, err
		}
		result = append(result, TeamDTO{
			ID:          team.ID,
			Name:        team.Name,
			Slug:        team.Slug,
			Description: team.Description,
			MemberIDs:   memberIDs,
			MemberCount: len(memberIDs),
		})
	}
	return result, ListMeta{Page: page, PageSize: pageSize, Total: int(total)}, nil
}

func (s *Service) CreateTeam(ctx context.Context, orgID string, req UpsertTeamRequest) (*TeamDTO, error) {
	team := &Team{
		OrganizationID: orgID,
		Name:           strings.TrimSpace(req.Name),
		Slug:           strings.ToLower(strings.TrimSpace(req.Slug)),
		Description:    strings.TrimSpace(req.Description),
	}
	if team.Name == "" || team.Slug == "" {
		return nil, fmt.Errorf("name and slug are required")
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(team).Error; err != nil {
			return err
		}
		return s.replaceTeamMembersTx(ctx, tx, orgID, team.ID, req.MemberIDs)
	}); err != nil {
		return nil, err
	}
	items, err := s.ListTeams(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == team.ID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("team not found")
}

func (s *Service) UpdateTeam(ctx context.Context, orgID, teamID string, req UpsertTeamRequest) (*TeamDTO, error) {
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&Team{}).Where("id = ? AND organization_id = ?", teamID, orgID).Updates(map[string]any{
			"name":        strings.TrimSpace(req.Name),
			"slug":        strings.ToLower(strings.TrimSpace(req.Slug)),
			"description": strings.TrimSpace(req.Description),
		}).Error; err != nil {
			return err
		}
		return s.replaceTeamMembersTx(ctx, tx, orgID, teamID, req.MemberIDs)
	}); err != nil {
		return nil, err
	}
	items, err := s.ListTeams(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == teamID {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("team not found")
}

func (s *Service) DeleteTeam(ctx context.Context, orgID, teamID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("team_id = ?", teamID).Delete(&TeamMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("organization_id = ?", orgID).Delete(&Team{}, "id = ?", teamID).Error; err != nil {
			return err
		}
		return s.syncAllMembershipTeamsTx(ctx, tx, orgID)
	})
}

func (s *Service) ListAuditLogs(ctx context.Context, orgID string, limit int, status, resource, action string) ([]AuditLogDTO, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	type auditRow struct {
		ID          string
		UserID      string
		UserEmail   string
		Action      string
		Resource    string
		ResourceID  string
		Environment string
		Status      string
		IPAddress   string
		UserAgent   string
		Metadata    JSONObject
		CreatedAt   time.Time
	}
	var rows []auditRow
	query := s.db.WithContext(ctx).
		Table("audit_logs al").
		Select("al.id, al.user_id, coalesce(u.email, '') as user_email, al.action, al.resource, al.resource_id, al.environment, al.status, al.ip_address, al.user_agent, al.metadata, al.created_at").
		Joins("left join users u on u.id = al.user_id").
		Where("al.organization_id = ?", orgID)
	if strings.TrimSpace(status) != "" {
		query = query.Where("al.status = ?", strings.TrimSpace(status))
	}
	if strings.TrimSpace(resource) != "" {
		query = query.Where("al.resource = ?", strings.TrimSpace(resource))
	}
	if strings.TrimSpace(action) != "" {
		query = query.Where("al.action = ?", strings.TrimSpace(action))
	}
	if err := query.Order("al.created_at desc").Limit(limit).Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]AuditLogDTO, 0, len(rows))
	for _, row := range rows {
		items = append(items, AuditLogDTO{
			ID:          row.ID,
			UserID:      row.UserID,
			UserEmail:   row.UserEmail,
			Action:      row.Action,
			Resource:    row.Resource,
			ResourceID:  row.ResourceID,
			Environment: row.Environment,
			Status:      row.Status,
			IPAddress:   row.IPAddress,
			UserAgent:   row.UserAgent,
			Metadata:    row.Metadata,
			Timestamp:   row.CreatedAt.Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *Service) recordAuthEvent(ctx context.Context, orgID, userID, action, status, ipAddress, userAgent string, metadata JSONObject) {
	if strings.TrimSpace(action) == "" {
		return
	}
	values := map[string]any{
		"id":         uuid.NewString(),
		"action":     action,
		"resource":   "auth",
		"status":     status,
		"ip_address": ipAddress,
		"user_agent": userAgent,
		"metadata":   metadata,
		"created_at": time.Now().UTC(),
	}
	if strings.TrimSpace(userID) != "" {
		values["user_id"] = strings.TrimSpace(userID)
	}
	if strings.TrimSpace(orgID) != "" {
		values["organization_id"] = strings.TrimSpace(orgID)
	}
	_ = s.db.WithContext(ctx).Table("audit_logs").Create(values).Error
}

func (s *Service) CheckPermission(ctx context.Context, userID, orgID, resource, action, env, resourceID string) bool {
	decision, _ := s.checkPermissionDecision(ctx, userID, orgID, resource, action, env, resourceID)
	return decision.Allowed
}

// Permission check flow:
//
// 1. verify active membership in organization
// 2. load role permissions and user overrides
// 3. apply deny override before allow
// 4. resolve resource scope / tenant / environment
// 5. enforce cross-org and env boundaries
// 6. evaluate ABAC-like ownership/team conditions
// 7. cache the final decision in Redis for 60s
func (s *Service) checkPermissionDecision(ctx context.Context, userID, orgID, resource, action, env, resourceID string) (permissionDecision, error) {
	cacheKey := fmt.Sprintf("perm:%s:%s:%s:%s:%s:%s", userID, orgID, resource, action, env, resourceID)
	if s.cache != nil {
		if cached, err := s.cache.Get(ctx, cacheKey).Result(); err == nil {
			return permissionDecision{Allowed: cached == "1", Reason: "cache"}, nil
		}
	}
	var membership UserOrganization
	if err := s.db.WithContext(ctx).Where("user_id = ? AND organization_id = ? AND status = 'active'", userID, orgID).First(&membership).Error; err != nil {
		return permissionDecision{Allowed: false, Reason: "not_in_org"}, nil
	}
	allow, deny, rolePerms, err := s.permissionsForUser(ctx, userID, orgID)
	if err != nil {
		return permissionDecision{}, err
	}
	key := resource + ":" + action
	if deny[key] || deny[resource+":*"] {
		s.cacheDecision(ctx, cacheKey, false)
		return permissionDecision{Allowed: false, Reason: "deny_override"}, nil
	}
	if !rolePerms[key] && !allow[key] && !rolePerms[resource+":*"] && !allow[resource+":*"] {
		s.cacheDecision(ctx, cacheKey, false)
		return permissionDecision{Allowed: false, Reason: "missing_permission"}, nil
	}
	if resourceID != "" {
		scopeOrgID, scopeEnv, ownerID, attrs, err := s.lookupResourceScope(ctx, resource, resourceID)
		if err != nil {
			return permissionDecision{}, err
		}
		if scopeOrgID != "" && scopeOrgID != orgID {
			s.cacheDecision(ctx, cacheKey, false)
			return permissionDecision{Allowed: false, Reason: "cross_org"}, nil
		}
		if env != "" && scopeEnv != "" && !strings.EqualFold(env, scopeEnv) {
			s.cacheDecision(ctx, cacheKey, false)
			return permissionDecision{Allowed: false, Reason: "env_mismatch"}, nil
		}
		if !s.evalImplicitConditions(userID, membership.Teams, ownerID, attrs) {
			s.cacheDecision(ctx, cacheKey, false)
			return permissionDecision{Allowed: false, Reason: "abac_rejected"}, nil
		}
	}
	s.cacheDecision(ctx, cacheKey, true)
	return permissionDecision{Allowed: true, Reason: "role"}, nil
}

func (s *Service) permissionsForUser(ctx context.Context, userID, orgID string) (map[string]bool, map[string]bool, map[string]bool, error) {
	type row struct {
		Resource string
		Action   string
	}
	rolePerms := map[string]bool{}
	var rows []row
	if err := s.db.WithContext(ctx).
		Table("user_roles ur").
		Select("p.resource, p.action").
		Joins("join role_permissions rp on rp.role_id = ur.role_id").
		Joins("join permissions p on p.id = rp.permission_id").
		Where("ur.user_id = ? AND ur.organization_id = ?", userID, orgID).
		Scan(&rows).Error; err != nil {
		return nil, nil, nil, err
	}
	for _, row := range rows {
		rolePerms[row.Resource+":"+row.Action] = true
	}
	allow := map[string]bool{}
	deny := map[string]bool{}
	var overrides []struct {
		Resource string
		Action   string
		Effect   string
	}
	if err := s.db.WithContext(ctx).
		Table("user_permissions up").
		Select("p.resource, p.action, up.effect").
		Joins("join permissions p on p.id = up.permission_id").
		Where("up.user_id = ? AND up.organization_id = ? AND (up.expires_at IS NULL OR up.expires_at > ?)", userID, orgID, time.Now().UTC()).
		Scan(&overrides).Error; err != nil {
		return nil, nil, nil, err
	}
	for _, item := range overrides {
		key := item.Resource + ":" + item.Action
		if strings.EqualFold(item.Effect, "deny") {
			deny[key] = true
			continue
		}
		allow[key] = true
	}
	return allow, deny, rolePerms, nil
}

func (s *Service) lookupResourceScope(ctx context.Context, resource, resourceID string) (string, string, string, JSONObject, error) {
	var scope ResourceScope
	if err := s.db.WithContext(ctx).Where("resource = ? AND resource_id = ?", resource, resourceID).First(&scope).Error; err == nil {
		return scope.OrganizationID, scope.Env, scope.OwnerUserID, scope.Attributes, nil
	}
	if resource == "server" {
		type serverRow struct {
			TenantID    string
			Environment string
		}
		var row serverRow
		if err := s.db.WithContext(ctx).Table("servers").Select("tenant_id, environment").Where("id = ?", resourceID).First(&row).Error; err != nil {
			return "", "", "", JSONObject{}, nil
		}
		return row.TenantID, row.Environment, "", JSONObject{}, nil
	}
	return "", "", "", JSONObject{}, nil
}

func (s *Service) evalImplicitConditions(userID string, teams []string, ownerID string, attrs JSONObject) bool {
	if ownerID != "" && ownerID != userID {
		if team, ok := attrs["team"].(string); ok && containsFold(teams, team) {
			return true
		}
		return false
	}
	if team, ok := attrs["team"].(string); ok {
		return containsFold(teams, team)
	}
	return true
}

func (s *Service) cacheDecision(ctx context.Context, key string, allowed bool) {
	if s.cache == nil {
		return
	}
	value := "0"
	if allowed {
		value = "1"
	}
	_ = s.cache.Set(ctx, key, value, 60*time.Second).Err()
}

func (s *Service) issueLogin(ctx context.Context, user *User, membership *UserOrganization, ipAddress, userAgent string) (*LoginResponse, error) {
	orgs, err := s.organizationsForUser(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	principal, err := s.buildPrincipal(ctx, user, membership)
	if err != nil {
		return nil, err
	}
	pair, refreshHash, err := s.tokens.NewTokenPair(principal)
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Create(&RefreshToken{
		UserID:         user.ID,
		OrganizationID: membership.OrganizationID,
		TokenHash:      refreshHash,
		UserAgent:      userAgent,
		IPAddress:      ipAddress,
		ExpiresAt:      time.Now().UTC().Add(s.tokens.RefreshTTL()),
	}).Error; err != nil {
		return nil, err
	}
	if ipAddress != "" && net.ParseIP(ipAddress) != nil {
		_ = s.sendSecurityEmail(ctx, user.Email, "New login to EINFRA", loginEmailHTML(ipAddress, userAgent))
	}
	return &LoginResponse{
		TokenPair:     *pair,
		User:          user,
		Organizations: orgs,
		Principal:     principal,
	}, nil
}

func (s *Service) buildPrincipal(ctx context.Context, user *User, membership *UserOrganization) (*Principal, error) {
	var roles []struct{ Slug string }
	if err := s.db.WithContext(ctx).
		Table("user_roles ur").
		Select("r.slug").
		Joins("join roles r on r.id = ur.role_id").
		Where("ur.user_id = ? AND ur.organization_id = ?", user.ID, membership.OrganizationID).
		Scan(&roles).Error; err != nil {
		return nil, err
	}
	allow, _, rolePerms, err := s.permissionsForUser(ctx, user.ID, membership.OrganizationID)
	if err != nil {
		return nil, err
	}
	roleNames := make([]string, 0, len(roles))
	permNames := make([]string, 0, len(rolePerms)+len(allow))
	for _, role := range roles {
		roleNames = append(roleNames, role.Slug)
	}
	for key := range rolePerms {
		permNames = append(permNames, key)
	}
	for key := range allow {
		if !rolePerms[key] {
			permNames = append(permNames, key)
		}
	}
	sort.Strings(roleNames)
	sort.Strings(permNames)
	return &Principal{
		UserID:         user.ID,
		OrganizationID: membership.OrganizationID,
		Username:       user.Username,
		Email:          user.Email,
		Roles:          roleNames,
		Permissions:    permNames,
		Teams:          append([]string(nil), membership.Teams...),
	}, nil
}

func (s *Service) lookupUserMembership(ctx context.Context, identifier, organizationID string) (*User, *UserOrganization, error) {
	var user User
	if err := s.db.WithContext(ctx).
		Where("lower(email) = ? OR lower(username) = ?", strings.ToLower(identifier), strings.ToLower(identifier)).
		First(&user).Error; err != nil {
		return nil, nil, fmt.Errorf("invalid credentials")
	}
	return s.lookupUserMembershipByUserID(ctx, user.ID, organizationID)
}

func (s *Service) resolveOrganizationID(ctx context.Context, value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("organization_id is required")
	}
	var org Organization
	query := s.db.WithContext(ctx)
	if _, err := uuid.Parse(value); err == nil {
		query = query.Where("id = ?", value)
	} else {
		query = query.Where("slug = ?", strings.ToLower(value))
	}
	if err := query.First(&org).Error; err != nil {
		return "", fmt.Errorf("organization not found")
	}
	return org.ID, nil
}

func (s *Service) lookupUserMembershipByUserID(ctx context.Context, userID, organizationID string) (*User, *UserOrganization, error) {
	var user User
	if err := s.db.WithContext(ctx).First(&user, "id = ?", userID).Error; err != nil {
		return nil, nil, fmt.Errorf("user not found")
	}
	var membership UserOrganization
	if err := s.db.WithContext(ctx).Where("user_id = ? AND organization_id = ?", userID, organizationID).First(&membership).Error; err != nil {
		return nil, nil, fmt.Errorf("organization access denied")
	}
	return &user, &membership, nil
}

func (s *Service) organizationsForUser(ctx context.Context, userID string) ([]Organization, error) {
	var orgs []Organization
	err := s.db.WithContext(ctx).
		Table("organizations o").
		Select("o.*").
		Joins("join user_organizations uo on uo.organization_id = o.id").
		Where("uo.user_id = ? AND uo.status = 'active'", userID).
		Order("uo.is_default desc, o.name asc").
		Scan(&orgs).Error
	return orgs, err
}

func (s *Service) getActionToken(ctx context.Context, kind, raw string) (*AuthActionToken, error) {
	var action AuthActionToken
	if err := s.db.WithContext(ctx).Where("kind = ? AND token_hash = ?", kind, s.tokens.HashToken(strings.TrimSpace(raw))).First(&action).Error; err != nil {
		return nil, fmt.Errorf("invalid token")
	}
	if action.ConsumedAt != nil || action.ExpiresAt.Before(time.Now().UTC()) {
		return nil, fmt.Errorf("token expired")
	}
	return &action, nil
}

func (s *Service) consumeTOTP(user *User, code string) bool {
	code = strings.TrimSpace(code)
	if s.tokens.VerifyTOTP(user.TOTPSecret, code) {
		return true
	}
	for i, recovery := range user.RecoveryCodes {
		if strings.EqualFold(strings.TrimSpace(recovery), code) {
			updated := append([]string(nil), user.RecoveryCodes...)
			updated = append(updated[:i], updated[i+1:]...)
			_ = s.db.Model(&User{}).Where("id = ?", user.ID).Update("recovery_codes", StringSlice(updated)).Error
			return true
		}
	}
	return false
}

func (s *Service) sendSecurityEmail(ctx context.Context, to, subject, html string) error {
	if s.mailer == nil || strings.TrimSpace(to) == "" {
		return nil
	}
	return s.mailer.Send(ctx, to, subject, html)
}

type SMTPMailer struct {
	host      string
	port      int
	username  string
	password  string
	fromEmail string
}

func NewSMTPMailer(host string, port int, username, password, fromEmail string) *SMTPMailer {
	if strings.TrimSpace(host) == "" || strings.TrimSpace(fromEmail) == "" {
		return nil
	}
	return &SMTPMailer{host: host, port: port, username: username, password: password, fromEmail: fromEmail}
}

func (m *SMTPMailer) Send(ctx context.Context, to, subject, htmlBody string) error {
	if m == nil {
		return nil
	}
	dialer := gomail.NewDialer(m.host, m.port, m.username, m.password)
	msg := gomail.NewMessage()
	msg.SetHeader("From", m.fromEmail)
	msg.SetHeader("To", to)
	msg.SetHeader("Subject", subject)
	msg.SetBody("text/html", htmlBody)
	done := make(chan error, 1)
	go func() {
		done <- dialer.DialAndSend(msg)
	}()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		return err
	}
}

func stringValueFromMap(payload JSONObject, key string) string {
	if payload == nil {
		return ""
	}
	value, _ := payload[key].(string)
	return value
}

func stringSliceFromMap(payload JSONObject, key string) []string {
	if payload == nil {
		return nil
	}
	switch value := payload[key].(type) {
	case []string:
		return append([]string(nil), value...)
	case []any:
		items := make([]string, 0, len(value))
		for _, raw := range value {
			items = append(items, fmt.Sprint(raw))
		}
		return items
	default:
		return nil
	}
}

func containsFold(items []string, needle string) bool {
	for _, item := range items {
		if strings.EqualFold(item, needle) {
			return true
		}
	}
	return false
}

func normalizePage(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func normalizeSortClause(sortBy, sortDir string, allowed map[string]string, defaultClause string) string {
	column, ok := allowed[strings.ToLower(strings.TrimSpace(sortBy))]
	if !ok {
		return defaultClause
	}
	direction := "ASC"
	if strings.EqualFold(strings.TrimSpace(sortDir), "desc") {
		direction = "DESC"
	}
	return column + " " + direction
}

func dedupeRolesBySlug(roles []Role, orgID string) []Role {
	if len(roles) == 0 {
		return roles
	}
	bySlug := make(map[string]Role, len(roles))
	for _, role := range roles {
		existing, ok := bySlug[role.Slug]
		if !ok {
			bySlug[role.Slug] = role
			continue
		}
		if preferRoleCandidate(role, existing, orgID) {
			bySlug[role.Slug] = role
		}
	}
	result := make([]Role, 0, len(bySlug))
	for _, role := range bySlug {
		result = append(result, role)
	}
	return result
}

func preferRoleCandidate(candidate, existing Role, orgID string) bool {
	candidateScoped := candidate.OrganizationID != nil && *candidate.OrganizationID == orgID
	existingScoped := existing.OrganizationID != nil && *existing.OrganizationID == orgID
	if candidateScoped != existingScoped {
		return candidateScoped
	}
	if candidate.IsSystem != existing.IsSystem {
		return candidate.IsSystem
	}
	if candidate.CreatedAt.Equal(existing.CreatedAt) {
		return candidate.ID < existing.ID
	}
	return candidate.CreatedAt.Before(existing.CreatedAt)
}

func sortRoles(roles []Role, sortBy, sortDir string) {
	key := strings.ToLower(strings.TrimSpace(sortBy))
	desc := strings.EqualFold(strings.TrimSpace(sortDir), "desc")
	if key == "" {
		key = "is_system"
		desc = true
	}
	sort.SliceStable(roles, func(i, j int) bool {
		left := roles[i]
		right := roles[j]
		switch key {
		case "slug":
			return compareStrings(left.Slug, right.Slug, desc)
		case "is_system":
			if left.IsSystem != right.IsSystem {
				if desc {
					return left.IsSystem && !right.IsSystem
				}
				return !left.IsSystem && right.IsSystem
			}
		default:
			if strings.ToLower(left.Name) != strings.ToLower(right.Name) {
				return compareStrings(left.Name, right.Name, desc)
			}
		}
		return compareStrings(left.Name, right.Name, false)
	})
}

func compareStrings(left, right string, desc bool) bool {
	if desc {
		return strings.ToLower(left) > strings.ToLower(right)
	}
	return strings.ToLower(left) < strings.ToLower(right)
}

func loginEmailHTML(ipAddress, userAgent string) string {
	return fmt.Sprintf(`<html><body style="font-family:Arial,sans-serif"><h2>New login detected</h2><p><strong>IP:</strong> %s<br/><strong>User-Agent:</strong> %s</p></body></html>`, ipAddress, userAgent)
}

func passwordResetEmailHTML(baseURL, token string) string {
	return fmt.Sprintf(`<html><body style="font-family:Arial,sans-serif"><h2>Password reset</h2><p>Use this token to reset your password:</p><pre style="padding:12px;background:#f5f5f5;border-radius:8px">%s</pre><p>%s</p></body></html>`, token, baseURL)
}

func mfaResetEmailHTML(baseURL, token string) string {
	return fmt.Sprintf(`<html><body style="font-family:Arial,sans-serif"><h2>Authenticator reset</h2><p>Use this token to reset your authenticator:</p><pre style="padding:12px;background:#f5f5f5;border-radius:8px">%s</pre><p>%s</p></body></html>`, token, baseURL)
}

func genericSecurityEmailHTML(message string) string {
	return fmt.Sprintf(`<html><body style="font-family:Arial,sans-serif"><h2>Security notification</h2><p>%s</p></body></html>`, message)
}

func (s *Service) normalizeUUIDColumns(ctx context.Context) error {
	statements := []string{
		`ALTER TABLE user_organizations ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE user_organizations ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE roles ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE role_permissions ALTER COLUMN role_id TYPE uuid USING NULLIF(role_id, '')::uuid`,
		`ALTER TABLE role_permissions ALTER COLUMN permission_id TYPE uuid USING NULLIF(permission_id, '')::uuid`,
		`ALTER TABLE user_roles ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE user_roles ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE user_roles ALTER COLUMN role_id TYPE uuid USING NULLIF(role_id, '')::uuid`,
		`ALTER TABLE resource_scopes ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE resource_scopes ALTER COLUMN owner_user_id TYPE uuid USING NULLIF(owner_user_id, '')::uuid`,
		`ALTER TABLE user_permissions ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE user_permissions ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE user_permissions ALTER COLUMN permission_id TYPE uuid USING NULLIF(permission_id, '')::uuid`,
		`ALTER TABLE refresh_tokens ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE refresh_tokens ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE auth_action_tokens ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE auth_action_tokens ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE audit_logs ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
		`ALTER TABLE audit_logs ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE teams ALTER COLUMN organization_id TYPE uuid USING NULLIF(organization_id, '')::uuid`,
		`ALTER TABLE team_members ALTER COLUMN team_id TYPE uuid USING NULLIF(team_id, '')::uuid`,
		`ALTER TABLE team_members ALTER COLUMN user_id TYPE uuid USING NULLIF(user_id, '')::uuid`,
	}
	for _, statement := range statements {
		if err := s.db.WithContext(ctx).Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) normalizeAuditLogRows(ctx context.Context) error {
	statements := []string{
		`ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT NOW()`,
		`UPDATE audit_logs SET created_at = NOW() WHERE created_at IS NULL`,
		`DELETE FROM audit_logs WHERE resource = 'auth' AND created_at < TIMESTAMPTZ '2000-01-01 00:00:00+00'`,
	}
	for _, statement := range statements {
		if err := s.db.WithContext(ctx).Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) userRoleAndTeams(ctx context.Context, userID, orgID string) ([]string, []string, error) {
	var roles []string
	if err := s.db.WithContext(ctx).
		Table("user_roles ur").
		Select("r.slug").
		Joins("join roles r on r.id = ur.role_id").
		Where("ur.user_id = ? AND ur.organization_id = ?", userID, orgID).
		Pluck("r.slug", &roles).Error; err != nil {
		return nil, nil, err
	}
	var teams []string
	if err := s.db.WithContext(ctx).
		Table("team_members tm").
		Select("t.name").
		Joins("join teams t on t.id = tm.team_id").
		Where("tm.user_id = ? AND t.organization_id = ?", userID, orgID).
		Pluck("t.name", &teams).Error; err != nil {
		return nil, nil, err
	}
	return roles, teams, nil
}

func (s *Service) replaceUserRolesTx(_ context.Context, tx *gorm.DB, userID, orgID string, roleSlugs []string) error {
	if err := tx.Where("user_id = ? AND organization_id = ?", userID, orgID).Delete(&UserRole{}).Error; err != nil {
		return err
	}
	for _, slug := range roleSlugs {
		var role Role
		query := tx.Where("slug = ?", strings.ToLower(strings.TrimSpace(slug)))
		query = query.Where("organization_id = ? OR organization_id IS NULL", orgID)
		if err := query.Order("organization_id desc").First(&role).Error; err != nil {
			return err
		}
		if err := tx.Create(&UserRole{
			UserID:         userID,
			OrganizationID: orgID,
			RoleID:         role.ID,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) replaceRolePermissionsTx(_ context.Context, tx *gorm.DB, roleID string, permissionKeys []string) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&RolePermission{}).Error; err != nil {
		return err
	}
	for _, key := range permissionKeys {
		parts := strings.SplitN(key, ":", 2)
		if len(parts) != 2 {
			continue
		}
		var permission Permission
		if err := tx.Where("resource = ? AND action = ?", parts[0], parts[1]).First(&permission).Error; err != nil {
			return err
		}
		if err := tx.Create(&RolePermission{RoleID: roleID, PermissionID: permission.ID}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) replaceTeamMembersTx(ctx context.Context, tx *gorm.DB, orgID, teamID string, memberIDs []string) error {
	if err := tx.Where("team_id = ?", teamID).Delete(&TeamMember{}).Error; err != nil {
		return err
	}
	for _, memberID := range memberIDs {
		if err := tx.Create(&TeamMember{TeamID: teamID, UserID: memberID}).Error; err != nil {
			return err
		}
	}
	return s.syncAllMembershipTeamsTx(ctx, tx, orgID)
}

func (s *Service) replaceTeamMembersForUserTx(ctx context.Context, tx *gorm.DB, orgID, userID string, teamIDs []string) error {
	if err := tx.Exec("delete from team_members where user_id = ? and team_id in (select id from teams where organization_id = ?)", userID, orgID).Error; err != nil {
		return err
	}
	for _, teamID := range teamIDs {
		if err := tx.Create(&TeamMember{TeamID: teamID, UserID: userID}).Error; err != nil {
			return err
		}
	}
	return s.syncAllMembershipTeamsTx(ctx, tx, orgID)
}

func (s *Service) syncAllMembershipTeamsTx(_ context.Context, tx *gorm.DB, orgID string) error {
	type row struct {
		UserID string
		Name   string
	}
	var rows []row
	if err := tx.Table("team_members tm").
		Select("tm.user_id, t.name").
		Joins("join teams t on t.id = tm.team_id").
		Where("t.organization_id = ?", orgID).
		Scan(&rows).Error; err != nil {
		return err
	}
	byUser := map[string][]string{}
	for _, row := range rows {
		byUser[row.UserID] = append(byUser[row.UserID], row.Name)
	}
	var memberships []UserOrganization
	if err := tx.Where("organization_id = ?", orgID).Find(&memberships).Error; err != nil {
		return err
	}
	for _, membership := range memberships {
		teams := byUser[membership.UserID]
		if err := tx.Model(&UserOrganization{}).Where("id = ?", membership.ID).Update("teams", StringSlice(teams)).Error; err != nil {
			return err
		}
	}
	return nil
}
