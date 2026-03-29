package collector

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type RuntimeAuditRecord struct {
	ID            string         `json:"id"`
	EnvironmentID string         `json:"environment_id"`
	Action        string         `json:"action"`
	ResourceType  string         `json:"resource_type"`
	ResourceID    string         `json:"resource_id"`
	Status        string         `json:"status"`
	Details       string         `json:"details,omitempty"`
	Actor         string         `json:"actor,omitempty"`
	Metadata      map[string]any `json:"metadata,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
}

type RuntimeAuditFilterOptions struct {
	EnvironmentID string
	Limit         int
	Search        string
	Status        string
	Action        string
	Actor         string
	ResourceType  string
	Tag           string
	From          string
	To            string
}

type DockerTopology struct {
	Nodes []DockerTopologyNode `json:"nodes"`
	Edges []DockerTopologyEdge `json:"edges"`
}

type DockerTopologyNode struct {
	ID       string         `json:"id"`
	Label    string         `json:"label"`
	Kind     string         `json:"kind"`
	Status   string         `json:"status,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type DockerTopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

type DockerAutoHealPolicy struct {
	ID              string    `json:"id"`
	EnvironmentID   string    `json:"environment_id"`
	Name            string    `json:"name"`
	TargetMode      string    `json:"target_mode"`
	MatchValue      string    `json:"match_value,omitempty"`
	Trigger         string    `json:"trigger"`
	Action          string    `json:"action"`
	IntervalMinutes int       `json:"interval_minutes"`
	Enabled         bool      `json:"enabled"`
	LastRunAt       time.Time `json:"last_run_at,omitempty"`
	LastOutcome     string    `json:"last_outcome,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type DockerStackRevision struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Path      string    `json:"path"`
}

type DockerStackDetail struct {
	Name         string                `json:"name"`
	Mode         string                `json:"mode,omitempty"`
	Compose      string                `json:"compose"`
	Environment  map[string]string     `json:"environment"`
	Secrets      map[string]string     `json:"secrets"`
	Configs      map[string]string     `json:"configs"`
	Revisions    []DockerStackRevision `json:"revisions"`
	CurrentPath  string                `json:"current_path"`
	LastModified time.Time             `json:"last_modified"`
}

type RegistryCredential struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Provider    string    `json:"provider"`
	URL         string    `json:"url"`
	Username    string    `json:"username,omitempty"`
	Password    string    `json:"password,omitempty"`
	Token       string    `json:"token,omitempty"`
	Registry    string    `json:"registry,omitempty"`
	Region      string    `json:"region,omitempty"`
	IsAnonymous bool      `json:"is_anonymous"`
	IsDefault   bool      `json:"is_default"`
	PullPresets []string  `json:"pull_presets,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DockerContainerCreateRequest struct {
	Name                   string            `json:"name"`
	Image                  string            `json:"image"`
	Command                []string          `json:"command,omitempty"`
	Environment            map[string]string `json:"environment,omitempty"`
	Ports                  []string          `json:"ports,omitempty"`
	Volumes                []string          `json:"volumes,omitempty"`
	Labels                 map[string]string `json:"labels,omitempty"`
	RestartPolicy          string            `json:"restart_policy,omitempty"`
	RegistryID             string            `json:"registry_id,omitempty"`
	AutoStart              bool              `json:"auto_start"`
	HealthcheckCommand     string            `json:"healthcheck_command,omitempty"`
	HealthcheckInterval    string            `json:"healthcheck_interval,omitempty"`
	HealthcheckTimeout     string            `json:"healthcheck_timeout,omitempty"`
	HealthcheckStartPeriod string            `json:"healthcheck_start_period,omitempty"`
	HealthcheckRetries     int               `json:"healthcheck_retries,omitempty"`
	HealthcheckDisabled    bool              `json:"healthcheck_disabled,omitempty"`
}

type DockerContainerConfig struct {
	ID                     string            `json:"id"`
	Name                   string            `json:"name"`
	Image                  string            `json:"image"`
	Command                []string          `json:"command"`
	Environment            map[string]string `json:"environment"`
	Ports                  []string          `json:"ports"`
	Volumes                []string          `json:"volumes"`
	Labels                 map[string]string `json:"labels"`
	RestartPolicy          string            `json:"restart_policy"`
	State                  string            `json:"state"`
	HealthStatus           string            `json:"health_status,omitempty"`
	Alerts                 []string          `json:"alerts,omitempty"`
	HealthcheckCommand     string            `json:"healthcheck_command,omitempty"`
	HealthcheckInterval    string            `json:"healthcheck_interval,omitempty"`
	HealthcheckTimeout     string            `json:"healthcheck_timeout,omitempty"`
	HealthcheckStartPeriod string            `json:"healthcheck_start_period,omitempty"`
	HealthcheckRetries     int               `json:"healthcheck_retries,omitempty"`
	HealthcheckDisabled    bool              `json:"healthcheck_disabled,omitempty"`
	Inspect                map[string]any    `json:"inspect,omitempty"`
}

type DockerSecretAsset struct {
	Name      string    `json:"name"`
	Value     string    `json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DockerNetworkConfig struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Driver   string            `json:"driver"`
	Scope    string            `json:"scope"`
	Internal bool              `json:"internal"`
	Labels   map[string]string `json:"labels"`
}

type DockerVolumeConfig struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels"`
	Options    map[string]string `json:"options"`
}

type DockerFileEntry struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Size     int64     `json:"size"`
	Mode     string    `json:"mode"`
	IsDir    bool      `json:"is_dir"`
	IsLink   bool      `json:"is_link"`
	Modified time.Time `json:"modified"`
}

type DockerContainerStats struct {
	CPUPerc    string `json:"cpu_perc"`
	MemUsage   string `json:"mem_usage"`
	MemPerc    string `json:"mem_perc"`
	NetIO      string `json:"net_io"`
	BlockIO    string `json:"block_io"`
	PIDs       string `json:"pids"`
	ReadAt     string `json:"read_at"`
	RawPayload string `json:"raw_payload,omitempty"`
}

type DockerServiceDetail struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Image        string            `json:"image"`
	Mode         string            `json:"mode"`
	Replicas     string            `json:"replicas"`
	Ports        string            `json:"ports"`
	Labels       map[string]string `json:"labels"`
	Command      []string          `json:"command"`
	Arguments    []string          `json:"arguments"`
	Env          []string          `json:"env"`
	Networks     []string          `json:"networks"`
	CreatedAt    string            `json:"created_at"`
	UpdatedAt    string            `json:"updated_at"`
	Stack        string            `json:"stack"`
	EndpointMode string            `json:"endpoint_mode"`
}

type DockerRegistryCatalog struct {
	RegistryID   string              `json:"registry_id"`
	RegistryName string              `json:"registry_name"`
	Repositories []string            `json:"repositories"`
	Tags         map[string][]string `json:"tags,omitempty"`
}

type DockerImageImportResult struct {
	LoadedImages []string `json:"loaded_images"`
	Output       string   `json:"output"`
}

type DockerBuildHistoryRecord struct {
	ID            string    `json:"id"`
	EnvironmentID string    `json:"environment_id"`
	CreatedAt     time.Time `json:"created_at"`
	Target        string    `json:"target"`
	Dockerfile    string    `json:"dockerfile"`
	Status        string    `json:"status"`
	Output        string    `json:"output"`
	ContextName   string    `json:"context_name,omitempty"`
	ContextID     string    `json:"context_id,omitempty"`
	ContextPath   string    `json:"context_path,omitempty"`
	ContextSize   int64     `json:"context_size,omitempty"`
	ArchiveName   string    `json:"archive_name,omitempty"`
	Tags          []string  `json:"tags,omitempty"`
}

type DockerSwarmStatus struct {
	LocalNodeState   string `json:"local_node_state"`
	ControlAvailable bool   `json:"control_available"`
	NodeID           string `json:"node_id,omitempty"`
	Error            string `json:"error,omitempty"`
	IsManager        bool   `json:"is_manager"`
	IsActive         bool   `json:"is_active"`
}

func GetDockerSystemLogs(lines int) (string, error) {
	if lines <= 0 {
		lines = 200
	}
	if runtime.GOOS == "windows" {
		output, err := exec.Command("powershell", "-NoProfile", "-Command", fmt.Sprintf("Get-EventLog -LogName Application -Newest %d | Where-Object { $_.Source -like '*docker*' -or $_.Message -like '*docker*' } | Select-Object TimeGenerated, EntryType, Source, Message | Format-List", lines)).CombinedOutput()
		if err == nil && strings.TrimSpace(string(output)) != "" {
			return string(output), nil
		}
		infoOutput, infoErr := exec.Command("docker", "info").CombinedOutput()
		if infoErr == nil && strings.TrimSpace(string(infoOutput)) != "" {
			return "Windows host fallback: Docker event log entries were not found. Showing docker info instead.\n\n" + string(infoOutput), nil
		}
		return "", fmt.Errorf("docker system logs are unavailable on this Windows host")
	}
	output, err := exec.Command("journalctl", "-u", "docker", "-n", strconv.Itoa(lines), "--no-pager").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("journalctl docker failed: %s", strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func RestartDockerContainer(containerID string) error {
	return runCommand("docker", "restart", containerID)
}

func KillDockerContainer(containerID string) error {
	state, _ := inspectDockerContainerState(containerID)
	if state != "" && !strings.EqualFold(strings.TrimSpace(state), "running") {
		return nil
	}
	err := runCommand("docker", "kill", containerID)
	if err == nil {
		return nil
	}
	state, _ = inspectDockerContainerState(containerID)
	if state != "" && !strings.EqualFold(strings.TrimSpace(state), "running") {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "is not running") {
		return nil
	}
	return err
}

func PauseDockerContainer(containerID string) error {
	return runCommand("docker", "pause", containerID)
}

func UnpauseDockerContainer(containerID string) error {
	return runCommand("docker", "unpause", containerID)
}

func RenameDockerContainer(containerID, newName string) error {
	return runCommand("docker", "rename", containerID, strings.TrimSpace(newName))
}

func CommitDockerContainer(containerID, imageRef string) error {
	return runCommand("docker", "commit", containerID, strings.TrimSpace(imageRef))
}

func ensureDockerImageRequiredEnvironment(request *DockerContainerCreateRequest) {
	if request.Environment == nil {
		request.Environment = map[string]string{}
	}
	imageRef := strings.ToLower(strings.TrimSpace(request.Image))
	hasEnv := func(keys ...string) bool {
		for _, key := range keys {
			if strings.TrimSpace(request.Environment[key]) != "" {
				return true
			}
		}
		return false
	}
	setEnvIfMissing := func(key string, generator func() string) {
		if strings.TrimSpace(request.Environment[key]) == "" {
			request.Environment[key] = generator()
		}
	}

	switch {
	case strings.HasPrefix(imageRef, "mariadb:"):
		if !hasEnv("MARIADB_ROOT_PASSWORD", "MARIADB_ROOT_PASSWORD_HASH", "MARIADB_ALLOW_EMPTY_ROOT_PASSWORD", "MARIADB_RANDOM_ROOT_PASSWORD") {
			setEnvIfMissing("MARIADB_ROOT_PASSWORD", randomRuntimeSecret)
		}
	case strings.HasPrefix(imageRef, "mysql:"):
		if !hasEnv("MYSQL_ROOT_PASSWORD", "MYSQL_ALLOW_EMPTY_PASSWORD", "MYSQL_RANDOM_ROOT_PASSWORD") {
			setEnvIfMissing("MYSQL_ROOT_PASSWORD", randomRuntimeSecret)
		}
	case strings.HasPrefix(imageRef, "postgres:"):
		if !hasEnv("POSTGRES_PASSWORD") {
			setEnvIfMissing("POSTGRES_PASSWORD", randomRuntimeSecret)
		}
	case strings.Contains(imageRef, "keycloak"):
		setEnvIfMissing("KEYCLOAK_ADMIN", func() string { return "admin" })
		setEnvIfMissing("KEYCLOAK_ADMIN_PASSWORD", randomRuntimeSecret)
	}
}

func randomRuntimeSecret() string {
	buffer := make([]byte, 12)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("einfra-%d", time.Now().UTC().UnixNano())
	}
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	chars := make([]byte, len(buffer))
	for index, value := range buffer {
		chars[index] = alphabet[int(value)%len(alphabet)]
	}
	return string(chars)
}

func CreateDockerContainer(request DockerContainerCreateRequest) (string, error) {
	imageRef := strings.TrimSpace(request.Image)
	if imageRef == "" {
		return "", fmt.Errorf("image is required")
	}
	ensureDockerImageRequiredEnvironment(&request)
	if strings.TrimSpace(request.RegistryID) != "" {
		if err := PullDockerImageWithCredential(imageRef, strings.TrimSpace(request.RegistryID)); err != nil {
			return "", err
		}
	}
	commandName := "run"
	args := []string{}
	if request.AutoStart {
		args = append(args, "-d")
	} else {
		commandName = "create"
	}
	if name := strings.TrimSpace(request.Name); name != "" {
		args = append(args, "--name", name)
	}
	for key, value := range request.Environment {
		args = append(args, "-e", fmt.Sprintf("%s=%s", key, value))
	}
	for _, port := range request.Ports {
		if trimmed := strings.TrimSpace(port); trimmed != "" {
			args = append(args, "-p", trimmed)
		}
	}
	for _, volume := range request.Volumes {
		if trimmed := strings.TrimSpace(volume); trimmed != "" {
			args = append(args, "-v", trimmed)
		}
	}
	for key, value := range request.Labels {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}
		args = append(args, "--label", fmt.Sprintf("%s=%s", trimmedKey, strings.TrimSpace(value)))
	}
	if request.HealthcheckDisabled {
		args = append(args, "--no-healthcheck")
	} else if strings.TrimSpace(request.HealthcheckCommand) != "" {
		args = append(args, "--health-cmd", strings.TrimSpace(request.HealthcheckCommand))
		if strings.TrimSpace(request.HealthcheckInterval) != "" {
			args = append(args, "--health-interval", strings.TrimSpace(request.HealthcheckInterval))
		}
		if strings.TrimSpace(request.HealthcheckTimeout) != "" {
			args = append(args, "--health-timeout", strings.TrimSpace(request.HealthcheckTimeout))
		}
		if strings.TrimSpace(request.HealthcheckStartPeriod) != "" {
			args = append(args, "--health-start-period", strings.TrimSpace(request.HealthcheckStartPeriod))
		}
		if request.HealthcheckRetries > 0 {
			args = append(args, "--health-retries", strconv.Itoa(request.HealthcheckRetries))
		}
	}
	switch strings.TrimSpace(request.RestartPolicy) {
	case "", "no":
	case "always", "unless-stopped", "on-failure":
		args = append(args, "--restart", strings.TrimSpace(request.RestartPolicy))
	default:
		return "", fmt.Errorf("unsupported restart policy %s", request.RestartPolicy)
	}
	args = append(args, imageRef)
	args = append(args, request.Command...)
	output, err := exec.Command("docker", append([]string{commandName}, args...)...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker %s failed: %s", commandName, strings.TrimSpace(string(output)))
	}
	return strings.TrimSpace(string(output)), nil
}

