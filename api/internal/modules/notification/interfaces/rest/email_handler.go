//go:build legacy
// +build legacy

package handler

import (
	"encoding/base64"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"einfra/api/internal/domain"
	"einfra/api/internal/usecase"
	"einfra/api/pkg/errorx"
)

type EmailHandler struct {
	emailUsecase usecase.EmailUsecase
}

func NewEmailHandler(emailUsecase usecase.EmailUsecase) *EmailHandler {
	return &EmailHandler{
		emailUsecase: emailUsecase,
	}
}

type SendEmailRequest struct {
	To       []string          `json:"to" binding:"required,min=1"`
	CC       []string          `json:"cc"`
	BCC      []string          `json:"bcc"`
	Subject  string            `json:"subject" binding:"required"`
	Body     string            `json:"body"`
	HTMLBody string            `json:"html_body"`
	ReplyTo  string            `json:"reply_to"`
	Priority string            `json:"priority"` // "high", "normal", "low"
	Headers  map[string]string `json:"headers"`
}

type SendTemplateEmailRequest struct {
	To           []string               `json:"to" binding:"required,min=1"`
	CC           []string               `json:"cc"`
	BCC          []string               `json:"bcc"`
	TemplateName string                 `json:"template_name" binding:"required"`
	Data         map[string]interface{} `json:"data" binding:"required"`
}

type SendBulkEmailRequest struct {
	Emails []SendEmailRequest `json:"emails" binding:"required,min=1,dive"`
}

type SendEmailWithAttachmentRequest struct {
	SendEmailRequest
	Attachments []AttachmentRequest `json:"attachments" binding:"required,min=1,dive"`
}

type AttachmentRequest struct {
	Filename    string `json:"filename" binding:"required"`
	Content     string `json:"content" binding:"required"` // Base64 encoded
	ContentType string `json:"content_type" binding:"required"`
	Inline      bool   `json:"inline"`
	ContentID   string `json:"content_id"`
}

type ScheduleEmailRequest struct {
	SendAt time.Time        `json:"send_at" binding:"required"`
	Email  SendEmailRequest `json:"email" binding:"required"`
}

type ValidateEmailRequest struct {
	Email string `json:"email" binding:"required"`
}

// Handlers

// SendEmail handles sending simple emails
// @Summary Send Email
// @Description Send a simple text or HTML email
// @Tags emails
// @Accept json
// @Produce json
// @Param request body SendEmailRequest true "Email data"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Failure 500 {object} errorx.Error
// @Router /emails/send [post]
func (h *EmailHandler) SendEmail(c *gin.Context) {
	var req SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	ctx := c.Request.Context()
	var err error

	if req.HTMLBody != "" {
		err = h.emailUsecase.SendHTMLEmail(ctx, req.To, req.Subject, req.HTMLBody)
	} else {
		err = h.emailUsecase.SendEmail(ctx, req.To, req.Subject, req.Body)
	}

	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email sent successfully"})
}

// SendTemplateEmail handles sending template-based emails
// @Summary Send Template Email
// @Description Send an email using a template
// @Tags emails
// @Accept json
// @Produce json
// @Param request body SendTemplateEmailRequest true "Template email data"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Failure 500 {object} errorx.Error
// @Router /emails/send-template [post]
func (h *EmailHandler) SendTemplateEmail(c *gin.Context) {
	var req SendTemplateEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	ctx := c.Request.Context()
	err := h.emailUsecase.SendEmailWithTemplate(ctx, req.To, req.TemplateName, req.Data)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Template email sent successfully"})
}

// SendBulkEmail handles sending bulk emails
// @Summary Send Bulk Emails
// @Description Send multiple emails in bulk
// @Tags emails
// @Accept json
// @Produce json
// @Param request body SendBulkEmailRequest true "Bulk email data"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Failure 500 {object} errorx.Error
// @Router /emails/send-bulk [post]
func (h *EmailHandler) SendBulkEmail(c *gin.Context) {
	var req SendBulkEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	ctx := c.Request.Context()
	emails := make([]domain.EmailData, len(req.Emails))

	for i, emailReq := range req.Emails {
		emails[i] = domain.EmailData{
			To:       emailReq.To,
			CC:       emailReq.CC,
			BCC:      emailReq.BCC,
			Subject:  emailReq.Subject,
			Body:     emailReq.Body,
			HTMLBody: emailReq.HTMLBody,
			ReplyTo:  emailReq.ReplyTo,
			Headers:  emailReq.Headers,
		}
	}

	err := h.emailUsecase.SendBulkEmail(ctx, emails)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk emails sent successfully",
		"count":   len(emails),
	})
}

// SendEmailWithAttachment handles sending emails with attachments
// @Summary Send Email with Attachment
// @Description Send an email with attachments
// @Tags emails
// @Accept json
// @Produce json
// @Param request body SendEmailWithAttachmentRequest true "Email with attachment data"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Failure 500 {object} errorx.Error
// @Router /emails/send-with-attachment [post]
func (h *EmailHandler) SendEmailWithAttachment(c *gin.Context) {
	var req SendEmailWithAttachmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	// Convert attachments
	attachments := make([]domain.EmailAttachment, len(req.Attachments))
	for i, att := range req.Attachments {
		content, err := base64.StdEncoding.DecodeString(att.Content)
		if err != nil {
			c.Error(errorx.New(http.StatusBadRequest, "Invalid attachment content (base64)"))
			return
		}

		attachments[i] = domain.EmailAttachment{
			Filename:    att.Filename,
			Content:     content,
			ContentType: att.ContentType,
			Inline:      att.Inline,
			ContentID:   att.ContentID,
		}
	}

	ctx := c.Request.Context()
	err := h.emailUsecase.SendEmailWithAttachment(ctx, req.To, req.Subject, req.Body, attachments)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email with attachments sent successfully"})
}

