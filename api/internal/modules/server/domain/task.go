package domain

import (
	"time"

	"github.com/google/uuid"
)

type TaskType string

const (
	TaskTypePing       TaskType = "PING"
	TaskTypeInstall    TaskType = "INSTALL"
	TaskTypeDeploy     TaskType = "DEPLOY"
	TaskTypePullImage  TaskType = "PULL_IMAGE"
	TaskTypeServiceAction TaskType = "SERVICE_ACTION"
	TaskTypeListServices  TaskType = "LIST_SERVICES"
)

type TaskStatus string

const (
	TaskStatusPending TaskStatus = "PENDING"
	TaskStatusRunning TaskStatus = "RUNNING"
	TaskStatusDone    TaskStatus = "DONE"
	TaskStatusFailed  TaskStatus = "FAILED"
)

// AgentTask defines the job payload sent out to distributed node agents.
type AgentTask struct {
	ID        uuid.UUID  `json:"id"`
	ServerID  uuid.UUID  `json:"server_id"`
	TenantID  uuid.UUID  `json:"tenant_id"`
	Type      TaskType   `json:"type"`
	Payload   string     `json:"payload"`
	Status    TaskStatus `json:"status"`
	IssueTime time.Time  `json:"issue_time"`
	Result    string     `json:"result"`
}

func NewAgentTask(serverID, tenantID uuid.UUID, taskType TaskType, payload string) *AgentTask {
	return &AgentTask{
		ID:        uuid.New(),
		ServerID:  serverID,
		TenantID:  tenantID,
		Type:      taskType,
		Payload:   payload,
		Status:    TaskStatusPending,
		IssueTime: time.Now(),
	}
}

func (t *AgentTask) MarkRunning() {
	if t.Status == TaskStatusPending {
		t.Status = TaskStatusRunning
	}
}

func (t *AgentTask) CompleteTask(result string) {
	t.Status = TaskStatusDone
	t.Result = result
}

func (t *AgentTask) FailTask(reason string) {
	t.Status = TaskStatusFailed
	t.Result = reason
}
