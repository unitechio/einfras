package managementapp

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
)

type commandResultReader interface {
	FindByID(ctx context.Context, id string) (*agent.Command, error)
	GetLogs(ctx context.Context, commandID string) ([]*agent.CommandLog, error)
}

type ResourceCommandProjector struct {
	commands commandResultReader
	services domain.ServerServiceRepository
	networks domain.ServerNetworkRepository
	firewall domain.ServerIPTableRepository
	backups  domain.ServerBackupRepository
	disks    domain.ServerDiskRepository
}

func NewResourceCommandProjector(
	commands commandResultReader,
	services domain.ServerServiceRepository,
	networks domain.ServerNetworkRepository,
	firewall domain.ServerIPTableRepository,
	backups domain.ServerBackupRepository,
	disks domain.ServerDiskRepository,
) *ResourceCommandProjector {
	return &ResourceCommandProjector{
		commands: commands,
		services: services,
		networks: networks,
		firewall: firewall,
		backups:  backups,
		disks:    disks,
	}
}

func (p *ResourceCommandProjector) Project(ctx context.Context, commandID string) error {
	command, err := p.commands.FindByID(ctx, commandID)
	if err != nil {
		return err
	}

	output, err := p.commandOutput(ctx, command)
	if err != nil {
		return err
	}

	switch {
	case strings.HasPrefix(command.IdempotencyKey, "service-refresh:"),
		strings.HasPrefix(command.IdempotencyKey, "service-discovery:"):
		serverID := strings.TrimPrefix(strings.TrimPrefix(command.IdempotencyKey, "service-refresh:"), "service-discovery:")
		return p.projectServices(ctx, serverID, output)
	case strings.HasPrefix(command.IdempotencyKey, "service-action:"):
		return p.projectServiceAction(ctx, command)
	case strings.HasPrefix(command.IdempotencyKey, "network-refresh:"):
		serverID := strings.TrimPrefix(command.IdempotencyKey, "network-refresh:")
		return p.projectNetworkInterfaces(ctx, serverID, output)
	case strings.HasPrefix(command.IdempotencyKey, "network-check:"):
		return p.projectConnectivityCheck(ctx, command, output)
	case strings.HasPrefix(command.IdempotencyKey, "backup-create:"):
		backupID := strings.TrimPrefix(command.IdempotencyKey, "backup-create:")
		return p.projectBackupCreate(ctx, backupID, command, output)
	case strings.HasPrefix(command.IdempotencyKey, "disk-refresh:"):
		serverID := strings.TrimPrefix(command.IdempotencyKey, "disk-refresh:")
		return p.projectDisks(ctx, serverID, output)
	case strings.HasPrefix(command.IdempotencyKey, "backup-restore:"):
		backupID := strings.TrimPrefix(command.IdempotencyKey, "backup-restore:")
		return p.projectBackupRestore(ctx, backupID, command, output)
	case strings.HasPrefix(command.IdempotencyKey, "iptables-apply:"):
		serverID := strings.TrimPrefix(command.IdempotencyKey, "iptables-apply:")
		return p.projectFirewallApply(ctx, serverID, command)
	case strings.HasPrefix(command.IdempotencyKey, "iptables-restore:"):
		backupID := strings.TrimPrefix(command.IdempotencyKey, "iptables-restore:")
		return p.projectFirewallRestore(ctx, backupID, command)
	default:
		return nil
	}
}

func (p *ResourceCommandProjector) projectDisks(ctx context.Context, serverID, output string) error {
	if p.disks == nil {
		return nil
	}
	items, err := ParseDisks(serverID, output)
	if err != nil {
		return err
	}
	return p.disks.ReplaceByServerID(ctx, serverID, items)
}

func (p *ResourceCommandProjector) commandOutput(ctx context.Context, command *agent.Command) (string, error) {
	if strings.TrimSpace(command.Output) != "" {
		return command.Output, nil
	}

	logs, err := p.commands.GetLogs(ctx, command.ID)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	for _, chunk := range logs {
		builder.WriteString(chunk.Chunk)
	}
	return builder.String(), nil
}

