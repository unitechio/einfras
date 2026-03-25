//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/modules/auth/domain"
	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/modules/auth/infrastructure"
	"einfra/api/internal/domain"
)

type AuthUsecase interface {
	Register(ctx context.Context, user *domain.User, password string) (*domain.AuthResponse, error)
	Login(ctx context.Context, credentials *domain.AuthCredentials, ipAddress, userAgent string) (*domain.AuthResponse, error)
	Logout(ctx context.Context, token string) error
	RefreshToken(ctx context.Context, refreshToken string) (*domain.AuthResponse, error)
	ValidateToken(ctx context.Context, token string) (*domain.User, error)
	ChangePassword(ctx context.Context, userID string, request *domain.ChangePasswordRequest) error
	RequestPasswordReset(ctx context.Context, request *domain.PasswordResetRequest) error
	ResetPassword(ctx context.Context, request *domain.PasswordResetConfirm) error
	VerifyEmail(ctx context.Context, request *domain.EmailVerificationRequest) error
	ResendVerificationEmail(ctx context.Context, email string) error
	GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error)
	RevokeSession(ctx context.Context, sessionID string) error
	RevokeAllSessions(ctx context.Context, userID string) error
	GetOAuthLoginURL(ctx context.Context, provider domain.AuthProvider, redirectURL string) (string, error)
	HandleOAuthCallback(ctx context.Context, provider domain.AuthProvider, code, state string) (*domain.AuthResponse, error)
}

type authUsecase struct {
	authRepo            repository.AuthRepository
	userRepo            repository.UserRepository
	sessionRepo         repository.SessionRepository
	loginAttemptRepo    repository.LoginAttemptRepository
	notificationUsecase NotificationUsecase
	cfg                 config.AuthConfig
	jwt                 *auth.JWTService
	maxFailedAttempts   int
	lockDuration        time.Duration
}

func NewAuthUsecase(
	authRepo repository.AuthRepository,
	userRepo repository.UserRepository,
	sessionRepo repository.SessionRepository,
	loginAttemptRepo repository.LoginAttemptRepository,
	notificationUsecase NotificationUsecase,
	cfg config.AuthConfig,
	jwt *auth.JWTService,
) AuthUsecase {
	return &authUsecase{
		authRepo:            authRepo,
		userRepo:            userRepo,
		sessionRepo:         sessionRepo,
		loginAttemptRepo:    loginAttemptRepo,
		notificationUsecase: notificationUsecase,
		cfg:                 cfg,
		jwt:                 jwt,
		maxFailedAttempts:   5,
		lockDuration:        30 * time.Minute,
	}
}

func (u *authUsecase) Register(ctx context.Context, user *domain.User, password string) (*domain.AuthResponse, error) {
	existingUser, _ := u.userRepo.GetByEmail(ctx, user.Email)
	if existingUser != nil {
		return nil, fmt.Errorf("user with this email already exists")
	}

	existingUser, _ = u.userRepo.GetByUsername(ctx, user.Username)
	if existingUser != nil {
		return nil, fmt.Errorf("user with this username already exists")
	}

	hashedPassword, err := u.jwt.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user.Password = hashedPassword
	user.IsActive = true
	user.IsEmailVerified = false

	if err := u.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	verificationToken, err := u.jwt.GenerateRefreshToken()
	if err != nil {
		fmt.Printf("Failed to generate verification token: %v\n", err)
	} else {
		refreshToken := &domain.RefreshToken{
			UserID:    user.ID,
			Token:     verificationToken,
			ExpiresAt: time.Now().Add(24 * time.Hour),
		}
		_ = u.authRepo.SaveRefreshToken(ctx, refreshToken)

		if u.notificationUsecase != nil {
			go func() {
				_ = u.notificationUsecase.SendNotificationFromTemplate(
					context.Background(),
					user.ID,
					"email_verification",
					map[string]string{
						"username": user.Username,
						"token":    verificationToken,
					},
				)
			}()
		}
	}

	return u.generateTokens(ctx, user)
}

