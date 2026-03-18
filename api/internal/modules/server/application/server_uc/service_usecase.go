package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/pkg/logstream"
	"einfra/api/pkg/ssh"
)

type serverServiceUsecase struct {
	serviceRepo domain.ServerServiceRepository
	serverRepo  domain.ServerRepository
}

// NewServerServiceUsecase creates a new server service usecase instance
func NewServerServiceUsecase(
	serviceRepo domain.ServerServiceRepository,
	serverRepo domain.ServerRepository,
) domain.ServerServiceUsecase {
	return &serverServiceUsecase{
		serviceRepo: serviceRepo,
		serverRepo:  serverRepo,
	}
}

// ListServices retrieves all services running on a server
func (u *serverServiceUsecase) ListServices(ctx context.Context, serverID string) ([]*domain.ServerService, error) {
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

	filter := domain.ServiceFilter{
		ServerID: serverID,
		Page:     1,
		PageSize: 100,
	}

	services, _, err := u.serviceRepo.List(ctx, filter)
	return services, err
}

// GetService retrieves a service by ID
func (u *serverServiceUsecase) GetService(ctx context.Context, id string) (*domain.ServerService, error) {
	if id == "" {
		return nil, errors.New("service ID is required")
	}
	return u.serviceRepo.GetByID(ctx, id)
}

// GetServiceStatus gets the current status of a service
func (u *serverServiceUsecase) GetServiceStatus(ctx context.Context, serverID, serviceName string) (*domain.ServerService, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}
	if serviceName == "" {
		return nil, errors.New("service name is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
	}

	// Get service from database
	service, err := u.serviceRepo.GetByServerAndName(ctx, serverID, serviceName)
	if err != nil {
		return nil, err
	}

	// TODO: Query actual service status via SSH
	// This would involve:
	// 1. SSH into the server
	// 2. Run systemctl status <service> (Linux) or Get-Service (Windows)
	// 3. Parse output and update service status

	return service, nil
}

// PerformAction performs an action on a service (start, stop, restart, etc.)
func (u *serverServiceUsecase) PerformAction(ctx context.Context, serverID, serviceName string, action domain.ServiceAction) error {
	if serverID == "" {
		return errors.New("server ID is required")
	}
	if serviceName == "" {
		return errors.New("service name is required")
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return err
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Get or create service record
	service, err := u.serviceRepo.GetByServerAndName(ctx, serverID, serviceName)
	if err != nil {
		// Service doesn't exist in DB, create it
		service = &domain.ServerService{
			ServerID: serverID,
			Name:     serviceName,
			Status:   domain.ServiceStatusUnknown,
		}
		if err := u.serviceRepo.Create(ctx, service); err != nil {
			return fmt.Errorf("failed to create service record: %w", err)
		}
	}

	// Execute action via SSH
	if err := u.executeServiceAction(ctx, server, serviceName, action); err != nil {
		return err
	}

	// Update service status based on action
	var newStatus domain.ServiceStatus
	switch action {
	case domain.ServiceActionStart:
		newStatus = domain.ServiceStatusRunning
	case domain.ServiceActionStop:
		newStatus = domain.ServiceStatusStopped
	case domain.ServiceActionRestart:
		newStatus = domain.ServiceStatusRunning
	case domain.ServiceActionEnable:
		service.Enabled = true
	case domain.ServiceActionDisable:
		service.Enabled = false
	}

	if newStatus != "" {
		service.Status = newStatus
	}
	service.LastCheckedAt = time.Now()

	return u.serviceRepo.Update(ctx, service)
}

// executeServiceAction executes a service action via SSH
func (u *serverServiceUsecase) executeServiceAction(ctx context.Context, server *domain.Server, serviceName string, action domain.ServiceAction) error {
	// Create SSH client
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

	// Build command based on OS
	var command string
	if u.isLinuxOS(server.OS) {
		command = u.buildLinuxServiceCommand(serviceName, action)
	} else if u.isWindowsOS(server.OS) {
		command = u.buildWindowsServiceCommand(serviceName, action)
	} else {
		return fmt.Errorf("unsupported OS: %s", server.OS)
	}

	// Execute command
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil {
		return fmt.Errorf("failed to execute service action: %w", err)
	}

	if result.ExitCode != 0 {
		return fmt.Errorf("service action failed: %s", result.Stderr)
	}

	return nil
}

// buildLinuxServiceCommand builds a systemctl command for Linux
func (u *serverServiceUsecase) buildLinuxServiceCommand(serviceName string, action domain.ServiceAction) string {
	switch action {
	case domain.ServiceActionStart:
		return fmt.Sprintf("sudo systemctl start %s", serviceName)
	case domain.ServiceActionStop:
		return fmt.Sprintf("sudo systemctl stop %s", serviceName)
	case domain.ServiceActionRestart:
		return fmt.Sprintf("sudo systemctl restart %s", serviceName)
	case domain.ServiceActionReload:
		return fmt.Sprintf("sudo systemctl reload %s", serviceName)
	case domain.ServiceActionEnable:
		return fmt.Sprintf("sudo systemctl enable %s", serviceName)
	case domain.ServiceActionDisable:
		return fmt.Sprintf("sudo systemctl disable %s", serviceName)
	default:
		return ""
	}
}

// buildWindowsServiceCommand builds a PowerShell command for Windows
func (u *serverServiceUsecase) buildWindowsServiceCommand(serviceName string, action domain.ServiceAction) string {
	switch action {
	case domain.ServiceActionStart:
		return fmt.Sprintf("Start-Service -Name %s", serviceName)
	case domain.ServiceActionStop:
		return fmt.Sprintf("Stop-Service -Name %s", serviceName)
	case domain.ServiceActionRestart:
		return fmt.Sprintf("Restart-Service -Name %s", serviceName)
	default:
		return ""
	}
}

// isLinuxOS checks if the OS is Linux-based
func (u *serverServiceUsecase) isLinuxOS(os domain.ServerOS) bool {
	linuxOSes := []domain.ServerOS{
		domain.ServerOSLinux,
		domain.ServerOSUbuntu,
		domain.ServerOSDebian,
		domain.ServerOSCentOS,
		domain.ServerOSRockyLinux,
		domain.ServerOSAlmaLinux,
		domain.ServerOSFedora,
		domain.ServerOSRHEL,
	}
	for _, linuxOS := range linuxOSes {
		if os == linuxOS {
			return true
		}
	}
	return false
}

// isWindowsOS checks if the OS is Windows-based
func (u *serverServiceUsecase) isWindowsOS(os domain.ServerOS) bool {
	return strings.Contains(string(os), "windows")
}

// GetServiceLogs retrieves recent logs for a service
func (u *serverServiceUsecase) GetServiceLogs(ctx context.Context, serverID, serviceName string, lines int) ([]string, error) {
	if serverID == "" {
		return nil, errors.New("server ID is required")
	}
	if serviceName == "" {
		return nil, errors.New("service name is required")
	}
	if lines <= 0 {
		lines = 50
	}

	// Get server
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, errors.New("server not found")
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
		return nil, fmt.Errorf("failed to create SSH client: %w", err)
	}
	defer sshClient.Close()

	// Build command based on OS
	var command string
	if u.isLinuxOS(server.OS) {
		command = fmt.Sprintf("sudo journalctl -u %s -n %d --no-pager", serviceName, lines)
	} else {
		return nil, fmt.Errorf("log retrieval not supported for OS: %s", server.OS)
	}

	// Execute command
	result, err := sshClient.ExecuteCommand(ctx, command)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve logs: %w", err)
	}

	// Split output into lines
	logLines := strings.Split(strings.TrimSpace(result.Stdout), "\n")
	return logLines, nil
}