func InspectDockerContainerConfig(containerID string) (*DockerContainerConfig, error) {
	var rawInspect []map[string]any
	if err := dockerInspect([]string{containerID}, &rawInspect); err != nil {
		return nil, err
	}
	if len(rawInspect) == 0 {
		return nil, fmt.Errorf("container %s not found", containerID)
	}
	var payload []struct {
		ID     string   `json:"Id"`
		Name   string   `json:"Name"`
		Path   string   `json:"Path"`
		Args   []string `json:"Args"`
		Config struct {
			Image       string            `json:"Image"`
			Cmd         []string          `json:"Cmd"`
			Env         []string          `json:"Env"`
			Labels      map[string]string `json:"Labels"`
			Healthcheck *struct {
				Test        []string `json:"Test"`
				Interval    int64    `json:"Interval"`
				Timeout     int64    `json:"Timeout"`
				StartPeriod int64    `json:"StartPeriod"`
				Retries     int      `json:"Retries"`
			} `json:"Healthcheck"`
		} `json:"Config"`
		HostConfig struct {
			Binds        []string `json:"Binds"`
			PortBindings map[string][]struct {
				HostIP   string `json:"HostIp"`
				HostPort string `json:"HostPort"`
			} `json:"PortBindings"`
			RestartPolicy struct {
				Name string `json:"Name"`
			} `json:"RestartPolicy"`
		} `json:"HostConfig"`
		Mounts []struct {
			Source      string `json:"Source"`
			Destination string `json:"Destination"`
			Name        string `json:"Name"`
			Type        string `json:"Type"`
		} `json:"Mounts"`
		State struct {
			Status string `json:"Status"`
			Health struct {
				Status string `json:"Status"`
			} `json:"Health"`
		} `json:"State"`
	}
	if err := json.Unmarshal(mustMarshalJSON(rawInspect), &payload); err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, fmt.Errorf("container %s not found", containerID)
	}
	item := payload[0]
	env := map[string]string{}
	for _, pair := range item.Config.Env {
		key, value, found := strings.Cut(pair, "=")
		if found {
			env[key] = value
		}
	}
	ports := make([]string, 0)
	for privatePort, bindings := range item.HostConfig.PortBindings {
		for _, binding := range bindings {
			host := strings.TrimSpace(binding.HostPort)
			if host == "" {
				continue
			}
			ports = append(ports, fmt.Sprintf("%s:%s", host, strings.Split(privatePort, "/")[0]))
		}
	}
	volumes := make([]string, 0, len(item.Mounts))
	for _, mount := range item.Mounts {
		source := firstNonEmpty(mount.Source, mount.Name)
		if source == "" || strings.TrimSpace(mount.Destination) == "" {
			continue
		}
		volumes = append(volumes, fmt.Sprintf("%s:%s", source, mount.Destination))
	}
	command := item.Config.Cmd
	if len(command) == 0 {
		command = append([]string{item.Path}, item.Args...)
	}
	healthcheckCommand := ""
	healthcheckDisabled := false
	healthcheckInterval := ""
	healthcheckTimeout := ""
	healthcheckStartPeriod := ""
	healthcheckRetries := 0
	if item.Config.Healthcheck != nil {
		test := item.Config.Healthcheck.Test
		if len(test) > 0 {
			if strings.EqualFold(test[0], "NONE") {
				healthcheckDisabled = true
			} else if len(test) > 1 {
				healthcheckCommand = strings.Join(test[1:], " ")
			}
		}
		healthcheckInterval = formatDockerDuration(item.Config.Healthcheck.Interval)
		healthcheckTimeout = formatDockerDuration(item.Config.Healthcheck.Timeout)
		healthcheckStartPeriod = formatDockerDuration(item.Config.Healthcheck.StartPeriod)
		healthcheckRetries = item.Config.Healthcheck.Retries
	}
	return &DockerContainerConfig{
		ID:                     item.ID,
		Name:                   strings.TrimPrefix(item.Name, "/"),
		Image:                  item.Config.Image,
		Command:                command,
		Environment:            env,
		Ports:                  ports,
		Volumes:                volumes,
		Labels:                 item.Config.Labels,
		RestartPolicy:          firstNonEmpty(item.HostConfig.RestartPolicy.Name, "no"),
		State:                  item.State.Status,
		HealthStatus:           item.State.Health.Status,
		Alerts:                 deriveContainerAlerts(item.State.Status, item.State.Health.Status),
		HealthcheckCommand:     healthcheckCommand,
		HealthcheckInterval:    healthcheckInterval,
		HealthcheckTimeout:     healthcheckTimeout,
		HealthcheckStartPeriod: healthcheckStartPeriod,
		HealthcheckRetries:     healthcheckRetries,
		HealthcheckDisabled:    healthcheckDisabled,
		Inspect:                rawInspect[0],
	}, nil
}

func mustMarshalJSON(value any) []byte {
	payload, _ := json.Marshal(value)
	return payload
}

func deriveContainerAlerts(state, health string) []string {
	alerts := []string{}
	if strings.EqualFold(health, "unhealthy") {
		alerts = append(alerts, "Container healthcheck is reporting unhealthy.")
	}
	if state != "" && !strings.EqualFold(state, "running") {
		alerts = append(alerts, fmt.Sprintf("Container state is %s.", state))
	}
	return alerts
}

func formatDockerDuration(nanoseconds int64) string {
	if nanoseconds <= 0 {
		return ""
	}
	return (time.Duration(nanoseconds)).String()
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func UpdateDockerContainerConfig(containerID string, request DockerContainerCreateRequest, recreate bool) (string, error) {
	current, err := InspectDockerContainerConfig(containerID)
	if err != nil {
		return "", err
	}
	name := firstNonEmpty(strings.TrimSpace(request.Name), current.Name)
	image := firstNonEmpty(strings.TrimSpace(request.Image), current.Image)
	command := request.Command
	if len(command) == 0 {
		command = current.Command
	}
	environment := current.Environment
	if request.Environment != nil {
		environment = request.Environment
	}
	ports := current.Ports
	if request.Ports != nil {
		ports = request.Ports
	}
	volumes := current.Volumes
	if request.Volumes != nil {
		volumes = request.Volumes
	}
	labels := current.Labels
	if request.Labels != nil {
		labels = request.Labels
	}
	restartPolicy := firstNonEmpty(strings.TrimSpace(request.RestartPolicy), current.RestartPolicy)

	if !recreate && restartPolicy != "" && restartPolicy != current.RestartPolicy {
		if err := runCommand("docker", "update", "--restart", restartPolicy, containerID); err != nil {
			return "", err
		}
		if name != current.Name {
			if err := RenameDockerContainer(containerID, name); err != nil {
				return "", err
			}
		}
		return containerID, nil
	}

	wasRunning := strings.EqualFold(current.State, "running")
	_ = StopDockerContainer(containerID)
	if err := runCommand("docker", "rm", containerID); err != nil {
		return "", err
	}
	return CreateDockerContainer(DockerContainerCreateRequest{
		Name:                   name,
		Image:                  image,
		Command:                command,
		Environment:            environment,
		Ports:                  ports,
		Volumes:                volumes,
		Labels:                 labels,
		RestartPolicy:          restartPolicy,
		RegistryID:             request.RegistryID,
		AutoStart:              request.AutoStart || wasRunning,
		HealthcheckCommand:     firstNonEmpty(strings.TrimSpace(request.HealthcheckCommand), current.HealthcheckCommand),
		HealthcheckInterval:    firstNonEmpty(strings.TrimSpace(request.HealthcheckInterval), current.HealthcheckInterval),
		HealthcheckTimeout:     firstNonEmpty(strings.TrimSpace(request.HealthcheckTimeout), current.HealthcheckTimeout),
		HealthcheckStartPeriod: firstNonEmpty(strings.TrimSpace(request.HealthcheckStartPeriod), current.HealthcheckStartPeriod),
		HealthcheckRetries:     maxInt(request.HealthcheckRetries, current.HealthcheckRetries),
		HealthcheckDisabled:    request.HealthcheckDisabled,
	})
}

func ExecDockerContainer(containerID string, command []string) (string, error) {
	args := []string{"exec", containerID}
	args = append(args, command...)
	output, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker exec failed: %s", strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

type DockerExecSession struct {
	Stdin   io.WriteCloser
	Stdout  io.ReadCloser
	Stderr  io.ReadCloser
	Wait    func() error
	Close   func() error
	Resize  func(cols, rows uint16) error
	IsPTY   bool
	Command *exec.Cmd
}

func StartDockerExecSession(containerID string, shellCommand []string) (*DockerExecSession, error) {
	if len(shellCommand) == 0 {
		shellCommand = defaultDockerShellCandidates()
	}
	if runtime.GOOS != "windows" {
		for _, candidate := range shellCommand {
			if session, err := startDockerExecPTYSession(containerID, []string{candidate}); err == nil {
				return session, nil
			}
		}
	}
	var lastErr error
	for _, candidate := range shellCommand {
		session, err := startDockerExecPipeSession(containerID, []string{candidate})
		if err == nil {
			return session, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return startDockerExecPipeSession(containerID, []string{"sh"})
}

func StreamReaderLines(reader io.Reader, callback func(string) error) error {
	scanner := bufio.NewScanner(reader)
	buffer := make([]byte, 0, 64*1024)
	scanner.Buffer(buffer, 1024*1024)
	for scanner.Scan() {
		if err := callback(scanner.Text()); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func defaultDockerShellCandidates() []string {
	return []string{
		"sh",
		"/bin/sh",
		"bash",
		"/bin/bash",
		"ash",
		"/bin/ash",
		"busybox",
		"/busybox/sh",
		"pwsh",
		"powershell",
		"powershell.exe",
		"cmd",
		"cmd.exe",
	}
}

func DeployDockerStack(name, compose string, envVars map[string]string, secrets map[string]string, configs map[string]string) error {
	mode, preparedCompose, err := prepareComposeDeploymentPayload(compose)
	if err != nil {
		return err
	}
	stackDir, err := ensureStackDir(name)
	if err != nil {
		return err
	}
	revisionID := time.Now().UTC().Format("20060102-150405")
	revisionPath := filepath.Join(stackDir, "revisions", revisionID+".yml")
	currentPath := filepath.Join(stackDir, "current.yml")
	envPath := filepath.Join(stackDir, "current.env.json")
	secretsPath := filepath.Join(stackDir, "current.secrets.json")
	configsPath := filepath.Join(stackDir, "current.configs.json")
	metaPath := filepath.Join(stackDir, "current.meta.json")
	if err := os.MkdirAll(filepath.Dir(revisionPath), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(revisionPath, []byte(preparedCompose), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(currentPath, []byte(preparedCompose), 0o644); err != nil {
		return err
	}
	if payload, err := json.MarshalIndent(envVars, "", "  "); err == nil {
		_ = os.WriteFile(envPath, payload, 0o644)
	}
	if payload, err := json.MarshalIndent(secrets, "", "  "); err == nil {
		_ = os.WriteFile(secretsPath, payload, 0o600)
	}
	if payload, err := json.MarshalIndent(configs, "", "  "); err == nil {
		_ = os.WriteFile(configsPath, payload, 0o644)
	}
	if payload, err := json.MarshalIndent(map[string]string{"mode": mode}, "", "  "); err == nil {
		_ = os.WriteFile(metaPath, payload, 0o644)
	}
	if err := writeStackAssets(stackDir, "secrets", secrets, 0o600); err != nil {
		return err
	}
	if err := writeStackAssets(stackDir, "configs", configs, 0o644); err != nil {
		return err
	}
	return runDockerStackDeploy(name, currentPath, envVars, mode)
}

func GetDockerStackDetail(name string) (*DockerStackDetail, error) {
	stackDir, err := ensureStackDir(name)
	if err != nil {
		return nil, err
	}
	currentPath := filepath.Join(stackDir, "current.yml")
	composeBytes, err := os.ReadFile(currentPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &DockerStackDetail{Name: name, Environment: map[string]string{}, Revisions: []DockerStackRevision{}}, nil
		}
		return nil, err
	}
	info, _ := os.Stat(currentPath)
	envVars := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.env.json")); err == nil {
		_ = json.Unmarshal(payload, &envVars)
	}
	secrets := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.secrets.json")); err == nil {
		_ = json.Unmarshal(payload, &secrets)
	}
	configs := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.configs.json")); err == nil {
		_ = json.Unmarshal(payload, &configs)
	}
	mode := "swarm"
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.meta.json")); err == nil {
		var meta map[string]string
		if json.Unmarshal(payload, &meta) == nil && strings.TrimSpace(meta["mode"]) != "" {
			mode = strings.TrimSpace(meta["mode"])
		}
	}
	revisions, _ := listDockerStackRevisions(name)
	return &DockerStackDetail{
		Name:         name,
		Mode:         mode,
		Compose:      string(composeBytes),
		Environment:  envVars,
		Secrets:      secrets,
		Configs:      configs,
		Revisions:    revisions,
		CurrentPath:  currentPath,
		LastModified: fileModTime(info),
	}, nil
}

func RollbackDockerStack(name, revisionID string) error {
	stackDir, err := ensureStackDir(name)
	if err != nil {
		return err
	}
	revisionPath := filepath.Join(stackDir, "revisions", strings.TrimSpace(revisionID)+".yml")
	composeBytes, err := os.ReadFile(revisionPath)
	if err != nil {
		return err
	}
	envVars := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.env.json")); err == nil {
		_ = json.Unmarshal(payload, &envVars)
	}
	secrets := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.secrets.json")); err == nil {
		_ = json.Unmarshal(payload, &secrets)
	}
	configs := map[string]string{}
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.configs.json")); err == nil {
		_ = json.Unmarshal(payload, &configs)
	}
	currentPath := filepath.Join(stackDir, "current.yml")
	if err := os.WriteFile(currentPath, composeBytes, 0o644); err != nil {
		return err
	}
	if err := writeStackAssets(stackDir, "secrets", secrets, 0o600); err != nil {
		return err
	}
	if err := writeStackAssets(stackDir, "configs", configs, 0o644); err != nil {
		return err
	}
	mode := "swarm"
	if payload, err := os.ReadFile(filepath.Join(stackDir, "current.meta.json")); err == nil {
		var meta map[string]string
		if json.Unmarshal(payload, &meta) == nil && strings.TrimSpace(meta["mode"]) != "" {
			mode = strings.TrimSpace(meta["mode"])
		}
	}
	return runDockerStackDeploy(name, currentPath, envVars, mode)
}

