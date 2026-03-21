package domain

import (
	"context"
	"time"
)

type AuditLogFilter struct {
	ServerID       string
	TenantID       string
	Action         string
	PolicyDecision string
	Limit          int
}

type ServerDisk struct {
	ID          string    `json:"id" gorm:"column:id;primaryKey"`
	ServerID    string    `json:"server_id" gorm:"column:server_id;index"`
	Name        string    `json:"name" gorm:"column:name"`
	Device      string    `json:"device" gorm:"column:device"`
	Type        string    `json:"type" gorm:"column:type"`
	FileSystem  string    `json:"filesystem" gorm:"column:filesystem"`
	MountPoint  string    `json:"mount_point" gorm:"column:mount_point"`
	TotalBytes  int64     `json:"total_bytes" gorm:"column:total_bytes"`
	UsedBytes   int64     `json:"used_bytes" gorm:"column:used_bytes"`
	FreeBytes   int64     `json:"free_bytes" gorm:"column:free_bytes"`
	ReadBytes   int64     `json:"read_bytes" gorm:"column:read_bytes"`
	WriteBytes  int64     `json:"write_bytes" gorm:"column:write_bytes"`
	IsRemovable bool      `json:"is_removable" gorm:"column:is_removable"`
	State       string    `json:"state" gorm:"column:state"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"column:updated_at"`
}

func (ServerDisk) TableName() string { return "server_disks" }

type ServerMetricSample struct {
	ID             string    `json:"id" gorm:"column:id;primaryKey"`
	ServerID       string    `json:"server_id" gorm:"column:server_id;index"`
	CPUUsage       float64   `json:"cpu_usage" gorm:"column:cpu_usage"`
	MemoryUsage    float64   `json:"memory_usage" gorm:"column:memory_usage"`
	DiskUsage      float64   `json:"disk_usage" gorm:"column:disk_usage"`
	DiskReadBytes  int64     `json:"disk_read_bytes" gorm:"column:disk_read_bytes"`
	DiskWriteBytes int64     `json:"disk_write_bytes" gorm:"column:disk_write_bytes"`
	NetworkRxBytes int64     `json:"network_rx_bytes" gorm:"column:network_rx_bytes"`
	NetworkTxBytes int64     `json:"network_tx_bytes" gorm:"column:network_tx_bytes"`
	RecordedAt     time.Time `json:"recorded_at" gorm:"column:recorded_at;index"`
}

func (ServerMetricSample) TableName() string { return "server_metric_samples" }

type ServerAuditLog struct {
	ID                  string    `json:"id" gorm:"column:id;primaryKey"`
	ServerID            string    `json:"server_id" gorm:"column:server_id;index"`
	TenantID            string    `json:"tenant_id" gorm:"column:tenant_id;index"`
	ServerGroups        []string  `json:"server_groups" gorm:"serializer:json;column:server_groups"`
	ActorID             string    `json:"actor_id" gorm:"column:actor_id"`
	ActorRole           string    `json:"actor_role" gorm:"column:actor_role"`
	Action              string    `json:"action" gorm:"column:action"`
	ResourceType        string    `json:"resource_type" gorm:"column:resource_type"`
	ResourceID          string    `json:"resource_id" gorm:"column:resource_id"`
	Status              string    `json:"status" gorm:"column:status"`
	PolicyDecision      string    `json:"policy_decision" gorm:"column:policy_decision"`
	PolicyReason        string    `json:"policy_reason" gorm:"column:policy_reason"`
	RequiredCapability  string    `json:"required_capability" gorm:"column:required_capability"`
	OperationParamsJSON string    `json:"operation_params_json" gorm:"column:operation_params_json"`
	Details             string    `json:"details" gorm:"column:details"`
	CreatedAt           time.Time `json:"created_at" gorm:"column:created_at;index"`
}

func (ServerAuditLog) TableName() string { return "server_audit_logs" }

func (ServerCronjob) TableName() string { return "server_cronjobs" }

func (CronjobExecution) TableName() string { return "cronjob_executions" }

type ServerDiskRepository interface {
	ReplaceByServerID(ctx context.Context, serverID string, disks []*ServerDisk) error
	ListByServerID(ctx context.Context, serverID string) ([]*ServerDisk, error)
}

type ServerMetricRepository interface {
	Create(ctx context.Context, sample *ServerMetricSample) error
	ListMetricsByServerID(ctx context.Context, serverID string, limit int) ([]*ServerMetricSample, error)
}

type ServerAuditRepository interface {
	Create(ctx context.Context, entry *ServerAuditLog) error
	ListAudit(ctx context.Context, filter AuditLogFilter) ([]*ServerAuditLog, error)
}
