package collector

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type DockerContainerInfo struct {
	Id      string                `json:"Id"`
	Names   []string              `json:"Names"`
	Image   string                `json:"Image"`
	ImageID string                `json:"ImageID"`
	Command string                `json:"Command"`
	Created int64                 `json:"Created"`
	State   string                `json:"State"`
	Status  string                `json:"Status"`
	Ports   []DockerContainerPort `json:"Ports"`
	Labels  map[string]string     `json:"Labels"`
}

type DockerContainerPort struct {
	IP          string `json:"IP"`
	PrivatePort int    `json:"PrivatePort"`
	PublicPort  int    `json:"PublicPort,omitempty"`
	Type        string `json:"Type"`
}

type DockerImageInfo struct {
	Id          string            `json:"Id"`
	ParentId    string            `json:"ParentId"`
	RepoTags    []string          `json:"RepoTags"`
	RepoDigests []string          `json:"RepoDigests"`
	Created     int64             `json:"Created"`
	Size        int64             `json:"Size"`
	VirtualSize int64             `json:"VirtualSize"`
	SharedSize  int64             `json:"SharedSize"`
	Labels      map[string]string `json:"Labels"`
	Containers  int64             `json:"Containers"`
}

type DockerNetworkInfo struct {
	Id         string `json:"Id"`
	Name       string `json:"Name"`
	Scope      string `json:"Scope"`
	Driver     string `json:"Driver"`
	EnableIPv6 bool   `json:"EnableIPv6"`
	Internal   bool   `json:"Internal"`
	Created    string `json:"Created"`
}

type DockerVolumeInfo struct {
	Name       string            `json:"Name"`
	Driver     string            `json:"Driver"`
	Mountpoint string            `json:"Mountpoint"`
	CreatedAt  string            `json:"CreatedAt"`
	Labels     map[string]string `json:"Labels"`
}

type DockerStackInfo struct {
	Name      string `json:"Name"`
	Services  int    `json:"Services"`
	Status    string `json:"Status"`
	CreatedAt string `json:"CreatedAt"`
	Mode      string `json:"Mode,omitempty"`
}

type DockerStackServiceInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Image    string `json:"image"`
	Replicas string `json:"replicas"`
	Ports    string `json:"ports"`
}

type K8sPodInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	Node      string `json:"node"`
	IP        string `json:"ip"`
	Restarts  int    `json:"restarts"`
	Age       string `json:"age"`
}

type K8sDeploymentInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	ReadyReplicas   int32  `json:"ready_replicas"`
	DesiredReplicas int32  `json:"desired_replicas"`
	Status          string `json:"status"`
	Age             string `json:"age"`
}

type K8sServiceInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Type       string `json:"type"`
	ClusterIP  string `json:"cluster_ip"`
	ExternalIP string `json:"external_ip"`
	Ports      string `json:"ports"`
	Age        string `json:"age"`
}

type K8sNodeInfo struct {
	Name           string `json:"name"`
	Status         string `json:"status"`
	Role           string `json:"role"`
	Version        string `json:"version"`
	InternalIP     string `json:"internal_ip"`
	CPUCapacity    string `json:"cpu_capacity"`
	MemoryCapacity string `json:"memory_capacity"`
	Schedulable    bool   `json:"schedulable"`
	Labels         string `json:"labels,omitempty"`
	Age            string `json:"age"`
}

type K8sNodeConditionInfo struct {
	Type               string `json:"type"`
	Status             string `json:"status"`
	Reason             string `json:"reason,omitempty"`
	Message            string `json:"message,omitempty"`
	LastTransitionTime string `json:"last_transition_time,omitempty"`
}

type K8sNodeTaintInfo struct {
	Key    string `json:"key"`
	Value  string `json:"value,omitempty"`
	Effect string `json:"effect,omitempty"`
}

