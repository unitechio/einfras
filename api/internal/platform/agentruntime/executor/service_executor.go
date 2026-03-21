package executor

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// ServiceAction represents an action on a system service.
type ServiceAction string

const (
	ActionStart   ServiceAction = "start"
	ActionStop    ServiceAction = "stop"
	ActionRestart ServiceAction = "restart"
	ActionReload  ServiceAction = "reload"
	ActionEnable  ServiceAction = "enable"
	ActionDisable ServiceAction = "disable"
	ActionStatus  ServiceAction = "status"
)

// ServiceInfo represents the status of a service.
type ServiceInfo struct {
	Name        string `json:"name"`
	Status      string `json:"status"` // active | inactive | failed
	LoadState   string `json:"load_state"`
	SubState    string `json:"sub_state"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	Startup     string `json:"startup"` // enabled | disabled
}

// ServiceExecutor handles service-related operations.
type ServiceExecutor struct{}

func NewServiceExecutor() *ServiceExecutor {
	return &ServiceExecutor{}
}

// PerformAction executes a service action (start, stop, etc.).
func (e *ServiceExecutor) PerformAction(ctx context.Context, serviceName string, action ServiceAction) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "linux":
		cmd = exec.CommandContext(ctx, "sudo", "systemctl", string(action), serviceName)
	case "windows":
		// Mapping for Windows PowerShell
		psAction := ""
		switch action {
		case ActionStart:
			psAction = "Start-Service"
		case ActionStop:
			psAction = "Stop-Service"
		case ActionRestart:
			psAction = "Restart-Service"
		default:
			return fmt.Errorf("unsupported action for Windows: %s", action)
		}
		cmd = exec.CommandContext(ctx, "powershell", "-Command", fmt.Sprintf("%s -Name %s", psAction, serviceName))
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("service action failed: %v, output: %s", err, string(output))
	}

	return nil
}

// ListServices returns a list of services on the system.
func (e *ServiceExecutor) ListServices(ctx context.Context) ([]ServiceInfo, error) {
	if runtime.GOOS != "linux" {
		return nil, fmt.Errorf("listing services not implemented for %s", runtime.GOOS)
	}

	// Format: UNIT LOAD ACTIVE SUB DESCRIPTION
	cmd := exec.CommandContext(ctx, "systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %v", err)
	}

	var services []ServiceInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}

		name := fields[0]
		load := fields[1]
		active := fields[2]
		sub := fields[3]
		description := ""
		if len(fields) > 4 {
			description = strings.Join(fields[4:], " ")
		}

		// Get enabled/disabled status (Startup)
		startup := "disabled"
		enabledCmd := exec.CommandContext(ctx, "systemctl", "is-enabled", name)
		if err := enabledCmd.Run(); err == nil {
			startup = "enabled"
		}

		services = append(services, ServiceInfo{
			Name:        name,
			Status:      active,
			LoadState:   load,
			SubState:    sub,
			Description: description,
			Startup:     startup,
		})
	}

	return services, nil
}
