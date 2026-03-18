package email

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/jaytaylor/html2text"
	"einfra/api/internal/shared/platform/config"
	"einfra/api/internal/domain"
	"einfra/api/pkg/email"
	"gopkg.in/gomail.v2"
)

// SMTPService handles email sending via SMTP
type SMTPService struct {
	dialer           *gomail.Dialer
	from             string
	templateRenderer *email.TemplateRenderer
}

// NewSMTPService creates a new SMTP email service
func NewSMTPService(cfg *config.SmtpConfig) (*SMTPService, error) {
	d := gomail.NewDialer(cfg.Host, cfg.Port, cfg.UserName, cfg.Password)

	// Initialize template renderer
	renderer, err := email.NewTemplateRenderer(email.TemplateConfig{
		TemplateDir:  "./templates/email",
		CacheEnabled: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to initialize template renderer: %w", err)
	}

	return &SMTPService{
		dialer:           d,
		from:             cfg.FromEmail,
		templateRenderer: renderer,
	}, nil
}

// SendEmail sends a plain text email
func (s *SMTPService) SendEmail(ctx context.Context, to []string, subject, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	return s.dialer.DialAndSend(m)
}

// SendHTMLEmail sends an HTML email
func (s *SMTPService) SendHTMLEmail(ctx context.Context, to []string, subject, htmlBody string) error {
	// Generate plain text version
	plainText, err := html2text.FromString(htmlBody)
	if err != nil {
		plainText = htmlBody // Fallback to HTML if conversion fails
	}

	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", plainText)
	m.AddAlternative("text/html", htmlBody)

	return s.dialer.DialAndSend(m)
}

// SendEmailWithCC sends an email with CC recipients
func (s *SMTPService) SendEmailWithCC(ctx context.Context, to, cc []string, subject, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Cc", cc...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	return s.dialer.DialAndSend(m)
}

// SendEmailWithBCC sends an email with BCC recipients
func (s *SMTPService) SendEmailWithBCC(ctx context.Context, to, bcc []string, subject, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Bcc", bcc...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	return s.dialer.DialAndSend(m)
}

// SendEmailWithTemplate sends an email using a template
func (s *SMTPService) SendEmailWithTemplate(ctx context.Context, to []string, templateName string, data interface{}) error {
	templateData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("data must be a map[string]interface{}")
	}

	// Render template
	htmlBody, err := s.templateRenderer.Render(templateName, templateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	// Extract subject from data
	subject, _ := templateData["Subject"].(string)
	if subject == "" {
		subject = "Email from " + templateName
	}

	return s.SendHTMLEmail(ctx, to, subject, htmlBody)
}

// SendTemplateEmailWithCC sends a template email with CC
func (s *SMTPService) SendTemplateEmailWithCC(ctx context.Context, to, cc []string, templateName string, data interface{}) error {
	templateData, ok := data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("data must be a map[string]interface{}")
	}

	htmlBody, err := s.templateRenderer.Render(templateName, templateData)
	if err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}

	subject, _ := templateData["Subject"].(string)
	if subject == "" {
		subject = "Email from " + templateName
	}

	plainText, _ := html2text.FromString(htmlBody)

	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Cc", cc...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", plainText)
	m.AddAlternative("text/html", htmlBody)

	return s.dialer.DialAndSend(m)
}

// SendEmailWithAttachment sends an email with attachments
func (s *SMTPService) SendEmailWithAttachment(ctx context.Context, to []string, subject, body string, attachments []domain.EmailAttachment) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	// Add attachments
	for _, att := range attachments {
		if att.Inline {
			m.Embed(att.Filename)
		} else {
			m.Attach(att.Filename)
		}
	}

	return s.dialer.DialAndSend(m)
}

// SendEmailWithInlineImage sends an email with inline images
func (s *SMTPService) SendEmailWithInlineImage(ctx context.Context, to []string, subject, htmlBody string, images []domain.EmailAttachment) error {
	plainText, _ := html2text.FromString(htmlBody)

	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", plainText)
	m.AddAlternative("text/html", htmlBody)

	// Embed images
	for _, img := range images {
		m.Embed(img.Filename)
	}

	return s.dialer.DialAndSend(m)
}

// SendBulkEmail sends multiple emails
func (s *SMTPService) SendBulkEmail(ctx context.Context, emails []domain.EmailData) error {
	for _, emailData := range emails {
		if err := s.sendEmailData(ctx, emailData); err != nil {
			return fmt.Errorf("failed to send email to %v: %w", emailData.To, err)
		}
	}
	return nil
}