type K8sNodeEventInfo struct {
	Type      string `json:"type"`
	Reason    string `json:"reason"`
	Message   string `json:"message"`
	Namespace string `json:"namespace,omitempty"`
	Age       string `json:"age,omitempty"`
}

type K8sNodePodInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Status    string `json:"status"`
	IP        string `json:"ip,omitempty"`
	Age       string `json:"age,omitempty"`
}

type K8sNodeDetailInfo struct {
	Name             string                 `json:"name"`
	Status           string                 `json:"status"`
	Role             string                 `json:"role"`
	Version          string                 `json:"version"`
	InternalIP       string                 `json:"internal_ip"`
	OSImage          string                 `json:"os_image,omitempty"`
	KernelVersion    string                 `json:"kernel_version,omitempty"`
	ContainerRuntime string                 `json:"container_runtime,omitempty"`
	Architecture     string                 `json:"architecture,omitempty"`
	CPUCapacity      string                 `json:"cpu_capacity,omitempty"`
	MemoryCapacity   string                 `json:"memory_capacity,omitempty"`
	PodCIDR          string                 `json:"pod_cidr,omitempty"`
	Schedulable      bool                   `json:"schedulable"`
	Age              string                 `json:"age"`
	Labels           map[string]string      `json:"labels,omitempty"`
	Annotations      map[string]string      `json:"annotations,omitempty"`
	Taints           []K8sNodeTaintInfo     `json:"taints,omitempty"`
	Conditions       []K8sNodeConditionInfo `json:"conditions,omitempty"`
	Pods             []K8sNodePodInfo       `json:"pods,omitempty"`
	Events           []K8sNodeEventInfo     `json:"events,omitempty"`
}

type K8sNamespaceInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Age    string `json:"age"`
}

type K8sSearchResult struct {
	Kind            string `json:"kind"`
	Name            string `json:"name"`
	Namespace       string `json:"namespace,omitempty"`
	Status          string `json:"status,omitempty"`
	Detail          string `json:"detail,omitempty"`
	SecondaryDetail string `json:"secondary_detail,omitempty"`
	Age             string `json:"age,omitempty"`
}

func ListDockerContainers(all bool) ([]DockerContainerInfo, error) {
	args := []string{"ps", "-q", "--no-trunc"}
	if all {
		args = []string{"ps", "-aq", "--no-trunc"}
	}
	ids, err := commandLines("docker", args...)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []DockerContainerInfo{}, nil
	}

	var payload []struct {
		ID       string   `json:"Id"`
		Name     string   `json:"Name"`
		ImageRef string   `json:"Image"`
		Created  string   `json:"Created"`
		Path     string   `json:"Path"`
		Args     []string `json:"Args"`
		Config   struct {
			Image  string            `json:"Image"`
			Labels map[string]string `json:"Labels"`
		} `json:"Config"`
		State struct {
			Status string `json:"Status"`
		} `json:"State"`
		NetworkSettings struct {
			Ports map[string][]struct {
				HostIP   string `json:"HostIp"`
				HostPort string `json:"HostPort"`
			} `json:"Ports"`
		} `json:"NetworkSettings"`
	}
	if err := dockerInspect(ids, &payload); err != nil {
		return nil, err
	}

	items := make([]DockerContainerInfo, 0, len(payload))
	for _, item := range payload {
		createdAt, _ := time.Parse(time.RFC3339Nano, item.Created)
		items = append(items, DockerContainerInfo{
			Id:      item.ID,
			Names:   []string{strings.TrimSpace(item.Name)},
			Image:   firstNonEmpty(item.Config.Image, item.ImageRef),
			ImageID: item.ImageRef,
			Command: strings.TrimSpace(strings.Join(append([]string{item.Path}, item.Args...), " ")),
			Created: createdAt.Unix(),
			State:   item.State.Status,
			Status:  item.State.Status,
			Ports:   flattenDockerPorts(item.NetworkSettings.Ports),
			Labels:  item.Config.Labels,
		})
	}
	return items, nil
}

