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

type serverNetworkUsecase struct {
	networkRepo domain.ServerNetworkRepository
	serverRepo  domain.ServerRepository
}

func NewServerNetworkUsecase(
	networkRepo domain.ServerNetworkRepository,
	serverRepo domain.ServerRepository,
) domain.ServerNetworkUsecase {
	return &serverNetworkUsecase{
		networkRepo: networkRepo,
		serverRepo:  serverRepo,
	}
}

func (u *serverNetworkUsecase) GetNetworkInterfaces(ctx context.Context, serverID string) ([]*domain.NetworkInterface, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	return u.networkRepo.GetInterfacesByServerID(ctx, serverID)
}

func (u *serverNetworkUsecase) RefreshNetworkInterfaces(ctx context.Context, serverID string) error {
	if serverID == "" {
		return errors.New("server ID is required")
	}
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Implement network interface discovery via SSH
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

	// Execute ip addr show
	result, err := sshClient.ExecuteCommand(ctx, "ip addr show")
	if err != nil {
		return fmt.Errorf("failed to execute command: %w", err)
	}

	// Simple parser for ip addr show output
	// Example line: 2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
	// Example line:    link/ether 08:00:27:8d:6e:0d brd ff:ff:ff:ff:ff:ff
	// Example line:    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0
	
	lines := strings.Split(result.Stdout, "\n")
	var interfaces []*domain.NetworkInterface
	var currentIF *domain.NetworkInterface

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// New interface block
		if strings.Contains(line, ": <") {
			parts := strings.Split(line, ": ")
			if len(parts) >= 2 {
				name := parts[1]
				currentIF = &domain.NetworkInterface{
					ServerID: serverID,
					Name:     name,
					IsUp:     strings.Contains(line, "state UP"),
				}
				// Parse MTU
				if strings.Contains(line, "mtu ") {
					fmt.Sscanf(line[strings.Index(line, "mtu "):], "mtu %d", &currentIF.MTU)
				}
				interfaces = append(interfaces, currentIF)
			}
			continue
		}

		if currentIF == nil {
			continue
		}

		if strings.HasPrefix(line, "link/ether ") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				currentIF.MACAddress = parts[1]
			}
		} else if strings.HasPrefix(line, "inet ") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				currentIF.IPAddress = parts[1]
			}
		}
	}

	// Update database
	if err := u.networkRepo.DeleteInterfacesByServerID(ctx, serverID); err != nil {
		return err
	}

	for _, iface := range interfaces {
		if err := u.networkRepo.CreateInterface(ctx, iface); err != nil {
			return err
		}
	}

	return nil
}

// GetNetworkStats retrieves current network statistics
func (u *serverNetworkUsecase) GetNetworkStats(ctx context.Context, serverID string) ([]*domain.NetworkStats, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	// Get network interfaces
	interfaces, err := u.networkRepo.GetInterfacesByServerID(ctx, serverID)
	if err != nil {
		return nil, err
	}

	stats := make([]*domain.NetworkStats, 0, len(interfaces))
	for _, iface := range interfaces {
		stat := &domain.NetworkStats{
			ServerID:      serverID,
			InterfaceName: iface.Name,
			Timestamp:     time.Now(),
		}
		// TODO: Calculate actual bandwidth from interface statistics
		stats = append(stats, stat)
	}

	return stats, nil
}

// CheckConnectivity checks network connectivity to a target
func (u *serverNetworkUsecase) CheckConnectivity(ctx context.Context, serverID, targetHost string, targetPort int, protocol string) (*domain.NetworkConnectivityCheck, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}
	if targetHost == "" {
		return nil, errors.New("target host is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	check := &domain.NetworkConnectivityCheck{
		ServerID:   serverID,
		TargetHost: targetHost,
		TargetPort: targetPort,
		Protocol:   protocol,
		TestedAt:   time.Now(),
	}

	// Create SSH client
	sshClient, err := ssh.NewClient(ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
	})
	if err != nil {
		check.Success = false
		check.ErrorMessage = fmt.Sprintf("failed to create SSH client: %v", err)
		u.networkRepo.CreateConnectivityCheck(ctx, check)
		return check, err
	}
	defer sshClient.Close()

	// Build ping command
	var command string
	if targetPort > 0 {
		// TCP/UDP port check
		command = fmt.Sprintf("timeout 5 bash -c 'cat < /dev/null > /dev/tcp/%s/%d' && echo 'success' || echo 'failed'", targetHost, targetPort)
	} else {
		// ICMP ping
		command = fmt.Sprintf("ping -c 4 -W 5 %s", targetHost)
	}

	startTime := time.Now()
	result, err := sshClient.ExecuteCommand(ctx, command)
	latency := time.Since(startTime).Milliseconds()

	if err != nil || result.ExitCode != 0 {
		check.Success = false
		check.ErrorMessage = result.Stderr
	} else {
		check.Success = strings.Contains(result.Stdout, "success") || strings.Contains(result.Stdout, "bytes from")
		check.Latency = float64(latency)
	}

	// Save check result
	if err := u.networkRepo.CreateConnectivityCheck(ctx, check); err != nil {
		return check, fmt.Errorf("failed to save connectivity check: %w", err)
	}

	return check, nil
}

// TestPort tests connectivity to a specific port
func (u *serverNetworkUsecase) TestPort(ctx context.Context, serverID string, request domain.PortCheckRequest) (bool, error) {
	if serverID == "" {
		return false, errors.New("server ID is required")
	}

	// Validate request
	if request.Host == "" {
		return false, errors.New("host is required")
	}
	if request.Port <= 0 || request.Port > 65535 {
		return false, errors.New("invalid port number")
	}
	if request.Protocol == "" {
		request.Protocol = "tcp"
	}
	if request.Timeout <= 0 {
		request.Timeout = 5
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return false, err
	}
	if server == nil {
		return false, errors.New("server not found")
	}

	// Test from the server via SSH
	check, err := u.CheckConnectivity(ctx, serverID, request.Host, request.Port, request.Protocol)
	if err != nil {
		return false, err
	}

	return check.Success, nil
}

// GetConnectivityHistory retrieves connectivity check history
func (u *serverNetworkUsecase) GetConnectivityHistory(ctx context.Context, serverID string, limit int) ([]*domain.NetworkConnectivityCheck, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}

	if limit <= 0 {
		limit = 50
	}

	return u.networkRepo.GetConnectivityHistory(ctx, serverID, limit)
}

// MonitorBandwidth monitors bandwidth usage
func (u *serverNetworkUsecase) MonitorBandwidth(ctx context.Context, serverID string, duration int) ([]*domain.NetworkStats, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}
	if duration <= 0 {
		duration = 60 // Default 60 seconds
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	// TODO: Implement bandwidth monitoring via SSH
	// This would involve:
	// 1. SSH into the server
	// 2. Run iftop, vnstat, or similar tools
	// 3. Collect data over the specified duration
	// 4. Parse and return statistics

	return nil, nil
}
