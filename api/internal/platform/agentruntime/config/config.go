package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

const (
	defaultConfigFile = "/etc/einfra-agent/config.yaml"
	defaultLogFile    = "/var/log/einfra-agent/agent.log"
	defaultGRPCPort   = 50051
)

type Config struct {
	ConfigFilePath      string
	Mode                string
	ControlPlaneURLs    []string
	GRPCURLs            []string
	AgentToken          string
	ServerID            string
	Version             string
	TenantID            string
	HeartbeatInterval   time.Duration
	ConnectTimeout      time.Duration
	HealthCheckTimeout  time.Duration
	HealthCheckPath     string
	BackoffInitial      time.Duration
	BackoffMax          time.Duration
	LogLevel            string
	LogFormat           string
	LogFilePath         string
	AllowedReadRoots    []string
	AllowedWriteRoots   []string
	PluginRoot          string
	MaxReadBytes        int64
	StreamChunkBytes    int
	MaxTailLines        int
	UpdateManifestURL   string
	UpdateCheckInterval time.Duration
	UpdateChannel       string
	UpdatePublicKey     string
	UpdateRetryInterval time.Duration
	UpdateMaxRetries    int
	DefaultGRPCPort     int
	TenantAllowlist     map[string]struct{}
	TenantDenylist      map[string]struct{}
	GroupAllowlist      map[string]struct{}
	GroupDenylist       map[string]struct{}
	GroupOperationRoles map[string]map[string]map[string]struct{}
}

type fileConfig struct {
	Mode                   string                         `yaml:"mode"`
	ControlPlaneURLs       []string                       `yaml:"control_plane_urls"`
	GRPCURLs               []string                       `yaml:"grpc_urls"`
	AgentToken             string                         `yaml:"agent_token"`
	ServerID               string                         `yaml:"server_id"`
	Version                string                         `yaml:"agent_version"`
	TenantID               string                         `yaml:"tenant_id"`
	HeartbeatSeconds       int                            `yaml:"heartbeat_interval_sec"`
	ConnectTimeoutSec      int                            `yaml:"connect_timeout_sec"`
	HealthTimeoutSec       int                            `yaml:"health_check_timeout_sec"`
	HealthCheckPath        string                         `yaml:"health_check_path"`
	BackoffInitialSec      int                            `yaml:"backoff_initial_sec"`
	BackoffMaxSec          int                            `yaml:"backoff_max_sec"`
	LogLevel               string                         `yaml:"log_level"`
	LogFormat              string                         `yaml:"log_format"`
	LogFilePath            string                         `yaml:"log_file_path"`
	AllowedReadRoots       []string                       `yaml:"allowed_read_roots"`
	AllowedWriteRoots      []string                       `yaml:"allowed_write_roots"`
	PluginRoot             string                         `yaml:"plugin_root"`
	MaxReadBytes           int64                          `yaml:"max_read_bytes"`
	StreamChunkBytes       int                            `yaml:"stream_chunk_bytes"`
	MaxTailLines           int                            `yaml:"max_tail_lines"`
	UpdateManifestURL      string                         `yaml:"update_manifest_url"`
	UpdateCheckIntervalSec int                            `yaml:"update_check_interval_sec"`
	UpdateChannel          string                         `yaml:"update_channel"`
	UpdatePublicKey        string                         `yaml:"update_public_key"`
	UpdateRetryIntervalSec int                            `yaml:"update_retry_interval_sec"`
	UpdateMaxRetries       int                            `yaml:"update_max_retries"`
	DefaultGRPCPort        int                            `yaml:"default_grpc_port"`
	TenantAllowlist        []string                       `yaml:"tenant_allowlist"`
	TenantDenylist         []string                       `yaml:"tenant_denylist"`
	GroupAllowlist         []string                       `yaml:"group_allowlist"`
	GroupDenylist          []string                       `yaml:"group_denylist"`
	GroupOperationRoles    map[string]map[string][]string `yaml:"group_operation_roles"`
}

