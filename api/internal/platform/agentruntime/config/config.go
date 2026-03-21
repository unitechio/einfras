// Package config loads agent configuration from environment variables.
//
// Required environment variables:
//
//	CONTROL_PLANE_URL  - WebSocket URL of the control plane (e.g. wss://einfra.example.com)
//	AGENT_TOKEN        - JWT token issued by the control plane at onboarding
//	SERVER_ID          - Unique identifier for this server (UUID)
//
// Optional:
//
//	AGENT_VERSION      - Agent version string (default: "1.0.0")
//	HEARTBEAT_INTERVAL - Heartbeat interval in seconds (default: 15)
package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all agent runtime configuration.
type Config struct {
	ControlPlaneURL   string
	GRPCURL           string
	AgentToken        string
	ServerID          string
	Version           string
	HeartbeatInterval time.Duration
	AllowedReadRoots  []string
	AllowedWriteRoots []string
	PluginRoot        string
	MaxReadBytes      int64
	StreamChunkBytes  int
	MaxTailLines      int
}

// Load reads configuration from environment variables.
// It will log.Fatal if required variables are missing.
func Load() *Config {
	cfg := &Config{
		ControlPlaneURL:   requireEnv("CONTROL_PLANE_URL"),
		AgentToken:        requireEnv("AGENT_TOKEN"),
		ServerID:          requireEnv("SERVER_ID"),
		Version:           getEnvOrDefault("AGENT_VERSION", "1.0.0"),
		HeartbeatInterval: parseDuration("HEARTBEAT_INTERVAL", 15*time.Second),
		GRPCURL:           getEnvOrDefault("GRPC_URL", "localhost:50051"),
		AllowedReadRoots:  parseCSV("AGENT_ALLOWED_READ_ROOTS", "/etc,/opt,/srv,/var,/home,/root,/tmp"),
		AllowedWriteRoots: parseCSV("AGENT_ALLOWED_WRITE_ROOTS", "/etc,/opt,/srv,/var,/home,/root,/tmp"),
		PluginRoot:        getEnvOrDefault("AGENT_PLUGIN_ROOT", "/opt/einfra/plugins"),
		MaxReadBytes:      parseInt64("AGENT_MAX_READ_BYTES", 2*1024*1024),
		StreamChunkBytes:  parseInt("AGENT_STREAM_CHUNK_BYTES", 32768),
		MaxTailLines:      parseInt("AGENT_MAX_TAIL_LINES", 2000),
	}
	return cfg
}

func requireEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		log.Fatalf("[config] required environment variable %q is not set", key)
	}
	return val
}

func getEnvOrDefault(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

func parseDuration(key string, def time.Duration) time.Duration {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	secs, err := strconv.Atoi(val)
	if err != nil {
		log.Printf("[config] invalid %s=%q, using default %s", key, val, def)
		return def
	}
	return time.Duration(secs) * time.Second
}

func parseCSV(key, def string) []string {
	value := getEnvOrDefault(key, def)
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func parseInt(key string, def int) int {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	parsed, err := strconv.Atoi(val)
	if err != nil || parsed <= 0 {
		return def
	}
	return parsed
}

func parseInt64(key string, def int64) int64 {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	parsed, err := strconv.ParseInt(val, 10, 64)
	if err != nil || parsed <= 0 {
		return def
	}
	return parsed
}