func StartDockerContainer(containerID string) error {
	return runCommand("docker", "start", containerID)
}

func StopDockerContainer(containerID string) error {
	return runCommand("docker", "stop", containerID)
}

func GetDockerContainerLogs(containerID string, tail int) (string, error) {
	output, err := exec.Command("docker", "logs", "--tail", strconv.Itoa(tail), containerID).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker logs failed: %w", err)
	}
	return string(output), nil
}

func ListDockerImages() ([]DockerImageInfo, error) {
	ids, err := commandLines("docker", "image", "ls", "-q", "--no-trunc")
	if err != nil {
		return nil, err
	}
	ids = uniqueStrings(ids)
	if len(ids) == 0 {
		return []DockerImageInfo{}, nil
	}

	var payload []struct {
		ID          string   `json:"Id"`
		Parent      string   `json:"Parent"`
		RepoTags    []string `json:"RepoTags"`
		RepoDigests []string `json:"RepoDigests"`
		Created     string   `json:"Created"`
		Size        int64    `json:"Size"`
		VirtualSize int64    `json:"VirtualSize"`
		SharedSize  int64    `json:"SharedSize"`
		Containers  int64    `json:"Containers"`
		Config      struct {
			Labels map[string]string `json:"Labels"`
		} `json:"Config"`
	}
	if err := dockerImageInspect(ids, &payload); err != nil {
		return nil, err
	}

	items := make([]DockerImageInfo, 0, len(payload))
	for _, item := range payload {
		createdAt, _ := time.Parse(time.RFC3339Nano, item.Created)
		items = append(items, DockerImageInfo{
			Id:          item.ID,
			ParentId:    item.Parent,
			RepoTags:    item.RepoTags,
			RepoDigests: item.RepoDigests,
			Created:     createdAt.Unix(),
			Size:        item.Size,
			VirtualSize: item.VirtualSize,
			SharedSize:  item.SharedSize,
			Labels:      item.Config.Labels,
			Containers:  item.Containers,
		})
	}
	return items, nil
}

func PullDockerImage(imageName string) error {
	return runCommand("docker", "pull", imageName)
}

func ListDockerNetworks() ([]DockerNetworkInfo, error) {
	ids, err := commandLines("docker", "network", "ls", "-q")
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []DockerNetworkInfo{}, nil
	}
	var payload []struct {
		ID         string `json:"Id"`
		Name       string `json:"Name"`
		Scope      string `json:"Scope"`
		Driver     string `json:"Driver"`
		EnableIPv6 bool   `json:"EnableIPv6"`
		Internal   bool   `json:"Internal"`
		Created    string `json:"Created"`
	}
	if err := dockerNetworkInspect(ids, &payload); err != nil {
		return nil, err
	}
	items := make([]DockerNetworkInfo, 0, len(payload))
	for _, item := range payload {
		items = append(items, DockerNetworkInfo{
			Id:         item.ID,
			Name:       item.Name,
			Scope:      item.Scope,
			Driver:     item.Driver,
			EnableIPv6: item.EnableIPv6,
			Internal:   item.Internal,
			Created:    item.Created,
		})
	}
	return items, nil
}

func ListDockerVolumes() ([]DockerVolumeInfo, error) {
	names, err := commandLines("docker", "volume", "ls", "-q")
	if err != nil {
		return nil, err
	}
	if len(names) == 0 {
		return []DockerVolumeInfo{}, nil
	}
	var payload []struct {
		Name       string            `json:"Name"`
		Driver     string            `json:"Driver"`
		Mountpoint string            `json:"Mountpoint"`
		CreatedAt  string            `json:"CreatedAt"`
		Labels     map[string]string `json:"Labels"`
	}
	if err := dockerVolumeInspect(names, &payload); err != nil {
		return nil, err
	}
	items := make([]DockerVolumeInfo, 0, len(payload))
	for _, item := range payload {
		items = append(items, DockerVolumeInfo(item))
	}
	return items, nil
}

