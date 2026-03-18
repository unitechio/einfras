// Package agent defines the core domain types for the agent-based architecture.
// All server operations go through the agent layer — no direct SSH/sockets.
package agent

import "time"

// CommandStatus represents the lifecycle state of a dispatched command.
type CommandStatus string

const (
	StatusPending   CommandStatus = "PENDING"
	StatusRunning   CommandStatus = "RUNNING"
	StatusSuccess   CommandStatus = "SUCCESS"
	StatusFailed    CommandStatus = "FAILED"
	StatusCancelled CommandStatus = "CANCELLED"
	StatusTimeout   CommandStatus = "TIMEOUT"
)

// Command represents a command sent from the control plane to an agent.
type Command struct {
	ID              string        `gorm:"primarykey"              json:"id"`
	ServerID        string        `gorm:"index"                   json:"server_id"`
	UserID          string        `gorm:"index"                   json:"user_id"`
	IdempotencyKey  string        `gorm:"uniqueIndex" json:"idempotency_key,omitempty"`
	Cmd             string        `json:"cmd"`
	Status          CommandStatus `gorm:"index"                   json:"status"`
	ExitCode        *int          `json:"exit_code,omitempty"`
	Output          string        `json:"output"` // accumulated full output (truncated for large outputs)
	TimeoutSec      int           `json:"timeout_sec"`
	CreatedAt       time.Time     `json:"created_at"`
	StartedAt       *time.Time    `json:"started_at,omitempty"`
	DoneAt          *time.Time    `json:"done_at,omitempty"`
}

// CommandLog represents a single streamed chunk of output from a running command.
type CommandLog struct {
	ID        uint      `gorm:"primarykey;autoIncrement" json:"id"`
	CommandID string    `gorm:"index"                    json:"command_id"`
	Seq       int       `json:"seq"` // sequential chunk number (for ordering)
	Chunk     string    `json:"chunk"`
	Ts        time.Time `json:"ts"`
}

// AgentInfo represents the known state of an agent registered to a server.
type AgentInfo struct {
	ServerID    string    `gorm:"primarykey" json:"server_id"`
	Version     string    `json:"version"`
	Online      bool      `json:"online"`
	LastSeen    time.Time `json:"last_seen"`
	CPUPercent  float64   `json:"cpu_percent"`
	MemPercent  float64   `json:"mem_percent"`
	DiskPercent float64   `json:"disk_percent"`
	HasDocker   bool      `json:"has_docker"`
	HasK8s      bool      `json:"has_k8s"`
	OS          string    `json:"os"`
	Arch        string    `json:"arch"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AgentToken is a short-lived (or long-lived) credential issued to an agent.
type AgentToken struct {
	ID       string    `gorm:"primarykey" json:"id"`
	ServerID string    `gorm:"uniqueIndex" json:"server_id"`
	Token    string    `json:"token"` // hashed in DB
	IssuedAt time.Time `json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// CPMessage is the envelope sent from the Control Plane to the Agent.
type CPMessage struct {
	Type      string      `json:"type"`       // EXEC_COMMAND | PING | CONFIG_UPDATE | CANCEL_COMMAND
	MessageID string      `json:"message_id"` // UUID for correlation
	Payload   interface{} `json:"payload"`
}

// AgentMessage is the envelope sent from the Agent to the Control Plane.
type AgentMessage struct {
	Type      string      `json:"type"`      // COMMAND_OUTPUT | COMMAND_DONE | COMMAND_ERROR | HEARTBEAT | METRICS
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
	CommandID   string `json:"command_id"`
	ExitCode    int    `json:"exit_code"`
	DurationMs  int64  `json:"duration_ms"`
}

// CommandErrorPayload is the payload sent when the command fails.
type CommandErrorPayload struct {
	CommandID string `json:"command_id"`
	Error     string `json:"error"`
	ExitCode  int    `json:"exit_code"`
}

// HeartbeatPayload is the metrics payload sent periodically by the agent.
type HeartbeatPayload struct {
	CPUPercent  float64 `json:"cpu_percent"`
	MemPercent  float64 `json:"mem_percent"`
	DiskPercent float64 `json:"disk_percent"`
	OS          string  `json:"os"`
	Arch        string  `json:"arch"`
	HasDocker   bool    `json:"has_docker"`
	HasK8s      bool    `json:"has_k8s"`
	AgentVersion string `json:"agent_version"`
}
