package agentrepo

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	agentregistry "einfra/api/internal/modules/agent/application"
	agent "einfra/api/internal/modules/agent/domain"
)

type MemoryCommandRepository struct {
	mu       sync.RWMutex
	commands map[string]*agent.Command
	logs     map[string][]*agent.CommandLog
}

func NewMemoryCommandRepository() *MemoryCommandRepository {
	return &MemoryCommandRepository{
		commands: make(map[string]*agent.Command),
		logs:     make(map[string][]*agent.CommandLog),
	}
}

func (r *MemoryCommandRepository) Create(_ context.Context, cmd *agent.Command) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copyCmd := *cmd
	r.commands[cmd.ID] = &copyCmd
	return nil
}

func (r *MemoryCommandRepository) UpdateStatus(_ context.Context, id string, status agent.CommandStatus, exitCode *int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cmd, ok := r.commands[id]
	if !ok {
		return fmt.Errorf("command %q not found", id)
	}
	cmd.Status = status
	if exitCode != nil {
		value := *exitCode
		cmd.ExitCode = &value
		now := time.Now().UTC()
		cmd.DoneAt = &now
	}
	return nil
}

func (r *MemoryCommandRepository) AppendLog(_ context.Context, logItem *agent.CommandLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copyLog := *logItem
	r.logs[logItem.CommandID] = append(r.logs[logItem.CommandID], &copyLog)
	if cmd, ok := r.commands[logItem.CommandID]; ok {
		if cmd.Output != "" {
			cmd.Output += "\n"
		}
		cmd.Output += logItem.Chunk
	}
	return nil
}

func (r *MemoryCommandRepository) FindByID(_ context.Context, id string) (*agent.Command, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cmd, ok := r.commands[id]
	if !ok {
		return nil, fmt.Errorf("command %q not found", id)
	}
	copyCmd := *cmd
	return &copyCmd, nil
}

func (r *MemoryCommandRepository) ListByServer(_ context.Context, serverID string, limit int) ([]*agent.Command, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := make([]*agent.Command, 0)
	for _, cmd := range r.commands {
		if cmd.ServerID == serverID {
			copyCmd := *cmd
			items = append(items, &copyCmd)
		}
	}
	slices.SortFunc(items, func(a, b *agent.Command) int {
		return b.CreatedAt.Compare(a.CreatedAt)
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func (r *MemoryCommandRepository) GetLogs(_ context.Context, commandID string) ([]*agent.CommandLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := r.logs[commandID]
	result := make([]*agent.CommandLog, 0, len(items))
	for _, item := range items {
		copyLog := *item
		result = append(result, &copyLog)
	}
	return result, nil
}

type MemoryAgentInfoRepository struct {
	mu    sync.RWMutex
	infos map[string]*agent.AgentInfo
}

func NewMemoryAgentInfoRepository() *MemoryAgentInfoRepository {
	return &MemoryAgentInfoRepository{
		infos: make(map[string]*agent.AgentInfo),
	}
}

func (r *MemoryAgentInfoRepository) Upsert(serverID string, info *agent.AgentInfo) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copyInfo := *info
	copyInfo.ServerID = serverID
	copyInfo.UpdatedAt = time.Now().UTC()
	r.infos[serverID] = &copyInfo
	return nil
}

func (r *MemoryAgentInfoRepository) SetOnline(serverID string, online bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	info, ok := r.infos[serverID]
	if !ok {
		info = &agent.AgentInfo{ServerID: serverID}
		r.infos[serverID] = info
	}
	now := time.Now().UTC()
	info.Online = online
	info.LastSeen = now
	info.UpdatedAt = now
	return nil
}

func (r *MemoryAgentInfoRepository) GetByServerID(serverID string) (*agent.AgentInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	info, ok := r.infos[serverID]
	if !ok {
		return nil, fmt.Errorf("agent info for server %q not found", serverID)
	}
	copyInfo := *info
	return &copyInfo, nil
}

type MemoryTokenRepository struct {
	mu     sync.RWMutex
	tokens map[string]*agent.AgentToken
}

func NewMemoryTokenRepository() *MemoryTokenRepository {
	return &MemoryTokenRepository{
		tokens: make(map[string]*agent.AgentToken),
	}
}

func (r *MemoryTokenRepository) Save(_ context.Context, tok *agent.AgentToken) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copyTok := *tok
	r.tokens[tok.ServerID] = &copyTok
	return nil
}

func (r *MemoryTokenRepository) FindByServerID(_ context.Context, serverID string) (*agent.AgentToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	tok, ok := r.tokens[serverID]
	if !ok {
		return nil, fmt.Errorf("agent token for server %q not found", serverID)
	}
	copyTok := *tok
	return &copyTok, nil
}

func (r *MemoryTokenRepository) Delete(_ context.Context, serverID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.tokens, serverID)
	return nil
}

var (
	_ agentregistry.CommandRepository    = (*MemoryCommandRepository)(nil)
	_ agentregistry.AgentTokenRepository = (*MemoryTokenRepository)(nil)
)
