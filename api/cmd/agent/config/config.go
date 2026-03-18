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
	"time"
)

// Config holds all agent runtime configuration.
type Config struct {
	ControlPlaneURL   string
	AgentToken        string
	ServerID          string
	Version           string
	HeartbeatInterval time.Duration
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
