//go:build legacy
// +build legacy

package repository

import (
	"context"
	"fmt"
	"time"

	"einfra/api/internal/domain"
	"gorm.io/gorm"
)

type EmailRepository interface {
	SaveEmailLog(ctx context.Context, log *domain.EmailLog) error
	GetEmailLog(ctx context.Context, id string) (*domain.EmailLog, error)
	ListEmailLogs(ctx context.Context, filter domain.EmailLogFilter) ([]*domain.EmailLog, error)
	UpdateEmailStatus(ctx context.Context, id string, status domain.EmailStatus, errorMsg string) error
}
type emailRepository struct {
	db *gorm.DB
}

func NewEmailRepository(db *gorm.DB) EmailRepository {
	return &emailRepository{db: db}
}

func (r *emailRepository) SaveEmailLog(ctx context.Context, log *domain.EmailLog) error {
	emailLog := &domain.EmailLog{
		ID:       log.ID,
		To:       log.To,
		CC:       log.CC,
		BCC:      log.BCC,
		From:     log.From,
		Subject:  log.Subject,
		Template: log.Template,
		// Status:    string(log.Status),
		Error: log.Error,
		// Metadata:  domain.JSONB(log.Metadata),
		SentAt:    log.SentAt,
		CreatedAt: log.CreatedAt,
		UpdatedAt: log.UpdatedAt,
	}

	result := r.db.WithContext(ctx).Create(emailLog)
	if result.Error != nil {
		return fmt.Errorf("failed to save email log: %w", result.Error)
	}

	return nil
}

// GetEmailLog retrieves an email log by ID
func (r *emailRepository) GetEmailLog(ctx context.Context, id string) (*domain.EmailLog, error) {
	var emailLog domain.EmailLog

	result := r.db.WithContext(ctx).First(&emailLog, "id = ?", id)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("email log not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get email log: %w", result.Error)
	}

	return r.toDomainEmailLog(&emailLog), nil
}

// ListEmailLogs retrieves email logs with filters
func (r *emailRepository) ListEmailLogs(ctx context.Context, filter domain.EmailLogFilter) ([]*domain.EmailLog, error) {
	var emailLogs []domain.EmailLog

	query := r.db.WithContext(ctx).Model(&domain.EmailLog{})

	// Apply filters
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.From != "" {
		query = query.Where("from_address = ?", filter.From)
	}

	if filter.To != "" {
		// Search in JSONB array
		query = query.Where("to_addresses @> ?", fmt.Sprintf(`["%s"]`, filter.To))
	}

	if filter.Template != "" {
		query = query.Where("template = ?", filter.Template)
	}

	if filter.DateFrom != nil {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}

	if filter.DateTo != nil {
		query = query.Where("created_at <= ?", filter.DateTo)
	}

	// Order by created_at descending
	query = query.Order("created_at DESC")

	// Apply pagination
	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}

	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	result := query.Find(&emailLogs)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to list email logs: %w", result.Error)
	}

	// Convert to domain domain
	logs := make([]*domain.EmailLog, len(emailLogs))
	for i, log := range emailLogs {
		logs[i] = r.toDomainEmailLog(&log)
	}

	return logs, nil
}

