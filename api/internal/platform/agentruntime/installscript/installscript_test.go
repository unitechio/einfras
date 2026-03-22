package installscript

import (
	"strings"
	"testing"
)

func TestRenderIncludesSaferDefaults(t *testing.T) {
	script, err := Render(Payload{
		ServerID:        "11111111-1111-1111-1111-111111111111",
		AgentToken:      "super-secure-agent-token",
		ControlPlaneURL: "https://cp.example.com",
		GRPCURL:         "cp.example.com:50051",
	})
	if err != nil {
		t.Fatalf("Render() error = %v", err)
	}

	contains := []string{
		"EnvironmentFile=${ENV_PATH}",
		"config.yaml",
		"detect_docker",
		"has_systemd",
		"curl -fsSL install.sh | bash -s --",
		"GRPC_URL=\"${host_part}:50051\"",
		"/v1/agent/binary?os=linux&arch=amd64",
		"EINFRA_INSTALLER_VERSION=v2",
		"retry_download",
	}
	for _, item := range contains {
		if !strings.Contains(script, item) {
			t.Fatalf("rendered script missing %q", item)
		}
	}
}
