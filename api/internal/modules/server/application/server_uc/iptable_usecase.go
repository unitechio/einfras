package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/ssh"
)

type serverIPTableUsecase struct {
	iptableRepo domain.ServerIPTableRepository
	serverRepo  domain.ServerRepository
}

// NewServerIPTableUsecase creates a new server iptables usecase instance
func NewServerIPTableUsecase(
	iptableRepo domain.ServerIPTableRepository,
	serverRepo domain.ServerRepository,
) domain.ServerIPTableUsecase {
	return &serverIPTableUsecase{
		iptableRepo: iptableRepo,
		serverRepo:  serverRepo,
	}
}

// ListRules retrieves all iptables rules for a server
func (u *serverIPTableUsecase) ListRules(ctx context.Context, serverID string) ([]*domain.ServerIPTable, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	// Verify server exists
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	return u.iptableRepo.GetByServerID(ctx, serverID)
}

// GetRule retrieves an iptables rule by ID
func (u *serverIPTableUsecase) GetRule(ctx context.Context, id string) (*domain.ServerIPTable, error) {
	if id == "" {
		return nil, errors.New("rule ID is required")
	}
	return u.iptableRepo.GetByID(ctx, id)
}

// AddRule adds a new iptables rule
func (u *serverIPTableUsecase) AddRule(ctx context.Context, rule *domain.ServerIPTable) error {
	// Verify server exists
	server, err := u.serverRepo.GetByID(ctx, rule.ServerID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Validate rule
	if rule.Chain == "" {
		return errors.New("chain is required")
	}
	if rule.Action == "" {
		return errors.New("action is required")
	}

	// Set defaults
	if rule.Protocol == "" {
		rule.Protocol = domain.IPTableProtocolAll
	}
	if rule.Enabled {
		rule.LastApplied = time.Now()
	}

	// Build raw rule if not provided
	if rule.RawRule == "" {
		rule.RawRule = u.buildIPTablesRule(rule)
	}

	// Create rule record
	if err := u.iptableRepo.Create(ctx, rule); err != nil {
		return fmt.Errorf("failed to create rule: %w", err)
	}

	// Apply rule if enabled
	if rule.Enabled {
		if err := u.applyRule(ctx, server, rule); err != nil {
			return fmt.Errorf("failed to apply rule: %w", err)
		}
	}

	return nil
}

// UpdateRule updates an existing iptables rule
func (u *serverIPTableUsecase) UpdateRule(ctx context.Context, rule *domain.ServerIPTable) error {
	if rule.ID == "" {
		return errors.New("rule ID is required")
	}

	// Verify rule exists
	existing, err := u.iptableRepo.GetByID(ctx, rule.ID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("rule not found")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, rule.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Rebuild raw rule if configuration changed
	if rule.RawRule == "" || u.ruleConfigChanged(existing, rule) {
		rule.RawRule = u.buildIPTablesRule(rule)
	}

	// Update rule record
	if err := u.iptableRepo.Update(ctx, rule); err != nil {
		return fmt.Errorf("failed to update rule: %w", err)
	}

	// Reapply rules if enabled
	if rule.Enabled {
		if err := u.ApplyRules(ctx, rule.ServerID); err != nil {
			return fmt.Errorf("failed to apply rules: %w", err)
		}
	}

	return nil
}

// DeleteRule deletes an iptables rule
func (u *serverIPTableUsecase) DeleteRule(ctx context.Context, id string) error {
	if id == "" {
		return errors.New("rule ID is required")
	}

	// Verify rule exists
	rule, err := u.iptableRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if rule == nil {
		return errors.New("rule not found")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, rule.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Remove rule from server if it was enabled
	if rule.Enabled {
		if err := u.removeRule(ctx, server, rule); err != nil {
			return fmt.Errorf("failed to remove rule from server: %w", err)
		}
	}

	return u.iptableRepo.Delete(ctx, id)
}

// ApplyRules applies all enabled rules to the server
func (u *serverIPTableUsecase) ApplyRules(ctx context.Context, serverID string) error {
	if serverID == "" {
		return errors.New("server ID is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Get all enabled rules
	rules, err := u.iptableRepo.GetByServerID(ctx, serverID)
	if err != nil {
		return err
	}

	// Filter enabled rules
	enabledRules := make([]*domain.ServerIPTable, 0)
	for _, rule := range rules {
		if rule.Enabled {
			enabledRules = append(enabledRules, rule)
		}
	}

	// Apply rules via SSH
	if err := u.applyAllRules(ctx, server, enabledRules); err != nil {
		return err
	}

	return nil
}

// RefreshRules refreshes rules from the server
func (u *serverIPTableUsecase) RefreshRules(ctx context.Context, serverID string) error {
	if serverID == "" {
		return errors.New("server ID is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// TODO: Implement rule discovery via SSH
	// This would involve:
	// 1. SSH into the server
	// 2. Run iptables-save
	// 3. Parse output and update database

	return nil
}

// BackupConfiguration creates a backup of current iptables configuration
func (u *serverIPTableUsecase) BackupConfiguration(ctx context.Context, serverID, name, description string) (*domain.IPTableBackup, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}
	if name == "" {
		return nil, errors.New("backup name is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	// Get current iptables configuration via SSH
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH client: %w", err)
	}
	defer sshClient.Close()

	// Execute iptables-save
	result, err := sshClient.ExecuteCommand(ctx, "sudo iptables-save")
	if err != nil {
		return nil, fmt.Errorf("failed to backup iptables: %w", err)
	}

	// Count rules
	ruleCount := strings.Count(result.Stdout, "\n-A ")

	// Create backup record
	backup := &domain.IPTableBackup{
		ServerID:    serverID,
		Name:        name,
		Description: description,
		Content:     result.Stdout,
		RuleCount:   ruleCount,
	}

	if err := u.iptableRepo.CreateBackup(ctx, backup); err != nil {
		return nil, fmt.Errorf("failed to create backup record: %w", err)
	}

	return backup, nil
}

// RestoreConfiguration restores iptables from a backup
func (u *serverIPTableUsecase) RestoreConfiguration(ctx context.Context, backupID string) error {
	if backupID == "" {
		return errors.New("backup ID is required")
	}

	// Get backup
	backup, err := u.iptableRepo.GetBackupByID(ctx, backupID)
	if err != nil {
		return err
	}
	if backup == nil {
		return errors.New("backup not found")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, backup.ServerID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Restore via SSH
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return fmt.Errorf("failed to create SSH client: %w", err)
	}
	defer sshClient.Close()

	// Execute iptables-restore
	command := fmt.Sprintf("echo '%s' | sudo iptables-restore", backup.Content)
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil || result.ExitCode != 0 {
		return fmt.Errorf("failed to restore iptables: %s", result.Stderr)
	}

	return nil
}

// GetBackups retrieves backup history
func (u *serverIPTableUsecase) GetBackups(ctx context.Context, serverID string, limit int) ([]*domain.IPTableBackup, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	if limit <= 0 {
		limit = 50
	}

	return u.iptableRepo.GetBackups(ctx, serverID, limit)
}

// FlushRules removes all rules from a chain
func (u *serverIPTableUsecase) FlushRules(ctx context.Context, serverID string, chain domain.IPTableChain) error {
	if serverID == "" {
		return errors.New("server ID is required")
	}
	if chain == "" {
		return errors.New("chain is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Flush chain via SSH
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return fmt.Errorf("failed to create SSH client: %w", err)
	}
	defer sshClient.Close()

	command := fmt.Sprintf("sudo iptables -F %s", chain)
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil || result.ExitCode != 0 {
		return fmt.Errorf("failed to flush chain: %s", result.Stderr)
	}

	return nil
}

// Helper functions

func (u *serverIPTableUsecase) buildIPTablesRule(rule *domain.ServerIPTable) string {
	parts := []string{"iptables", "-A", string(rule.Chain)}

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
	if rule.Comment != "" {
		parts = append(parts, "-m", "comment", "--comment", fmt.Sprintf("\"%s\"", rule.Comment))
	}

	parts = append(parts, "-j", string(rule.Action))

	return strings.Join(parts, " ")
}

func (u *serverIPTableUsecase) applyRule(ctx context.Context, server *domain.Server, rule *domain.ServerIPTable) error {
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return err
	}
	defer sshClient.Close()

	command := "sudo " + rule.RawRule
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil || result.ExitCode != 0 {
		return fmt.Errorf("failed to apply rule: %s", result.Stderr)
	}

	return nil
}

func (u *serverIPTableUsecase) removeRule(ctx context.Context, server *domain.Server, rule *domain.ServerIPTable) error {
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		return err
	}
	defer sshClient.Close()

	// Convert -A to -D to delete the rule
	deleteRule := strings.Replace(rule.RawRule, "-A", "-D", 1)
	command := "sudo " + deleteRule
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil || result.ExitCode != 0 {
		return fmt.Errorf("failed to remove rule: %s", result.Stderr)
	}

	return nil
}

func (u *serverIPTableUsecase) applyAllRules(ctx context.Context, server *domain.Server, rules []*domain.ServerIPTable) error {
	for _, rule := range rules {
		if err := u.applyRule(ctx, server, rule); err != nil {
			return err
		}
	}
	return nil
}

func (u *serverIPTableUsecase) ruleConfigChanged(old, new *domain.ServerIPTable) bool {
	return old.Chain != new.Chain ||
		old.Action != new.Action ||
		old.Protocol != new.Protocol ||
		old.SourceIP != new.SourceIP ||
		old.SourcePort != new.SourcePort ||
		old.DestIP != new.DestIP ||
		old.DestPort != new.DestPort ||
		old.Interface != new.Interface ||
		old.State != new.State
}
