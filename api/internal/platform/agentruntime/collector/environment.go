package collector

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type DockerInventorySummary struct {
	ServerVersion   string `json:"server_version,omitempty"`
	Running         int    `json:"running"`
	Total           int    `json:"total"`
	Images          int    `json:"images"`
	Volumes         int    `json:"volumes"`
	Stacks          int    `json:"stacks"`
	CurrentContext  string `json:"current_context,omitempty"`
	StorageDriver   string `json:"storage_driver,omitempty"`
	KernelVersion   string `json:"kernel_version,omitempty"`
	OperatingSystem string `json:"operating_system,omitempty"`
	DockerRootDir   string `json:"docker_root_dir,omitempty"`
	NCPU            int    `json:"ncpu,omitempty"`
	MemTotal        int64  `json:"mem_total,omitempty"`
}

type KubernetesInventorySummary struct {
	ServerVersion string `json:"server_version,omitempty"`
	Context       string `json:"context,omitempty"`
	Nodes         int    `json:"nodes"`
	ReadyNodes    int    `json:"ready_nodes"`
	Namespaces    int    `json:"namespaces"`
	Pods          int    `json:"pods"`
}

func CollectDockerInventory() (*DockerInventorySummary, error) {
	if !commandExists("docker") {
		return nil, fmt.Errorf("docker command not available")
	}

	summary := &DockerInventorySummary{
		ServerVersion:  strings.TrimSpace(runCommandText("docker", "version", "--format", "{{.Server.Version}}")),
		CurrentContext: strings.TrimSpace(runCommandText("docker", "context", "show")),
		Total:          countCommandLines("docker", "ps", "-aq"),
		Running:        countCommandLines("docker", "ps", "-q"),
		Images:         countCommandLines("docker", "image", "ls", "-q"),
		Volumes:        countCommandLines("docker", "volume", "ls", "-q"),
		Stacks:         countCommandLines("docker", "stack", "ls", "--format", "{{.Name}}"),
	}

	infoOutput, err := exec.Command("docker", "info", "--format", "{{json .}}").Output()
	if err == nil {
		var payload struct {
			Driver          string `json:"Driver"`
			KernelVersion   string `json:"KernelVersion"`
			OperatingSystem string `json:"OperatingSystem"`
			DockerRootDir   string `json:"DockerRootDir"`
			NCPU            int    `json:"NCPU"`
			MemTotal        int64  `json:"MemTotal"`
		}
		if jsonErr := json.Unmarshal(infoOutput, &payload); jsonErr == nil {
			summary.StorageDriver = strings.TrimSpace(payload.Driver)
			summary.KernelVersion = strings.TrimSpace(payload.KernelVersion)
			summary.OperatingSystem = strings.TrimSpace(payload.OperatingSystem)
			summary.DockerRootDir = strings.TrimSpace(payload.DockerRootDir)
			summary.NCPU = payload.NCPU
			summary.MemTotal = payload.MemTotal
		}
	}

	return summary, nil
}

func CollectKubernetesInventory() (*KubernetesInventorySummary, error) {
	if !commandExists("kubectl") {
		return nil, fmt.Errorf("kubectl command not available")
	}

	contextName := strings.TrimSpace(runCommandText("kubectl", "config", "current-context"))

	versionOutput, err := exec.Command("kubectl", "version", "--output=json").Output()
	if err != nil {
		return nil, fmt.Errorf("kubectl version failed: %w", err)
	}

	var versionPayload struct {
		ServerVersion struct {
			GitVersion string `json:"gitVersion"`
		} `json:"serverVersion"`
	}
	if err := json.Unmarshal(versionOutput, &versionPayload); err != nil {
		return nil, fmt.Errorf("parse kubectl version: %w", err)
	}

	nodes, readyNodes, err := collectNodeCounts()
	if err != nil {
		return nil, err
	}

	namespaces, err := countKubernetesItems("namespaces")
	if err != nil {
		return nil, err
	}

	pods, err := countKubernetesItems("pods", "-A")
	if err != nil {
		return nil, err
	}

	return &KubernetesInventorySummary{
		ServerVersion: strings.TrimSpace(versionPayload.ServerVersion.GitVersion),
		Context:       contextName,
		Nodes:         nodes,
		ReadyNodes:    readyNodes,
		Namespaces:    namespaces,
		Pods:          pods,
	}, nil
}

func collectNodeCounts() (int, int, error) {
	output, err := exec.Command("kubectl", "get", "nodes", "-o", "json").Output()
	if err != nil {
		return 0, 0, fmt.Errorf("kubectl get nodes failed: %w", err)
	}

	var payload struct {
		Items []struct {
			Status struct {
				Conditions []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := json.Unmarshal(output, &payload); err != nil {
		return 0, 0, fmt.Errorf("parse kubectl nodes: %w", err)
	}

	ready := 0
	for _, item := range payload.Items {
		for _, condition := range item.Status.Conditions {
			if condition.Type == "Ready" && strings.EqualFold(condition.Status, "True") {
				ready++
				break
			}
		}
	}

	return len(payload.Items), ready, nil
}

func countKubernetesItems(resource string, extraArgs ...string) (int, error) {
	args := []string{"get", resource}
	args = append(args, extraArgs...)
	args = append(args, "-o", "json")

	output, err := exec.Command("kubectl", args...).Output()
	if err != nil {
		return 0, fmt.Errorf("kubectl get %s failed: %w", resource, err)
	}

	var payload struct {
		Items []json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(output, &payload); err != nil {
		return 0, fmt.Errorf("parse kubectl %s payload: %w", resource, err)
	}

	return len(payload.Items), nil
}

func runCommandText(name string, args ...string) string {
	output, err := exec.Command(name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func countCommandLines(name string, args ...string) int {
	output, err := exec.Command(name, args...).Output()
	if err != nil {
		return 0
	}
	text := strings.TrimSpace(string(output))
	if text == "" {
		return 0
	}
	return len(strings.Split(text, "\n"))
}
