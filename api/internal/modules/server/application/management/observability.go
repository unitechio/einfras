package managementapp

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	domain "einfra/api/internal/modules/server/domain"
)

type metricWriter interface {
	Create(ctx context.Context, sample *domain.ServerMetricSample) error
	ListMetricsByServerID(ctx context.Context, serverID string, limit int) ([]*domain.ServerMetricSample, error)
}

type auditWriter interface {
	CreateAudit(ctx context.Context, entry *domain.ServerAuditLog) error
	ListAudit(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.ServerAuditLog, error)
}

type ObservabilityManager struct {
	servers domain.ServerRepository
	metrics metricWriter
	audits  auditWriter
}

func NewObservabilityManager(servers domain.ServerRepository, metrics metricWriter, audits auditWriter) *ObservabilityManager {
	return &ObservabilityManager{servers: servers, metrics: metrics, audits: audits}
}

func (m *ObservabilityManager) RecordHeartbeat(serverID string, payload map[string]any) error {
	ctx := context.Background()
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return err
	}
	sample := &domain.ServerMetricSample{
		ID:             uuid.NewString(),
		ServerID:       serverID,
		CPUUsage:       floatValue(payload["cpu_percent"]),
		MemoryUsage:    floatValue(payload["mem_percent"]),
		DiskUsage:      floatValue(payload["disk_percent"]),
		DiskReadBytes:  int64Value(payload["disk_read_bytes"]),
		DiskWriteBytes: int64Value(payload["disk_write_bytes"]),
		NetworkRxBytes: int64Value(payload["network_rx_bytes"]),
		NetworkTxBytes: int64Value(payload["network_tx_bytes"]),
		RecordedAt:     time.Now().UTC(),
	}
	return m.metrics.Create(ctx, sample)
}

func (m *ObservabilityManager) MetricsHistory(ctx context.Context, serverID string, limit int) ([]*domain.ServerMetricSample, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.metrics.ListMetricsByServerID(ctx, serverID, limit)
}

func (m *ObservabilityManager) AuditHistory(ctx context.Context, filter domain.AuditLogFilter) ([]*domain.ServerAuditLog, error) {
	if _, err := m.servers.GetByID(ctx, filter.ServerID); err != nil {
		return nil, err
	}
	return m.audits.ListAudit(ctx, filter)
}

func (m *ObservabilityManager) Audit(ctx context.Context, entry *domain.ServerAuditLog) error {
	if entry.ID == "" {
		entry.ID = uuid.NewString()
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = time.Now().UTC()
	}
	return m.audits.CreateAudit(ctx, entry)
}

func floatValue(value any) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0
	}
}

func int64Value(value any) int64 {
	switch v := value.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case string:
		i, _ := strconv.ParseInt(v, 10, 64)
		return i
	default:
		return 0
	}
}
