package events

import "time"

const (
	SubjectCommandDispatched = "infra.command.dispatched"
	SubjectCommandDone       = "infra.command.done"
	SubjectCommandFailed     = "infra.command.failed"
	SubjectAgentOnline       = "infra.agent.online"
	SubjectAgentOffline      = "infra.agent.offline"
	SubjectAgentMetrics      = "infra.agent.metrics"
	SubjectServerCreated     = "infra.server.created"
	SubjectServerDeleted     = "infra.server.deleted"
	SubjectOrgCreated        = "infra.org.created"
	SubjectMemberInvited     = "infra.org.member.invited"
	SubjectAuditWrite        = "infra.audit.write"
	SubjectBillingUsage      = "infra.billing.usage"
)

type CommandDispatchedEvent struct {
	OrgID          string    `json:"org_id"`
	ServerID       string    `json:"server_id"`
	CommandID      string    `json:"command_id"`
	UserID         string    `json:"user_id"`
	Cmd            string    `json:"cmd"`
	IdempotencyKey string    `json:"idempotency_key"`
	DispatchedAt   time.Time `json:"dispatched_at"`
}

type CommandDoneEvent struct {
	OrgID      string    `json:"org_id"`
	ServerID   string    `json:"server_id"`
	CommandID  string    `json:"command_id"`
	UserID     string    `json:"user_id"`
	ExitCode   int       `json:"exit_code"`
	Status     string    `json:"status"`
	DurationMs int64     `json:"duration_ms"`
	DoneAt     time.Time `json:"done_at"`
}

type CommandFailedEvent struct {
	OrgID     string    `json:"org_id"`
	ServerID  string    `json:"server_id"`
	CommandID string    `json:"command_id"`
	Reason    string    `json:"reason"`
	FailedAt  time.Time `json:"failed_at"`
}

type AgentOnlineEvent struct {
	OrgID     string    `json:"org_id"`
	ServerID  string    `json:"server_id"`
	Transport string    `json:"transport"`
	OnlineAt  time.Time `json:"online_at"`
}

type AgentOfflineEvent struct {
	OrgID     string    `json:"org_id"`
	ServerID  string    `json:"server_id"`
	OfflineAt time.Time `json:"offline_at"`
}

type AgentMetricsEvent struct {
	OrgID       string    `json:"org_id"`
	ServerID    string    `json:"server_id"`
	CPUPercent  float32   `json:"cpu_percent"`
	MemPercent  float32   `json:"mem_percent"`
	DiskPercent float32   `json:"disk_percent"`
	RecordedAt  time.Time `json:"recorded_at"`
}

type ServerCreatedEvent struct {
	OrgID     string    `json:"org_id"`
	ServerID  string    `json:"server_id"`
	Name      string    `json:"name"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type OrgCreatedEvent struct {
	OrgID     string    `json:"org_id"`
	Name      string    `json:"name"`
	Plan      string    `json:"plan"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type BillingUsageEvent struct {
	OrgID      string    `json:"org_id"`
	ServerID   string    `json:"server_id"`
	Resource   string    `json:"resource"`
	Units      float64   `json:"units"`
	RecordedAt time.Time `json:"recorded_at"`
}
