package managementapp

import (
	"context"
	"strings"
	"time"

	agent "einfra/api/internal/modules/agent/domain"
	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/platform/agentruntime/collector"
)

type EnvironmentInventory struct {
	ID          string                                `json:"id"`
	ServerID    string                                `json:"server_id"`
	ServerName  string                                `json:"server_name"`
	ServerIP    string                                `json:"server_ip"`
	Platform    string                                `json:"platform"`
	Status      string                                `json:"status"`
	OS          string                                `json:"os,omitempty"`
	Arch        string                                `json:"arch,omitempty"`
	Endpoint    string                                `json:"endpoint,omitempty"`
	SelfHost    bool                                  `json:"self_host"`
	LastSeen    *time.Time                            `json:"last_seen,omitempty"`
	CPUCores    int                                   `json:"cpu_cores,omitempty"`
	MemoryGB    float64                               `json:"memory_gb,omitempty"`
	DiskGB      int                                   `json:"disk_gb,omitempty"`
	CPUPercent  float64                               `json:"cpu_percent,omitempty"`
	MemPercent  float64                               `json:"mem_percent,omitempty"`
	DiskPercent float64                               `json:"disk_percent,omitempty"`
	Docker      *collector.DockerInventorySummary     `json:"docker,omitempty"`
	Kubernetes  *collector.KubernetesInventorySummary `json:"kubernetes,omitempty"`
}

type LocalEnvironmentProbe struct {
	Metrics    collector.SystemMetrics
	Docker     *collector.DockerInventorySummary
	Kubernetes *collector.KubernetesInventorySummary
}

type LocalEnvironmentProbeFunc func() LocalEnvironmentProbe

type EnvironmentInventoryService struct {
	servers domain.ServerRepository
	agents  AgentInfoReader
	hub     OnlineChecker
	probe   LocalEnvironmentProbeFunc
}

func NewEnvironmentInventoryService(
	servers domain.ServerRepository,
	agents AgentInfoReader,
	hub OnlineChecker,
	probe LocalEnvironmentProbeFunc,
) *EnvironmentInventoryService {
	if probe == nil {
		probe = probeLocalEnvironment
	}
	return &EnvironmentInventoryService{
		servers: servers,
		agents:  agents,
		hub:     hub,
		probe:   probe,
	}
}

func (s *EnvironmentInventoryService) List(ctx context.Context) ([]EnvironmentInventory, error) {
	servers, _, err := s.servers.List(ctx, domain.ServerFilter{Page: 1, PageSize: 10000})
	if err != nil {
		return nil, err
	}

	local := s.probe()
	items := make([]EnvironmentInventory, 0, len(servers)*2)
	for _, server := range servers {
		if server == nil {
			continue
		}

		info, _ := s.agents.GetByServerID(server.ID)
		selfHost := isSelfHostedServer(server)
		if selfHost {
			items = append(items, s.buildLocalEnvironmentItems(server, info, local)...)
			continue
		}

		items = append(items, s.buildRemoteEnvironmentItems(server, info)...)
	}

	importedKubernetes, err := collector.ListImportedKubernetesEnvironments()
	if err == nil {
		for _, imported := range importedKubernetes {
			status := "degraded"
			var summary *collector.KubernetesInventorySummary
			if inventory, summaryErr := collector.CollectKubernetesInventoryForEnvironment(imported.ID); summaryErr == nil {
				summary = inventory
				status = "up"
			}
			items = append(items, EnvironmentInventory{
				ID:         imported.ID,
				ServerID:   imported.ID,
				ServerName: imported.Name,
				ServerIP:   "",
				Platform:   "kubernetes",
				Status:     status,
				Endpoint:   imported.Endpoint,
				SelfHost:   false,
				LastSeen:   timePointer(imported.ImportedAt),
				Kubernetes: summary,
			})
		}
	}

	return items, nil
}