// SendBulkTemplateEmail sends bulk emails using a template
func (s *SMTPService) SendBulkTemplateEmail(ctx context.Context, recipients []string, templateName string, data interface{}) error {
	for _, recipient := range recipients {
		if err := s.SendEmailWithTemplate(ctx, []string{recipient}, templateName, data); err != nil {
			return fmt.Errorf("failed to send email to %s: %w", recipient, err)
		}
	}
	return nil
}

// SendPriorityEmail sends an email with priority
func (s *SMTPService) SendPriorityEmail(ctx context.Context, to []string, subject, body string, priority domain.EmailPriority) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	// Set priority header
	switch priority {
	case domain.PriorityHigh:
		m.SetHeader("X-Priority", "1")
		m.SetHeader("Importance", "high")
	case domain.PriorityLow:
		m.SetHeader("X-Priority", "5")
		m.SetHeader("Importance", "low")
	}

	return s.dialer.DialAndSend(m)
}

// SendEmailWithReplyTo sends an email with reply-to header
func (s *SMTPService) SendEmailWithReplyTo(ctx context.Context, to []string, subject, body, replyTo string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Reply-To", replyTo)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	return s.dialer.DialAndSend(m)
}

// SendEmailWithHeaders sends an email with custom headers
func (s *SMTPService) SendEmailWithHeaders(ctx context.Context, to []string, subject, body string, headers map[string]string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	// Add custom headers
	for key, value := range headers {
		m.SetHeader(key, value)
	}

	return s.dialer.DialAndSend(m)
}

// ScheduleEmail schedules an email for future sending (placeholder)
func (s *SMTPService) ScheduleEmail(ctx context.Context, sendAt time.Time, data domain.EmailData) error {
	// TODO: Implement scheduling logic with a job queue
	return fmt.Errorf("email scheduling not yet implemented")
}

// Helper method to send EmailData
func (s *SMTPService) sendEmailData(ctx context.Context, data domain.EmailData) error {
	m := gomail.NewMessage()

	// Set From (use default if empty)
	from := data.From
	if from == "" {
		from = s.from
	}
	m.SetHeader("From", from)

	// Set Recipients
	m.SetHeader("To", data.To...)
	if len(data.CC) > 0 {
		m.SetHeader("Cc", data.CC...)
	}
	if len(data.BCC) > 0 {
		m.SetHeader("Bcc", data.BCC...)
	}

	// Set Subject
	subject := data.Subject

	// Handle Template if present
	var htmlBody string
	var err error
	if data.Template != "" {
		htmlBody, err = s.templateRenderer.Render(data.Template, data.Data)
		if err != nil {
			return fmt.Errorf("failed to render template: %w", err)
		}

		// If subject is not set in EmailData, try to get it from template data
		if subject == "" && data.Data != nil {
			if s, ok := data.Data["Subject"].(string); ok {
				subject = s
			}
		}
	} else {
		htmlBody = data.HTMLBody
	}

	if subject == "" {
		subject = "No Subject"
	}
	m.SetHeader("Subject", subject)

	// Set Body
	if htmlBody != "" {
		plainText := data.Body
		if plainText == "" {
			plainText, _ = html2text.FromString(htmlBody)
		}
		m.SetBody("text/plain", plainText)
		m.AddAlternative("text/html", htmlBody)
	} else {
		m.SetBody("text/plain", data.Body)
	}

	// Set Reply-To
	if data.ReplyTo != "" {
		m.SetHeader("Reply-To", data.ReplyTo)
	}

	// Set Priority
	switch data.Priority {
	case domain.PriorityHigh:
		m.SetHeader("X-Priority", "1")
		m.SetHeader("Importance", "high")
	case domain.PriorityLow:
		m.SetHeader("X-Priority", "5")
		m.SetHeader("Importance", "low")
	}

	// Set Custom Headers
	for k, v := range data.Headers {
		m.SetHeader(k, v)
	}

	// Handle Attachments
	for _, att := range data.Attachments {
		settings := []gomail.FileSetting{}

		// If content is provided, use it instead of reading from disk
		if len(att.Content) > 0 {
			settings = append(settings, gomail.SetCopyFunc(func(w io.Writer) error {
				_, err := w.Write(att.Content)
				return err
			}))
		}

		if att.Inline {
			m.Embed(att.Filename, settings...)
		} else {
			m.Attach(att.Filename, settings...)
		}
	}

	return s.dialer.DialAndSend(m)
}