func ListDockerStacks() ([]DockerStackInfo, error) {
	items := make([]DockerStackInfo, 0)
	seen := map[string]struct{}{}
	output, err := exec.Command("docker", "stack", "ls", "--format", "{{json .}}").Output()
	if err == nil {
		lines := splitNonEmptyLines(string(output))
		for _, line := range lines {
			var raw struct {
				Name     string `json:"Name"`
				Services string `json:"Services"`
				Orch     string `json:"Orchestrator"`
			}
			if err := json.Unmarshal([]byte(line), &raw); err != nil {
				continue
			}
			services, _ := strconv.Atoi(strings.TrimSpace(raw.Services))
			items = append(items, DockerStackInfo{
				Name:      raw.Name,
				Services:  services,
				Status:    "running",
				CreatedAt: "",
				Mode:      "swarm",
			})
			seen[raw.Name] = struct{}{}
		}
	}
	root, err := runtimeStateRoot()
	if err != nil {
		return items, nil
	}
	stackRoot := filepath.Join(root, "stacks")
	entries, err := os.ReadDir(stackRoot)
	if err != nil {
		return items, nil
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		stackName := entry.Name()
		if _, exists := seen[stackName]; exists {
			continue
		}
		detail, err := GetDockerStackDetail(stackName)
		if err != nil || detail == nil {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(detail.Mode), "compose") {
			continue
		}
		servicesCount := 0
		if count := countComposeServices(detail.Compose); count > 0 {
			servicesCount = count
		}
		items = append(items, DockerStackInfo{
			Name:      detail.Name,
			Services:  servicesCount,
			Status:    "running",
			CreatedAt: detail.LastModified.Format(time.RFC3339),
			Mode:      "compose",
		})
	}
	return items, nil
}

func countComposeServices(compose string) int {
	var payload struct {
		Services map[string]any `yaml:"services"`
	}
	if err := yaml.Unmarshal([]byte(compose), &payload); err != nil {
		return 0
	}
	return len(payload.Services)
}

func ListDockerStackServices(stackName string) ([]DockerStackServiceInfo, error) {
	output, err := exec.Command("docker", "stack", "services", strings.TrimSpace(stackName), "--format", "{{json .}}").Output()
	if err != nil {
		return []DockerStackServiceInfo{}, nil
	}
	lines := splitNonEmptyLines(string(output))
	items := make([]DockerStackServiceInfo, 0, len(lines))
	for _, line := range lines {
		var raw struct {
			ID       string `json:"ID"`
			Name     string `json:"Name"`
			Image    string `json:"Image"`
			Replicas string `json:"Replicas"`
			Ports    string `json:"Ports"`
		}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}
		items = append(items, DockerStackServiceInfo{
			ID:       raw.ID,
			Name:     raw.Name,
			Image:    raw.Image,
			Replicas: raw.Replicas,
			Ports:    raw.Ports,
		})
	}
	return items, nil
}

func ScaleDockerService(serviceName string, replicas int) error {
	return runCommand("docker", "service", "scale", fmt.Sprintf("%s=%d", strings.TrimSpace(serviceName), replicas))
}