func Load() (*Config, error) {
	cfg := defaultConfig()
	cfg.ConfigFilePath = resolveConfigPath()

	if err := applyFileConfig(cfg, cfg.ConfigFilePath); err != nil {
		return nil, err
	}
	applyEnvOverrides(cfg)
	cfg.normalize()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func defaultConfig() *Config {
	return &Config{
		Mode:                "auto",
		Version:             "1.0.0",
		HeartbeatInterval:   15 * time.Second,
		ConnectTimeout:      10 * time.Second,
		HealthCheckTimeout:  5 * time.Second,
		HealthCheckPath:     "/health",
		BackoffInitial:      2 * time.Second,
		BackoffMax:          60 * time.Second,
		LogLevel:            "info",
		LogFormat:           "json",
		LogFilePath:         defaultLogFile,
		AllowedReadRoots:    []string{"/etc", "/opt", "/srv", "/var", "/home", "/root", "/tmp"},
		AllowedWriteRoots:   []string{"/etc", "/opt", "/srv", "/var", "/home", "/root", "/tmp"},
		PluginRoot:          "/opt/einfra/plugins",
		MaxReadBytes:        2 * 1024 * 1024,
		StreamChunkBytes:    32 * 1024,
		MaxTailLines:        2000,
		UpdateCheckInterval: 30 * time.Minute,
		UpdateRetryInterval: 10 * time.Second,
		UpdateMaxRetries:    3,
		UpdateChannel:       "stable",
		DefaultGRPCPort:     defaultGRPCPort,
		TenantAllowlist:     map[string]struct{}{},
		TenantDenylist:      map[string]struct{}{},
		GroupAllowlist:      map[string]struct{}{},
		GroupDenylist:       map[string]struct{}{},
		GroupOperationRoles: map[string]map[string]map[string]struct{}{},
	}
}

func resolveConfigPath() string {
	path := strings.TrimSpace(os.Getenv("EINFRA_AGENT_CONFIG_FILE"))
	if path == "" {
		path = defaultConfigFile
	}
	return path
}

func applyFileConfig(cfg *Config, path string) error {
	if strings.TrimSpace(path) == "" {
		return nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read config file %s: %w", path, err)
	}

	var fc fileConfig
	if err := yaml.Unmarshal(raw, &fc); err != nil {
		return fmt.Errorf("parse config file %s: %w", path, err)
	}

	if fc.Mode != "" {
		cfg.Mode = fc.Mode
	}
	if len(fc.ControlPlaneURLs) > 0 {
		cfg.ControlPlaneURLs = append([]string(nil), fc.ControlPlaneURLs...)
	}
	if len(fc.GRPCURLs) > 0 {
		cfg.GRPCURLs = append([]string(nil), fc.GRPCURLs...)
	}
	if fc.AgentToken != "" {
		cfg.AgentToken = fc.AgentToken
	}
	if fc.ServerID != "" {
		cfg.ServerID = fc.ServerID
	}
	if fc.Version != "" {
		cfg.Version = fc.Version
	}
	if fc.TenantID != "" {
		cfg.TenantID = fc.TenantID
	}
	if fc.HeartbeatSeconds > 0 {
		cfg.HeartbeatInterval = time.Duration(fc.HeartbeatSeconds) * time.Second
	}
	if fc.ConnectTimeoutSec > 0 {
		cfg.ConnectTimeout = time.Duration(fc.ConnectTimeoutSec) * time.Second
	}
	if fc.HealthTimeoutSec > 0 {
		cfg.HealthCheckTimeout = time.Duration(fc.HealthTimeoutSec) * time.Second
	}
	if fc.HealthCheckPath != "" {
		cfg.HealthCheckPath = fc.HealthCheckPath
	}
	if fc.BackoffInitialSec > 0 {
		cfg.BackoffInitial = time.Duration(fc.BackoffInitialSec) * time.Second
	}
	if fc.BackoffMaxSec > 0 {
		cfg.BackoffMax = time.Duration(fc.BackoffMaxSec) * time.Second
	}
	if fc.LogLevel != "" {
		cfg.LogLevel = fc.LogLevel
	}
	if fc.LogFormat != "" {
		cfg.LogFormat = fc.LogFormat
	}
	if fc.LogFilePath != "" {
		cfg.LogFilePath = fc.LogFilePath
	}
	if len(fc.AllowedReadRoots) > 0 {
		cfg.AllowedReadRoots = append([]string(nil), fc.AllowedReadRoots...)
	}
	if len(fc.AllowedWriteRoots) > 0 {
		cfg.AllowedWriteRoots = append([]string(nil), fc.AllowedWriteRoots...)
	}
	if fc.PluginRoot != "" {
		cfg.PluginRoot = fc.PluginRoot
	}
	if fc.MaxReadBytes > 0 {
		cfg.MaxReadBytes = fc.MaxReadBytes
	}
	if fc.StreamChunkBytes > 0 {
		cfg.StreamChunkBytes = fc.StreamChunkBytes
	}
	if fc.MaxTailLines > 0 {
		cfg.MaxTailLines = fc.MaxTailLines
	}
	if fc.UpdateManifestURL != "" {
		cfg.UpdateManifestURL = fc.UpdateManifestURL
	}
	if fc.UpdateCheckIntervalSec > 0 {
		cfg.UpdateCheckInterval = time.Duration(fc.UpdateCheckIntervalSec) * time.Second
	}
	if fc.UpdateChannel != "" {
		cfg.UpdateChannel = fc.UpdateChannel
	}
	if fc.UpdatePublicKey != "" {
		cfg.UpdatePublicKey = fc.UpdatePublicKey
	}
	if fc.UpdateRetryIntervalSec > 0 {
		cfg.UpdateRetryInterval = time.Duration(fc.UpdateRetryIntervalSec) * time.Second
	}
	if fc.UpdateMaxRetries > 0 {
		cfg.UpdateMaxRetries = fc.UpdateMaxRetries
	}
	if fc.DefaultGRPCPort > 0 {
		cfg.DefaultGRPCPort = fc.DefaultGRPCPort
	}
	if len(fc.TenantAllowlist) > 0 {
		cfg.TenantAllowlist = parsePolicyList(fc.TenantAllowlist)
	}
	if len(fc.TenantDenylist) > 0 {
		cfg.TenantDenylist = parsePolicyList(fc.TenantDenylist)
	}
	if len(fc.GroupAllowlist) > 0 {
		cfg.GroupAllowlist = parsePolicyList(fc.GroupAllowlist)
	}
	if len(fc.GroupDenylist) > 0 {
		cfg.GroupDenylist = parsePolicyList(fc.GroupDenylist)
	}
	if len(fc.GroupOperationRoles) > 0 {
		cfg.GroupOperationRoles = parsePolicyMatrixMap(fc.GroupOperationRoles)
	}
	return nil
}

func applyEnvOverrides(cfg *Config) {
	if value := strings.TrimSpace(os.Getenv("AGENT_MODE")); value != "" {
		cfg.Mode = value
	}
	if values := envURLs("CONTROL_PLANE_URLS"); len(values) > 0 {
		cfg.ControlPlaneURLs = values
	} else if value := strings.TrimSpace(os.Getenv("CONTROL_PLANE_URL")); value != "" {
		cfg.ControlPlaneURLs = []string{value}
	}
	if values := envURLs("GRPC_URLS"); len(values) > 0 {
		cfg.GRPCURLs = values
	} else if value := strings.TrimSpace(os.Getenv("GRPC_URL")); value != "" {
		cfg.GRPCURLs = []string{value}
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_TOKEN")); value != "" {
		cfg.AgentToken = value
	}
	if value := strings.TrimSpace(os.Getenv("SERVER_ID")); value != "" {
		cfg.ServerID = value
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_VERSION")); value != "" {
		cfg.Version = value
	}
	if value := strings.TrimSpace(os.Getenv("TENANT_ID")); value != "" {
		cfg.TenantID = value
	}
	if seconds := envInt("HEARTBEAT_INTERVAL"); seconds > 0 {
		cfg.HeartbeatInterval = time.Duration(seconds) * time.Second
	}
	if seconds := envInt("AGENT_CONNECT_TIMEOUT"); seconds > 0 {
		cfg.ConnectTimeout = time.Duration(seconds) * time.Second
	}
	if seconds := envInt("AGENT_HEALTH_CHECK_TIMEOUT"); seconds > 0 {
		cfg.HealthCheckTimeout = time.Duration(seconds) * time.Second
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_HEALTH_CHECK_PATH")); value != "" {
		cfg.HealthCheckPath = value
	}
	if seconds := envInt("AGENT_BACKOFF_INITIAL"); seconds > 0 {
		cfg.BackoffInitial = time.Duration(seconds) * time.Second
	}
	if seconds := envInt("AGENT_BACKOFF_MAX"); seconds > 0 {
		cfg.BackoffMax = time.Duration(seconds) * time.Second
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_LOG_LEVEL")); value != "" {
		cfg.LogLevel = value
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_LOG_FORMAT")); value != "" {
		cfg.LogFormat = value
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_LOG_FILE")); value != "" {
		cfg.LogFilePath = value
	}
	if values := envCSV("AGENT_ALLOWED_READ_ROOTS"); len(values) > 0 {
		cfg.AllowedReadRoots = values
	}
	if values := envCSV("AGENT_ALLOWED_WRITE_ROOTS"); len(values) > 0 {
		cfg.AllowedWriteRoots = values
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_PLUGIN_ROOT")); value != "" {
		cfg.PluginRoot = value
	}
	if value := envInt64("AGENT_MAX_READ_BYTES"); value > 0 {
		cfg.MaxReadBytes = value
	}
	if value := envInt("AGENT_STREAM_CHUNK_BYTES"); value > 0 {
		cfg.StreamChunkBytes = value
	}
	if value := envInt("AGENT_MAX_TAIL_LINES"); value > 0 {
		cfg.MaxTailLines = value
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_UPDATE_MANIFEST_URL")); value != "" {
		cfg.UpdateManifestURL = value
	}
	if seconds := envInt("AGENT_UPDATE_CHECK_INTERVAL"); seconds > 0 {
		cfg.UpdateCheckInterval = time.Duration(seconds) * time.Second
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_UPDATE_CHANNEL")); value != "" {
		cfg.UpdateChannel = value
	}
	if value := strings.TrimSpace(os.Getenv("AGENT_UPDATE_PUBLIC_KEY")); value != "" {
		cfg.UpdatePublicKey = value
	}
	if seconds := envInt("AGENT_UPDATE_RETRY_INTERVAL"); seconds > 0 {
		cfg.UpdateRetryInterval = time.Duration(seconds) * time.Second
	}
	if value := envInt("AGENT_UPDATE_MAX_RETRIES"); value > 0 {
		cfg.UpdateMaxRetries = value
	}
	if value := envInt("AGENT_DEFAULT_GRPC_PORT"); value > 0 {
		cfg.DefaultGRPCPort = value
	}
	cfg.TenantAllowlist = mergePolicyMap(cfg.TenantAllowlist, parsePolicyCSVEnv("EINFRA_AGENT_TENANT_ALLOWLIST"))
	cfg.TenantDenylist = mergePolicyMap(cfg.TenantDenylist, parsePolicyCSVEnv("EINFRA_AGENT_TENANT_DENYLIST"))
	cfg.GroupAllowlist = mergePolicyMap(cfg.GroupAllowlist, parsePolicyCSVEnv("EINFRA_AGENT_GROUP_ALLOWLIST"))
	cfg.GroupDenylist = mergePolicyMap(cfg.GroupDenylist, parsePolicyCSVEnv("EINFRA_AGENT_GROUP_DENYLIST"))
	if raw := strings.TrimSpace(os.Getenv("EINFRA_AGENT_POLICY_MATRIX")); raw != "" {
		cfg.GroupOperationRoles = parsePolicyMatrixJSON(raw)
	}
}

func (c *Config) normalize() {
	c.Mode = strings.ToLower(strings.TrimSpace(c.Mode))
	if c.Mode == "" {
		c.Mode = "auto"
	}
	c.AgentToken = strings.TrimSpace(c.AgentToken)
	c.ServerID = strings.TrimSpace(c.ServerID)
	c.Version = strings.TrimSpace(c.Version)
	c.TenantID = strings.TrimSpace(c.TenantID)
	c.UpdateChannel = strings.ToLower(strings.TrimSpace(c.UpdateChannel))
	if c.UpdateChannel == "" {
		c.UpdateChannel = "stable"
	}
	c.UpdatePublicKey = strings.TrimSpace(c.UpdatePublicKey)
	c.HealthCheckPath = normalizePath(c.HealthCheckPath, "/health")
	c.LogLevel = strings.ToLower(strings.TrimSpace(c.LogLevel))
	c.LogFormat = strings.ToLower(strings.TrimSpace(c.LogFormat))
	c.LogFilePath = strings.TrimSpace(c.LogFilePath)
	if c.LogFilePath == "" {
		c.LogFilePath = defaultLogFile
	}
	c.ControlPlaneURLs = dedupe(trimAll(c.ControlPlaneURLs))
	c.GRPCURLs = dedupe(trimAll(c.GRPCURLs))
	c.AllowedReadRoots = trimAll(c.AllowedReadRoots)
	c.AllowedWriteRoots = trimAll(c.AllowedWriteRoots)
	c.PluginRoot = strings.TrimSpace(c.PluginRoot)
	if c.ConnectTimeout <= 0 {
		c.ConnectTimeout = 10 * time.Second
	}
	if c.HealthCheckTimeout <= 0 {
		c.HealthCheckTimeout = 5 * time.Second
	}
	if c.HeartbeatInterval <= 0 {
		c.HeartbeatInterval = 15 * time.Second
	}
	if c.BackoffInitial <= 0 {
		c.BackoffInitial = 2 * time.Second
	}
	if c.BackoffMax <= 0 {
		c.BackoffMax = 60 * time.Second
	}
	if c.BackoffMax < c.BackoffInitial {
		c.BackoffMax = c.BackoffInitial
	}
	if c.DefaultGRPCPort <= 0 {
		c.DefaultGRPCPort = defaultGRPCPort
	}
	if c.UpdateCheckInterval <= 0 {
		c.UpdateCheckInterval = 30 * time.Minute
	}
	if c.UpdateRetryInterval <= 0 {
		c.UpdateRetryInterval = 10 * time.Second
	}
	if c.UpdateMaxRetries <= 0 {
		c.UpdateMaxRetries = 3
	}
	if len(c.GRPCURLs) == 0 {
		c.GRPCURLs = deriveGRPCURLs(c.ControlPlaneURLs, c.DefaultGRPCPort)
	}
}

func (c *Config) Validate() error {
	if len(c.ControlPlaneURLs) == 0 {
		return errors.New("agent config invalid: CONTROL_PLANE_URL or CONTROL_PLANE_URLS is required")
	}
	for _, item := range c.ControlPlaneURLs {
		parsed, err := url.Parse(item)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return fmt.Errorf("agent config invalid: bad control plane url %q", item)
		}
	}
	if len(c.GRPCURLs) == 0 {
		return errors.New("agent config invalid: no gRPC target derived from control plane url")
	}
	for _, item := range c.GRPCURLs {
		if !strings.Contains(item, ":") {
			return fmt.Errorf("agent config invalid: bad grpc target %q", item)
		}
	}
	if c.ServerID == "" {
		return errors.New("agent config invalid: SERVER_ID is required")
	}
	if _, err := uuid.Parse(c.ServerID); err != nil {
		return fmt.Errorf("agent config invalid: SERVER_ID must be uuid: %w", err)
	}
	if err := validateToken(c.AgentToken); err != nil {
		return err
	}
	if c.LogLevel == "" {
		c.LogLevel = "info"
	}
	if c.LogFormat == "" {
		c.LogFormat = "json"
	}
	if c.StreamChunkBytes <= 0 || c.MaxReadBytes <= 0 || c.MaxTailLines <= 0 {
		return errors.New("agent config invalid: stream and read limits must be positive")
	}
	return nil
}