func (u *authUsecase) Login(ctx context.Context, credentials *domain.AuthCredentials, ipAddress, userAgent string) (*domain.AuthResponse, error) {
	failedCount, err := u.loginAttemptRepo.GetFailedAttempts(ctx, credentials.Username, ipAddress, 15*time.Minute)
	if err == nil && failedCount >= int64(u.maxFailedAttempts) {
		_ = u.loginAttemptRepo.Create(ctx, &domain.LoginAttempt{
			Username:   credentials.Username,
			IPAddress:  ipAddress,
			UserAgent:  userAgent,
			Success:    false,
			FailReason: "Too many failed attempts",
		})
		return nil, fmt.Errorf("too many failed login attempts, please try again later")
	}

	user, err := u.validateCredentials(ctx, credentials.Username, credentials.Password)
	if err != nil {
		_ = u.loginAttemptRepo.Create(ctx, &domain.LoginAttempt{
			Username:   credentials.Username,
			IPAddress:  ipAddress,
			UserAgent:  userAgent,
			Success:    false,
			FailReason: err.Error(),
		})

		if user != nil {
			_ = u.userRepo.IncrementFailedLogin(ctx, user.ID)
			if user.FailedLoginCount+1 >= u.maxFailedAttempts {
				lockUntil := time.Now().Add(u.lockDuration)
				_ = u.userRepo.LockAccount(ctx, user.ID, lockUntil)
			}
		}
		return nil, fmt.Errorf("invalid credentials")
	}

	_ = u.userRepo.ResetFailedLogin(ctx, user.ID)
	_ = u.userRepo.UpdateLastLogin(ctx, user.ID, ipAddress)

	_ = u.loginAttemptRepo.Create(ctx, &domain.LoginAttempt{
		Username:  user.Username,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Success:   true,
	})

	authResponse, err := u.generateTokens(ctx, user)
	if err != nil {
		return nil, err
	}

	session := &domain.Session{
		UserID:       user.ID,
		Token:        authResponse.AccessToken,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		IsActive:     true,
		LastActivity: time.Now(),
		ExpiresAt:    time.Now().Add(24 * time.Hour),
	}
	_ = u.sessionRepo.Create(ctx, session)

	return authResponse, nil
}

func (u *authUsecase) Logout(ctx context.Context, token string) error {
	refreshToken, err := u.authRepo.GetRefreshTokenByToken(ctx, token)
	if err == nil {
		_ = u.authRepo.RevokeRefreshToken(ctx, refreshToken.ID)
	}
	_ = u.sessionRepo.DeleteByToken(ctx, token)
	return nil
}

