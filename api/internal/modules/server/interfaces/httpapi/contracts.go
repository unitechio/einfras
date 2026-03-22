package serverhttp

import (
	"net/http"
	"time"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/platform/apierrors"
)

type responseEnvelope struct {
	Status   string            `json:"status"`
	Resource string            `json:"resource,omitempty"`
	Action   string            `json:"action,omitempty"`
	Item     any               `json:"item,omitempty"`
	Items    any               `json:"items,omitempty"`
	Command  any               `json:"command,omitempty"`
	Result   any               `json:"result,omitempty"`
	Meta     map[string]any    `json:"meta,omitempty"`
	Error    *apierrors.Detail `json:"error,omitempty"`
}

func itemEnvelope(status, resource string, item any, meta map[string]any) responseEnvelope {
	return responseEnvelope{
		Status:   status,
		Resource: resource,
		Item:     item,
		Meta:     meta,
	}
}

func listEnvelope(status, resource string, items any, meta map[string]any) responseEnvelope {
	return responseEnvelope{
		Status:   status,
		Resource: resource,
		Items:    items,
		Meta:     meta,
	}
}

func actionEnvelope(status, resource, action string, command, result any, meta map[string]any) responseEnvelope {
	return responseEnvelope{
		Status:   status,
		Resource: resource,
		Action:   action,
		Command:  command,
		Result:   result,
		Meta:     meta,
	}
}

func errorEnvelope(resource, action, code, message string, details map[string]any) responseEnvelope {
	envelope := apierrors.Envelope{
		Status:   "error",
		Resource: resource,
		Action:   action,
		Error: &apierrors.Detail{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
	return responseEnvelope{
		Status:   envelope.Status,
		Resource: envelope.Resource,
		Action:   envelope.Action,
		Error:    envelope.Error,
	}
}

func writeError(w http.ResponseWriter, statusCode int, resource, action, code, message string, details map[string]any) {
	writeJSON(w, statusCode, errorEnvelope(resource, action, code, message, details))
}

type createServerRequest struct {
	Name           string                      `json:"name"`
	Description    string                      `json:"description"`
	Hostname       string                      `json:"hostname"`
	IPAddress      string                      `json:"ip_address"`
	OS             domain.ServerOS             `json:"os"`
	OSVersion      string                      `json:"os_version"`
	Environment    domain.ServerEnvironment    `json:"environment"`
	ConnectionMode domain.ServerConnectionMode `json:"connection_mode"`
	Location       string                      `json:"location"`
	Provider       string                      `json:"provider"`
	CPUCores       int                         `json:"cpu_cores"`
	MemoryGB       float64                     `json:"memory_gb"`
	DiskGB         int                         `json:"disk_gb"`
	SSHPort        int                         `json:"ssh_port"`
	SSHUser        string                      `json:"ssh_user"`
	SSHPassword    string                      `json:"ssh_password,omitempty"`
	SSHKeyPath     string                      `json:"ssh_key_path,omitempty"`
	Tags           []string                    `json:"tags"`
}

type updateServerRequest = createServerRequest

type serverResponse struct {
	ID               string                        `json:"id"`
	Name             string                        `json:"name"`
	Description      string                        `json:"description"`
	Hostname         string                        `json:"hostname"`
	IPAddress        string                        `json:"ip_address"`
	OS               domain.ServerOS               `json:"os"`
	OSVersion        string                        `json:"os_version"`
	Status           domain.ServerStatus           `json:"status"`
	Environment      domain.ServerEnvironment      `json:"environment"`
	ConnectionMode   domain.ServerConnectionMode   `json:"connection_mode"`
	OnboardingStatus domain.ServerOnboardingStatus `json:"onboarding_status"`
	Location         string                        `json:"location"`
	Provider         string                        `json:"provider"`
	CPUCores         int                           `json:"cpu_cores"`
	MemoryGB         float64                       `json:"memory_gb"`
	DiskGB           int                           `json:"disk_gb"`
	SSHPort          int                           `json:"ssh_port"`
	SSHUser          string                        `json:"ssh_user"`
	SSHKeyPath       string                        `json:"ssh_key_path,omitempty"`
	Tags             []string                      `json:"tags"`
	LastCheckAt      *time.Time                    `json:"last_check_at,omitempty"`
	AgentVersion     string                        `json:"agent_version,omitempty"`
	CreatedAt        time.Time                     `json:"created_at"`
	UpdatedAt        time.Time                     `json:"updated_at"`
}

func toServerResponse(server *domain.Server) serverResponse {
	return serverResponse{
		ID:               server.ID,
		Name:             server.Name,
		Description:      server.Description,
		Hostname:         server.Hostname,
		IPAddress:        server.IPAddress,
		OS:               server.OS,
		OSVersion:        server.OSVersion,
		Status:           server.Status,
		Environment:      server.Environment,
		ConnectionMode:   server.ConnectionMode,
		OnboardingStatus: server.OnboardingStatus,
		Location:         server.Location,
		Provider:         server.Provider,
		CPUCores:         server.CPUCores,
		MemoryGB:         server.MemoryGB,
		DiskGB:           server.DiskGB,
		SSHPort:          server.SSHPort,
		SSHUser:          server.SSHUser,
		SSHKeyPath:       server.SSHKeyPath,
		Tags:             append([]string(nil), server.Tags...),
		LastCheckAt:      server.LastCheckAt,
		AgentVersion:     server.AgentVersion,
		CreatedAt:        server.CreatedAt,
		UpdatedAt:        server.UpdatedAt,
	}
}