func (c *Config) PrimaryControlPlaneURL() string {
	if len(c.ControlPlaneURLs) == 0 {
		return ""
	}
	return c.ControlPlaneURLs[0]
}

func (c *Config) HealthCheckURLs() []string {
	items := make([]string, 0, len(c.ControlPlaneURLs))
	for _, base := range c.ControlPlaneURLs {
		items = append(items, strings.TrimRight(base, "/")+c.HealthCheckPath)
	}
	return items
}

func (c *Config) GRPCTargets() []string {
	items := make([]string, len(c.GRPCURLs))
	copy(items, c.GRPCURLs)
	return items
}

func envURLs(key string) []string {
	return envCSV(key)
}

func envCSV(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func envInt(key string) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return value
}

func envInt64(key string) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0
	}
	return value
}

func trimAll(items []string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

func dedupe(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func deriveGRPCURLs(controlPlaneURLs []string, grpcPort int) []string {
	out := make([]string, 0, len(controlPlaneURLs))
	for _, item := range controlPlaneURLs {
		parsed, err := url.Parse(item)
		if err != nil || parsed.Host == "" {
			continue
		}
		host := parsed.Hostname()
		if host == "" {
			continue
		}
		out = append(out, fmt.Sprintf("%s:%d", host, grpcPort))
	}
	return dedupe(out)
}

func normalizePath(value, def string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return def
	}
	if !strings.HasPrefix(value, "/") {
		return "/" + value
	}
	return value
}

func validateToken(token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("agent config invalid: AGENT_TOKEN is required")
	}
	if len(token) < 16 {
		return errors.New("agent config invalid: AGENT_TOKEN appears too short")
	}
	if strings.ContainsAny(token, " \t\r\n") {
		return errors.New("agent config invalid: AGENT_TOKEN must not contain whitespace")
	}
	return nil
}

