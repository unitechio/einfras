package managementapp

import (
	"context"
	"testing"
	"time"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/platform/agentruntime/collector"
)

func TestEnvironmentInventoryServiceListIncludesSelfHostDockerAndK8s(t *testing.T) {
	now := time.Now().UTC()
	server := &domain.Server{
		ID:       "self-host-10-0-0-1",
		Name:     "Control Plane",
		IPAddress:"10.0.0.1",
		Provider: "local-control-plane",
		Tags:     []string{"self-hosted"},
		OS:       domain.ServerOSLinux,
		CPUCores: 8,
		MemoryGB: 32,
		DiskGB:   256,
	}
	agentInfo := &agent.AgentInfo{
		ServerID:   server.ID,
		Online:     true,
		LastSeen:   now,
		OS:         "linux",
		Arch:       "amd64",
		HasDocker:  true,
		HasK8s:     true,
	}

	service := NewEnvironmentInventoryService(
		&fakeServerRepo{servers: []*domain.Server{server}},
		&fakeAgentInfoReader{items: map[string]*agent.AgentInfo{server.ID: agentInfo}},
		fakeOnlineChecker{onlineIDs: map[string]bool{server.ID: true}},
		func() LocalEnvironmentProbe {
			return LocalEnvironmentProbe{
				Metrics: collector.SystemMetrics{HasDocker: true, HasK8s: true},
				Docker: &collector.DockerInventorySummary{
					Running: 3,
					Total:   5,
				},
				Kubernetes: &collector.KubernetesInventorySummary{
					Context:    "kind-local",
					Nodes:      1,
					ReadyNodes: 1,
				},
			}
		},
	)

	items, err := service.List(context.Background())
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 environments, got %d", len(items))
	}

	var dockerFound bool
	var k8sFound bool
	for _, item := range items {
		switch item.Platform {
		case "docker":
			dockerFound = true
			if item.Status != "up" {
				t.Fatalf("expected docker status up, got %q", item.Status)
			}
			if item.Docker == nil || item.Docker.Total != 5 {
				t.Fatalf("expected docker summary to be attached")
			}
		case "kubernetes":
			k8sFound = true
			if item.Kubernetes == nil || item.Kubernetes.Context != "kind-local" {
				t.Fatalf("expected kubernetes summary to be attached")
			}
		}
	}
	if !dockerFound || !k8sFound {
		t.Fatalf("expected both docker and kubernetes environments, got %#v", items)
	}
}

type fakeServerRepo struct {
	servers []*domain.Server
}

func (f *fakeServerRepo) Create(context.Context, *domain.Server) error { return nil }
func (f *fakeServerRepo) GetByID(context.Context, string) (*domain.Server, error) { return nil, nil }
func (f *fakeServerRepo) GetByIPAddress(context.Context, string) (*domain.Server, error) { return nil, nil }
func (f *fakeServerRepo) List(context.Context, domain.ServerFilter) ([]*domain.Server, int64, error) {
	return f.servers, int64(len(f.servers)), nil
}
func (f *fakeServerRepo) Update(context.Context, *domain.Server) error { return nil }
func (f *fakeServerRepo) UpdateStatus(context.Context, string, domain.ServerStatus) error { return nil }
func (f *fakeServerRepo) Delete(context.Context, string) error { return nil }

type fakeAgentInfoReader struct {
	items map[string]*agent.AgentInfo
}

func (f *fakeAgentInfoReader) GetByServerID(serverID string) (*agent.AgentInfo, error) {
	return f.items[serverID], nil
}

type fakeOnlineChecker struct {
	onlineIDs map[string]bool
}

func (f fakeOnlineChecker) IsAnyTransportOnline(serverID string) bool {
	return f.onlineIDs[serverID]
}
