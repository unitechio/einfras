//go:build legacy
// +build legacy

package handler

// import (
// 	"net/http"

// 	"github.com/gin-gonic/gin"
// 	"einfra/api/internal/domain"
// 	"einfra/api/pkg/errorx"
// )

// // ForgotPassword handles password reset requests
// // @Summary Request Password Reset
// // @Description Request a password reset token via email
// // @Tags auth
// // @Accept json
// // @Produce json
// // @Param request body struct{Email string `json:"email"`} true "Email address"
// // @Success 200 {object} gin.H
// // @Failure 400 {object} gin.H
// // @Router /auth/forgot-password [post]
// func (h *AuthHandler) ForgotPassword(c *gin.Context) {
// 	var req struct {
// 		Email string `json:"email" binding:"required,email"`
// 	}
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
// 		return
// 	}

// 	resetReq := &domain.PasswordResetRequest{Email: req.Email}
// 	if err := h.authUsecase.RequestPasswordReset(c.Request.Context(), resetReq); err != nil {
// 		// Don't reveal if email exists or not for security
// 		c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "If the email exists, a password reset link has been sent"})
// }

// // ResetPassword handles password reset with token
// // @Summary Reset Password
// // @Description Reset password using reset token
// // @Tags auth
// // @Accept json
// // @Produce json
// // @Param request body domain.PasswordResetConfirm true "Reset token and new password"
// // @Success 200 {object} gin.H
// // @Failure 400 {object} gin.H
// // @Router /auth/reset-password [post]
// func (h *AuthHandler) ResetPassword(c *gin.Context) {
// 	var req domain.PasswordResetConfirm
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
// 		return
// 	}

// 	if err := h.authUsecase.ResetPassword(c.Request.Context(), &req); err != nil {
// 		c.Error(errorx.New(http.StatusBadRequest, err.Error()))
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "Password reset successful"})
// }

// // VerifyEmail handles email verification
// // @Summary Verify Email
// // @Description Verify user email with verification token
// // @Tags auth
// // @Accept json
// // @Produce json
// // @Param request body domain.EmailVerificationRequest true "Verification token"
// // @Success 200 {object} gin.H
// // @Failure 400 {object} gin.H
// // @Router /auth/verify-email [post]
// func (h *AuthHandler) VerifyEmail(c *gin.Context) {
// 	var req domain.EmailVerificationRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body"))
// 		return
// 	}

// 	if err := h.authUsecase.VerifyEmail(c.Request.Context(), &req); err != nil {
// 		c.Error(errorx.New(http.StatusBadRequest, err.Error()))
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
// }