func (p *ResourceCommandProjector) projectServices(ctx context.Context, serverID, output string) error {
	parsed := parseSystemdServices(output)
	if len(parsed) == 0 {
		return nil
	}

	existing, _, err := p.services.List(ctx, domain.ServiceFilter{ServerID: serverID, Page: 1, PageSize: 5000})
	if err != nil {
		return err
	}

	index := make(map[string]*domain.ServerService, len(existing))
	for _, item := range existing {
		index[item.Name] = item
	}

	now := time.Now().UTC()
	for _, item := range parsed {
		record, ok := index[item.Name]
		if !ok {
			record = &domain.ServerService{
				ID:        uuid.NewString(),
				ServerID:  serverID,
				Name:      item.Name,
				CreatedAt: now,
			}
		}
		record.DisplayName = item.DisplayName
		record.Description = item.Description
		record.Status = item.Status
		record.Enabled = record.Enabled || item.Enabled
		record.LastCheckedAt = now
		record.UpdatedAt = now
		if ok {
			if err := p.services.Update(ctx, record); err != nil {
				return err
			}
			continue
		}
		if err := p.services.Create(ctx, record); err != nil {
			return err
		}
	}
	return nil
}

func (p *ResourceCommandProjector) projectServiceAction(ctx context.Context, command *agent.Command) error {
	parts := strings.SplitN(command.IdempotencyKey, ":", 4)
	if len(parts) != 4 {
		return nil
	}

	service, err := p.services.GetByServerAndName(ctx, parts[1], parts[2])
	if err != nil {
		return nil
	}

	service.LastCheckedAt = time.Now().UTC()
	service.UpdatedAt = service.LastCheckedAt
	action := parts[3]
	if command.Status == agent.StatusFailed {
		service.Status = domain.ServiceStatusFailed
		return p.services.Update(ctx, service)
	}

	switch action {
	case "start", "restart", "reload":
		service.Status = domain.ServiceStatusRunning
	case "stop":
		service.Status = domain.ServiceStatusStopped
	case "enable":
		service.Enabled = true
	case "disable":
		service.Enabled = false
	}
	return p.services.Update(ctx, service)
}

func (p *ResourceCommandProjector) projectNetworkInterfaces(ctx context.Context, serverID, output string) error {
	items, err := parseNetworkInterfaces(serverID, output)
	if err != nil {
		return err
	}
	if err := p.networks.DeleteInterfacesByServerID(ctx, serverID); err != nil {
		return err
	}
	for _, item := range items {
		if err := p.networks.CreateInterface(ctx, item); err != nil {
			return err
		}
	}
	return nil
}

func (p *ResourceCommandProjector) projectConnectivityCheck(ctx context.Context, command *agent.Command, output string) error {
	checkID := strings.TrimPrefix(command.IdempotencyKey, "network-check:")
	check, err := p.networks.GetConnectivityCheckByID(ctx, checkID)
	if err != nil {
		return err
	}

	check.TestedAt = time.Now().UTC()
	check.Success = command.Status == agent.StatusSuccess && (command.ExitCode == nil || *command.ExitCode == 0)
	check.ErrorMessage = ""
	if check.Success {
		check.Latency = parseLatency(output)
	} else {
		check.ErrorMessage = tailLine(output)
		if check.ErrorMessage == "" {
			check.ErrorMessage = "network check failed"
		}
	}
	return p.networks.UpdateConnectivityCheck(ctx, check)
}

func (p *ResourceCommandProjector) projectBackupCreate(ctx context.Context, backupID string, command *agent.Command, output string) error {
	backup, err := p.backups.GetByID(ctx, backupID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	backup.UpdatedAt = now
	if command.Status == agent.StatusSuccess && (command.ExitCode == nil || *command.ExitCode == 0) {
		backup.Status = domain.BackupStatusCompleted
		backup.CompletedAt = &now
		backup.ErrorMessage = ""
		backup.SizeBytes = parseLastInteger(output)
	} else {
		backup.Status = domain.BackupStatusFailed
		backup.ErrorMessage = tailLine(output)
		if backup.ErrorMessage == "" {
			backup.ErrorMessage = "backup command failed"
		}
	}
	return p.backups.Update(ctx, backup)
}

func (p *ResourceCommandProjector) projectBackupRestore(ctx context.Context, backupID string, command *agent.Command, output string) error {
	backup, err := p.backups.GetByID(ctx, backupID)
	if err != nil {
		return err
	}
	backup.UpdatedAt = time.Now().UTC()
	if command.Status == agent.StatusFailed {
		backup.ErrorMessage = tailLine(output)
		if backup.ErrorMessage == "" {
			backup.ErrorMessage = "restore command failed"
		}
	} else {
		backup.ErrorMessage = ""
	}
	return p.backups.Update(ctx, backup)
}

func (p *ResourceCommandProjector) projectFirewallApply(ctx context.Context, serverID string, command *agent.Command) error {
	if command.Status == agent.StatusFailed {
		return nil
	}

	rules, err := p.firewall.GetByServerID(ctx, serverID)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		rule.LastApplied = now
		rule.UpdatedAt = now
		if err := p.firewall.Update(ctx, rule); err != nil {
			return err
		}
	}
	return nil
}