func ListRegistryCredentials() ([]RegistryCredential, error) {
	path, err := registryFilePath()
	if err != nil {
		return nil, err
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []RegistryCredential{}, nil
		}
		return nil, err
	}
	var items []RegistryCredential
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func SaveRegistryCredential(item RegistryCredential) (RegistryCredential, error) {
	items, err := ListRegistryCredentials()
	if err != nil {
		return RegistryCredential{}, err
	}
	now := time.Now().UTC()
	if strings.TrimSpace(item.ID) == "" {
		item.ID = fmt.Sprintf("registry-%d", now.UnixNano())
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	if item.PullPresets == nil {
		item.PullPresets = []string{}
	}
	if item.IsDefault {
		for index := range items {
			items[index].IsDefault = false
		}
	}
	found := false
	for index := range items {
		if items[index].ID == item.ID {
			item.CreatedAt = items[index].CreatedAt
			items[index] = item
			found = true
			break
		}
	}
	if !found {
		items = append(items, item)
	}
	if err := writeRegistryCredentials(items); err != nil {
		return RegistryCredential{}, err
	}
	return item, nil
}

func DeleteRegistryCredential(id string) error {
	items, err := ListRegistryCredentials()
	if err != nil {
		return err
	}
	filtered := make([]RegistryCredential, 0, len(items))
	for _, item := range items {
		if item.ID != id {
			filtered = append(filtered, item)
		}
	}
	return writeRegistryCredentials(filtered)
}

func ListDockerSecretAssets(environmentID string) ([]DockerSecretAsset, error) {
	path, err := dockerSecretAssetsFilePath(environmentID)
	if err != nil {
		return nil, err
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []DockerSecretAsset{}, nil
		}
		return nil, err
	}
	var items []DockerSecretAsset
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, err
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	return items, nil
}

func SaveDockerSecretAsset(environmentID string, item DockerSecretAsset) (DockerSecretAsset, error) {
	items, err := ListDockerSecretAssets(environmentID)
	if err != nil {
		return DockerSecretAsset{}, err
	}
	item.Name = strings.TrimSpace(item.Name)
	item.UpdatedAt = time.Now().UTC()
	found := false
	for index := range items {
		if items[index].Name == item.Name {
			items[index] = item
			found = true
			break
		}
	}
	if !found {
		items = append(items, item)
	}
	if err := writeDockerSecretAssets(environmentID, items); err != nil {
		return DockerSecretAsset{}, err
	}
	return item, nil
}

func DeleteDockerSecretAsset(environmentID, name string) error {
	items, err := ListDockerSecretAssets(environmentID)
	if err != nil {
		return err
	}
	filtered := make([]DockerSecretAsset, 0, len(items))
	for _, item := range items {
		if item.Name != strings.TrimSpace(name) {
			filtered = append(filtered, item)
		}
	}
	return writeDockerSecretAssets(environmentID, filtered)
}

func StartDockerStack(name string) error {
	detail, err := GetDockerStackDetail(name)
	if err != nil {
		return err
	}
	if strings.TrimSpace(detail.Compose) == "" {
		return fmt.Errorf("stack %s has no saved compose to start", name)
	}
	return runDockerStackDeploy(name, detail.CurrentPath, detail.Environment, detail.Mode)
}

func StopDockerStack(name string) error {
	detail, err := GetDockerStackDetail(name)
	if err == nil && strings.EqualFold(strings.TrimSpace(detail.Mode), "compose") {
		return runDockerComposeDown(name, detail.CurrentPath, detail.Environment)
	}
	return runCommand("docker", "stack", "rm", strings.TrimSpace(name))
}

func RemoveDockerStack(name string, purge bool) error {
	_ = StopDockerStack(name)
	if !purge {
		return nil
	}
	stackDir, err := ensureStackDir(name)
	if err != nil {
		return err
	}
	return os.RemoveAll(stackDir)
}

func InspectDockerNetworkConfig(networkID string) (*DockerNetworkConfig, error) {
	var payload []struct {
		ID       string            `json:"Id"`
		Name     string            `json:"Name"`
		Driver   string            `json:"Driver"`
		Scope    string            `json:"Scope"`
		Internal bool              `json:"Internal"`
		Labels   map[string]string `json:"Labels"`
	}
	if err := dockerNetworkInspect([]string{networkID}, &payload); err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, fmt.Errorf("network %s not found", networkID)
	}
	return &DockerNetworkConfig{
		ID:       payload[0].ID,
		Name:     payload[0].Name,
		Driver:   payload[0].Driver,
		Scope:    payload[0].Scope,
		Internal: payload[0].Internal,
		Labels:   payload[0].Labels,
	}, nil
}

func CreateDockerNetwork(config DockerNetworkConfig) error {
	args := []string{"network", "create"}
	if strings.TrimSpace(config.Driver) != "" {
		args = append(args, "--driver", strings.TrimSpace(config.Driver))
	}
	if config.Internal {
		args = append(args, "--internal")
	}
	for key, value := range config.Labels {
		if strings.TrimSpace(key) == "" {
			continue
		}
		args = append(args, "--label", fmt.Sprintf("%s=%s", key, value))
	}
	args = append(args, strings.TrimSpace(config.Name))
	return runCommand("docker", args...)
}

func UpdateDockerNetwork(original string, config DockerNetworkConfig) error {
	if err := DeleteDockerNetwork(original); err != nil {
		return err
	}
	return CreateDockerNetwork(config)
}

func DeleteDockerNetwork(networkID string) error {
	return runCommand("docker", "network", "rm", strings.TrimSpace(networkID))
}

func InspectDockerVolumeConfig(name string) (*DockerVolumeConfig, error) {
	var payload []struct {
		Name       string            `json:"Name"`
		Driver     string            `json:"Driver"`
		Mountpoint string            `json:"Mountpoint"`
		Labels     map[string]string `json:"Labels"`
		Options    map[string]string `json:"Options"`
	}
	if err := dockerVolumeInspect([]string{name}, &payload); err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, fmt.Errorf("volume %s not found", name)
	}
	return &DockerVolumeConfig{
		Name:       payload[0].Name,
		Driver:     payload[0].Driver,
		Mountpoint: payload[0].Mountpoint,
		Labels:     payload[0].Labels,
		Options:    payload[0].Options,
	}, nil
}

func CreateDockerVolume(config DockerVolumeConfig) error {
	args := []string{"volume", "create"}
	if strings.TrimSpace(config.Driver) != "" {
		args = append(args, "--driver", strings.TrimSpace(config.Driver))
	}
	for key, value := range config.Labels {
		if strings.TrimSpace(key) == "" {
			continue
		}
		args = append(args, "--label", fmt.Sprintf("%s=%s", key, value))
	}
	for key, value := range config.Options {
		if strings.TrimSpace(key) == "" {
			continue
		}
		args = append(args, "--opt", fmt.Sprintf("%s=%s", key, value))
	}
	args = append(args, strings.TrimSpace(config.Name))
	return runCommand("docker", args...)
}

func UpdateDockerVolume(original string, config DockerVolumeConfig) error {
	if err := DeleteDockerVolume(original, true); err != nil {
		return err
	}
	return CreateDockerVolume(config)
}

func DeleteDockerVolume(name string, force bool) error {
	args := []string{"volume", "rm"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, strings.TrimSpace(name))
	return runCommand("docker", args...)
}

func FindRegistryCredential(id string) (*RegistryCredential, error) {
	items, err := ListRegistryCredentials()
	if err != nil {
		return nil, err
	}
	for index := range items {
		if items[index].ID == id {
			return &items[index], nil
		}
	}
	return nil, fmt.Errorf("registry credential %s not found", id)
}