func (u *authUsecase) RefreshToken(ctx context.Context, refreshTokenStr string) (*domain.AuthResponse, error) {
	refreshToken, err := u.authRepo.GetRefreshTokenByToken(ctx, refreshTokenStr)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	if !refreshToken.IsValid() {
		return nil, fmt.Errorf("refresh token expired or revoked")
	}

	user, err := u.userRepo.GetByID(ctx, refreshToken.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return u.generateTokens(ctx, user)
}

func (u *authUsecase) ValidateToken(ctx context.Context, token string) (*domain.User, error) {
	claims, err := u.jwt.ValidateAccessToken(token)
	if err != nil {
		return nil, err
	}
	return u.userRepo.GetByID(ctx, claims.UserID)
}

func (u *authUsecase) ChangePassword(ctx context.Context, userID string, request *domain.ChangePasswordRequest) error {
	user, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if err := u.jwt.CheckPassword(user.Password, request.OldPassword); err != nil {
		return fmt.Errorf("invalid old password")
	}

	hashedPassword, err := u.jwt.HashPassword(request.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := u.userRepo.UpdatePassword(ctx, userID, hashedPassword); err != nil {
		return err
	}

	_ = u.authRepo.RevokeAllRefreshTokensForUser(ctx, userID)
	return nil
}

func (u *authUsecase) RequestPasswordReset(ctx context.Context, request *domain.PasswordResetRequest) error {
	user, err := u.userRepo.GetByEmail(ctx, request.Email)
	if err != nil {
		return nil
	}

	resetToken, err := u.jwt.GenerateRefreshToken()
	if err != nil {
		return err
	}

	refreshToken := &domain.RefreshToken{
		UserID:    user.ID,
		Token:     resetToken,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	if err := u.authRepo.SaveRefreshToken(ctx, refreshToken); err != nil {
		return err
	}

	if u.notificationUsecase != nil {
		go func() {
			_ = u.notificationUsecase.SendNotificationFromTemplate(
				context.Background(),
				user.ID,
				"password_reset",
				map[string]string{
					"username": user.Username,
					"token":    resetToken,
				},
			)
		}()
	}

	return nil
}

func (u *authUsecase) ResetPassword(ctx context.Context, request *domain.PasswordResetConfirm) error {
	refreshToken, err := u.authRepo.GetRefreshTokenByToken(ctx, request.Token)
	if err != nil {
		return fmt.Errorf("invalid or expired reset token")
	}

	if !refreshToken.IsValid() {
		return fmt.Errorf("invalid or expired reset token")
	}

	hashedPassword, err := u.jwt.HashPassword(request.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	if err := u.userRepo.UpdatePassword(ctx, refreshToken.UserID, hashedPassword); err != nil {
		return err
	}

	_ = u.authRepo.RevokeRefreshToken(ctx, refreshToken.ID)
	_ = u.authRepo.RevokeAllRefreshTokensForUser(ctx, refreshToken.UserID)

	return nil
}

func (u *authUsecase) VerifyEmail(ctx context.Context, request *domain.EmailVerificationRequest) error {
	refreshToken, err := u.authRepo.GetRefreshTokenByToken(ctx, request.Token)
	if err != nil {
		return fmt.Errorf("invalid or expired verification token")
	}

	if !refreshToken.IsValid() {
		return fmt.Errorf("invalid or expired verification token")
	}

	user, err := u.userRepo.GetByID(ctx, refreshToken.UserID)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	now := time.Now()
	user.IsEmailVerified = true
	user.EmailVerifiedAt = &now

	if err := u.userRepo.Update(ctx, user); err != nil {
		return err
	}

	_ = u.authRepo.RevokeRefreshToken(ctx, refreshToken.ID)
	return nil
}

func (u *authUsecase) ResendVerificationEmail(ctx context.Context, email string) error {
	user, err := u.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if user.IsEmailVerified {
		return fmt.Errorf("email already verified")
	}

	verificationToken, err := u.jwt.GenerateRefreshToken()
	if err != nil {
		return err
	}

	refreshToken := &domain.RefreshToken{
		UserID:    user.ID,
		Token:     verificationToken,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	if err := u.authRepo.SaveRefreshToken(ctx, refreshToken); err != nil {
		return err
	}

	if u.notificationUsecase != nil {
		go func() {
			_ = u.notificationUsecase.SendNotificationFromTemplate(
				context.Background(),
				user.ID,
				"email_verification",
				map[string]string{
					"username": user.Username,
					"token":    verificationToken,
				},
			)
		}()
	}

	return nil
}

func (u *authUsecase) GetUserSessions(ctx context.Context, userID string) ([]*domain.Session, error) {
	return u.sessionRepo.GetByUserID(ctx, userID)
}

func (u *authUsecase) RevokeSession(ctx context.Context, sessionID string) error {
	return u.sessionRepo.Delete(ctx, sessionID)
}

func (u *authUsecase) RevokeAllSessions(ctx context.Context, userID string) error {
	if err := u.authRepo.RevokeAllRefreshTokensForUser(ctx, userID); err != nil {
		return err
	}
	return u.sessionRepo.DeleteAllForUser(ctx, userID)
}

func (u *authUsecase) GetOAuthLoginURL(ctx context.Context, provider domain.AuthProvider, redirectURL string) (string, error) {
	return "", fmt.Errorf("OAuth not implemented yet")
}

func (u *authUsecase) HandleOAuthCallback(ctx context.Context, provider domain.AuthProvider, code, state string) (*domain.AuthResponse, error) {
	return nil, fmt.Errorf("OAuth not implemented yet")
}

func (u *authUsecase) validateCredentials(ctx context.Context, username, password string) (*domain.User, error) {
	var user *domain.User
	var err error

	user, err = u.userRepo.GetByUsername(ctx, username)
	if err != nil {
		user, err = u.userRepo.GetByEmail(ctx, username)
		if err != nil {
			return nil, fmt.Errorf("invalid credentials")
		}
	}

	if !user.IsActive {
		return nil, fmt.Errorf("account is inactive")
	}

	if user.IsLocked() {
		return nil, fmt.Errorf("account is locked")
	}

	if err := u.jwt.CheckPassword(user.Password, password); err != nil {
		return user, fmt.Errorf("invalid credentials")
	}

	return user, nil
}

func (u *authUsecase) generateTokens(ctx context.Context, user *domain.User) (*domain.AuthResponse, error) {
	var permissions []string
	if user.Role != nil {
		for _, perm := range user.Role.Permissions {
			permissions = append(permissions, perm.Name)
		}
	}

	accessToken, err := u.jwt.GenerateAccessToken(user, permissions)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := u.jwt.GenerateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	refreshTokenModel := &domain.RefreshToken{
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: time.Now().Add(time.Duration(u.cfg.RefreshTokenExpiry) * time.Second),
	}
	if err := u.authRepo.SaveRefreshToken(ctx, refreshTokenModel); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &domain.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    u.cfg.JWTExpiration,
		User:         user,
		IssuedAt:     time.Now(),
	}, nil
}
