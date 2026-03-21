package managementapp

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type FirewallManager struct {
	servers    domain.ServerRepository
	rules      domain.ServerIPTableRepository
	dispatcher AgentCommandDispatcher
}

func NewFirewallManager(servers domain.ServerRepository, rules domain.ServerIPTableRepository, dispatcher AgentCommandDispatcher) *FirewallManager {
	return &FirewallManager{servers: servers, rules: rules, dispatcher: dispatcher}
}

func (m *FirewallManager) ListRules(ctx context.Context, serverID string) ([]*domain.ServerIPTable, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	return m.rules.GetByServerID(ctx, serverID)
}

func (m *FirewallManager) CreateRule(ctx context.Context, rule *domain.ServerIPTable) error {
	if _, err := m.servers.GetByID(ctx, rule.ServerID); err != nil {
		return err
	}
	if rule.ID == "" {
		rule.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	return m.rules.Create(ctx, rule)
}

func (m *FirewallManager) UpdateRule(ctx context.Context, rule *domain.ServerIPTable) error {
	existing, err := m.rules.GetByID(ctx, rule.ID)
	if err != nil {
		return err
	}
	rule.ServerID = existing.ServerID
	rule.CreatedAt = existing.CreatedAt
	rule.UpdatedAt = time.Now().UTC()
	return m.rules.Update(ctx, rule)
}

func (m *FirewallManager) DeleteRule(ctx context.Context, id string) error {
	return m.rules.Delete(ctx, id)
}

func (m *FirewallManager) Apply(ctx context.Context, serverID, userID string) (*agent.Command, error) {
	if _, err := m.servers.GetByID(ctx, serverID); err != nil {
		return nil, err
	}
	rules, err := m.rules.GetByServerID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	commands := make([]string, 0, len(rules))
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		commands = append(commands, buildIPTablesCommand(rule))
	}
	if len(commands) == 0 {
		return nil, errors.New("no enabled firewall rules to apply")
	}
	return m.dispatcher.Dispatch(ctx, serverID, userID, strings.Join(commands, " && "), 120, "iptables-apply:"+serverID)
}

func (m *FirewallManager) Backup(ctx context.Context, serverID, name, description string) (*domain.IPTableBackup, error) {
	rules, err := m.rules.GetByServerID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	lines := make([]string, 0, len(rules))
	for _, rule := range rules {
		lines = append(lines, buildIPTablesCommand(rule))
	}
	backup := &domain.IPTableBackup{
		ID:          uuid.NewString(),
		ServerID:    serverID,
		Name:        name,
		Description: description,
		Content:     strings.Join(lines, "\n"),
		RuleCount:   len(rules),
		CreatedAt:   time.Now().UTC(),
	}
	if err := m.rules.CreateBackup(ctx, backup); err != nil {
		return nil, err
	}
	return backup, nil
}

func (m *FirewallManager) Restore(ctx context.Context, backupID, userID string) (*agent.Command, error) {
	backup, err := m.rules.GetBackupByID(ctx, backupID)
	if err != nil {
		return nil, err
	}
	return m.dispatcher.Dispatch(ctx, backup.ServerID, userID, backup.Content, 120, "iptables-restore:"+backupID)
}

func (m *FirewallManager) GetBackups(ctx context.Context, serverID string, limit int) ([]*domain.IPTableBackup, error) {
	return m.rules.GetBackups(ctx, serverID, limit)
}

func buildIPTablesCommand(rule *domain.ServerIPTable) string {
	parts := []string{"sudo", "iptables", "-A", string(rule.Chain)}
	if rule.Protocol != "" && rule.Protocol != domain.IPTableProtocolAll {
		parts = append(parts, "-p", string(rule.Protocol))
	}
	if rule.SourceIP != "" {
		parts = append(parts, "-s", rule.SourceIP)
	}
	if rule.DestIP != "" {
		parts = append(parts, "-d", rule.DestIP)
	}
	if rule.SourcePort != "" {
		parts = append(parts, "--sport", rule.SourcePort)
	}
	if rule.DestPort != "" {
		parts = append(parts, "--dport", rule.DestPort)
	}
	if rule.Interface != "" {
		parts = append(parts, "-i", rule.Interface)
	}
	if rule.State != "" {
		parts = append(parts, "-m", "state", "--state", rule.State)
	}
	parts = append(parts, "-j", string(rule.Action))
	return strings.Join(parts, " ")
}