// RefreshServices refreshes the list of services from the server
func (u *serverServiceUsecase) RefreshServices(ctx context.Context, serverID string) error {
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

	// Implement service discovery via SSH
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

	// Execute systemctl list-units
	// Format: UNIT LOAD ACTIVE SUB DESCRIPTION
	result, err := sshClient.ExecuteCommand(ctx, "systemctl list-units --type=service --all --no-pager --no-legend")
	if err != nil {
		return fmt.Errorf("failed to execute command: %w", err)
	}

	lines := strings.Split(result.Stdout, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 4 {
			continue
		}

		name := parts[0]
		active := parts[2]
		description := strings.Join(parts[4:], " ")

		// Map status
		status := domain.ServiceStatusUnknown
		if active == "active" {
			status = domain.ServiceStatusRunning
		} else if active == "inactive" || active == "failed" {
			status = domain.ServiceStatusStopped
		}

		// Get or create service record
		service, err := u.serviceRepo.GetByServerAndName(ctx, serverID, name)
		if err != nil {
			service = &domain.ServerService{
				ServerID:    serverID,
				Name:        name,
				DisplayName: name,
				Description: description,
				Status:      status,
				CreatedAt:   time.Now(),
			}
			u.serviceRepo.Create(ctx, service)
		} else {
			service.Status = status
			service.Description = description
			service.LastCheckedAt = time.Now()
			u.serviceRepo.Update(ctx, service)
		}
	}

	return nil
}

// StreamServiceLogs streams service logs in real-time
func (u *serverServiceUsecase) StreamServiceLogs(ctx context.Context, serverID, serviceName string, options logstream.LogOptions) (<-chan logstream.LogEntry, <-chan error) {
	logChan := make(chan logstream.LogEntry, 100)
	errChan := make(chan error, 1)

	go func() {
		defer close(logChan)
		defer close(errChan)

		// Get server
		server, err := u.serverRepo.GetByID(ctx, serverID)
		if err != nil {
			errChan <- err
			return
		}
		if server == nil {
			errChan <- errors.New("server not found")
			return
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
			errChan <- fmt.Errorf("failed to create SSH client: %w", err)
			return
		}
		defer sshClient.Close()

		// Build command based on OS and options
		var command string
		if u.isLinuxOS(server.OS) {
			command = u.buildLinuxLogCommand(serviceName, options)
		} else {
			errChan <- fmt.Errorf("log streaming not supported for OS: %s", server.OS)
			return
		}

		// Execute command and stream output
		result, err := sshClient.ExecuteCommand(ctx, command)
		if err != nil {
			errChan <- fmt.Errorf("failed to stream logs: %w", err)
			return
		}

		// Parse and stream log lines
		logLines := strings.Split(strings.TrimSpace(result.Stdout), "\n")
		for _, line := range logLines {
			if line == "" {
				continue
			}

			entry := logstream.LogEntry{
				Timestamp: time.Now(),
				Message:   line,
				Source:    serviceName,
			}

			select {
			case logChan <- entry:
			case <-ctx.Done():
				return
			}
		}
	}()

	return logChan, errChan
}

// buildLinuxLogCommand builds a journalctl command for log streaming
func (u *serverServiceUsecase) buildLinuxLogCommand(serviceName string, options logstream.LogOptions) string {
	parts := []string{"sudo", "journalctl", "-u", serviceName}

	if options.Follow {
		parts = append(parts, "-f")
	}

	if options.Lines > 0 {
		parts = append(parts, "-n", fmt.Sprintf("%d", options.Lines))
	}

	if options.SinceTime != "" {
		parts = append(parts, "--since", fmt.Sprintf("'%s'", options.SinceTime))
	}

	parts = append(parts, "--no-pager")

	return strings.Join(parts, " ")
}