// UpdateEmailStatus updates the status of an email log
func (r *emailRepository) UpdateEmailStatus(ctx context.Context, id string, status domain.EmailStatus, errorMsg string) error {
	updates := map[string]interface{}{
		"status":     status,
		"error":      errorMsg,
		"updated_at": time.Now(),
	}

	// If status is sent or delivered, update sent_at
	if status == domain.EmailStatusSent || status == domain.EmailStatusDelivered {
		updates["sent_at"] = time.Now()
	}

	result := r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("id = ?", id).
		Updates(updates)

	if result.Error != nil {
		return fmt.Errorf("failed to update email status: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("email log not found: %s", id)
	}

	return nil
}

// GetEmailLogsByStatus retrieves email logs by status
func (r *emailRepository) GetEmailLogsByStatus(ctx context.Context, status domain.EmailStatus, limit int) ([]*domain.EmailLog, error) {
	filter := domain.EmailLogFilter{
		Status: status,
		Limit:  limit,
	}
	return r.ListEmailLogs(ctx, filter)
}

// GetEmailLogsByRecipient retrieves email logs by recipient
func (r *emailRepository) GetEmailLogsByRecipient(ctx context.Context, recipient string, limit int) ([]*domain.EmailLog, error) {
	filter := domain.EmailLogFilter{
		To:    recipient,
		Limit: limit,
	}
	return r.ListEmailLogs(ctx, filter)
}

// GetEmailLogsByTemplate retrieves email logs by template
func (r *emailRepository) GetEmailLogsByTemplate(ctx context.Context, templateName string, limit int) ([]*domain.EmailLog, error) {
	filter := domain.EmailLogFilter{
		Template: templateName,
		Limit:    limit,
	}
	return r.ListEmailLogs(ctx, filter)
}

// GetEmailLogsByDateRange retrieves email logs within date range
func (r *emailRepository) GetEmailLogsByDateRange(ctx context.Context, from, to time.Time, limit int) ([]*domain.EmailLog, error) {
	filter := domain.EmailLogFilter{
		DateFrom: &from,
		DateTo:   &to,
		Limit:    limit,
	}
	return r.ListEmailLogs(ctx, filter)
}

// CountEmailLogs counts email logs with filters
func (r *emailRepository) CountEmailLogs(ctx context.Context, filter domain.EmailLogFilter) (int64, error) {
	var count int64

	query := r.db.WithContext(ctx).Model(&domain.EmailLog{})

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.From != "" {
		query = query.Where("from_address = ?", filter.From)
	}

	if filter.Template != "" {
		query = query.Where("template = ?", filter.Template)
	}

	if filter.DateFrom != nil {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}

	if filter.DateTo != nil {
		query = query.Where("created_at <= ?", filter.DateTo)
	}

	result := query.Count(&count)
	if result.Error != nil {
		return 0, fmt.Errorf("failed to count email logs: %w", result.Error)
	}

	return count, nil
}

// DeleteOldEmailLogs deletes email logs older than duration
func (r *emailRepository) DeleteOldEmailLogs(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoffTime := time.Now().Add(-olderThan)

	result := r.db.WithContext(ctx).
		Where("created_at < ?", cutoffTime).
		Delete(&domain.EmailLog{})

	if result.Error != nil {
		return 0, fmt.Errorf("failed to delete old email logs: %w", result.Error)
	}

	return result.RowsAffected, nil
}

// GetEmailStats retrieves email statistics
func (r *emailRepository) GetEmailStats(ctx context.Context, from, to time.Time) (map[string]interface{}, error) {
	var stats struct {
		Total     int64
		Sent      int64
		Failed    int64
		Pending   int64
		Delivered int64
		Bounced   int64
	}

	// Get total count
	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ?", from, to).
		Count(&stats.Total)

	// Get counts by status
	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", from, to, domain.EmailStatusSent).
		Count(&stats.Sent)

	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", from, to, domain.EmailStatusFailed).
		Count(&stats.Failed)

	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", from, to, domain.EmailStatusPending).
		Count(&stats.Pending)

	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", from, to, domain.EmailStatusDelivered).
		Count(&stats.Delivered)

	r.db.WithContext(ctx).Model(&domain.EmailLog{}).
		Where("created_at BETWEEN ? AND ? AND status = ?", from, to, domain.EmailStatusBounced).
		Count(&stats.Bounced)

	result := map[string]interface{}{
		"total":     stats.Total,
		"sent":      stats.Sent,
		"failed":    stats.Failed,
		"pending":   stats.Pending,
		"delivered": stats.Delivered,
		"bounced":   stats.Bounced,
	}

	if stats.Total > 0 {
		successCount := stats.Sent + stats.Delivered
		failureCount := stats.Failed + stats.Bounced
		result["success_rate"] = float64(successCount) / float64(stats.Total) * 100
		result["failure_rate"] = float64(failureCount) / float64(stats.Total) * 100
	}

	return result, nil
}

// Helper method to convert model to domain
func (r *emailRepository) toDomainEmailLog(log *domain.EmailLog) *domain.EmailLog {
	var sentAt time.Time
	// if log.SentAt != nil {
	// 	sentAt = *log.SentAt
	// }

	return &domain.EmailLog{
		ID:        log.ID,
		To:        []string(log.To),
		CC:        []string(log.CC),
		BCC:       []string(log.BCC),
		From:      log.From,
		Subject:   log.Subject,
		Template:  log.Template,
		Status:    domain.EmailStatus(log.Status),
		Error:     log.Error,
		Metadata:  map[string]interface{}(log.Metadata),
		SentAt:    sentAt,
		CreatedAt: log.CreatedAt,
		UpdatedAt: log.UpdatedAt,
	}
}
