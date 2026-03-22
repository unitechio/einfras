// Package agent defines the core domain types for the agent-based architecture.
// All server operations go through the agent layer — no direct SSH/sockets.
package agent

import (
	"encoding/json"
	"strings"
	"time"
)

type CommandType string

const (
	CommandTypeShell            CommandType = "shell"
	CommandTypeServiceAction    CommandType = "service_action"
	CommandTypeControlOperation CommandType = "control_operation"
)

// CommandStatus represents the lifecycle state of a dispatched command.
type CommandStatus string

const (
	StatusPending   CommandStatus = "PENDING"
	StatusRunning   CommandStatus = "RUNNING"
	StatusSuccess   CommandStatus = "SUCCESS"
	StatusFailed    CommandStatus = "FAILED"
	StatusCancelled CommandStatus = "CANCELLED"
	StatusTimeout   CommandStatus = "TIMEOUT"
	StatusError     CommandStatus = "ERROR"
)

// Command represents a command sent from the control plane to an agent.
type Command struct {
	ID             string        `gorm:"column:id;primaryKey" json:"id"`
	ServerID       string        `gorm:"column:server_id;index" json:"server_id"`
	UserID         string        `gorm:"column:user_id;index" json:"user_id"`
	IdempotencyKey string        `gorm:"column:idempotency_key;uniqueIndex" json:"idempotency_key,omitempty"`
	Type           CommandType   `gorm:"column:command_type" json:"command_type"`
	Cmd            string        `gorm:"column:cmd" json:"cmd"`
	PayloadJSON    string        `gorm:"column:payload_json" json:"payload_json,omitempty"`
	Status         CommandStatus `gorm:"column:status;index" json:"status"`
	ExitCode       *int          `json:"exit_code,omitempty"`
	Output         string        `json:"output"` // accumulated full output (truncated for large outputs)
	TimeoutSec     int           `json:"timeout_sec"`
	CreatedAt      time.Time     `json:"created_at"`
	StartedAt      *time.Time    `json:"started_at,omitempty"`
	DoneAt         *time.Time    `json:"done_at,omitempty"`
}

func (Command) TableName() string { return "agent_commands" }

// CommandLog represents a single streamed chunk of output from a running command.
type CommandLog struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	CommandID string    `gorm:"column:command_id;index" json:"command_id"`
	Seq       int       `json:"seq"` // sequential chunk number (for ordering)
	Chunk     string    `json:"chunk"`
	Ts        time.Time `json:"ts"`
}

func (CommandLog) TableName() string { return "agent_command_logs" }