func (s *EnvironmentInventoryService) buildLocalEnvironmentItems(server *domain.Server, info *agent.AgentInfo, local LocalEnvironmentProbe) []EnvironmentInventory {
	items := make([]EnvironmentInventory, 0, 2)
	base := s.baseEnvironment(server, info, true)
	if local.Metrics.HasDocker || (info != nil && info.HasDocker) || local.Docker != nil {
		dockerItem := base
		dockerItem.ID = server.ID + ":docker"
		dockerItem.Platform = "docker"
		dockerItem.Endpoint = dockerEndpoint(local.Docker)
		dockerItem.Status = platformStatus(local.Docker != nil || (info != nil && info.HasDocker), true)
		dockerItem.Docker = local.Docker
		items = append(items, dockerItem)
	}
	if local.Metrics.HasK8s || (info != nil && info.HasK8s) || local.Kubernetes != nil {
		k8sItem := base
		k8sItem.ID = server.ID + ":kubernetes"
		k8sItem.Platform = "kubernetes"
		k8sItem.Endpoint = kubernetesEndpoint(local.Kubernetes)
		k8sItem.Status = platformStatus(local.Kubernetes != nil || (info != nil && info.HasK8s), true)
		k8sItem.Kubernetes = local.Kubernetes
		items = append(items, k8sItem)
	}
	return items
}

func (s *EnvironmentInventoryService) buildRemoteEnvironmentItems(server *domain.Server, info *agent.AgentInfo) []EnvironmentInventory {
	if info == nil {
		return nil
	}

	items := make([]EnvironmentInventory, 0, 2)
	base := s.baseEnvironment(server, info, false)
	if info.HasDocker {
		dockerItem := base
		dockerItem.ID = server.ID + ":docker"
		dockerItem.Platform = "docker"
		dockerItem.Endpoint = "agent://" + server.ID + "/docker"
		dockerItem.Status = platformStatus(true, s.hub.IsAnyTransportOnline(server.ID))
		items = append(items, dockerItem)
	}
	if info.HasK8s {
		k8sItem := base
		k8sItem.ID = server.ID + ":kubernetes"
		k8sItem.Platform = "kubernetes"
		k8sItem.Endpoint = "agent://" + server.ID + "/kubernetes"
		k8sItem.Status = platformStatus(true, s.hub.IsAnyTransportOnline(server.ID))
		items = append(items, k8sItem)
	}
	return items
}

func (s *EnvironmentInventoryService) baseEnvironment(server *domain.Server, info *agent.AgentInfo, selfHost bool) EnvironmentInventory {
	item := EnvironmentInventory{
		ServerID:   server.ID,
		ServerName: server.Name,
		ServerIP:   server.IPAddress,
		SelfHost:   selfHost,
		CPUCores:   server.CPUCores,
		MemoryGB:   server.MemoryGB,
		DiskGB:     server.DiskGB,
		OS:         string(server.OS),
	}
	if info != nil {
		item.OS = firstNonEmptyString(info.OS, item.OS)
		item.Arch = info.Arch
		item.CPUPercent = info.CPUPercent
		item.MemPercent = info.MemPercent
		item.DiskPercent = info.DiskPercent
		if !info.LastSeen.IsZero() {
			item.LastSeen = &info.LastSeen
		}
	}
	return item
}

func probeLocalEnvironment() LocalEnvironmentProbe {
	metrics := collector.Collect()
	dockerSummary, _ := collector.CollectDockerInventory()
	k8sSummary, _ := collector.CollectKubernetesInventory()
	return LocalEnvironmentProbe{
		Metrics:    metrics,
		Docker:     dockerSummary,
		Kubernetes: k8sSummary,
	}
}

func isSelfHostedServer(server *domain.Server) bool {
	if server == nil {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(server.Provider), "local-control-plane") {
		return true
	}
	for _, tag := range server.Tags {
		if strings.EqualFold(strings.TrimSpace(tag), "self-hosted") || strings.EqualFold(strings.TrimSpace(tag), "control-plane") {
			return true
		}
	}
	return false
}

func platformStatus(available bool, online bool) string {
	if !available {
		return "down"
	}
	if online {
		return "up"
	}
	return "degraded"
}

func dockerEndpoint(summary *collector.DockerInventorySummary) string {
	if summary != nil && strings.TrimSpace(summary.CurrentContext) != "" && !strings.EqualFold(summary.CurrentContext, "default") {
		return summary.CurrentContext
	}
	return "/var/run/docker.sock"
}

func kubernetesEndpoint(summary *collector.KubernetesInventorySummary) string {
	if summary != nil && strings.TrimSpace(summary.Context) != "" {
		return summary.Context
	}
	return "kubectl"
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func timePointer(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	utc := value.UTC()
	return &utc
}