func DockerLoginRegistry(item RegistryCredential) error {
	if item.IsAnonymous {
		return nil
	}
	secret := strings.TrimSpace(item.Token)
	if secret == "" {
		secret = strings.TrimSpace(item.Password)
	}
	if strings.TrimSpace(item.Username) == "" || secret == "" {
		return fmt.Errorf("username and password/token are required")
	}
	cmd := exec.Command("docker", "login", strings.TrimSpace(item.URL), "-u", strings.TrimSpace(item.Username), "--password-stdin")
	cmd.Stdin = strings.NewReader(secret)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker login failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func StreamReaderChunks(reader io.Reader, callback func([]byte) error) error {
	buffer := make([]byte, 4096)
	for {
		count, err := reader.Read(buffer)
		if count > 0 {
			chunk := make([]byte, count)
			copy(chunk, buffer[:count])
			if callbackErr := callback(chunk); callbackErr != nil {
				return callbackErr
			}
		}
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
	}
}

func PullDockerImageWithCredential(imageName, registryID string) error {
	if strings.TrimSpace(registryID) != "" {
		selected, err := FindRegistryCredential(registryID)
		if err != nil {
			return err
		}
		if err := DockerLoginRegistry(*selected); err != nil {
			return err
		}
	} else {
		items, err := ListRegistryCredentials()
		if err == nil {
			for index := range items {
				if items[index].IsDefault {
					if err := DockerLoginRegistry(items[index]); err == nil {
						break
					}
				}
			}
		}
	}
	return runCommand("docker", "pull", strings.TrimSpace(imageName))
}

func RemoveDockerImage(imageRef string, force bool) error {
	args := []string{"image", "rm"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, strings.TrimSpace(imageRef))
	output, err := exec.Command("docker", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker image rm failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func PushDockerImage(imageRef, registryID string) error {
	if strings.TrimSpace(registryID) != "" {
		selected, err := FindRegistryCredential(registryID)
		if err != nil {
			return err
		}
		if err := DockerLoginRegistry(*selected); err != nil {
			return err
		}
	}
	output, err := exec.Command("docker", "push", strings.TrimSpace(imageRef)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker push failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func ExportDockerImage(imageRef string) (string, error) {
	if strings.TrimSpace(imageRef) == "" {
		return "", fmt.Errorf("image reference is required")
	}
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	exportDir := filepath.Join(root, "docker-image-exports")
	if err := os.MkdirAll(exportDir, 0o755); err != nil {
		return "", err
	}
	fileName := sanitizeFileName(strings.ReplaceAll(strings.TrimSpace(imageRef), ":", "_")) + "-" + time.Now().UTC().Format("20060102-150405") + ".tar.gz"
	outputPath := filepath.Join(exportDir, fileName)
	file, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	gzipWriter := gzip.NewWriter(file)
	cmd := exec.Command("docker", "save", strings.TrimSpace(imageRef))
	cmd.Stdout = gzipWriter
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		_ = gzipWriter.Close()
		_ = os.Remove(outputPath)
		return "", fmt.Errorf("docker save failed: %s", strings.TrimSpace(stderr.String()))
	}
	if err := gzipWriter.Close(); err != nil {
		_ = os.Remove(outputPath)
		return "", err
	}
	return outputPath, nil
}

func ImportDockerImageArchive(file multipart.File, fileName string) (*DockerImageImportResult, error) {
	return ImportDockerImageArchiveStreamContext(context.Background(), file, fileName, io.Discard)
}

func ImportDockerImageArchiveStream(file multipart.File, fileName string, output io.Writer) (*DockerImageImportResult, error) {
	return ImportDockerImageArchiveStreamContext(context.Background(), file, fileName, output)
}

func ImportDockerImageArchiveStreamContext(ctx context.Context, file multipart.File, fileName string, output io.Writer) (*DockerImageImportResult, error) {
	tempFile, err := os.CreateTemp("", "docker-image-import-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		return nil, err
	}
	if _, err := tempFile.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}

	loadPath := tempFile.Name()
	if isCompressedArchive(fileName) {
		uncompressedPath := tempFile.Name() + ".tar"
		if err := decompressGzipFile(tempFile.Name(), uncompressedPath); err != nil {
			return nil, err
		}
		defer os.Remove(uncompressedPath)
		loadPath = uncompressedPath
	}

	commandOutput, err := streamCommand(exec.CommandContext(ctx, "docker", "load", "-i", loadPath), output)
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return nil, fmt.Errorf("docker import cancelled")
		}
		return nil, fmt.Errorf("docker load failed: %s", strings.TrimSpace(commandOutput))
	}
	loadedImages := extractLoadedImages(commandOutput)
	return &DockerImageImportResult{
		LoadedImages: loadedImages,
		Output:       strings.TrimSpace(commandOutput),
	}, nil
}

func BuildDockerImage(environmentID, dockerfile, contextName string, file multipart.File, tags []string) (*DockerBuildHistoryRecord, error) {
	return BuildDockerImageStreamContext(context.Background(), environmentID, dockerfile, contextName, file, tags, io.Discard)
}

func BuildDockerImageStream(environmentID, dockerfile, contextName string, file multipart.File, tags []string, output io.Writer) (*DockerBuildHistoryRecord, error) {
	return BuildDockerImageStreamContext(context.Background(), environmentID, dockerfile, contextName, file, tags, output)
}

func BuildDockerImageStreamContext(ctx context.Context, environmentID, dockerfile, contextName string, file multipart.File, tags []string, output io.Writer) (*DockerBuildHistoryRecord, error) {
	storedContext, err := storeDockerBuildContext(environmentID, contextName, file)
	if err != nil {
		return nil, err
	}
	return buildDockerImageFromStoredContext(ctx, environmentID, dockerfile, storedContext, tags, output)
}

func RebuildDockerImageStream(environmentID, historyID string, overrideTags []string, output io.Writer) (*DockerBuildHistoryRecord, error) {
	return RebuildDockerImageStreamContext(context.Background(), environmentID, historyID, overrideTags, output)
}

func RebuildDockerImageStreamContext(ctx context.Context, environmentID, historyID string, overrideTags []string, output io.Writer) (*DockerBuildHistoryRecord, error) {
	historyRecord, err := GetDockerBuildHistoryRecord(environmentID, historyID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(historyRecord.ContextPath) == "" {
		return nil, fmt.Errorf("build context is not available for rebuild")
	}
	storedContext := dockerStoredContext{
		ID:          historyRecord.ContextID,
		ArchivePath: historyRecord.ContextPath,
		ContextName: firstNonEmpty(historyRecord.ContextName, historyRecord.ArchiveName),
		ArchiveName: firstNonEmpty(historyRecord.ArchiveName, filepath.Base(historyRecord.ContextPath)),
		Size:        historyRecord.ContextSize,
	}
	return buildDockerImageFromStoredContext(ctx, environmentID, historyRecord.Dockerfile, storedContext, firstNonEmptySlice(overrideTags, historyRecord.Tags, splitCSV(historyRecord.Target)), output)
}

func buildDockerImageFromStoredContext(ctx context.Context, environmentID, dockerfile string, storedContext dockerStoredContext, tags []string, output io.Writer) (*DockerBuildHistoryRecord, error) {
	tempDir, err := os.MkdirTemp("", "docker-build-context-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	contextDir := filepath.Join(tempDir, "context")
	if err := os.MkdirAll(contextDir, 0o755); err != nil {
		return nil, err
	}
	if err := extractArchiveFile(storedContext.ArchivePath, contextDir); err != nil {
		return nil, err
	}

	trimmedDockerfile := firstNonEmpty(strings.TrimSpace(dockerfile), "Dockerfile")
	args := []string{"build", "-f", trimmedDockerfile}
	trimmedTags := make([]string, 0, len(tags))
	for _, tag := range tags {
		if trimmed := strings.TrimSpace(tag); trimmed != "" {
			trimmedTags = append(trimmedTags, trimmed)
			args = append(args, "-t", trimmed)
		}
	}
	args = append(args, contextDir)

	commandOutput, runErr := streamCommand(exec.CommandContext(ctx, "docker", args...), output)
	status := "success"
	if runErr != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			status = "cancelled"
		} else {
			status = "failed"
		}
	}
	record := &DockerBuildHistoryRecord{
		ID:            fmt.Sprintf("docker-build-%d", time.Now().UTC().UnixNano()),
		EnvironmentID: strings.TrimSpace(environmentID),
		CreatedAt:     time.Now().UTC(),
		Target:        strings.Join(trimmedTags, ", "),
		Dockerfile:    trimmedDockerfile,
		Status:        status,
		Output:        strings.TrimSpace(commandOutput),
		ContextName:   strings.TrimSpace(storedContext.ContextName),
		ContextID:     strings.TrimSpace(storedContext.ID),
		ContextPath:   strings.TrimSpace(storedContext.ArchivePath),
		ContextSize:   storedContext.Size,
		ArchiveName:   strings.TrimSpace(storedContext.ArchiveName),
		Tags:          append([]string(nil), trimmedTags...),
	}
	if appendErr := AppendDockerBuildHistory(*record); appendErr != nil {
		return nil, appendErr
	}
	if runErr != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return record, fmt.Errorf("docker build cancelled")
		}
		return record, fmt.Errorf("docker build failed: %s", strings.TrimSpace(commandOutput))
	}
	return record, nil
}

