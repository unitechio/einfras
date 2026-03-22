package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDerivesGRPCFromControlPlaneURL(t *testing.T) {
	t.Setenv("EINFRA_AGENT_CONFIG_FILE", filepath.Join(t.TempDir(), "missing.yaml"))
	t.Setenv("SERVER_ID", "11111111-1111-1111-1111-111111111111")
	t.Setenv("AGENT_TOKEN", "super-secure-agent-token")
	t.Setenv("CONTROL_PLANE_URL", "https://cp.example.internal:8443")
	t.Setenv("GRPC_URL", "")
	t.Setenv("CONTROL_PLANE_URLS", "")
	t.Setenv("GRPC_URLS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if got := cfg.PrimaryControlPlaneURL(); got != "https://cp.example.internal:8443" {
		t.Fatalf("PrimaryControlPlaneURL() = %q", got)
	}
	targets := cfg.GRPCTargets()
	if len(targets) != 1 || targets[0] != "cp.example.internal:50051" {
		t.Fatalf("GRPCTargets() = %#v", targets)
	}
}

func TestLoadReadsYAMLConfigFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	raw := []byte(`
server_id: "22222222-2222-2222-2222-222222222222"
agent_token: "another-secure-agent-token"
control_plane_urls:
  - "https://cp-a.example.com"
  - "https://cp-b.example.com"
grpc_urls:
  - "cp-a.example.com:50051"
heartbeat_interval_sec: 10
`)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	t.Setenv("EINFRA_AGENT_CONFIG_FILE", path)
	t.Setenv("SERVER_ID", "")
	t.Setenv("AGENT_TOKEN", "")
	t.Setenv("CONTROL_PLANE_URL", "")
	t.Setenv("CONTROL_PLANE_URLS", "")
	t.Setenv("GRPC_URL", "")
	t.Setenv("GRPC_URLS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if len(cfg.ControlPlaneURLs) != 2 {
		t.Fatalf("ControlPlaneURLs = %#v", cfg.ControlPlaneURLs)
	}
	if cfg.HeartbeatInterval.Seconds() != 10 {
		t.Fatalf("HeartbeatInterval = %s", cfg.HeartbeatInterval)
	}
}
