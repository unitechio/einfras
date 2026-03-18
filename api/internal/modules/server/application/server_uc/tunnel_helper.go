package usecase

import (
	"context"
	"fmt"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/ssh"
)

// getSSHClient gets or creates an SSH client for a server (with tunnel support)
func (u *serverUsecase) getSSHClient(ctx context.Context, server *domain.Server) (*ssh.Client, error) {
	// Check if tunnel is required
	if server.TunnelEnabled {
		return u.getSSHClientWithTunnel(ctx, server)
	}

	// Direct SSH connection
	return u.getDirectSSHClient(server)
}

// getDirectSSHClient creates a direct SSH connection to the server
func (u *serverUsecase) getDirectSSHClient(server *domain.Server) (*ssh.Client, error) {
	// Check cache
	if client, exists := u.sshClients[server.ID]; exists {
		return client, nil
	}

	// Create new SSH client
	sshConfig := ssh.Config{
		Host:     server.IPAddress,
		Port:     server.SSHPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
		Timeout:  30 * time.Second,
	}

	client, err := ssh.NewClient(sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH client: %w", err)
	}

	// Connect
	if err := client.Connect(); err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}

	// Cache client
	u.sshClients[server.ID] = client

	return client, nil
}

// getSSHClientWithTunnel creates an SSH connection through a tunnel
func (u *serverUsecase) getSSHClientWithTunnel(ctx context.Context, server *domain.Server) (*ssh.Client, error) {
	// Create tunnel ID
	tunnelID := fmt.Sprintf("server-%s", server.ID)

	// Check if tunnel already exists
	tunnel, err := u.tunnelManager.GetTunnel(tunnelID)
	if err != nil {
		// Create new tunnel
		localPort := 10000 + (len(u.tunnelManager.ListTunnels()) % 5000) // Dynamic port allocation

		tunnelCfg := ssh.TunnelConfig{
			SSHConfig: ssh.Config{
				Host:    server.TunnelHost,
				Port:    server.TunnelPort,
				User:    server.TunnelUser,
				KeyPath: server.TunnelKeyPath,
				Timeout: 30 * time.Second,
			},
			LocalAddr:  fmt.Sprintf("localhost:%d", localPort),
			RemoteAddr: fmt.Sprintf("%s:%d", server.IPAddress, server.SSHPort),
		}

		if err := u.tunnelManager.CreateTunnel(tunnelID, tunnelCfg); err != nil {
			return nil, fmt.Errorf("failed to create tunnel: %w", err)
		}

		tunnel, _ = u.tunnelManager.GetTunnel(tunnelID)
	}

	// Get tunnel stats to find local address
	stats := tunnel.GetStats()
	localAddr := stats["local_addr"].(string)

	// Parse local address
	var localHost string
	var localPort int
	fmt.Sscanf(localAddr, "%[^:]:%d", &localHost, &localPort)

	// Create SSH client to connect through tunnel
	sshConfig := ssh.Config{
		Host:     localHost,
		Port:     localPort,
		User:     server.SSHUser,
		Password: server.SSHPassword,
		KeyPath:  server.SSHKeyPath,
		Timeout:  30 * time.Second,
	}

	client, err := ssh.NewClient(sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH client for tunnel: %w", err)
	}

	// Connect through tunnel
	if err := client.Connect(); err != nil {
		return nil, fmt.Errorf("failed to connect through tunnel: %w", err)
	}

	// Cache client
	u.sshClients[server.ID] = client

	return client, nil
}

// ExecuteCommand executes a command on a server (with tunnel support)
func (u *serverUsecase) ExecuteCommand(ctx context.Context, serverID string, command string) (*ssh.CommandResult, error) {
	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, fmt.Errorf("server not found")
	}

	// Get SSH client (with tunnel if needed)
	client, err := u.getSSHClient(ctx, server)
	if err != nil {
		return nil, err
	}

	// Execute command
	return client.ExecuteCommand(ctx, command)
}

// GetRealTimeMetrics gets real-time metrics from a server via SSH
func (u *serverUsecase) GetRealTimeMetrics(ctx context.Context, serverID string) (*domain.ServerMetrics, error) {
	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, fmt.Errorf("server not found")
	}

	// Get SSH client
	client, err := u.getSSHClient(ctx, server)
	if err != nil {
		return nil, err
	}

	// Execute commands to get metrics
	metrics := &domain.ServerMetrics{
		ServerID: serverID,
	}

	// Get CPU usage
	cpuResult, err := client.ExecuteCommand(ctx, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1")
	if err == nil {
		fmt.Sscanf(cpuResult.Stdout, "%f", &metrics.CPUUsage)
	}

	// Get memory usage
	memResult, err := client.ExecuteCommand(ctx, "free | grep Mem | awk '{print ($3/$2) * 100.0}'")
	if err == nil {
		fmt.Sscanf(memResult.Stdout, "%f", &metrics.MemoryUsage)
	}

	// Get disk usage
	diskResult, err := client.ExecuteCommand(ctx, "df -h / | tail -1 | awk '{print $5}' | cut -d'%' -f1")
	if err == nil {
		fmt.Sscanf(diskResult.Stdout, "%f", &metrics.DiskUsage)
	}

	// Get uptime
	uptimeResult, err := client.ExecuteCommand(ctx, "cat /proc/uptime | awk '{print $1}'")
	if err == nil {
		var uptime float64
		fmt.Sscanf(uptimeResult.Stdout, "%f", &uptime)
		metrics.Uptime = int64(uptime)
	}

	// Get load average
	loadResult, err := client.ExecuteCommand(ctx, "cat /proc/loadavg | awk '{print $1,$2,$3}'")
	if err == nil {
		var load1, load5, load15 float64
		fmt.Sscanf(loadResult.Stdout, "%f %f %f", &load1, &load5, &load15)
		metrics.LoadAverage = []float64{load1, load5, load15}
	}

	metrics.Timestamp = time.Now()

	return metrics, nil
}

// CloseConnection closes SSH connection and tunnel for a server
func (u *serverUsecase) CloseConnection(ctx context.Context, serverID string) error {
	// Close SSH client
	if client, exists := u.sshClients[serverID]; exists {
		client.Close()
		delete(u.sshClients, serverID)
	}

	// Stop tunnel if exists
	tunnelID := fmt.Sprintf("server-%s", serverID)
	if _, err := u.tunnelManager.GetTunnel(tunnelID); err == nil {
		u.tunnelManager.StopTunnel(tunnelID)
	}

	return nil
}