func (p *ResourceCommandProjector) projectFirewallRestore(ctx context.Context, backupID string, command *agent.Command) error {
	if command.Status == agent.StatusFailed {
		return nil
	}

	backup, err := p.firewall.GetBackupByID(ctx, backupID)
	if err != nil {
		return err
	}
	return p.projectFirewallApply(ctx, backup.ServerID, command)
}

type parsedService struct {
	Name        string
	DisplayName string
	Description string
	Status      domain.ServiceStatus
	Enabled     bool
}

func parseSystemdServices(output string) []parsedService {
	lines := strings.Split(output, "\n")
	services := make([]parsedService, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		name := fields[0]
		activeState := fields[2]
		subState := fields[3]
		services = append(services, parsedService{
			Name:        name,
			DisplayName: name,
			Description: strings.Join(fields[4:], " "),
			Status:      mapServiceStatus(activeState, subState),
			Enabled:     activeState == "active",
		})
	}
	return services
}

func mapServiceStatus(activeState, subState string) domain.ServiceStatus {
	switch {
	case activeState == "failed" || subState == "failed":
		return domain.ServiceStatusFailed
	case activeState == "active":
		return domain.ServiceStatusRunning
	case activeState == "inactive" || subState == "dead":
		return domain.ServiceStatusStopped
	default:
		return domain.ServiceStatusUnknown
	}
}

type ipAddressEntry struct {
	Family    string `json:"family"`
	Local     string `json:"local"`
	PrefixLen int    `json:"prefixlen"`
}

type ipLinkEntry struct {
	IfName    string           `json:"ifname"`
	LinkType  string           `json:"link_type"`
	Address   string           `json:"address"`
	MTU       int              `json:"mtu"`
	OperState string           `json:"operstate"`
	AddrInfo  []ipAddressEntry `json:"addr_info"`
}

func parseNetworkInterfaces(serverID, output string) ([]*domain.NetworkInterface, error) {
	if strings.TrimSpace(output) == "" {
		return nil, nil
	}

	var payload []ipLinkEntry
	if err := json.Unmarshal([]byte(output), &payload); err != nil {
		return nil, fmt.Errorf("parse network interfaces: %w", err)
	}

	now := time.Now().UTC()
	items := make([]*domain.NetworkInterface, 0, len(payload))
	for _, entry := range payload {
		if strings.TrimSpace(entry.IfName) == "" {
			continue
		}
		items = append(items, &domain.NetworkInterface{
			ID:            uuid.NewString(),
			ServerID:      serverID,
			Name:          entry.IfName,
			Type:          entry.LinkType,
			IPAddress:     primaryIPAddress(entry.AddrInfo),
			MACAddress:    entry.Address,
			MTU:           entry.MTU,
			IsUp:          strings.EqualFold(entry.OperState, "UP"),
			LastUpdatedAt: now,
			CreatedAt:     now,
			UpdatedAt:     now,
		})
	}
	return items, nil
}

func primaryIPAddress(entries []ipAddressEntry) string {
	for _, entry := range entries {
		if entry.Family == "inet" && entry.Local != "" {
			return entry.Local
		}
	}
	for _, entry := range entries {
		if entry.Local != "" {
			return entry.Local
		}
	}
	return ""
}

func parseLatency(output string) float64 {
	for _, line := range strings.Split(output, "\n") {
		if index := strings.Index(line, "time="); index >= 0 {
			value := line[index+5:]
			value = strings.TrimSpace(strings.TrimSuffix(strings.SplitN(value, " ", 2)[0], "ms"))
			if parsed, err := strconv.ParseFloat(value, 64); err == nil {
				return parsed
			}
		}
	}
	return 0
}

func parseLastInteger(output string) int64 {
	lines := strings.Split(output, "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		value := strings.TrimSpace(lines[i])
		if value == "" {
			continue
		}
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			return parsed
		}
	}
	return 0
}

func tailLine(output string) string {
	lines := strings.Split(output, "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line != "" {
			return line
		}
	}
	return ""
}