// ScheduleEmail handles scheduling emails
// @Summary Schedule Email
// @Description Schedule an email to be sent at a later time
// @Tags emails
// @Accept json
// @Produce json
// @Param request body ScheduleEmailRequest true "Schedule email data"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Failure 500 {object} errorx.Error
// @Router /emails/schedule [post]
func (h *EmailHandler) ScheduleEmail(c *gin.Context) {
	var req ScheduleEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	emailData := domain.EmailData{
		To:       req.Email.To,
		CC:       req.Email.CC,
		BCC:      req.Email.BCC,
		Subject:  req.Email.Subject,
		Body:     req.Email.Body,
		HTMLBody: req.Email.HTMLBody,
		ReplyTo:  req.Email.ReplyTo,
		Headers:  req.Email.Headers,
	}

	ctx := c.Request.Context()
	err := h.emailUsecase.ScheduleEmail(ctx, req.SendAt, emailData)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Email scheduled successfully",
		"send_at": req.SendAt,
	})
}

// GetEmailLogs retrieves email logs
// @Summary Get Email Logs
// @Description Retrieve email logs with filtering
// @Tags emails
// @Accept json
// @Produce json
// @Param status query string false "Status"
// @Param from query string false "From"
// @Param to query string false "To"
// @Param template query string false "Template"
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param date_from query string false "Date From (RFC3339)"
// @Param date_to query string false "Date To (RFC3339)"
// @Success 200 {object} gin.H
// @Failure 500 {object} errorx.Error
// @Router /emails/logs [get]
func (h *EmailHandler) GetEmailLogs(c *gin.Context) {
	filter := domain.EmailLogFilter{
		Status:   domain.EmailStatus(c.Query("status")),
		From:     c.Query("from"),
		To:       c.Query("to"),
		Template: c.Query("template"),
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		limit, _ := strconv.Atoi(limitStr)
		filter.Limit = limit
	} else {
		filter.Limit = 20
	}

	if offsetStr := c.Query("offset"); offsetStr != "" {
		offset, _ := strconv.Atoi(offsetStr)
		filter.Offset = offset
	}

	if dateFromStr := c.Query("date_from"); dateFromStr != "" {
		dateFrom, err := time.Parse(time.RFC3339, dateFromStr)
		if err == nil {
			filter.DateFrom = &dateFrom
		}
	}

	if dateToStr := c.Query("date_to"); dateToStr != "" {
		dateTo, err := time.Parse(time.RFC3339, dateToStr)
		if err == nil {
			filter.DateTo = &dateTo
		}
	}

	ctx := c.Request.Context()
	logs, err := h.emailUsecase.ListEmailLogs(ctx, filter)
	if err != nil {
		c.Error(errorx.New(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Email logs retrieved successfully",
		"logs":    logs,
		"count":   len(logs),
	})
}

// GetEmailLog retrieves a specific email log
// @Summary Get Email Log
// @Description Retrieve a specific email log by ID
// @Tags emails
// @Accept json
// @Produce json
// @Param id path string true "Log ID"
// @Success 200 {object} domain.EmailLog
// @Failure 404 {object} errorx.Error
// @Router /emails/logs/{id} [get]
func (h *EmailHandler) GetEmailLog(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	log, err := h.emailUsecase.GetEmailLog(ctx, id)
	if err != nil {
		c.Error(errorx.New(http.StatusNotFound, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Email log retrieved successfully",
		"data":    log,
	})
}

// GetEmailStatus retrieves the status of an email
// @Summary Get Email Status
// @Description Retrieve the status of a specific email by ID
// @Tags emails
// @Accept json
// @Produce json
// @Param id path string true "Log ID"
// @Success 200 {object} gin.H
// @Failure 404 {object} errorx.Error
// @Router /emails/logs/{id}/status [get]
func (h *EmailHandler) GetEmailStatus(c *gin.Context) {
	id := c.Param("id")

	ctx := c.Request.Context()
	status, err := h.emailUsecase.GetEmailStatus(ctx, id)
	if err != nil {
		c.Error(errorx.New(http.StatusNotFound, err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Email status retrieved successfully",
		"status":  status,
	})
}

// ValidateEmail validates an email address
// @Summary Validate Email
// @Description Validate an email address format
// @Tags emails
// @Accept json
// @Produce json
// @Param request body ValidateEmailRequest true "Validation request"
// @Success 200 {object} gin.H
// @Failure 400 {object} errorx.Error
// @Router /emails/validate [post]
func (h *EmailHandler) ValidateEmail(c *gin.Context) {
	var req ValidateEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(errorx.New(http.StatusBadRequest, "Invalid request body: "+err.Error()))
		return
	}

	isValid := h.emailUsecase.ValidateEmail(req.Email)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Email validated",
		"email":    req.Email,
		"is_valid": isValid,
	})
}