// AgentInfo represents the known state of an agent registered to a server.
type AgentInfo struct {
	ServerID     string    `gorm:"column:server_id;primaryKey" json:"server_id"`
	Version      string    `json:"version"`
	Online       bool      `json:"online"`
	LastSeen     time.Time `json:"last_seen"`
	CPUPercent   float64   `json:"cpu_percent"`
	MemPercent   float64   `json:"mem_percent"`
	DiskPercent  float64   `json:"disk_percent"`
	HasDocker    bool      `json:"has_docker"`
	HasK8s       bool      `json:"has_k8s"`
	OS           string    `json:"os"`
	Arch         string    `json:"arch"`
	Capabilities []string  `gorm:"serializer:json;column:capabilities" json:"capabilities"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (AgentInfo) TableName() string { return "agent_infos" }

// AgentToken is a short-lived (or long-lived) credential issued to an agent.
type AgentToken struct {
	ID        string    `gorm:"column:id;primaryKey" json:"id"`
	ServerID  string    `gorm:"column:server_id;uniqueIndex" json:"server_id"`
	Token     string    `gorm:"column:token_hash" json:"token"` // hashed in DB
	IssuedAt  time.Time `gorm:"column:issued_at" json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (AgentToken) TableName() string { return "agent_tokens" }

// CPMessage is the envelope sent from the Control Plane to the Agent.
type CPMessage struct {
	Type           string      `json:"type"`       // EXEC_COMMAND | SERVICE_ACTION | LIST_SERVICES | PING | CONFIG_UPDATE | CANCEL_COMMAND
	MessageID      string      `json:"message_id"` // UUID for correlation
	IdempotencyKey string      `json:"idempotency_key,omitempty"`
	Payload        interface{} `json:"payload"`
}

type ControlOperation struct {
	CommandID string `json:"command_id"`
	Operation string `json:"operation"`
}

type ControlOperationPayload struct {
	CommandID          string         `json:"command_id"`
	Operation          string         `json:"operation"`
	TimeoutS           int            `json:"timeout_s"`
	Params             map[string]any `json:"params"`
	TenantID           string         `json:"tenant_id,omitempty"`
	ServerGroups       []string       `json:"server_groups,omitempty"`
	RequiredCapability string         `json:"required_capability,omitempty"`
	ActorRole          string         `json:"actor_role,omitempty"`
}

const TypedControlSchemaVersion = "typed-control/v1"

type TypedControlResult struct {
	SchemaVersion string         `json:"schema_version"`
	Operation     string         `json:"operation"`
	Status        string         `json:"status"`
	Summary       string         `json:"summary"`
	Data          any            `json:"data,omitempty"`
	Preview       string         `json:"preview,omitempty"`
	Redactions    []string       `json:"redactions,omitempty"`
	Truncated     bool           `json:"truncated,omitempty"`
	Meta          map[string]any `json:"meta,omitempty"`
}

func (r *TypedControlResult) Normalize() {
	if r.SchemaVersion == "" {
		r.SchemaVersion = TypedControlSchemaVersion
	}
	if r.Status == "" {
		r.Status = "success"
	}
}

func MarshalTypedControlResult(result TypedControlResult) (string, error) {
	result.Normalize()
	raw, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func ParseTypedControlResult(output string) (*TypedControlResult, string) {
	output = strings.TrimSpace(output)
	if output == "" {
		return nil, ""
	}
	var result TypedControlResult
	if err := json.Unmarshal([]byte(output), &result); err == nil && result.SchemaVersion != "" {
		result.Normalize()
		return &result, ""
	}
	return nil, output
}

// AgentMessage is the envelope sent from the Agent to the Control Plane.
type AgentMessage struct {
	Type      string      `json:"type"`       // COMMAND_OUTPUT | COMMAND_DONE | COMMAND_ERROR | HEARTBEAT | METRICS
	MessageID string      `json:"message_id"` // correlates to CPMessage.MessageID
	ServerID  string      `json:"server_id"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"ts"` // Unix ms
}

// ExecCommandPayload is the payload sent to the agent to run a command.
type ExecCommandPayload struct {
	CommandID string `json:"command_id"`
	Cmd       string `json:"cmd"`
	TimeoutS  int    `json:"timeout_s"`
}

// CommandOutputPayload is the payload sent from the agent for each streamed chunk.
type CommandOutputPayload struct {
	CommandID string `json:"command_id"`
	Chunk     string `json:"chunk"`
	Seq       int    `json:"seq"`
}

// CommandDonePayload is the payload sent when the command completes successfully.
type CommandDonePayload struct {
	CommandID  string `json:"command_id"`
	ExitCode   int    `json:"exit_code"`
	DurationMs int64  `json:"duration_ms"`
}

// CommandErrorPayload is the payload sent when the command fails.
type CommandErrorPayload struct {
	CommandID string `json:"command_id"`
	Error     string `json:"error"`
	ExitCode  int    `json:"exit_code"`
}

// HeartbeatPayload is the metrics payload sent periodically by the agent.
type HeartbeatPayload struct {
	CPUPercent   float64 `json:"cpu_percent"`
	MemPercent   float64 `json:"mem_percent"`
	DiskPercent  float64 `json:"disk_percent"`
	OS           string  `json:"os"`
	Arch         string  `json:"arch"`
	HasDocker    bool    `json:"has_docker"`
	HasK8s       bool    `json:"has_k8s"`
	AgentVersion string  `json:"agent_version"`
}

// ServiceActionPayload is the payload to perform an action on a service.
type ServiceActionPayload struct {
	ServiceName string `json:"service_name"`
	Action      string `json:"action"` // start | stop | restart | reload | enable | disable
}

// ServiceListPayload is the response to LIST_SERVICES.
type ServiceListPayload struct {
	Services []ServiceEntry `json:"services"`
}

type ServiceEntry struct {
	Name        string `json:"name"`
	Status      string `json:"status"` // active | inactive | failed
	LoadState   string `json:"load_state"`
	SubState    string `json:"sub_state"`
	Description string `json:"description"`
}