func ListKubernetesPods(namespace string) ([]K8sPodInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				NodeName string `json:"nodeName"`
			} `json:"spec"`
			Status struct {
				Phase             string `json:"phase"`
				PodIP             string `json:"podIP"`
				ContainerStatuses []struct {
					RestartCount int `json:"restartCount"`
				} `json:"containerStatuses"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSON(&payload, "get", "pods", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sPodInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		restarts := 0
		for _, status := range item.Status.ContainerStatuses {
			restarts += status.RestartCount
		}
		items = append(items, K8sPodInfo{
			Name:      item.Metadata.Name,
			Namespace: item.Metadata.Namespace,
			Status:    item.Status.Phase,
			Node:      item.Spec.NodeName,
			IP:        item.Status.PodIP,
			Restarts:  restarts,
			Age:       humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesDeployments(namespace string) ([]K8sDeploymentInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Replicas *int32 `json:"replicas"`
			} `json:"spec"`
			Status struct {
				ReadyReplicas int32 `json:"readyReplicas"`
				Conditions    []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSON(&payload, "get", "deployments", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sDeploymentInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		desired := int32(0)
		if item.Spec.Replicas != nil {
			desired = *item.Spec.Replicas
		}
		status := "Unknown"
		if item.Status.ReadyReplicas == desired && desired > 0 {
			status = "Available"
		} else if item.Status.ReadyReplicas > 0 {
			status = "Progressing"
		}
		items = append(items, K8sDeploymentInfo{
			Name:            item.Metadata.Name,
			Namespace:       item.Metadata.Namespace,
			ReadyReplicas:   item.Status.ReadyReplicas,
			DesiredReplicas: desired,
			Status:          status,
			Age:             humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesServices(namespace string) ([]K8sServiceInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Type      string `json:"type"`
				ClusterIP string `json:"clusterIP"`
				Ports     []struct {
					Port       int32  `json:"port"`
					TargetPort string `json:"targetPort"`
					Protocol   string `json:"protocol"`
				} `json:"ports"`
			} `json:"spec"`
			Status struct {
				LoadBalancer struct {
					Ingress []struct {
						IP       string `json:"ip"`
						Hostname string `json:"hostname"`
					} `json:"ingress"`
				} `json:"loadBalancer"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSON(&payload, "get", "services", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sServiceInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		ports := make([]string, 0, len(item.Spec.Ports))
		for _, port := range item.Spec.Ports {
			target := port.TargetPort
			if strings.TrimSpace(target) == "" || target == "0" {
				target = strconv.Itoa(int(port.Port))
			}
			ports = append(ports, fmt.Sprintf("%d:%s/%s", port.Port, target, strings.ToLower(port.Protocol)))
		}
		externalIP := "<none>"
		if len(item.Status.LoadBalancer.Ingress) > 0 {
			ingress := item.Status.LoadBalancer.Ingress[0]
			externalIP = firstNonEmpty(ingress.IP, ingress.Hostname)
		}
		items = append(items, K8sServiceInfo{
			Name:       item.Metadata.Name,
			Namespace:  item.Metadata.Namespace,
			Type:       item.Spec.Type,
			ClusterIP:  item.Spec.ClusterIP,
			ExternalIP: externalIP,
			Ports:      strings.Join(ports, ", "),
			Age:        humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesNodes() ([]K8sNodeInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string            `json:"name"`
				CreationTimestamp time.Time         `json:"creationTimestamp"`
				Labels            map[string]string `json:"labels"`
			} `json:"metadata"`
			Status struct {
				NodeInfo struct {
					KubeletVersion string `json:"kubeletVersion"`
				} `json:"nodeInfo"`
				Addresses []struct {
					Type    string `json:"type"`
					Address string `json:"address"`
				} `json:"addresses"`
				Conditions []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
				Capacity map[string]string `json:"capacity"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSON(&payload, "get", "nodes", "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sNodeInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		status := "Unknown"
		for _, condition := range item.Status.Conditions {
			if condition.Type == "Ready" {
				if strings.EqualFold(condition.Status, "True") {
					status = "Ready"
				} else {
					status = "NotReady"
				}
				break
			}
		}
		role := "worker"
		if _, ok := item.Metadata.Labels["node-role.kubernetes.io/control-plane"]; ok {
			role = "control-plane"
		} else if _, ok := item.Metadata.Labels["node-role.kubernetes.io/master"]; ok {
			role = "master"
		}
		internalIP := ""
		for _, address := range item.Status.Addresses {
			if address.Type == "InternalIP" {
				internalIP = address.Address
				break
			}
		}
		items = append(items, K8sNodeInfo{
			Name:           item.Metadata.Name,
			Status:         status,
			Role:           role,
			Version:        item.Status.NodeInfo.KubeletVersion,
			InternalIP:     internalIP,
			CPUCapacity:    item.Status.Capacity["cpu"],
			MemoryCapacity: item.Status.Capacity["memory"],
			Age:            humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesNamespaces() ([]K8sNamespaceInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSON(&payload, "get", "namespaces", "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sNamespaceInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		items = append(items, K8sNamespaceInfo{
			Name:   item.Metadata.Name,
			Status: item.Status.Phase,
			Age:    humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func dockerInspect(ids []string, target any) error {
	args := append([]string{"inspect"}, ids...)
	return commandJSON(target, "docker", args...)
}

func dockerImageInspect(ids []string, target any) error {
	args := append([]string{"image", "inspect"}, ids...)
	return commandJSON(target, "docker", args...)
}

func dockerNetworkInspect(ids []string, target any) error {
	args := append([]string{"network", "inspect"}, ids...)
	return commandJSON(target, "docker", args...)
}

func dockerVolumeInspect(names []string, target any) error {
	args := append([]string{"volume", "inspect"}, names...)
	return commandJSON(target, "docker", args...)
}

func kubectlJSON(target any, args ...string) error {
	return commandJSON(target, "kubectl", args...)
}

func commandJSON(target any, name string, args ...string) error {
	output, err := exec.Command(name, args...).Output()
	if err != nil {
		return fmt.Errorf("%s %s failed: %w", name, strings.Join(args, " "), err)
	}
	if err := json.Unmarshal(output, target); err != nil {
		return fmt.Errorf("parse %s output: %w", name, err)
	}
	return nil
}

func commandLines(name string, args ...string) ([]string, error) {
	output, err := exec.Command(name, args...).Output()
	if err != nil {
		return nil, fmt.Errorf("%s %s failed: %w", name, strings.Join(args, " "), err)
	}
	return splitNonEmptyLines(string(output)), nil
}

func runCommand(name string, args ...string) error {
	output, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %s failed: %s", name, strings.Join(args, " "), strings.TrimSpace(string(output)))
	}
	return nil
}

func splitNonEmptyLines(value string) []string {
	raw := strings.Split(strings.TrimSpace(value), "\n")
	items := make([]string, 0, len(raw))
	for _, item := range raw {
		item = strings.TrimSpace(item)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func flattenDockerPorts(source map[string][]struct {
	HostIP   string `json:"HostIp"`
	HostPort string `json:"HostPort"`
}) []DockerContainerPort {
	items := make([]DockerContainerPort, 0)
	for key, bindings := range source {
		parts := strings.Split(key, "/")
		privatePort, _ := strconv.Atoi(parts[0])
		protocol := ""
		if len(parts) > 1 {
			protocol = parts[1]
		}
		if len(bindings) == 0 {
			items = append(items, DockerContainerPort{
				PrivatePort: privatePort,
				Type:        protocol,
			})
			continue
		}
		for _, binding := range bindings {
			publicPort, _ := strconv.Atoi(binding.HostPort)
			items = append(items, DockerContainerPort{
				IP:          binding.HostIP,
				PrivatePort: privatePort,
				PublicPort:  publicPort,
				Type:        protocol,
			})
		}
	}
	return items
}

func humanAge(createdAt time.Time) string {
	if createdAt.IsZero() {
		return "-"
	}
	diff := time.Since(createdAt)
	if diff < time.Minute {
		return fmt.Sprintf("%ds", int(diff.Seconds()))
	}
	if diff < time.Hour {
		return fmt.Sprintf("%dm", int(diff.Minutes()))
	}
	if diff < 24*time.Hour {
		return fmt.Sprintf("%dh", int(diff.Hours()))
	}
	return fmt.Sprintf("%dd", int(diff.Hours()/24))
}

func uniqueStrings(items []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}
	return result
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
