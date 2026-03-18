package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/modules/auth/application"
	"einfra/api/internal/domain"
	"einfra/api/pkg/errorx"
)

// AuthHandler handles authentication-related requests.
type AuthHandler struct {
	authUsecase usecase.AuthUsecase
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authUsecase usecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{authUsecase: authUsecase}
}

// Register handles user registration
// @Summary Register a new user
// @Description Register a new user with username, email, and password
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.RegisterRequest true "Registration data"
// @Success 201 {object} domain.UserToken "Registration successful"
// @Failure 400 {object} errorx.Error "Bad request"
// @Failure 409 {object} errorx.Error "User already exists"
// @Failure 500 {object} errorx.Error "Internal server error"
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req domain.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	user := &domain.User{
		Username:  req.Username,
		Email:     req.Email,
		FirstName: req.Name,
	}

	// Only set RoleID if it's provided (and convert to string if needed, though int to UUID string is unlikely to work directly unless it's a specific logic)
	// For now, we'll skip RoleID assignment from int to string UUID to avoid invalid UUID errors,
	// assuming default role assignment happens in usecase or database if not provided.

	token, err := h.authUsecase.Register(c.Request.Context(), user, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registration successful",
		"data":    token,
	})
}

// Login handles the login request.
// @Summary Login
// @Description Login with username and password
// @Tags auth
// @Accept json
// @Produce json
// @Param credentials body domain.AuthCredentials true "Login credentials"
// @Success 200 {object} domain.AuthResponse
// @Failure 400 {object} gin.H
// @Failure 401 {object} gin.H
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.AuthCredentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()

	authResponse, err := h.authUsecase.Login(c.Request.Context(), &req, ipAddress, userAgent)
	if err != nil {
		c.Error(errorx.New(http.StatusUnauthorized, err.Error()))
		return
	}

	c.JSON(http.StatusOK, authResponse)
}

// Logout handles the logout request.
// @Summary Logout
// @Description Logout and revoke token
// @Tags auth
// @Accept json
// @Produce json
// @Param body body struct{Token string `json:"token"`} true "Token to revoke"
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	if err := h.authUsecase.Logout(c.Request.Context(), req.Token); err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, "Failed to logout").WithStack())
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

// RefreshToken handles token refresh.
// @Summary Refresh Token
// @Description Refresh access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param body body struct{RefreshToken string `json:"refresh_token"`} true "Refresh Token"
// @Success 200 {object} domain.AuthResponse
// @Failure 400 {object} gin.H
// @Failure 401 {object} gin.H
// @Router /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	authResponse, err := h.authUsecase.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.Error(errorx.New(http.StatusUnauthorized, "Invalid refresh token"))
		return
	}

	c.JSON(http.StatusOK, authResponse)
}

// ForgotPassword handles password reset requests
// @Summary Request Password Reset
// @Description Request a password reset token via email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body struct{Email string `json:"email"`} true "Email address"
// @Success 200 {object} gin.H
// @Failure 400 {object} gin.H
// @Router /auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	resetReq := &domain.PasswordResetRequest{Email: req.Email}
	if err := h.authUsecase.RequestPasswordReset(c.Request.Context(), resetReq); err != nil {
		// Don't reveal if email exists or not for security
		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
}

// ResetPassword handles password reset with token
// @Summary Reset Password
// @Description Reset password using reset token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.PasswordResetConfirm true "Reset token and new password"
// @Success 200 {object} gin.H
// @Failure 400 {object} gin.H
// @Router /auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req domain.PasswordResetConfirm
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	if err := h.authUsecase.ResetPassword(c.Request.Context(), &req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successful"})
}

// VerifyEmail handles email verification
// @Summary Verify Email
// @Description Verify user email with verification token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body domain.EmailVerificationRequest true "Verification token"
// @Success 200 {object} gin.H
// @Failure 400 {object} gin.H
// @Router /auth/verify-email [post]
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req domain.EmailVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
		return
	}

	if err := h.authUsecase.VerifyEmail(c.Request.Context(), &req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}
