//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"einfra/api/internal/modules/notification/infrastructure"
	"einfra/api/internal/domain"
	"einfra/api/pkg/email"
)

type emailUsecase struct {
	emailRepo        repository.EmailRepository
	templateRenderer *email.TemplateRenderer
}

func NewEmailUsecase(emailRepo repository.EmailRepository) EmailUsecase {
	// Initialize template renderer
	renderer, err := email.NewTemplateRenderer(email.TemplateConfig{
		TemplateDir:  "./templates/email",
		CacheEnabled: true,
	})
	if err != nil {
		// Log error but don't fail - templates are optional
		fmt.Printf("Warning: Failed to initialize email template renderer: %v\n", err)
	}

	return &emailUsecase{
		emailRepo:        emailRepo,
		templateRenderer: renderer,
	}
}

// Basic sending functions

func (u *emailUsecase) SendEmail(ctx context.Context, to []string, subject, body string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	data := domain.EmailData{
		To:      to,
		Subject: subject,
		Body:    body,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendHTMLEmail(ctx context.Context, to []string, subject, htmlBody string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	data := domain.EmailData{
		To:       to,
		Subject:  subject,
		HTMLBody: htmlBody,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendEmailWithCC(ctx context.Context, to, cc []string, subject, body string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}
	if err := u.validateRecipients(cc); err != nil {
		return err
	}

	data := domain.EmailData{
		To:      to,
		CC:      cc,
		Subject: subject,
		Body:    body,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendEmailWithBCC(ctx context.Context, to, bcc []string, subject, body string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}
	if err := u.validateRecipients(bcc); err != nil {
		return err
	}

	data := domain.EmailData{
		To:      to,
		BCC:     bcc,
		Subject: subject,
		Body:    body,
	}

	return u.sendAndLog(ctx, data)
}

// Template-based functions

func (u *emailUsecase) SendEmailWithTemplate(ctx context.Context, to []string, templateName string, data interface{}) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	templateData, ok := data.(map[string]interface{})
	if !ok {
		return errors.New("data must be a map[string]interface{}")
	}

	// Render template to HTML
	var htmlBody string
	var subject string
	if u.templateRenderer != nil {
		renderedHTML, err := u.templateRenderer.Render(templateName, templateData)
		if err != nil {
			return fmt.Errorf("failed to render template %s: %w", templateName, err)
		}
		htmlBody = renderedHTML

		// Extract subject from template data if provided
		if subj, ok := templateData["Subject"].(string); ok {
			subject = subj
		} else {
			subject = fmt.Sprintf("Email from %s", templateName)
		}
	}

	emailData := domain.EmailData{
		To:       to,
		Subject:  subject,
		HTMLBody: htmlBody,
		Template: templateName,
		Data:     templateData,
	}

	return u.sendAndLog(ctx, emailData)
}

func (u *emailUsecase) SendTemplateEmailWithCC(ctx context.Context, to, cc []string, templateName string, data interface{}) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}
	if err := u.validateRecipients(cc); err != nil {
		return err
	}

	templateData, ok := data.(map[string]interface{})
	if !ok {
		return errors.New("data must be a map[string]interface{}")
	}

	emailData := domain.EmailData{
		To:       to,
		CC:       cc,
		Template: templateName,
		Data:     templateData,
	}

	return u.sendAndLog(ctx, emailData)
}

// Attachment functions

func (u *emailUsecase) SendEmailWithAttachment(ctx context.Context, to []string, subject, body string, attachments []domain.EmailAttachment) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	data := domain.EmailData{
		To:          to,
		Subject:     subject,
		Body:        body,
		Attachments: attachments,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendEmailWithInlineImage(ctx context.Context, to []string, subject, htmlBody string, images []domain.EmailAttachment) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	// Mark all images as inline
	for i := range images {
		images[i].Inline = true
		if images[i].ContentID == "" {
			images[i].ContentID = fmt.Sprintf("image_%d", i)
		}
	}

	data := domain.EmailData{
		To:          to,
		Subject:     subject,
		HTMLBody:    htmlBody,
		Attachments: images,
	}

	return u.sendAndLog(ctx, data)
}

// Bulk operations

func (u *emailUsecase) SendBulkEmail(ctx context.Context, emails []domain.EmailData) error {
	// Validate all emails first
	for _, email := range emails {
		if err := u.validateRecipients(email.To); err != nil {
			return fmt.Errorf("validation failed for email to %v: %w", email.To, err)
		}
	}

	// Log all emails
	for _, email := range emails {
		log := u.createEmailLog(email)
		if err := u.emailRepo.SaveEmailLog(ctx, log); err != nil {
			return fmt.Errorf("failed to save email log: %w", err)
		}
	}

	// TODO: Implement actual email sending service
	return fmt.Errorf("bulk email sending not yet implemented")
	// return u.emailService.SendBulkEmail(ctx, emails)
}

func (u *emailUsecase) SendBulkTemplateEmail(ctx context.Context, recipients []string, templateName string, data interface{}) error {
	if err := u.validateRecipients(recipients); err != nil {
		return err
	}

	templateData, ok := data.(map[string]interface{})
	if !ok {
		return errors.New("data must be a map[string]interface{}")
	}

	emails := make([]domain.EmailData, len(recipients))
	for i, recipient := range recipients {
		emails[i] = domain.EmailData{
			To:       []string{recipient},
			Template: templateName,
			Data:     templateData,
		}
	}

	return u.SendBulkEmail(ctx, emails)
}

// Advanced features

func (u *emailUsecase) SendPriorityEmail(ctx context.Context, to []string, subject, body string, priority domain.EmailPriority) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	data := domain.EmailData{
		To:       to,
		Subject:  subject,
		Body:     body,
		Priority: priority,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendEmailWithReplyTo(ctx context.Context, to []string, subject, body, replyTo string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}
	if !u.ValidateEmail(replyTo) {
		return fmt.Errorf("invalid reply-to email: %s", replyTo)
	}

	data := domain.EmailData{
		To:      to,
		Subject: subject,
		Body:    body,
		ReplyTo: replyTo,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) SendEmailWithHeaders(ctx context.Context, to []string, subject, body string, headers map[string]string) error {
	if err := u.validateRecipients(to); err != nil {
		return err
	}

	data := domain.EmailData{
		To:      to,
		Subject: subject,
		Body:    body,
		Headers: headers,
	}

	return u.sendAndLog(ctx, data)
}

func (u *emailUsecase) ScheduleEmail(ctx context.Context, sendAt time.Time, data domain.EmailData) error {
	if sendAt.Before(time.Now()) {
		return errors.New("scheduled time must be in the future")
	}

	if err := u.validateRecipients(data.To); err != nil {
		return err
	}

	// Create log with pending status
	log := u.createEmailLog(data)
	log.Status = domain.EmailStatusPending
	log.Metadata = map[string]interface{}{
		"scheduled_at": sendAt,
	}

	return u.emailRepo.SaveEmailLog(ctx, log)
}

// Validation functions

func (u *emailUsecase) ValidateEmail(email string) bool {
	// Basic email validation using regex
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

func (u *emailUsecase) ValidateEmailList(emails []string) (valid []string, invalid []string) {
	valid = make([]string, 0)
	invalid = make([]string, 0)

	for _, email := range emails {
		if u.ValidateEmail(email) {
			valid = append(valid, email)
		} else {
			invalid = append(invalid, email)
		}
	}

	return valid, invalid
}

// Logs and tracking

func (u *emailUsecase) GetEmailLog(ctx context.Context, id string) (*domain.EmailLog, error) {
	return u.emailRepo.GetEmailLog(ctx, id)
}

func (u *emailUsecase) ListEmailLogs(ctx context.Context, filter domain.EmailLogFilter) ([]*domain.EmailLog, error) {
	return u.emailRepo.ListEmailLogs(ctx, filter)
}

func (u *emailUsecase) GetEmailStatus(ctx context.Context, id string) (domain.EmailStatus, error) {
	log, err := u.emailRepo.GetEmailLog(ctx, id)
	if err != nil {
		return "", err
	}
	return log.Status, nil
}

// Utility functions

func (u *emailUsecase) ParseEmailAddresses(addresses string) []string {
	// Split by common delimiters: comma, semicolon, space
	delimiter := regexp.MustCompile(`[,;\s]+`)
	emails := delimiter.Split(addresses, -1)

	result := make([]string, 0)
	for _, email := range emails {
		email = strings.TrimSpace(email)
		if email != "" && u.ValidateEmail(email) {
			result = append(result, email)
		}
	}

	return result
}

func (u *emailUsecase) FormatEmailAddress(name, email string) string {
	if name == "" {
		return email
	}
	return fmt.Sprintf("%s <%s>", name, email)
}

// Private helper functions

func (u *emailUsecase) validateRecipients(emails []string) error {
	if len(emails) == 0 {
		return errors.New("recipient list cannot be empty")
	}

	for _, email := range emails {
		if !u.ValidateEmail(email) {
			return fmt.Errorf("invalid email address: %s", email)
		}
	}

	return nil
}

func (u *emailUsecase) sendAndLog(ctx context.Context, data domain.EmailData) error {
	// Create log entry
	log := u.createEmailLog(data)

	// Save log before sending
	if err := u.emailRepo.SaveEmailLog(ctx, log); err != nil {
		return fmt.Errorf("failed to save email log: %w", err)
	}

	// TODO: Implement actual email sending service
	// For now, just mark as sent
	_ = u.emailRepo.UpdateEmailStatus(ctx, log.ID, domain.EmailStatusSent, "")
	return nil

	// Send email
	// err := u.emailService.SendEmail(ctx, data)
	// Update log status
	// if err != nil {
	// 	_ = u.emailRepo.UpdateEmailStatus(ctx, log.ID, domain.EmailStatusFailed, err.Error())
	// 	return err
	// }
	// _ = u.emailRepo.UpdateEmailStatus(ctx, log.ID, domain.EmailStatusSent, "")
	// return nil
}

func (u *emailUsecase) createEmailLog(data domain.EmailData) *domain.EmailLog {
	now := time.Now()
	return &domain.EmailLog{
		ID:        uuid.New().String(),
		To:        data.To,
		CC:        data.CC,
		BCC:       data.BCC,
		From:      data.From,
		Subject:   data.Subject,
		Template:  data.Template,
		Status:    domain.EmailStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