func GetDockerContainerStats(containerID string) (*DockerContainerStats, error) {
	output, err := exec.Command("docker", "stats", containerID, "--no-stream", "--format", "{{json .}}").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("docker stats failed: %s", strings.TrimSpace(string(output)))
	}
	var payload struct {
		CPUPerc  string `json:"CPUPerc"`
		MemUsage string `json:"MemUsage"`
		MemPerc  string `json:"MemPerc"`
		NetIO    string `json:"NetIO"`
		BlockIO  string `json:"BlockIO"`
		PIDs     string `json:"PIDs"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(output), &payload); err != nil {
		return &DockerContainerStats{RawPayload: strings.TrimSpace(string(output)), ReadAt: time.Now().UTC().Format(time.RFC3339)}, nil
	}
	return &DockerContainerStats{
		CPUPerc:    payload.CPUPerc,
		MemUsage:   payload.MemUsage,
		MemPerc:    payload.MemPerc,
		NetIO:      payload.NetIO,
		BlockIO:    payload.BlockIO,
		PIDs:       payload.PIDs,
		ReadAt:     time.Now().UTC().Format(time.RFC3339),
		RawPayload: strings.TrimSpace(string(output)),
	}, nil
}

func ListDockerContainerFiles(containerID, targetPath string) ([]DockerFileEntry, error) {
	containerPath := firstNonEmpty(strings.TrimSpace(targetPath), "/")
	// Use ls -apL to list files and follow symlink metadata to avoid copying to host.
	// We use -l --time-style=long-iso if available, or just -l.
	// Combining commands to be safe across different OSes (busybox vs coreutils).
	// We'll use a shell script via docker exec to get a standardized format.
	lsCmd := fmt.Sprintf("ls -ap -l --time-style=long-iso %s 2>/dev/null || ls -ap -l %s", containerPath, containerPath)
	output, err := exec.Command("docker", "exec", containerID, "sh", "-c", lsCmd).CombinedOutput()
	if err != nil {
		// If ls fails, it might be an empty directory or missing path, but docker exec might return non-zero.
		// Check if it's actually an error.
		if len(output) == 0 {
			return nil, fmt.Errorf("failed to list files in container: %v", err)
		}
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	items := make([]DockerFileEntry, 0)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "total ") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 8 {
			continue
		}

		// Typical ls -l output:
		// -rw-r--r--    1 root     root          1024 Jan 01 00:00 filename
		// or with long-iso:
		// -rw-r--r--    1 root     root          1024 2023-01-01 00:00 filename

		mode := parts[0]
		isDir := strings.HasPrefix(mode, "d")
		isLink := strings.HasPrefix(mode, "l")
		size, _ := strconv.ParseInt(parts[4], 10, 64)

		name := parts[len(parts)-1]
		if name == "." || name == ".." {
			continue
		}

		// Clean name from ls -p suffix (/)
		cleanName := strings.TrimSuffix(name, "/")
		
		var modified time.Time
		// Try to parse date from parts[5], parts[6], parts[7]
		// long-iso: 2023-01-01 00:00
		if len(parts) >= 8 {
			dateStr := parts[5] + " " + parts[6]
			if t, err := time.Parse("2006-01-02 15:04", dateStr); err == nil {
				modified = t
			} else {
				// Fallback to simpler parse if not long-iso (Jan 01 00:00)
				// Note: this is harder without year, so we just skip for now or use current year
				modified = time.Now()
			}
		}

		items = append(items, DockerFileEntry{
			Name:     cleanName,
			Path:     filepath.ToSlash(filepath.Join(containerPath, cleanName)),
			Size:     size,
			Mode:     mode,
			IsDir:    isDir || strings.HasSuffix(name, "/"),
			IsLink:   isLink,
			Modified: modified,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	return items, nil
}

func ReadDockerContainerFile(containerID, targetPath string) (string, error) {
	localPath, cleanup, err := copyDockerPathToTemp(containerID, targetPath)
	if err != nil {
		return "", err
	}
	defer cleanup()
	content, err := os.ReadFile(localPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func SaveDockerContainerFile(containerID, targetPath, content string) error {
	tempDir, err := os.MkdirTemp("", "docker-save-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)
	fileName := filepath.Base(strings.TrimSpace(targetPath))
	if fileName == "." || fileName == "" || fileName == string(filepath.Separator) {
		fileName = "file.txt"
	}
	localPath := filepath.Join(tempDir, fileName)
	if err := os.WriteFile(localPath, []byte(content), 0o644); err != nil {
		return err
	}
	output, err := exec.Command("docker", "cp", localPath, fmt.Sprintf("%s:%s", containerID, strings.TrimSpace(targetPath))).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker cp save failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func CopyDockerFileFromContainer(containerID, targetPath string) ([]byte, string, error) {
	localPath, cleanup, err := copyDockerPathToTemp(containerID, targetPath)
	if err != nil {
		return nil, "", err
	}
	defer cleanup()
	content, err := os.ReadFile(localPath)
	if err != nil {
		return nil, "", err
	}
	return content, filepath.Base(localPath), nil
}

func ArchiveDockerContainerPath(containerID, targetPath string) ([]byte, string, error) {
	localPath, cleanup, err := copyDockerPathToTemp(containerID, targetPath)
	if err != nil {
		return nil, "", err
	}
	defer cleanup()
	buffer := &bytes.Buffer{}
	gz := gzip.NewWriter(buffer)
	tw := tar.NewWriter(gz)
	info, err := os.Stat(localPath)
	if err != nil {
		return nil, "", err
	}
	baseName := info.Name()
	if baseName == "." || baseName == "" {
		baseName = "archive"
	}
	if info.IsDir() {
		if err := addDirectoryToTar(tw, localPath, baseName); err != nil {
			return nil, "", err
		}
	} else {
		if err := addSingleFileToTar(tw, localPath, baseName); err != nil {
			return nil, "", err
		}
	}
	if err := tw.Close(); err != nil {
		return nil, "", err
	}
	if err := gz.Close(); err != nil {
		return nil, "", err
	}
	return buffer.Bytes(), sanitizeFileName(baseName) + ".tar.gz", nil
}

func CopyDockerFileToContainer(containerID, targetPath string, file multipart.File) error {
	tempDir, err := os.MkdirTemp("", "docker-upload-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)

	targetName := filepath.Base(strings.TrimSpace(targetPath))
	if targetName == "." || targetName == string(filepath.Separator) || targetName == "" {
		targetName = "upload.bin"
	}
	localPath := filepath.Join(tempDir, targetName)
	out, err := os.Create(localPath)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, file); err != nil {
		_ = out.Close()
		return err
	}
	_ = out.Close()
	dest := strings.TrimSpace(targetPath)
	if dest == "" {
		dest = "/"
	}
	output, err := exec.Command("docker", "cp", localPath, fmt.Sprintf("%s:%s", containerID, dest)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker cp upload failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func ExtractArchiveToDockerContainer(containerID, targetPath string, file multipart.File) error {
	tempDir, err := os.MkdirTemp("", "docker-extract-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDir)
	archivePath := filepath.Join(tempDir, "archive.tar.gz")
	out, err := os.Create(archivePath)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, file); err != nil {
		_ = out.Close()
		return err
	}
	_ = out.Close()
	if err := extractTarGz(archivePath, tempDir); err != nil {
		return err
	}
	entries, err := os.ReadDir(tempDir)
	if err != nil {
		return err
	}
	dest := firstNonEmpty(strings.TrimSpace(targetPath), "/")
	for _, entry := range entries {
		if entry.Name() == "archive.tar.gz" {
			continue
		}
		output, err := exec.Command("docker", "cp", filepath.Join(tempDir, entry.Name()), fmt.Sprintf("%s:%s", containerID, dest)).CombinedOutput()
		if err != nil {
			return fmt.Errorf("docker archive extract failed: %s", strings.TrimSpace(string(output)))
		}
	}
	return nil
}

func DeleteDockerContainerFile(containerID, targetPath string) error {
	output, err := exec.Command("docker", "exec", containerID, "rm", "-rf", strings.TrimSpace(targetPath)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker exec rm failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func InspectDockerService(serviceName string) (*DockerServiceDetail, error) {
	var payload []struct {
		ID        string    `json:"ID"`
		CreatedAt time.Time `json:"CreatedAt"`
		UpdatedAt time.Time `json:"UpdatedAt"`
		Spec      struct {
			Name         string            `json:"Name"`
			Labels       map[string]string `json:"Labels"`
			TaskTemplate struct {
				ContainerSpec struct {
					Image   string   `json:"Image"`
					Env     []string `json:"Env"`
					Args    []string `json:"Args"`
					Command []string `json:"Command"`
				} `json:"ContainerSpec"`
				Networks []struct {
					Target string `json:"Target"`
				} `json:"Networks"`
			} `json:"TaskTemplate"`
			Mode struct {
				Replicated *struct {
					Replicas uint64 `json:"Replicas"`
				} `json:"Replicated"`
				Global any `json:"Global"`
			} `json:"Mode"`
			EndpointSpec struct {
				Mode  string `json:"Mode"`
				Ports []struct {
					Protocol      string `json:"Protocol"`
					TargetPort    uint32 `json:"TargetPort"`
					PublishedPort uint32 `json:"PublishedPort"`
				} `json:"Ports"`
			} `json:"EndpointSpec"`
		} `json:"Spec"`
	}
	if output, err := exec.Command("docker", "service", "inspect", strings.TrimSpace(serviceName)).CombinedOutput(); err != nil {
		return nil, fmt.Errorf("docker service inspect failed: %s", strings.TrimSpace(string(output)))
	} else if err := json.Unmarshal(output, &payload); err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, fmt.Errorf("service %s not found", serviceName)
	}
	item := payload[0]
	replicas := "global"
	mode := "global"
	if item.Spec.Mode.Replicated != nil {
		mode = "replicated"
		replicas = strconv.FormatUint(item.Spec.Mode.Replicated.Replicas, 10)
	}
	ports := make([]string, 0, len(item.Spec.EndpointSpec.Ports))
	for _, port := range item.Spec.EndpointSpec.Ports {
		ports = append(ports, fmt.Sprintf("%d:%d/%s", port.PublishedPort, port.TargetPort, strings.ToLower(port.Protocol)))
	}
	networks := make([]string, 0, len(item.Spec.TaskTemplate.Networks))
	for _, network := range item.Spec.TaskTemplate.Networks {
		networks = append(networks, network.Target)
	}
	return &DockerServiceDetail{
		ID:           item.ID,
		Name:         item.Spec.Name,
		Image:        item.Spec.TaskTemplate.ContainerSpec.Image,
		Mode:         mode,
		Replicas:     replicas,
		Ports:        strings.Join(ports, ", "),
		Labels:       item.Spec.Labels,
		Command:      item.Spec.TaskTemplate.ContainerSpec.Command,
		Arguments:    item.Spec.TaskTemplate.ContainerSpec.Args,
		Env:          item.Spec.TaskTemplate.ContainerSpec.Env,
		Networks:     networks,
		CreatedAt:    item.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    item.UpdatedAt.Format(time.RFC3339),
		Stack:        item.Spec.Labels["com.docker.stack.namespace"],
		EndpointMode: item.Spec.EndpointSpec.Mode,
	}, nil
}

func GetDockerServiceLogs(serviceName string, tail int) (string, error) {
	output, err := exec.Command("docker", "service", "logs", "--tail", strconv.Itoa(tail), strings.TrimSpace(serviceName)).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker service logs failed: %s", strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func RestartDockerService(serviceName string) error {
	output, err := exec.Command("docker", "service", "update", "--force", strings.TrimSpace(serviceName)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker service update failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func AttachDockerNetwork(networkID, containerID string) error {
	return runCommand("docker", "network", "connect", strings.TrimSpace(networkID), strings.TrimSpace(containerID))
}

func DetachDockerNetwork(networkID, containerID string, force bool) error {
	args := []string{"network", "disconnect"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, strings.TrimSpace(networkID), strings.TrimSpace(containerID))
	return runCommand("docker", args...)
}

func ListDockerVolumeFiles(volumeName, targetPath string) ([]DockerFileEntry, error) {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return nil, err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return nil, err
	}
	info, err := os.Stat(fullPath)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return []DockerFileEntry{dockerFileEntryFromInfo(fullPath, info, targetPath)}, nil
	}
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return nil, err
	}
	items := make([]DockerFileEntry, 0, len(entries))
	for _, entry := range entries {
		childInfo, err := entry.Info()
		if err != nil {
			continue
		}
		items = append(items, dockerFileEntryFromInfo(filepath.Join(fullPath, entry.Name()), childInfo, filepath.Join(firstNonEmpty(strings.TrimSpace(targetPath), "/"), entry.Name())))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})
	return items, nil
}

func ReadDockerVolumeFile(volumeName, targetPath string) (string, error) {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return "", err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return "", err
	}
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func SaveDockerVolumeFile(volumeName, targetPath, content string) error {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, []byte(content), 0o644)
}

func CopyDockerFileFromVolume(volumeName, targetPath string) ([]byte, string, error) {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return nil, "", err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return nil, "", err
	}
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, "", err
	}
	return content, filepath.Base(fullPath), nil
}

func CopyDockerFileToVolume(volumeName, targetPath string, file multipart.File) error {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return err
	}
	out, err := os.Create(fullPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, file)
	return err
}

func DeleteDockerVolumeFile(volumeName, targetPath string) error {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return err
	}
	fullPath, err := resolveVolumePath(volume.Mountpoint, targetPath)
	if err != nil {
		return err
	}
	return os.RemoveAll(fullPath)
}

func BackupDockerVolume(volumeName string) (string, error) {
	volume, err := InspectDockerVolumeConfig(volumeName)
	if err != nil {
		return "", err
	}
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	backupDir := filepath.Join(root, "docker", "volume-backups")
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		return "", err
	}
	backupPath := filepath.Join(backupDir, fmt.Sprintf("%s-%s.tar.gz", sanitizeFileName(volumeName), time.Now().UTC().Format("20060102-150405")))
	file, err := os.Create(backupPath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	gz := gzip.NewWriter(file)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()
	if err := addDirectoryToTar(tw, volume.Mountpoint, "."); err != nil {
		return "", err
	}
	return backupPath, nil
}

func CloneDockerVolume(sourceVolume, targetVolume string) error {
	source, err := InspectDockerVolumeConfig(sourceVolume)
	if err != nil {
		return err
	}
	if _, err := InspectDockerVolumeConfig(targetVolume); err != nil {
		if err := CreateDockerVolume(DockerVolumeConfig{Name: targetVolume, Driver: source.Driver, Labels: source.Labels, Options: source.Options}); err != nil {
			return err
		}
	}
	target, err := InspectDockerVolumeConfig(targetVolume)
	if err != nil {
		return err
	}
	return copyDirectoryContents(source.Mountpoint, target.Mountpoint)
}

func BrowseRegistryCatalog(registryID string, repository string) (*DockerRegistryCatalog, error) {
	registry, err := FindRegistryCredential(registryID)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 20 * time.Second}
	baseURL := strings.TrimRight(strings.TrimSpace(registry.URL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(registry.Registry), "/")
	}
	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}
	catalog := &DockerRegistryCatalog{
		RegistryID:   registry.ID,
		RegistryName: registry.Name,
		Repositories: []string{},
		Tags:         map[string][]string{},
	}
	if strings.TrimSpace(repository) == "" {
		responseBody, err := doRegistryRequest(client, registry, fmt.Sprintf("%s/v2/_catalog?n=100", baseURL))
		if err != nil {
			return nil, err
		}
		var payload struct {
			Repositories []string `json:"repositories"`
		}
		if err := json.Unmarshal(responseBody, &payload); err != nil {
			return nil, err
		}
		catalog.Repositories = payload.Repositories
		return catalog, nil
	}
	responseBody, err := doRegistryRequest(client, registry, fmt.Sprintf("%s/v2/%s/tags/list", baseURL, url.PathEscape(strings.TrimSpace(repository))))
	if err != nil {
		return nil, err
	}
	var payload struct {
		Name string   `json:"name"`
		Tags []string `json:"tags"`
	}
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return nil, err
	}
	catalog.Repositories = []string{payload.Name}
	catalog.Tags[payload.Name] = payload.Tags
	return catalog, nil
}

func RetagDockerImage(sourceRef, targetRef string) error {
	output, err := exec.Command("docker", "tag", strings.TrimSpace(sourceRef), strings.TrimSpace(targetRef)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker tag failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func DeleteRegistryTag(registryID, repository, tag string) error {
	registry, err := FindRegistryCredential(registryID)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	baseURL := strings.TrimRight(strings.TrimSpace(registry.URL), "/")
	if baseURL == "" {
		baseURL = strings.TrimRight(strings.TrimSpace(registry.Registry), "/")
	}
	if !strings.HasPrefix(baseURL, "http://") && !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}
	manifestURL := fmt.Sprintf("%s/v2/%s/manifests/%s", baseURL, url.PathEscape(strings.TrimSpace(repository)), url.PathEscape(strings.TrimSpace(tag)))
	req, err := http.NewRequest(http.MethodGet, manifestURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json")
	secret := strings.TrimSpace(registry.Token)
	if strings.TrimSpace(registry.Username) != "" && secret == "" {
		secret = strings.TrimSpace(registry.Password)
	}
	if strings.TrimSpace(registry.Username) != "" && secret != "" {
		req.SetBasicAuth(strings.TrimSpace(registry.Username), secret)
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	digest := strings.TrimSpace(resp.Header.Get("Docker-Content-Digest"))
	if digest == "" {
		return fmt.Errorf("registry did not return manifest digest for %s:%s", repository, tag)
	}
	deleteReq, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/v2/%s/manifests/%s", baseURL, url.PathEscape(strings.TrimSpace(repository)), url.PathEscape(digest)), nil)
	if err != nil {
		return err
	}
	if strings.TrimSpace(registry.Username) != "" && secret != "" {
		deleteReq.SetBasicAuth(strings.TrimSpace(registry.Username), secret)
	}
	deleteResp, err := client.Do(deleteReq)
	if err != nil {
		return err
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode >= 400 {
		body, _ := io.ReadAll(deleteResp.Body)
		return fmt.Errorf("registry tag delete failed: %s", strings.TrimSpace(string(body)))
	}
	return nil
}

func AppendRuntimeAudit(record RuntimeAuditRecord) error {
	items, err := ListRuntimeAudit(record.EnvironmentID, 500)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if strings.TrimSpace(record.ID) == "" {
		record.ID = fmt.Sprintf("audit-%d", now.UnixNano())
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}
	items = append([]RuntimeAuditRecord{record}, items...)
	if len(items) > 1000 {
		items = items[:1000]
	}
	return writeRuntimeAudit(items)
}

func ListRuntimeAudit(environmentID string, limit int) ([]RuntimeAuditRecord, error) {
	return ListRuntimeAuditFiltered(RuntimeAuditFilterOptions{
		EnvironmentID: environmentID,
		Limit:         limit,
	})
}

func ListRuntimeAuditFiltered(options RuntimeAuditFilterOptions) ([]RuntimeAuditRecord, error) {
	path, err := runtimeAuditFilePath()
	if err != nil {
		return nil, err
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []RuntimeAuditRecord{}, nil
		}
		return nil, err
	}
	var items []RuntimeAuditRecord
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, err
	}
	filtered := make([]RuntimeAuditRecord, 0, len(items))
	from := parseAuditTime(options.From, false)
	to := parseAuditTime(options.To, true)
	search := strings.ToLower(strings.TrimSpace(options.Search))
	status := strings.ToLower(strings.TrimSpace(options.Status))
	action := strings.ToLower(strings.TrimSpace(options.Action))
	actor := strings.ToLower(strings.TrimSpace(options.Actor))
	resourceType := strings.ToLower(strings.TrimSpace(options.ResourceType))
	tag := strings.ToLower(strings.TrimSpace(options.Tag))
	for _, item := range items {
		if trimmedEnv := strings.TrimSpace(options.EnvironmentID); trimmedEnv != "" && item.EnvironmentID != trimmedEnv {
			continue
		}
		if status != "" && strings.ToLower(strings.TrimSpace(item.Status)) != status {
			continue
		}
		if action != "" && strings.ToLower(strings.TrimSpace(item.Action)) != action {
			continue
		}
		if actor != "" && strings.ToLower(strings.TrimSpace(item.Actor)) != actor {
			continue
		}
		if resourceType != "" && strings.ToLower(strings.TrimSpace(item.ResourceType)) != resourceType {
			continue
		}
		if !from.IsZero() && item.CreatedAt.Before(from) {
			continue
		}
		if !to.IsZero() && item.CreatedAt.After(to) {
			continue
		}
		itemTags := extractAuditTags(item.Metadata)
		if tag != "" && !containsFolded(itemTags, tag) {
			continue
		}
		if search != "" {
			blob := strings.ToLower(strings.Join([]string{
				item.Action,
				item.ResourceType,
				item.ResourceID,
				item.Status,
				item.Actor,
				item.Details,
				strings.Join(itemTags, " "),
				stringifyMetadata(item.Metadata),
			}, " "))
			if !strings.Contains(blob, search) {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].CreatedAt.After(filtered[j].CreatedAt) })
	if options.Limit > 0 && len(filtered) > options.Limit {
		filtered = filtered[:options.Limit]
	}
	return filtered, nil
}

func AppendDockerBuildHistory(record DockerBuildHistoryRecord) error {
	items, err := ListDockerBuildHistory(record.EnvironmentID, 200)
	if err != nil {
		return err
	}
	if strings.TrimSpace(record.ID) == "" {
		record.ID = fmt.Sprintf("docker-build-%d", time.Now().UTC().UnixNano())
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now().UTC()
	}
	items = append([]DockerBuildHistoryRecord{record}, items...)
	if len(items) > 500 {
		items = items[:500]
	}
	return writeDockerBuildHistory(items)
}

func ListDockerBuildHistory(environmentID string, limit int) ([]DockerBuildHistoryRecord, error) {
	path, err := dockerBuildHistoryFilePath()
	if err != nil {
		return nil, err
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []DockerBuildHistoryRecord{}, nil
		}
		return nil, err
	}
	var items []DockerBuildHistoryRecord
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, err
	}
	filtered := make([]DockerBuildHistoryRecord, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(environmentID) == "" || item.EnvironmentID == environmentID {
			filtered = append(filtered, item)
		}
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].CreatedAt.After(filtered[j].CreatedAt) })
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}
	return filtered, nil
}

func GetDockerBuildHistoryRecord(environmentID, historyID string) (*DockerBuildHistoryRecord, error) {
	items, err := ListDockerBuildHistory(environmentID, 500)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if item.ID == strings.TrimSpace(historyID) {
			record := item
			return &record, nil
		}
	}
	return nil, fmt.Errorf("build history record not found")
}

func BuildDockerTopology() (*DockerTopology, error) {
	containers, err := ListDockerContainers(true)
	if err != nil {
		return nil, err
	}
	networks, err := ListDockerNetworks()
	if err != nil {
		return nil, err
	}
	volumes, err := ListDockerVolumes()
	if err != nil {
		return nil, err
	}

	nodes := make([]DockerTopologyNode, 0, len(containers)+len(networks)+len(volumes))
	edges := make([]DockerTopologyEdge, 0)
	seenNodes := map[string]struct{}{}

	addNode := func(node DockerTopologyNode) {
		if _, exists := seenNodes[node.ID]; exists {
			return
		}
		seenNodes[node.ID] = struct{}{}
		nodes = append(nodes, node)
	}

	for _, network := range networks {
		addNode(DockerTopologyNode{
			ID:     "network:" + network.Id,
			Label:  network.Name,
			Kind:   "network",
			Status: network.Scope,
			Metadata: map[string]any{
				"driver":   network.Driver,
				"internal": network.Internal,
				"scope":    network.Scope,
			},
		})
	}

	for _, volume := range volumes {
		addNode(DockerTopologyNode{
			ID:     "volume:" + volume.Name,
			Label:  volume.Name,
			Kind:   "volume",
			Status: volume.Driver,
			Metadata: map[string]any{
				"mountpoint": volume.Mountpoint,
				"driver":     volume.Driver,
			},
		})
	}

	type containerInspect struct {
		ID     string `json:"Id"`
		Name   string `json:"Name"`
		Config struct {
			Labels map[string]string `json:"Labels"`
		} `json:"Config"`
		NetworkSettings struct {
			Networks map[string]struct {
				NetworkID string `json:"NetworkID"`
			} `json:"Networks"`
		} `json:"NetworkSettings"`
		Mounts []struct {
			Type   string `json:"Type"`
			Name   string `json:"Name"`
			Source string `json:"Source"`
		} `json:"Mounts"`
	}

	for _, container := range containers {
		containerName := strings.TrimPrefix(firstString(container.Names), "/")
		addNode(DockerTopologyNode{
			ID:     "container:" + container.Id,
			Label:  containerName,
			Kind:   "container",
			Status: container.State,
			Metadata: map[string]any{
				"image":  container.Image,
				"status": container.Status,
				"labels": container.Labels,
			},
		})

		output, err := exec.Command("docker", "inspect", container.Id).CombinedOutput()
		if err != nil {
			continue
		}
		var details []containerInspect
		if err := json.Unmarshal(output, &details); err != nil || len(details) == 0 {
			continue
		}
		for networkName, network := range details[0].NetworkSettings.Networks {
			target := "network:" + network.NetworkID
			if network.NetworkID == "" {
				target = "network:" + networkName
				addNode(DockerTopologyNode{
					ID:    target,
					Label: networkName,
					Kind:  "network",
				})
			}
			edges = append(edges, DockerTopologyEdge{
				ID:     fmt.Sprintf("edge-%s-%s", container.Id, target),
				Source: "container:" + container.Id,
				Target: target,
				Label:  "attached",
			})
		}
		for _, mount := range details[0].Mounts {
			target := "volume:" + mount.Name
			label := "mounted"
			if mount.Type == "bind" || strings.TrimSpace(mount.Name) == "" {
				target = "bind:" + sanitizeFileName(mount.Source)
				label = "bind"
				addNode(DockerTopologyNode{
					ID:    target,
					Label: mount.Source,
					Kind:  "bind",
				})
			}
			edges = append(edges, DockerTopologyEdge{
				ID:     fmt.Sprintf("edge-%s-%s", container.Id, target),
				Source: "container:" + container.Id,
				Target: target,
				Label:  label,
			})
		}
	}

	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].Kind < nodes[j].Kind || (nodes[i].Kind == nodes[j].Kind && nodes[i].Label < nodes[j].Label)
	})
	sort.Slice(edges, func(i, j int) bool { return edges[i].ID < edges[j].ID })

	return &DockerTopology{Nodes: nodes, Edges: edges}, nil
}

func ListDockerAutoHealPolicies(environmentID string) ([]DockerAutoHealPolicy, error) {
	path, err := dockerAutoHealFilePath()
	if err != nil {
		return nil, err
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []DockerAutoHealPolicy{}, nil
		}
		return nil, err
	}
	var items []DockerAutoHealPolicy
	if err := json.Unmarshal(payload, &items); err != nil {
		return nil, err
	}
	filtered := make([]DockerAutoHealPolicy, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(environmentID) == "" || item.EnvironmentID == environmentID {
			filtered = append(filtered, item)
		}
	}
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].CreatedAt.After(filtered[j].CreatedAt) })
	return filtered, nil
}

func SaveDockerAutoHealPolicy(policy DockerAutoHealPolicy) (DockerAutoHealPolicy, error) {
	items, err := ListDockerAutoHealPolicies("")
	if err != nil {
		return DockerAutoHealPolicy{}, err
	}
	now := time.Now().UTC()
	if strings.TrimSpace(policy.ID) == "" {
		policy.ID = fmt.Sprintf("autoheal-%d", now.UnixNano())
		policy.CreatedAt = now
	}
	if policy.CreatedAt.IsZero() {
		policy.CreatedAt = now
	}
	if policy.IntervalMinutes <= 0 {
		policy.IntervalMinutes = 5
	}
	if strings.TrimSpace(policy.Action) == "" {
		policy.Action = "restart"
	}
	policy.UpdatedAt = now
	found := false
	for index := range items {
		if items[index].ID == policy.ID {
			policy.CreatedAt = items[index].CreatedAt
			items[index] = policy
			found = true
			break
		}
	}
	if !found {
		items = append(items, policy)
	}
	if err := writeDockerAutoHealPolicies(items); err != nil {
		return DockerAutoHealPolicy{}, err
	}
	return policy, nil
}

func DeleteDockerAutoHealPolicy(policyID string) error {
	items, err := ListDockerAutoHealPolicies("")
	if err != nil {
		return err
	}
	filtered := make([]DockerAutoHealPolicy, 0, len(items))
	for _, item := range items {
		if item.ID != policyID {
			filtered = append(filtered, item)
		}
	}
	return writeDockerAutoHealPolicies(filtered)
}

func RunDockerAutoHealPolicies(environmentID string, policyID string) ([]DockerAutoHealPolicy, error) {
	manualRun := policyID != ""
	policies, err := ListDockerAutoHealPolicies(environmentID)
	if err != nil {
		return nil, err
	}
	containers, err := ListDockerContainers(true)
	if err != nil {
		return nil, err
	}
	allPolicies, err := ListDockerAutoHealPolicies("")
	if err != nil {
		return nil, err
	}
	updatedMap := make(map[string]DockerAutoHealPolicy, len(allPolicies))
	for _, p := range allPolicies {
		updatedMap[p.ID] = p
	}

	for _, policy := range policies {
		if manualRun && policy.ID != policyID {
			continue
		}
		if !manualRun && !policy.Enabled {
			continue
		}
		if !manualRun && !shouldRunPolicy(policy, time.Now().UTC()) {
			continue
		}
		outcome := "no_match"
		for _, container := range containers {
			if !matchesPolicyContainer(policy, container) {
				continue
			}
			state, health := inspectDockerContainerState(container.Id)
			if !manualRun && !containerMatchesTrigger(policy.Trigger, state, health) {
				continue
			}
			if strings.EqualFold(policy.Action, "restart") {
				if err := RestartDockerContainer(container.Id); err != nil {
					outcome = "restart_failed"
				} else {
					outcome = "restarted"
					_ = AppendRuntimeAudit(RuntimeAuditRecord{
						EnvironmentID: policy.EnvironmentID,
						Action:        "docker.autoheal.restart",
						ResourceType:  "container",
						ResourceID:    container.Id,
						Status:        "success",
						Details:       fmt.Sprintf("Auto-heal restarted %s via policy %s", strings.TrimPrefix(firstString(container.Names), "/"), policy.Name),
						Metadata: map[string]any{
							"policy_id": policy.ID,
							"trigger":   policy.Trigger,
							"manual":    manualRun,
						},
						CreatedAt: time.Now().UTC(),
					})
				}
			}
		}
		policy.LastRunAt = time.Now().UTC()
		policy.LastOutcome = outcome
		policy.UpdatedAt = time.Now().UTC()
		updatedMap[policy.ID] = policy
	}

	merged := make([]DockerAutoHealPolicy, 0, len(updatedMap))
	for _, p := range updatedMap {
		merged = append(merged, p)
	}
	sort.Slice(merged, func(i, j int) bool { return merged[i].CreatedAt.Before(merged[j].CreatedAt) })
	if err := writeDockerAutoHealPolicies(merged); err != nil {
		return nil, err
	}
	result := make([]DockerAutoHealPolicy, 0, len(policies))
	for _, p := range merged {
		if p.EnvironmentID == environmentID {
			result = append(result, p)
		}
	}
	return result, nil
}

func RunAllDockerAutoHealPolicies() error {
	items, err := ListDockerAutoHealPolicies("")
	if err != nil {
		return err
	}
	seen := map[string]struct{}{}
	for _, item := range items {
		if strings.TrimSpace(item.EnvironmentID) == "" {
			continue
		}
		if _, exists := seen[item.EnvironmentID]; exists {
			continue
		}
		seen[item.EnvironmentID] = struct{}{}
		if _, err := RunDockerAutoHealPolicies(item.EnvironmentID, ""); err != nil {
			return err
		}
	}
	return nil
}

func ensureStackDir(name string) (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, "stacks", sanitizeFileName(name))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func listDockerStackRevisions(name string) ([]DockerStackRevision, error) {
	stackDir, err := ensureStackDir(name)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(filepath.Join(stackDir, "revisions"))
	if err != nil {
		if os.IsNotExist(err) {
			return []DockerStackRevision{}, nil
		}
		return nil, err
	}
	items := make([]DockerStackRevision, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".yml" {
			continue
		}
		info, _ := entry.Info()
		id := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		items = append(items, DockerStackRevision{
			ID:        id,
			CreatedAt: fileModTime(info),
			Path:      filepath.Join(stackDir, "revisions", entry.Name()),
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	return items, nil
}

type DockerDiskUsageObject struct {
	Type        string `json:"type"`
	TotalCount  int    `json:"total_count"`
	ActiveCount int    `json:"active_count"`
	Size        int64  `json:"size"`
	Reclaimable int64  `json:"reclaimable"`
	ReclaimPct  int    `json:"reclaim_pct"`
}

type DockerDiskUsage struct {
	LayersSize  int64                   `json:"layers_size"`
	Images      []DockerDiskUsageObject `json:"images"`
	Containers  []DockerDiskUsageObject `json:"containers"`
	Volumes     []DockerDiskUsageObject `json:"volumes"`
	BuildCache  []DockerDiskUsageObject `json:"build_cache"`
	TotalSize   int64                   `json:"total_size"`
	Reclaimable int64                   `json:"reclaimable"`
	Objects     []DockerDiskUsageObject `json:"objects"`
}

func GetDockerDiskUsage() (*DockerDiskUsage, error) {
	output, err := exec.Command("docker", "system", "df", "--format", "{{json .}}").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("docker system df failed: %s", strings.TrimSpace(string(output)))
	}

	type rawItem struct {
		Type        string `json:"Type"`
		TotalCount  string `json:"TotalCount"`
		Active      string `json:"Active"`
		Size        string `json:"Size"`
		Reclaimable string `json:"Reclaimable"`
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var result DockerDiskUsage
	var totalSize, reclaimable int64

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var item rawItem
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			continue
		}
		count := parseDockerDfInt(item.TotalCount)
		active := parseDockerDfInt(item.Active)
		size := parseDockerDfBytes(item.Size)
		reclStr := item.Reclaimable
		pct := 0
		if idx := strings.Index(reclStr, "("); idx != -1 && strings.Contains(reclStr, ")") {
			pctStr := reclStr[idx+1 : strings.Index(reclStr, ")")]
			pctStr = strings.TrimSuffix(strings.TrimSpace(pctStr), "%")
			pct = int(parseDockerDfFloat(pctStr))
			reclStr = strings.TrimSpace(reclStr[:idx])
		}
		recl := parseDockerDfBytes(reclStr)
		obj := DockerDiskUsageObject{
			Type:        item.Type,
			TotalCount:  count,
			ActiveCount: active,
			Size:        size,
			Reclaimable: recl,
			ReclaimPct:  pct,
		}
		result.Objects = append(result.Objects, obj)
		totalSize += size
		reclaimable += recl
	}

	result.TotalSize = totalSize
	result.Reclaimable = reclaimable
	return &result, nil
}

func parseDockerDfInt(s string) int {
	s = strings.TrimSpace(s)
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func parseDockerDfFloat(s string) float64 {
	var f float64
	fmt.Sscanf(strings.TrimSpace(s), "%f", &f)
	return f
}

func parseDockerDfBytes(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "0B" {
		return 0
	}
	suffixes := []struct {
		suffix     string
		multiplier int64
	}{
		{"TB", 1024 * 1024 * 1024 * 1024},
		{"GB", 1024 * 1024 * 1024},
		{"MB", 1024 * 1024},
		{"kB", 1024},
		{"KB", 1024},
		{"B", 1},
	}
	for _, su := range suffixes {
		if strings.HasSuffix(s, su.suffix) {
			numStr := strings.TrimSuffix(s, su.suffix)
			var f float64
			if _, err := fmt.Sscanf(strings.TrimSpace(numStr), "%f", &f); err == nil {
				return int64(f * float64(su.multiplier))
			}
		}
	}
	return 0
}

func writeStackAssets(stackDir, directory string, values map[string]string, mode os.FileMode) error {
	targetDir := filepath.Join(stackDir, directory)
	if err := os.RemoveAll(targetDir); err != nil {
		return err
	}
	if len(values) == 0 {
		return nil
	}
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}
	for key, value := range values {
		if err := os.WriteFile(filepath.Join(targetDir, sanitizeFileName(key)), []byte(value), mode); err != nil {
			return err
		}
	}
	return nil
}

func GetDockerSwarmStatus() (DockerSwarmStatus, error) {
	output, err := exec.Command("docker", "info", "--format", "{{json .Swarm}}").CombinedOutput()
	if err != nil {
		trimmed := strings.TrimSpace(string(output))
		if trimmed == "" {
			trimmed = err.Error()
		}
		return DockerSwarmStatus{}, fmt.Errorf("docker info failed: %s", trimmed)
	}
	var payload struct {
		LocalNodeState   string `json:"LocalNodeState"`
		ControlAvailable bool   `json:"ControlAvailable"`
		NodeID           string `json:"NodeID"`
		Error            string `json:"Error"`
	}
	if err := json.Unmarshal(output, &payload); err != nil {
		return DockerSwarmStatus{}, err
	}
	status := DockerSwarmStatus{
		LocalNodeState:   strings.TrimSpace(payload.LocalNodeState),
		ControlAvailable: payload.ControlAvailable,
		NodeID:           strings.TrimSpace(payload.NodeID),
		Error:            strings.TrimSpace(payload.Error),
	}
	status.IsActive = !strings.EqualFold(status.LocalNodeState, "inactive") && status.LocalNodeState != ""
	status.IsManager = status.IsActive && status.ControlAvailable
	return status, nil
}

func toSwarmRestartCondition(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "always", "unless-stopped":
		return "any"
	case "on-failure":
		return "on-failure"
	case "no":
		return "none"
	default:
		return ""
	}
}

func sanitizeComposeForSwarmStack(compose string) (string, []string, error) {
	var root yaml.Node
	if err := yaml.Unmarshal([]byte(compose), &root); err != nil {
		return "", nil, fmt.Errorf("invalid compose yaml: %w", err)
	}
	if len(root.Content) == 0 {
		return compose, nil, nil
	}
	document := root.Content[0]
	if document.Kind != yaml.MappingNode {
		return "", nil, fmt.Errorf("compose file must be a YAML mapping")
	}
	servicesNode := mappingValue(document, "services")
	if servicesNode == nil || servicesNode.Kind != yaml.MappingNode {
		return compose, nil, nil
	}
	warnings := []string{}
	for index := 0; index < len(servicesNode.Content); index += 2 {
		serviceName := strings.TrimSpace(servicesNode.Content[index].Value)
		serviceNode := servicesNode.Content[index+1]
		if serviceNode.Kind != yaml.MappingNode {
			continue
		}
		if mappingValue(serviceNode, "container_name") != nil {
			removeMappingKey(serviceNode, "container_name")
			warnings = append(warnings, fmt.Sprintf("%s: removed unsupported container_name for swarm stack deploy", serviceName))
		}
		restartNode := mappingValue(serviceNode, "restart")
		if restartNode != nil {
			condition := toSwarmRestartCondition(restartNode.Value)
			removeMappingKey(serviceNode, "restart")
			if condition != "" {
				deployNode := ensureMappingValue(serviceNode, "deploy")
				restartPolicyNode := ensureMappingValue(deployNode, "restart_policy")
				setMappingScalar(restartPolicyNode, "condition", condition)
			}
			warnings = append(warnings, fmt.Sprintf("%s: converted restart to deploy.restart_policy.condition for swarm", serviceName))
		}
	}
	payload, err := yaml.Marshal(document)
	if err != nil {
		return "", nil, err
	}
	return string(payload), warnings, nil
}

func sanitizeComposeForLocalCompose(compose string) (string, error) {
	var root yaml.Node
	if err := yaml.Unmarshal([]byte(compose), &root); err != nil {
		return "", fmt.Errorf("invalid compose yaml: %w", err)
	}
	if len(root.Content) == 0 {
		return compose, nil
	}
	document := root.Content[0]
	servicesNode := mappingValue(document, "services")
	if servicesNode == nil || servicesNode.Kind != yaml.MappingNode {
		return compose, nil
	}
	for index := 0; index < len(servicesNode.Content); index += 2 {
		serviceNode := servicesNode.Content[index+1]
		if serviceNode.Kind != yaml.MappingNode {
			continue
		}
		deployNode := mappingValue(serviceNode, "deploy")
		if deployNode == nil || deployNode.Kind != yaml.MappingNode {
			continue
		}
		restartPolicyNode := mappingValue(deployNode, "restart_policy")
		if restartPolicyNode != nil && restartPolicyNode.Kind == yaml.MappingNode {
			conditionNode := mappingValue(restartPolicyNode, "condition")
			if conditionNode != nil {
				restartValue := strings.TrimSpace(conditionNode.Value)
				switch restartValue {
				case "any":
					setMappingScalar(serviceNode, "restart", "unless-stopped")
				case "on-failure":
					setMappingScalar(serviceNode, "restart", "on-failure")
				case "none":
					setMappingScalar(serviceNode, "restart", "no")
				}
			}
		}
	}
	payload, err := yaml.Marshal(document)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func prepareComposeDeploymentPayload(compose string) (string, string, error) {
	swarmStatus, err := GetDockerSwarmStatus()
	if err != nil {
		return "", "", err
	}
	if swarmStatus.IsManager {
		sanitizedCompose, _, err := sanitizeComposeForSwarmStack(compose)
		if err != nil {
			return "", "", err
		}
		return "swarm", sanitizedCompose, nil
	}
	sanitizedCompose, err := sanitizeComposeForLocalCompose(compose)
	if err != nil {
		return "", "", err
	}
	return "compose", sanitizedCompose, nil
}

func mappingValue(node *yaml.Node, key string) *yaml.Node {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	for index := 0; index+1 < len(node.Content); index += 2 {
		if node.Content[index].Value == key {
			return node.Content[index+1]
		}
	}
	return nil
}

func ensureMappingValue(node *yaml.Node, key string) *yaml.Node {
	if existing := mappingValue(node, key); existing != nil {
		if existing.Kind == 0 {
			existing.Kind = yaml.MappingNode
			existing.Tag = "!!map"
		}
		return existing
	}
	keyNode := &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key}
	valueNode := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	node.Content = append(node.Content, keyNode, valueNode)
	return valueNode
}

func setMappingScalar(node *yaml.Node, key, value string) {
	if existing := mappingValue(node, key); existing != nil {
		existing.Kind = yaml.ScalarNode
		existing.Tag = "!!str"
		existing.Value = value
		return
	}
	node.Content = append(node.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key},
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: value},
	)
}

func removeMappingKey(node *yaml.Node, key string) {
	if node == nil || node.Kind != yaml.MappingNode {
		return
	}
	filtered := make([]*yaml.Node, 0, len(node.Content))
	for index := 0; index+1 < len(node.Content); index += 2 {
		if node.Content[index].Value == key {
			continue
		}
		filtered = append(filtered, node.Content[index], node.Content[index+1])
	}
	node.Content = filtered
}

func runDockerStackDeploy(name, composePath string, envVars map[string]string, mode string) error {
	if strings.EqualFold(strings.TrimSpace(mode), "compose") {
		return runDockerComposeUp(name, composePath, envVars)
	}
	cmd := exec.Command("docker", "stack", "deploy", "-c", composePath, strings.TrimSpace(name))
	cmd.Env = os.Environ()
	for key, value := range envVars {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker stack deploy failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func runDockerComposeUp(name, composePath string, envVars map[string]string) error {
	cmd := exec.Command("docker", "compose", "-p", strings.TrimSpace(name), "-f", composePath, "up", "-d")
	cmd.Env = os.Environ()
	for key, value := range envVars {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker compose up failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func runDockerComposeDown(name, composePath string, envVars map[string]string) error {
	cmd := exec.Command("docker", "compose", "-p", strings.TrimSpace(name), "-f", composePath, "down")
	cmd.Env = os.Environ()
	for key, value := range envVars {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("docker compose down failed: %s", strings.TrimSpace(string(output)))
	}
	return nil
}

func writeRegistryCredentials(items []RegistryCredential) error {
	path, err := registryFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

func registryFilePath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "registries.json"), nil
}

func runtimeAuditFilePath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "runtime-audit.json"), nil
}

func dockerBuildHistoryFilePath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "docker-build-history.json"), nil
}

func dockerBuildContextsRootPath(environmentID string) (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "docker-build-contexts", sanitizeFileName(environmentID)), nil
}

func DockerBuildContextsRootPath(environmentID string) (string, error) {
	return dockerBuildContextsRootPath(environmentID)
}

func dockerAutoHealFilePath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "docker-autoheal.json"), nil
}

func dockerSecretAssetsFilePath(environmentID string) (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "docker-secrets-"+sanitizeFileName(environmentID)+".json"), nil
}

func runtimeStateRoot() (string, error) {
	if env := strings.TrimSpace(os.Getenv("EINFRA_RUNTIME_STATE_DIR")); env != "" {
		return env, nil
	}
	if configDir, err := os.UserConfigDir(); err == nil {
		return filepath.Join(configDir, "einfra"), nil
	}
	return filepath.Join(".", ".einfra"), nil
}

func sanitizeFileName(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.ReplaceAll(value, " ", "-")
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.ReplaceAll(value, "\\", "-")
	if value == "" {
		return "default"
	}
	return value
}

func writeDockerBuildHistory(items []DockerBuildHistoryRecord) error {
	path, err := dockerBuildHistoryFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o644)
}

type dockerStoredContext struct {
	ID          string
	ArchivePath string
	ContextName string
	ArchiveName string
	Size        int64
}

type lockedBuffer struct {
	buffer bytes.Buffer
	mu     sync.Mutex
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.String()
}

func streamCommand(cmd *exec.Cmd, destination io.Writer) (string, error) {
	if destination == nil {
		destination = io.Discard
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", err
	}
	if err := cmd.Start(); err != nil {
		return "", err
	}
	buffer := &lockedBuffer{}
	combinedWriter := io.MultiWriter(buffer, destination)
	copyDone := make(chan error, 2)
	go func() {
		_, copyErr := io.Copy(combinedWriter, stdout)
		copyDone <- copyErr
	}()
	go func() {
		_, copyErr := io.Copy(combinedWriter, stderr)
		copyDone <- copyErr
	}()
	var copyErr error
	for i := 0; i < 2; i++ {
		if err := <-copyDone; err != nil && copyErr == nil {
			copyErr = err
		}
	}
	waitErr := cmd.Wait()
	if copyErr != nil {
		return strings.TrimSpace(buffer.String()), copyErr
	}
	return strings.TrimSpace(buffer.String()), waitErr
}

func storeDockerBuildContext(environmentID, contextName string, file multipart.File) (dockerStoredContext, error) {
	contextsRoot, err := dockerBuildContextsRootPath(environmentID)
	if err != nil {
		return dockerStoredContext{}, err
	}
	if err := os.MkdirAll(contextsRoot, 0o755); err != nil {
		return dockerStoredContext{}, err
	}
	contextID := fmt.Sprintf("build-context-%d", time.Now().UTC().UnixNano())
	archiveName := firstNonEmpty(strings.TrimSpace(contextName), "context.tar")
	archivePath := filepath.Join(contextsRoot, contextID+archiveExtension(archiveName))
	archiveFile, err := os.Create(archivePath)
	if err != nil {
		return dockerStoredContext{}, err
	}
	size, copyErr := io.Copy(archiveFile, file)
	closeErr := archiveFile.Close()
	if copyErr != nil {
		_ = os.Remove(archivePath)
		return dockerStoredContext{}, copyErr
	}
	if closeErr != nil {
		_ = os.Remove(archivePath)
		return dockerStoredContext{}, closeErr
	}
	return dockerStoredContext{
		ID:          contextID,
		ArchivePath: archivePath,
		ContextName: archiveName,
		ArchiveName: archiveName,
		Size:        size,
	}, nil
}

func archiveExtension(fileName string) string {
	trimmed := strings.ToLower(strings.TrimSpace(fileName))
	switch {
	case strings.HasSuffix(trimmed, ".tar.gz"):
		return ".tar.gz"
	case strings.HasSuffix(trimmed, ".tgz"):
		return ".tgz"
	case strings.HasSuffix(trimmed, ".tar"):
		return ".tar"
	default:
		if ext := filepath.Ext(trimmed); ext != "" {
			return ext
		}
		return ".tar"
	}
}

func splitCSV(value string) []string {
	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func firstNonEmptySlice(candidates ...[]string) []string {
	for _, candidate := range candidates {
		filtered := make([]string, 0, len(candidate))
		for _, item := range candidate {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				filtered = append(filtered, trimmed)
			}
		}
		if len(filtered) > 0 {
			return filtered
		}
	}
	return nil
}

func extractLoadedImages(output string) []string {
	lines := strings.Split(strings.ReplaceAll(output, "\r", ""), "\n")
	items := make([]string, 0, len(lines))
	seen := map[string]struct{}{}
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		for _, prefix := range []string{"Loaded image:", "Loaded image ID:"} {
			if strings.HasPrefix(trimmed, prefix) {
				value := strings.TrimSpace(strings.TrimPrefix(trimmed, prefix))
				if value != "" {
					if _, exists := seen[value]; !exists {
						seen[value] = struct{}{}
						items = append(items, value)
					}
				}
			}
		}
	}
	return items
}

func isCompressedArchive(fileName string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(fileName))
	return strings.HasSuffix(trimmed, ".tar.gz") || strings.HasSuffix(trimmed, ".tgz") || strings.HasSuffix(trimmed, ".gz")
}

func decompressGzipFile(sourcePath, targetPath string) error {
	in, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer in.Close()
	gz, err := gzip.NewReader(in)
	if err != nil {
		return err
	}
	defer gz.Close()
	out, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, gz)
	return err
}

func extractArchiveFile(archivePath, targetDir string) error {
	lower := strings.ToLower(strings.TrimSpace(archivePath))
	if strings.HasSuffix(lower, ".tar") {
		return extractTar(archivePath, targetDir)
	}
	return extractTarGz(archivePath, targetDir)
}

func extractTar(archivePath, targetDir string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()
	return extractTarStream(file, targetDir)
}

func fileModTime(info os.FileInfo) time.Time {
	if info == nil {
		return time.Time{}
	}
	return info.ModTime().UTC()
}

func writeRuntimeAudit(items []RuntimeAuditRecord) error {
	path, err := runtimeAuditFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

func writeDockerAutoHealPolicies(items []DockerAutoHealPolicy) error {
	path, err := dockerAutoHealFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

func writeDockerSecretAssets(environmentID string, items []DockerSecretAsset) error {
	path, err := dockerSecretAssetsFilePath(environmentID)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

func firstString(items []string) string {
	if len(items) == 0 {
		return ""
	}
	return items[0]
}

func inspectDockerContainerState(containerID string) (string, string) {
	type stateInspect struct {
		State struct {
			Status string `json:"Status"`
			Health struct {
				Status string `json:"Status"`
			} `json:"Health"`
		} `json:"State"`
	}
	output, err := exec.Command("docker", "inspect", containerID).CombinedOutput()
	if err != nil {
		return "", ""
	}
	var items []stateInspect
	if err := json.Unmarshal(output, &items); err != nil || len(items) == 0 {
		return "", ""
	}
	return strings.TrimSpace(items[0].State.Status), strings.TrimSpace(items[0].State.Health.Status)
}

func shouldRunPolicy(policy DockerAutoHealPolicy, now time.Time) bool {
	if policy.IntervalMinutes <= 0 || policy.LastRunAt.IsZero() {
		return true
	}
	return now.Sub(policy.LastRunAt) >= time.Duration(policy.IntervalMinutes)*time.Minute
}

func matchesPolicyContainer(policy DockerAutoHealPolicy, container DockerContainerInfo) bool {
	matchValue := strings.TrimSpace(policy.MatchValue)
	switch strings.ToLower(strings.TrimSpace(policy.TargetMode)) {
	case "all", "":
		return true
	case "name":
		for _, name := range container.Names {
			if strings.Contains(strings.TrimPrefix(name, "/"), matchValue) {
				return true
			}
		}
		return false
	case "label":
		for key, value := range container.Labels {
			pair := key
			if strings.TrimSpace(value) != "" {
				pair = key + "=" + value
			}
			if strings.EqualFold(pair, matchValue) || strings.EqualFold(key, matchValue) {
				return true
			}
		}
		return false
	default:
		return true
	}
}

func containerMatchesTrigger(trigger, state, health string) bool {
	switch strings.ToLower(strings.TrimSpace(trigger)) {
	case "unhealthy":
		return strings.EqualFold(health, "unhealthy")
	case "exited":
		return strings.EqualFold(state, "exited")
	case "stopped":
		return !strings.EqualFold(state, "running")
	default:
		return false
	}
}

func copyDockerPathToTemp(containerID, targetPath string) (string, func(), error) {
	tempDir, err := os.MkdirTemp("", "docker-copy-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(tempDir) }
	trimmed := strings.TrimSpace(targetPath)
	if trimmed == "" {
		trimmed = "/"
	}
	output, err := exec.Command("docker", "cp", fmt.Sprintf("%s:%s", containerID, trimmed), tempDir).CombinedOutput()
	if err != nil {
		cleanup()
		return "", nil, fmt.Errorf("docker cp failed: %s", strings.TrimSpace(string(output)))
	}
	localPath := filepath.Join(tempDir, filepath.Base(trimmed))
	if trimmed == "/" {
		localPath = tempDir
	}
	if _, statErr := os.Stat(localPath); statErr != nil {
		entries, readErr := os.ReadDir(tempDir)
		if readErr == nil && len(entries) == 1 {
			localPath = filepath.Join(tempDir, entries[0].Name())
		}
	}
	return localPath, cleanup, nil
}

func dockerFileEntryFromInfo(localPath string, info os.FileInfo, remotePath string) DockerFileEntry {
	return DockerFileEntry{
		Name:     info.Name(),
		Path:     filepath.ToSlash(remotePath),
		Size:     info.Size(),
		Mode:     info.Mode().String(),
		IsDir:    info.IsDir(),
		Modified: info.ModTime(),
	}
}

func resolveVolumePath(mountpoint, targetPath string) (string, error) {
	root := filepath.Clean(strings.TrimSpace(mountpoint))
	requested := filepath.Clean(filepath.Join(root, strings.TrimPrefix(strings.TrimSpace(targetPath), "/")))
	relative, err := filepath.Rel(root, requested)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(relative, "..") {
		return "", fmt.Errorf("path escapes volume root")
	}
	return requested, nil
}

func addDirectoryToTar(writer *tar.Writer, rootPath, prefix string) error {
	return filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(rootPath, path)
		if err != nil {
			return err
		}
		name := filepath.ToSlash(filepath.Join(prefix, relative))
		if relative == "." {
			name = prefix
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = name
		if err := writer.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		_, err = io.Copy(writer, file)
		return err
	})
}

func addSingleFileToTar(writer *tar.Writer, path, name string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}
	header.Name = filepath.ToSlash(name)
	if err := writer.WriteHeader(header); err != nil {
		return err
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(writer, file)
	return err
}

func copyDirectoryContents(source, target string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		if relative == "." {
			return os.MkdirAll(target, 0o755)
		}
		destination := filepath.Join(target, relative)
		if info.IsDir() {
			return os.MkdirAll(destination, info.Mode())
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		input, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(destination, input, info.Mode())
	})
}

func extractTarGz(archivePath, targetDir string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gz.Close()
	return extractTarStream(gz, targetDir)
}

func extractTarStream(reader io.Reader, targetDir string) error {
	tr := tar.NewReader(reader)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		destination := filepath.Join(targetDir, header.Name)
		if !strings.HasPrefix(filepath.Clean(destination), filepath.Clean(targetDir)) {
			return fmt.Errorf("archive path escapes target directory")
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(destination, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
				return err
			}
			out, err := os.Create(destination)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				_ = out.Close()
				return err
			}
			_ = out.Close()
		}
	}
}

func parseAuditTime(raw string, endOfDay bool) time.Time {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			if layout == "2006-01-02" && endOfDay {
				return parsed.Add(24*time.Hour - time.Nanosecond)
			}
			return parsed
		}
	}
	return time.Time{}
}

func extractAuditTags(metadata map[string]any) []string {
	if metadata == nil {
		return nil
	}
	raw := metadata["tags"]
	values := make([]string, 0)
	switch typed := raw.(type) {
	case []string:
		values = append(values, typed...)
	case []any:
		for _, item := range typed {
			if trimmed := strings.TrimSpace(fmt.Sprint(item)); trimmed != "" {
				values = append(values, trimmed)
			}
		}
	case string:
		for _, item := range strings.Split(typed, ",") {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				values = append(values, trimmed)
			}
		}
	}
	for key, value := range metadata {
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(key)), "einfra.tag.") {
			pair := strings.TrimSpace(fmt.Sprint(value))
			if pair != "" {
				values = append(values, pair)
			}
		}
	}
	return values
}

func containsFolded(items []string, expected string) bool {
	for _, item := range items {
		if strings.EqualFold(strings.TrimSpace(item), expected) {
			return true
		}
	}
	return false
}

func stringifyMetadata(metadata map[string]any) string {
	if len(metadata) == 0 {
		return ""
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return ""
	}
	return string(payload)
}

func doRegistryRequest(client *http.Client, registry *RegistryCredential, rawURL string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	secret := strings.TrimSpace(registry.Token)
	if strings.TrimSpace(registry.Username) != "" && secret == "" {
		secret = strings.TrimSpace(registry.Password)
	}
	if strings.TrimSpace(registry.Username) != "" && secret != "" {
		req.SetBasicAuth(strings.TrimSpace(registry.Username), secret)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("registry request failed: %s", strings.TrimSpace(string(body)))
	}
	return body, nil
}