func parsePolicyCSVEnv(key string) map[string]struct{} {
	return parsePolicyList(envCSV(key))
}

func parsePolicyList(items []string) map[string]struct{} {
	out := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = strings.ToLower(strings.TrimSpace(item))
		if item != "" {
			out[item] = struct{}{}
		}
	}
	return out
}

func mergePolicyMap(current, extra map[string]struct{}) map[string]struct{} {
	if len(current) == 0 && len(extra) == 0 {
		return map[string]struct{}{}
	}
	out := make(map[string]struct{}, len(current)+len(extra))
	for key := range current {
		out[key] = struct{}{}
	}
	for key := range extra {
		out[key] = struct{}{}
	}
	return out
}

func parsePolicyMatrixJSON(value string) map[string]map[string]map[string]struct{} {
	if strings.TrimSpace(value) == "" {
		return map[string]map[string]map[string]struct{}{}
	}
	var raw map[string]map[string][]string
	if err := yaml.Unmarshal([]byte(value), &raw); err != nil {
		return map[string]map[string]map[string]struct{}{}
	}
	return parsePolicyMatrixMap(raw)
}

func parsePolicyMatrixMap(raw map[string]map[string][]string) map[string]map[string]map[string]struct{} {
	matrix := make(map[string]map[string]map[string]struct{}, len(raw))
	for group, operations := range raw {
		groupKey := strings.ToLower(strings.TrimSpace(group))
		if groupKey == "" {
			continue
		}
		matrix[groupKey] = make(map[string]map[string]struct{}, len(operations))
		for operation, roles := range operations {
			opKey := strings.ToLower(strings.TrimSpace(operation))
			if opKey == "" {
				continue
			}
			matrix[groupKey][opKey] = parsePolicyList(roles)
		}
	}
	return matrix
}

func EnsureLogDir(path string) error {
	dir := filepath.Dir(strings.TrimSpace(path))
	if dir == "" || dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}
