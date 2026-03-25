package collector

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type ImportedKubernetesEnvironment struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Endpoint       string    `json:"endpoint,omitempty"`
	Context        string    `json:"context"`
	KubeconfigPath string    `json:"kubeconfig_path"`
	ImportedAt     time.Time `json:"imported_at"`
}

type K8sIngressInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	ClassName string `json:"class_name"`
	Hosts     string `json:"hosts"`
	Address   string `json:"address"`
	Ports     string `json:"ports"`
	Age       string `json:"age"`
}

type K8sConfigMapInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	DataCount int    `json:"data_count"`
	Immutable bool   `json:"immutable"`
	Age       string `json:"age"`
}

type K8sSecretInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Type      string `json:"type"`
	DataCount int    `json:"data_count"`
	Age       string `json:"age"`
}

type K8sPersistentVolumeInfo struct {
	Name          string `json:"name"`
	Capacity      string `json:"capacity"`
	AccessModes   string `json:"access_modes"`
	ReclaimPolicy string `json:"reclaim_policy"`
	Status        string `json:"status"`
	Claim         string `json:"claim"`
	StorageClass  string `json:"storage_class"`
	Age           string `json:"age"`
}

type K8sPersistentVolumeClaimInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Status       string `json:"status"`
	Volume       string `json:"volume"`
	Capacity     string `json:"capacity"`
	AccessModes  string `json:"access_modes"`
	StorageClass string `json:"storage_class"`
	Age          string `json:"age"`
}

type K8sJobInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Completions string `json:"completions"`
	Duration    string `json:"duration"`
	Age         string `json:"age"`
}

type K8sCronJobInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Schedule     string `json:"schedule"`
	Suspend      bool   `json:"suspend"`
	Active       int    `json:"active"`
	LastSchedule string `json:"last_schedule"`
	Age          string `json:"age"`
}

type HelmReleaseInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Revision   string `json:"revision"`
	Updated    string `json:"updated"`
	Status     string `json:"status"`
	Chart      string `json:"chart"`
	AppVersion string `json:"app_version"`
}

type K8sGenericResourceInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace,omitempty"`
	Kind            string `json:"kind"`
	Status          string `json:"status,omitempty"`
	Detail          string `json:"detail,omitempty"`
	SecondaryDetail string `json:"secondary_detail,omitempty"`
	Group           string `json:"group,omitempty"`
	Version         string `json:"version,omitempty"`
	Plural          string `json:"plural,omitempty"`
	ResourceKind    string `json:"resource_kind,omitempty"`
	Scope           string `json:"scope,omitempty"`
	Age             string `json:"age"`
}

type KubernetesTopologyNode struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Label  string `json:"label"`
	Status string `json:"status,omitempty"`
}

type KubernetesTopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

type KubernetesTopologyGraph struct {
	Nodes []KubernetesTopologyNode `json:"nodes"`
	Edges []KubernetesTopologyEdge `json:"edges"`
}

type KubernetesManifestHistoryEntry struct {
	ID            string    `json:"id"`
	EnvironmentID string    `json:"environment_id"`
	Kind          string    `json:"kind"`
	Name          string    `json:"name"`
	Namespace     string    `json:"namespace,omitempty"`
	Manifest      string    `json:"manifest"`
	CreatedAt     time.Time `json:"created_at"`
}

type KubernetesExecSession struct {
	Stdin   io.WriteCloser
	Stdout  io.ReadCloser
	Stderr  io.ReadCloser
	Wait    func() error
	Close   func() error
	Resize  func(cols, rows uint16) error
	Command *exec.Cmd
}

type KubernetesNodeDebugSessionInfo struct {
	NodeName  string `json:"node_name"`
	Namespace string `json:"namespace"`
	PodName   string `json:"pod_name"`
	Image     string `json:"image"`
	Output    string `json:"output,omitempty"`
}

func ImportKubernetesKubeconfig(displayName string, content []byte) ([]ImportedKubernetesEnvironment, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return nil, err
	}
	configDir := filepath.Join(root, "kubeconfigs")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return nil, err
	}

	importID := fmt.Sprintf("%s-%d", sanitizeFileName(firstNonEmpty(strings.TrimSpace(displayName), "cluster")), time.Now().UTC().UnixNano())
	configPath := filepath.Join(configDir, importID+".kubeconfig")
	if err := os.WriteFile(configPath, content, 0o600); err != nil {
		return nil, err
	}

	var payload struct {
		CurrentContext string `json:"current-context"`
		Contexts       []struct {
			Name    string `json:"name"`
			Context struct {
				Cluster string `json:"cluster"`
			} `json:"context"`
		} `json:"contexts"`
		Clusters []struct {
			Name    string `json:"name"`
			Cluster struct {
				Server string `json:"server"`
			} `json:"cluster"`
		} `json:"clusters"`
	}
	if err := kubectlJSONWithEnvironment("", configPath, "", &payload, "config", "view", "--raw", "-o", "json"); err != nil {
		_ = os.Remove(configPath)
		return nil, err
	}

	clusterEndpoints := map[string]string{}
	for _, cluster := range payload.Clusters {
		clusterEndpoints[strings.TrimSpace(cluster.Name)] = strings.TrimSpace(cluster.Cluster.Server)
	}

	currentName := strings.TrimSpace(payload.CurrentContext)
	imported := make([]ImportedKubernetesEnvironment, 0, len(payload.Contexts))
	for idx, item := range payload.Contexts {
		contextName := strings.TrimSpace(item.Name)
		if contextName == "" {
			continue
		}
		label := contextName
		if strings.TrimSpace(displayName) != "" {
			label = fmt.Sprintf("%s (%s)", strings.TrimSpace(displayName), contextName)
		}
		if contextName == currentName && strings.TrimSpace(displayName) == "" {
			label = contextName + " (default)"
		}
		imported = append(imported, ImportedKubernetesEnvironment{
			ID:             fmt.Sprintf("imported-k8s-%s-%d:kubernetes", sanitizeFileName(contextName), idx+1),
			Name:           label,
			Endpoint:       clusterEndpoints[strings.TrimSpace(item.Context.Cluster)],
			Context:        contextName,
			KubeconfigPath: configPath,
			ImportedAt:     time.Now().UTC(),
		})
	}
	if len(imported) == 0 {
		_ = os.Remove(configPath)
		return nil, fmt.Errorf("no Kubernetes contexts found in kubeconfig")
	}

	existing, err := ListImportedKubernetesEnvironments()
	if err != nil {
		return nil, err
	}
	filteredExisting := make([]ImportedKubernetesEnvironment, 0, len(existing))
	existingByID := map[string]struct{}{}
	for _, item := range imported {
		existingByID[item.ID] = struct{}{}
	}
	for _, item := range existing {
		if _, duplicate := existingByID[item.ID]; duplicate {
			continue
		}
		filteredExisting = append(filteredExisting, item)
	}
	merged := append(filteredExisting, imported...)
	if err := writeImportedKubernetesEnvironments(merged); err != nil {
		return nil, err
	}
	return imported, nil
}

func ListImportedKubernetesEnvironments() ([]ImportedKubernetesEnvironment, error) {
	path, err := importedKubernetesEnvironmentsPath()
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []ImportedKubernetesEnvironment{}, nil
		}
		return nil, err
	}
	var items []ImportedKubernetesEnvironment
	if err := json.Unmarshal(content, &items); err != nil {
		return nil, err
	}
	filtered := make([]ImportedKubernetesEnvironment, 0, len(items))
	for _, item := range items {
		if strings.TrimSpace(item.ID) == "" || strings.TrimSpace(item.Context) == "" || strings.TrimSpace(item.KubeconfigPath) == "" {
			continue
		}
		if _, err := os.Stat(item.KubeconfigPath); err != nil {
			continue
		}
		filtered = append(filtered, item)
	}
	if len(filtered) != len(items) {
		_ = writeImportedKubernetesEnvironments(filtered)
	}
	return filtered, nil
}

func IsImportedKubernetesEnvironment(environmentID string) bool {
	item, err := FindImportedKubernetesEnvironment(environmentID)
	return err == nil && item != nil
}

func FindImportedKubernetesEnvironment(environmentID string) (*ImportedKubernetesEnvironment, error) {
	items, err := ListImportedKubernetesEnvironments()
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		if strings.EqualFold(strings.TrimSpace(item.ID), strings.TrimSpace(environmentID)) {
			candidate := item
			return &candidate, nil
		}
	}
	return nil, fmt.Errorf("imported kubernetes environment not found")
}

func CollectKubernetesInventoryForEnvironment(environmentID string) (*KubernetesInventorySummary, error) {
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return nil, err
	}

	versionOutput, err := kubectlOutputWithEnvironment(environmentID, kubeconfigPath, contextName, "version", "--output=json")
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

	nodes, readyNodes, err := collectNodeCountsForEnvironment(environmentID, kubeconfigPath, contextName)
	if err != nil {
		return nil, err
	}
	namespaces, err := countKubernetesItemsForEnvironment(environmentID, kubeconfigPath, contextName, "namespaces")
	if err != nil {
		return nil, err
	}
	pods, err := countKubernetesItemsForEnvironment(environmentID, kubeconfigPath, contextName, "pods", "-A")
	if err != nil {
		return nil, err
	}

	return &KubernetesInventorySummary{
		ServerVersion: strings.TrimSpace(versionPayload.ServerVersion.GitVersion),
		Context:       firstNonEmpty(strings.TrimSpace(contextName), strings.TrimSpace(runCommandText("kubectl", "config", "current-context"))),
		Nodes:         nodes,
		ReadyNodes:    readyNodes,
		Namespaces:    namespaces,
		Pods:          pods,
	}, nil
}

func ListKubernetesPodsForEnvironment(environmentID, namespace string) ([]K8sPodInfo, error) {
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
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "pods", "-n", namespace, "-o", "json"); err != nil {
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

func ListKubernetesDeploymentsForEnvironment(environmentID, namespace string) ([]K8sDeploymentInfo, error) {
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
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "deployments", "-n", namespace, "-o", "json"); err != nil {
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

func ListKubernetesServicesForEnvironment(environmentID, namespace string) ([]K8sServiceInfo, error) {
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
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "services", "-n", namespace, "-o", "json"); err != nil {
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

func ListKubernetesIngressesForEnvironment(environmentID, namespace string) ([]K8sIngressInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				IngressClassName string `json:"ingressClassName"`
				TLS              []struct {
					Hosts []string `json:"hosts"`
				} `json:"tls"`
				Rules []struct {
					Host string `json:"host"`
				} `json:"rules"`
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
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "ingresses", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sIngressInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		hosts := make([]string, 0, len(item.Spec.Rules))
		for _, rule := range item.Spec.Rules {
			if strings.TrimSpace(rule.Host) != "" {
				hosts = append(hosts, strings.TrimSpace(rule.Host))
			}
		}
		addresses := make([]string, 0, len(item.Status.LoadBalancer.Ingress))
		for _, ingress := range item.Status.LoadBalancer.Ingress {
			addresses = append(addresses, firstNonEmpty(ingress.IP, ingress.Hostname))
		}
		items = append(items, K8sIngressInfo{
			Name:      item.Metadata.Name,
			Namespace: item.Metadata.Namespace,
			ClassName: firstNonEmpty(item.Spec.IngressClassName, "default"),
			Hosts:     firstNonEmpty(strings.Join(hosts, ", "), "<none>"),
			Address:   firstNonEmpty(strings.Join(addresses, ", "), "<pending>"),
			Ports:     "80, 443",
			Age:       humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesConfigMapsForEnvironment(environmentID, namespace string) ([]K8sConfigMapInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Immutable bool              `json:"immutable"`
			Data      map[string]string `json:"data"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "configmaps", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sConfigMapInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		items = append(items, K8sConfigMapInfo{
			Name:      item.Metadata.Name,
			Namespace: item.Metadata.Namespace,
			DataCount: len(item.Data),
			Immutable: item.Immutable,
			Age:       humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesSecretsForEnvironment(environmentID, namespace string) ([]K8sSecretInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Type string            `json:"type"`
			Data map[string]string `json:"data"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "secrets", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sSecretInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		items = append(items, K8sSecretInfo{
			Name:      item.Metadata.Name,
			Namespace: item.Metadata.Namespace,
			Type:      item.Type,
			DataCount: len(item.Data),
			Age:       humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesPersistentVolumesForEnvironment(environmentID string) ([]K8sPersistentVolumeInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Capacity    map[string]string `json:"capacity"`
				AccessModes []string          `json:"accessModes"`
				ClaimRef    *struct {
					Namespace string `json:"namespace"`
					Name      string `json:"name"`
				} `json:"claimRef"`
				PersistentVolumeReclaimPolicy string `json:"persistentVolumeReclaimPolicy"`
				StorageClassName              string `json:"storageClassName"`
			} `json:"spec"`
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "pv", "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sPersistentVolumeInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		claim := "<unbound>"
		if item.Spec.ClaimRef != nil {
			claim = fmt.Sprintf("%s/%s", item.Spec.ClaimRef.Namespace, item.Spec.ClaimRef.Name)
		}
		items = append(items, K8sPersistentVolumeInfo{
			Name:          item.Metadata.Name,
			Capacity:      item.Spec.Capacity["storage"],
			AccessModes:   strings.Join(item.Spec.AccessModes, ", "),
			ReclaimPolicy: item.Spec.PersistentVolumeReclaimPolicy,
			Status:        item.Status.Phase,
			Claim:         claim,
			StorageClass:  item.Spec.StorageClassName,
			Age:           humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesPersistentVolumeClaimsForEnvironment(environmentID, namespace string) ([]K8sPersistentVolumeClaimInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				AccessModes      []string `json:"accessModes"`
				StorageClassName string   `json:"storageClassName"`
				VolumeName       string   `json:"volumeName"`
			} `json:"spec"`
			Status struct {
				Phase    string            `json:"phase"`
				Capacity map[string]string `json:"capacity"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "pvc", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sPersistentVolumeClaimInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		items = append(items, K8sPersistentVolumeClaimInfo{
			Name:         item.Metadata.Name,
			Namespace:    item.Metadata.Namespace,
			Status:       item.Status.Phase,
			Volume:       item.Spec.VolumeName,
			Capacity:     item.Status.Capacity["storage"],
			AccessModes:  strings.Join(item.Spec.AccessModes, ", "),
			StorageClass: item.Spec.StorageClassName,
			Age:          humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesJobsForEnvironment(environmentID, namespace string) ([]K8sJobInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Completions *int32 `json:"completions"`
			} `json:"spec"`
			Status struct {
				Succeeded *int32     `json:"succeeded"`
				StartTime *time.Time `json:"startTime"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "jobs", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sJobInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		desired := int32(1)
		if item.Spec.Completions != nil {
			desired = *item.Spec.Completions
		}
		succeeded := int32(0)
		if item.Status.Succeeded != nil {
			succeeded = *item.Status.Succeeded
		}
		duration := "-"
		if item.Status.StartTime != nil {
			duration = humanAge(*item.Status.StartTime)
		}
		items = append(items, K8sJobInfo{
			Name:        item.Metadata.Name,
			Namespace:   item.Metadata.Namespace,
			Completions: fmt.Sprintf("%d/%d", succeeded, desired),
			Duration:    duration,
			Age:         humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func ListKubernetesCronJobsForEnvironment(environmentID, namespace string) ([]K8sCronJobInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Spec struct {
				Schedule string `json:"schedule"`
				Suspend  bool   `json:"suspend"`
			} `json:"spec"`
			Status struct {
				Active           []json.RawMessage `json:"active"`
				LastScheduleTime *time.Time        `json:"lastScheduleTime"`
			} `json:"status"`
		} `json:"items"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "cronjobs", "-n", namespace, "-o", "json"); err != nil {
		return nil, err
	}
	items := make([]K8sCronJobInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		last := "never"
		if item.Status.LastScheduleTime != nil {
			last = humanAge(*item.Status.LastScheduleTime)
		}
		items = append(items, K8sCronJobInfo{
			Name:         item.Metadata.Name,
			Namespace:    item.Metadata.Namespace,
			Schedule:     item.Spec.Schedule,
			Suspend:      item.Spec.Suspend,
			Active:       len(item.Status.Active),
			LastSchedule: last,
			Age:          humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func GetKubernetesPodLogsForEnvironment(environmentID, namespace, podName string, tail int) (string, error) {
	output, err := kubectlOutputWithEnvironment(environmentID, "", "", "logs", "-n", namespace, "--tail", strconv.Itoa(tail), podName)
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func ExecKubernetesPodForEnvironment(environmentID, namespace, podName string, command []string) (string, error) {
	if len(command) == 0 {
		return "", fmt.Errorf("command is required")
	}
	args := []string{"exec", "-n", namespace, podName, "--"}
	args = append(args, command...)
	output, err := kubectlOutputWithEnvironment(environmentID, "", "", args...)
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func StartKubernetesPodExecSession(environmentID, namespace, podName, containerName string, shellCandidates []string) (*KubernetesExecSession, error) {
	if strings.TrimSpace(namespace) == "" {
		namespace = "default"
	}
	if len(shellCandidates) == 0 {
		shellCandidates = []string{"sh", "/bin/sh", "bash", "/bin/bash", "ash", "/bin/ash", "busybox", "/busybox/sh", "pwsh", "powershell", "cmd"}
	}

	if runtime.GOOS != "windows" {
		for _, candidate := range shellCandidates {
			if session, err := startKubernetesExecPTYSession(environmentID, namespace, podName, containerName, []string{candidate}); err == nil {
				return session, nil
			}
		}
	}

	var lastErr error
	for _, candidate := range shellCandidates {
		session, err := startKubernetesExecPipeSession(environmentID, namespace, podName, containerName, []string{candidate})
		if err == nil {
			return session, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("unable to establish Kubernetes exec session")
}

func StartKubernetesNodeDebugSessionForEnvironment(environmentID, nodeName, namespace, image string) (*KubernetesNodeDebugSessionInfo, error) {
	nodeName = strings.TrimSpace(nodeName)
	if nodeName == "" {
		return nil, fmt.Errorf("node name is required")
	}
	if strings.TrimSpace(namespace) == "" {
		namespace = "default"
	}
	if strings.TrimSpace(image) == "" {
		image = "nicolaka/netshoot:latest"
	}

	podName := truncateKubernetesName("einfra-node-debug-" + sanitizeKubernetesName(nodeName))
	manifest := fmt.Sprintf(`apiVersion: v1
kind: Pod
metadata:
  name: %s
  namespace: %s
  labels:
    app.kubernetes.io/name: einfra-node-debug
    app.kubernetes.io/managed-by: einfra
    einfra.io/node-debug: "true"
    einfra.io/node-name: %s
spec:
  nodeName: %s
  hostNetwork: true
  hostPID: true
  tolerations:
    - operator: Exists
  containers:
    - name: toolbox
      image: %s
      imagePullPolicy: IfNotPresent
      command: ["sh", "-c", "sleep infinity"]
      stdin: true
      tty: true
      securityContext:
        privileged: true
      volumeMounts:
        - name: host-root
          mountPath: /host
  restartPolicy: Always
  volumes:
    - name: host-root
      hostPath:
        path: /
        type: Directory
`, podName, namespace, sanitizeManifestValue(nodeName), sanitizeManifestValue(nodeName), sanitizeManifestValue(image))

	_, _ = DeleteKubernetesResourceForEnvironment(environmentID, "pods", namespace, podName, true)
	output, err := ApplyKubernetesManifestForEnvironment(environmentID, namespace, manifest)
	if err != nil {
		return nil, err
	}
	_, _ = waitForKubernetesPodReady(environmentID, namespace, podName, 30*time.Second)
	return &KubernetesNodeDebugSessionInfo{
		NodeName:  nodeName,
		Namespace: namespace,
		PodName:   podName,
		Image:     image,
		Output:    output,
	}, nil
}

func StreamKubernetesPodLogs(environmentID, namespace, podName string, tail int, follow bool, stdout io.Writer, stderr io.Writer) error {
	if strings.TrimSpace(namespace) == "" {
		namespace = "default"
	}
	args := []string{"logs", "-n", namespace, "--tail", strconv.Itoa(tail)}
	if follow {
		args = append(args, "-f")
	}
	args = append(args, podName)
	return kubectlStreamWithEnvironment(environmentID, "", "", nil, stdout, stderr, args...)
}

func ScaleKubernetesDeploymentForEnvironment(environmentID, namespace, deploymentName string, replicas int) error {
	_, err := kubectlOutputWithEnvironment(environmentID, "", "", "scale", "deployment", deploymentName, "-n", namespace, "--replicas", strconv.Itoa(replicas))
	return err
}

func RestartKubernetesDeploymentForEnvironment(environmentID, namespace, deploymentName string) error {
	_, err := kubectlOutputWithEnvironment(environmentID, "", "", "rollout", "restart", "deployment", deploymentName, "-n", namespace)
	return err
}

func ApplyKubernetesManifestForEnvironment(environmentID, namespace, manifest string) (string, error) {
	if strings.TrimSpace(manifest) == "" {
		return "", fmt.Errorf("manifest is required")
	}
	args := []string{}
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(kubeconfigPath) != "" {
		args = append(args, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		args = append(args, "--context", contextName)
	}
	if strings.TrimSpace(namespace) != "" {
		args = append(args, "--namespace", namespace)
	}
	args = append(args, "apply", "-f", "-")
	cmd := exec.Command("kubectl", args...)
	cmd.Stdin = strings.NewReader(manifest)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("kubectl %s failed: %s", strings.Join(args, " "), strings.TrimSpace(string(output)))
	}
	_ = appendKubernetesManifestHistory(environmentID, namespace, manifest)
	return string(output), nil
}

func SearchKubernetesResourcesForEnvironment(environmentID, namespace, query string) ([]K8sSearchResult, error) {
	query = strings.ToLower(strings.TrimSpace(query))
	results := make([]K8sSearchResult, 0)
	if query == "" {
		return results, nil
	}

	appendGenericMatches := func(kind string, namespaced bool) error {
		scopeNamespace := namespace
		if !namespaced {
			scopeNamespace = ""
		}
		items, err := ListGenericKubernetesResourcesForEnvironment(environmentID, kind, firstNonEmpty(scopeNamespace, "default"), namespaced)
		if err != nil {
			return nil
		}
		for _, item := range items {
			if !matchesK8sSearch(item.Name, item.Namespace, item.Status, item.Detail, item.SecondaryDetail, query) {
				continue
			}
			results = append(results, K8sSearchResult{
				Kind:            item.Kind,
				Name:            item.Name,
				Namespace:       item.Namespace,
				Status:          item.Status,
				Detail:          item.Detail,
				SecondaryDetail: item.SecondaryDetail,
				Age:             item.Age,
			})
		}
		return nil
	}

	resourceKinds := []struct {
		kind       string
		namespaced bool
	}{
		{kind: "pods", namespaced: true},
		{kind: "deployments", namespaced: true},
		{kind: "statefulsets", namespaced: true},
		{kind: "daemonsets", namespaced: true},
		{kind: "replicasets", namespaced: true},
		{kind: "services", namespaced: true},
		{kind: "ingresses", namespaced: true},
		{kind: "configmaps", namespaced: true},
		{kind: "secrets", namespaced: true},
		{kind: "jobs", namespaced: true},
		{kind: "cronjobs", namespaced: true},
		{kind: "persistentvolumeclaims", namespaced: true},
		{kind: "networkpolicies", namespaced: true},
		{kind: "serviceaccounts", namespaced: true},
		{kind: "roles", namespaced: true},
		{kind: "rolebindings", namespaced: true},
		{kind: "horizontalpodautoscalers", namespaced: true},
		{kind: "verticalpodautoscalers", namespaced: true},
		{kind: "namespaces", namespaced: false},
		{kind: "nodes", namespaced: false},
		{kind: "persistentvolumes", namespaced: false},
		{kind: "storageclasses", namespaced: false},
		{kind: "clusterroles", namespaced: false},
		{kind: "clusterrolebindings", namespaced: false},
		{kind: "customresourcedefinitions", namespaced: false},
	}
	for _, resource := range resourceKinds {
		_ = appendGenericMatches(resource.kind, resource.namespaced)
	}
	return results, nil
}

func BuildKubernetesTopologyForEnvironment(environmentID string) (*KubernetesTopologyGraph, error) {
	var podsPayload struct {
		Items []struct {
			Metadata struct {
				Name            string            `json:"name"`
				Namespace       string            `json:"namespace"`
				Labels          map[string]string `json:"labels"`
				OwnerReferences []struct {
					Kind string `json:"kind"`
					Name string `json:"name"`
				} `json:"ownerReferences"`
			} `json:"metadata"`
			Spec struct {
				NodeName string `json:"nodeName"`
				Volumes  []struct {
					Name                  string `json:"name"`
					PersistentVolumeClaim struct {
						ClaimName string `json:"claimName"`
					} `json:"persistentVolumeClaim"`
					ConfigMap struct {
						Name string `json:"name"`
					} `json:"configMap"`
					Secret struct {
						SecretName string `json:"secretName"`
					} `json:"secret"`
				} `json:"volumes"`
			} `json:"spec"`
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
		} `json:"items"`
	}
	var deployPayload struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Status struct {
				ReadyReplicas int `json:"readyReplicas"`
			} `json:"status"`
		} `json:"items"`
	}
	var servicePayload struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Spec struct {
				Selector map[string]string `json:"selector"`
				Type     string            `json:"type"`
			} `json:"spec"`
		} `json:"items"`
	}
	var ingressPayload struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Spec struct {
				DefaultBackend struct {
					Service struct {
						Name string `json:"name"`
					} `json:"service"`
				} `json:"defaultBackend"`
				Rules []struct {
					Host string `json:"host"`
					HTTP struct {
						Paths []struct {
							Backend struct {
								Service struct {
									Name string `json:"name"`
								} `json:"service"`
							} `json:"backend"`
						} `json:"paths"`
					} `json:"http"`
				} `json:"rules"`
			} `json:"spec"`
		} `json:"items"`
	}
	var pvcPayload struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
		} `json:"items"`
	}
	var nodePayload struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
			Status struct {
				Conditions []struct {
					Type   string `json:"type"`
					Status string `json:"status"`
				} `json:"conditions"`
			} `json:"status"`
		} `json:"items"`
	}

	if err := kubectlJSONForEnvironment(environmentID, &podsPayload, "get", "pods", "-A", "-o", "json"); err != nil {
		return nil, err
	}
	_ = kubectlJSONForEnvironment(environmentID, &deployPayload, "get", "deployments", "-A", "-o", "json")
	_ = kubectlJSONForEnvironment(environmentID, &servicePayload, "get", "services", "-A", "-o", "json")
	_ = kubectlJSONForEnvironment(environmentID, &ingressPayload, "get", "ingresses", "-A", "-o", "json")
	_ = kubectlJSONForEnvironment(environmentID, &pvcPayload, "get", "pvc", "-A", "-o", "json")
	_ = kubectlJSONForEnvironment(environmentID, &nodePayload, "get", "nodes", "-o", "json")

	graph := &KubernetesTopologyGraph{
		Nodes: []KubernetesTopologyNode{},
		Edges: []KubernetesTopologyEdge{},
	}
	seenNodes := map[string]struct{}{}
	addNode := func(id, kind, label, status string) {
		if _, exists := seenNodes[id]; exists {
			return
		}
		seenNodes[id] = struct{}{}
		graph.Nodes = append(graph.Nodes, KubernetesTopologyNode{ID: id, Kind: kind, Label: label, Status: status})
	}
	addEdge := func(source, target, label string) {
		if source == "" || target == "" {
			return
		}
		graph.Edges = append(graph.Edges, KubernetesTopologyEdge{
			ID:     fmt.Sprintf("%s-%s-%s", sanitizeFileName(source), sanitizeFileName(target), sanitizeFileName(label)),
			Source: source,
			Target: target,
			Label:  label,
		})
	}
	podLabels := map[string]map[string]string{}

	for _, item := range nodePayload.Items {
		status := "Unknown"
		for _, condition := range item.Status.Conditions {
			if condition.Type == "Ready" {
				status = condition.Status
				break
			}
		}
		addNode("node:"+item.Metadata.Name, "node", item.Metadata.Name, status)
	}
	for _, item := range deployPayload.Items {
		addNode("deployment:"+item.Metadata.Namespace+"/"+item.Metadata.Name, "deployment", item.Metadata.Name, fmt.Sprintf("ready %d", item.Status.ReadyReplicas))
	}
	for _, item := range servicePayload.Items {
		addNode("service:"+item.Metadata.Namespace+"/"+item.Metadata.Name, "service", item.Metadata.Name, item.Spec.Type)
	}
	for _, item := range ingressPayload.Items {
		addNode("ingress:"+item.Metadata.Namespace+"/"+item.Metadata.Name, "ingress", item.Metadata.Name, "routing")
	}
	for _, item := range pvcPayload.Items {
		addNode("pvc:"+item.Metadata.Namespace+"/"+item.Metadata.Name, "pvc", item.Metadata.Name, item.Status.Phase)
	}
	for _, item := range podsPayload.Items {
		podID := "pod:" + item.Metadata.Namespace + "/" + item.Metadata.Name
		addNode(podID, "pod", item.Metadata.Name, item.Status.Phase)
		podLabels[podID] = item.Metadata.Labels
		if strings.TrimSpace(item.Spec.NodeName) != "" {
			addEdge("node:"+item.Spec.NodeName, podID, "schedules")
		}
		for _, owner := range item.Metadata.OwnerReferences {
			switch strings.ToLower(strings.TrimSpace(owner.Kind)) {
			case "replicaset":
				name := strings.TrimSpace(owner.Name)
				if idx := strings.LastIndex(name, "-"); idx > 0 {
					name = name[:idx]
				}
				addNode("deployment:"+item.Metadata.Namespace+"/"+name, "deployment", name, "")
				addEdge("deployment:"+item.Metadata.Namespace+"/"+name, podID, "owns")
			case "statefulset", "daemonset", "job":
				ownerKind := strings.ToLower(strings.TrimSpace(owner.Kind))
				ownerID := ownerKind + ":" + item.Metadata.Namespace + "/" + strings.TrimSpace(owner.Name)
				addNode(ownerID, ownerKind, strings.TrimSpace(owner.Name), "")
				addEdge(ownerID, podID, "owns")
			}
		}
		for _, volume := range item.Spec.Volumes {
			if strings.TrimSpace(volume.PersistentVolumeClaim.ClaimName) != "" {
				addEdge(podID, "pvc:"+item.Metadata.Namespace+"/"+volume.PersistentVolumeClaim.ClaimName, "mounts")
			}
			if strings.TrimSpace(volume.ConfigMap.Name) != "" {
				configID := "configmap:" + item.Metadata.Namespace + "/" + volume.ConfigMap.Name
				addNode(configID, "configmap", volume.ConfigMap.Name, "")
				addEdge(configID, podID, "injects")
			}
			if strings.TrimSpace(volume.Secret.SecretName) != "" {
				secretID := "secret:" + item.Metadata.Namespace + "/" + volume.Secret.SecretName
				addNode(secretID, "secret", volume.Secret.SecretName, "")
				addEdge(secretID, podID, "injects")
			}
		}
	}
	for _, item := range servicePayload.Items {
		serviceID := "service:" + item.Metadata.Namespace + "/" + item.Metadata.Name
		for podID, labels := range podLabels {
			if labelsMatchSelector(labels, item.Spec.Selector) {
				addEdge(serviceID, podID, "targets")
			}
		}
	}
	for _, item := range ingressPayload.Items {
		ingressID := "ingress:" + item.Metadata.Namespace + "/" + item.Metadata.Name
		if strings.TrimSpace(item.Spec.DefaultBackend.Service.Name) != "" {
			addEdge(ingressID, "service:"+item.Metadata.Namespace+"/"+item.Spec.DefaultBackend.Service.Name, "routes")
		}
		for _, rule := range item.Spec.Rules {
			for _, path := range rule.HTTP.Paths {
				if strings.TrimSpace(path.Backend.Service.Name) != "" {
					addEdge(ingressID, "service:"+item.Metadata.Namespace+"/"+path.Backend.Service.Name, "routes")
				}
			}
		}
	}
	return graph, nil
}

func GetKubernetesResourceYAMLForEnvironment(environmentID, kind, namespace, name string, namespaced bool) (string, error) {
	if strings.TrimSpace(kind) == "" || strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("kind and name are required")
	}
	args := []string{"get", kind, name}
	if namespaced && strings.TrimSpace(namespace) != "" {
		args = append(args, "-n", namespace)
	}
	args = append(args, "-o", "yaml")
	output, err := kubectlOutputWithEnvironment(environmentID, "", "", args...)
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func DeleteKubernetesResourceForEnvironment(environmentID, kind, namespace, name string, namespaced bool) (string, error) {
	if strings.TrimSpace(kind) == "" || strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("kind and name are required")
	}
	args := []string{"delete", kind, name}
	if namespaced && strings.TrimSpace(namespace) != "" {
		args = append(args, "-n", namespace)
	}
	output, err := kubectlOutputWithEnvironment(environmentID, "", "", args...)
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func ListHelmReleasesForEnvironment(environmentID string) ([]HelmReleaseInfo, error) {
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return nil, err
	}
	args := []string{}
	if strings.TrimSpace(kubeconfigPath) != "" {
		args = append(args, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		args = append(args, "--kube-context", contextName)
	}
	args = append(args, "list", "-A", "-o", "json")
	output, err := exec.Command("helm", args...).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("helm %s failed: %s", strings.Join(args, " "), strings.TrimSpace(string(output)))
	}
	var payload []struct {
		Name       string `json:"name"`
		Namespace  string `json:"namespace"`
		Revision   string `json:"revision"`
		Updated    string `json:"updated"`
		Status     string `json:"status"`
		Chart      string `json:"chart"`
		AppVersion string `json:"app_version"`
	}
	if err := json.Unmarshal(output, &payload); err != nil {
		return nil, err
	}
	items := make([]HelmReleaseInfo, 0, len(payload))
	for _, item := range payload {
		items = append(items, HelmReleaseInfo{
			Name:       item.Name,
			Namespace:  item.Namespace,
			Revision:   item.Revision,
			Updated:    item.Updated,
			Status:     item.Status,
			Chart:      item.Chart,
			AppVersion: item.AppVersion,
		})
	}
	return items, nil
}

func InstallHelmReleaseForEnvironment(environmentID, namespace, releaseName, chartRef, valuesYAML string) (string, error) {
	if strings.TrimSpace(releaseName) == "" || strings.TrimSpace(chartRef) == "" {
		return "", fmt.Errorf("release name and chart are required")
	}
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return "", err
	}
	args := []string{}
	if strings.TrimSpace(kubeconfigPath) != "" {
		args = append(args, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		args = append(args, "--kube-context", contextName)
	}
	args = append(args, "upgrade", "--install", releaseName, chartRef, "--namespace", firstNonEmpty(namespace, "default"), "--create-namespace")
	if strings.TrimSpace(valuesYAML) != "" {
		args = append(args, "-f", "-")
	}
	cmd := exec.Command("helm", args...)
	if strings.TrimSpace(valuesYAML) != "" {
		cmd.Stdin = strings.NewReader(valuesYAML)
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("helm %s failed: %s", strings.Join(args, " "), strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func UninstallHelmReleaseForEnvironment(environmentID, namespace, releaseName string) (string, error) {
	if strings.TrimSpace(releaseName) == "" {
		return "", fmt.Errorf("release name is required")
	}
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return "", err
	}
	args := []string{}
	if strings.TrimSpace(kubeconfigPath) != "" {
		args = append(args, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		args = append(args, "--kube-context", contextName)
	}
	args = append(args, "uninstall", releaseName, "--namespace", firstNonEmpty(namespace, "default"))
	output, err := exec.Command("helm", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("helm %s failed: %s", strings.Join(args, " "), strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func GenerateKubernetesAgentBootstrap(environmentID, agentToken, agentImage string) (string, error) {
	if strings.TrimSpace(agentToken) == "" {
		return "", fmt.Errorf("agent token is required")
	}
	image := firstNonEmpty(strings.TrimSpace(agentImage), "ghcr.io/einfra/kube-agent:latest")
	manifest := fmt.Sprintf(`apiVersion: v1
kind: Namespace
metadata:
  name: einfra-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: einfra-kube-agent
  namespace: einfra-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: einfra-kube-agent
  template:
    metadata:
      labels:
        app: einfra-kube-agent
    spec:
      serviceAccountName: default
      containers:
      - name: agent
        image: %s
        imagePullPolicy: IfNotPresent
        env:
        - name: EINFRA_AGENT_TOKEN
          value: %s
        - name: EINFRA_ENVIRONMENT_ID
          value: %s
`, image, agentToken, environmentID)
	return manifest, nil
}

func ListKubernetesNodesForEnvironment(environmentID string) ([]K8sNodeInfo, error) {
	var payload struct {
		Items []struct {
			Metadata struct {
				Name              string            `json:"name"`
				CreationTimestamp time.Time         `json:"creationTimestamp"`
				Labels            map[string]string `json:"labels"`
			} `json:"metadata"`
			Spec struct {
				Unschedulable bool `json:"unschedulable"`
			} `json:"spec"`
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
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "nodes", "-o", "json"); err != nil {
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
		role := summarizeKubernetesNodeRole(item.Metadata.Labels)
		internalIP := ""
		for _, address := range item.Status.Addresses {
			if address.Type == "InternalIP" {
				internalIP = address.Address
				break
			}
		}
		labelPairs := make([]string, 0, len(item.Metadata.Labels))
		for key, value := range item.Metadata.Labels {
			if strings.HasPrefix(key, "node-role.kubernetes.io/") {
				if strings.TrimSpace(value) == "" {
					labelPairs = append(labelPairs, key)
				} else {
					labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", key, value))
				}
				continue
			}
			if strings.HasPrefix(key, "topology.kubernetes.io/") || strings.HasPrefix(key, "kubernetes.io/hostname") {
				labelPairs = append(labelPairs, fmt.Sprintf("%s=%s", key, value))
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
			Schedulable:    !item.Spec.Unschedulable,
			Labels:         strings.Join(labelPairs, ", "),
			Age:            humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func GetKubernetesNodeDetailForEnvironment(environmentID, nodeName string) (*K8sNodeDetailInfo, error) {
	nodeName = strings.TrimSpace(nodeName)
	if nodeName == "" {
		return nil, fmt.Errorf("node name is required")
	}

	var nodePayload struct {
		Metadata struct {
			Name              string            `json:"name"`
			CreationTimestamp time.Time         `json:"creationTimestamp"`
			Labels            map[string]string `json:"labels"`
			Annotations       map[string]string `json:"annotations"`
		} `json:"metadata"`
		Spec struct {
			Unschedulable bool   `json:"unschedulable"`
			PodCIDR       string `json:"podCIDR"`
			Taints        []struct {
				Key    string `json:"key"`
				Value  string `json:"value"`
				Effect string `json:"effect"`
			} `json:"taints"`
		} `json:"spec"`
		Status struct {
			NodeInfo struct {
				KubeletVersion          string `json:"kubeletVersion"`
				OSImage                 string `json:"osImage"`
				KernelVersion           string `json:"kernelVersion"`
				ContainerRuntimeVersion string `json:"containerRuntimeVersion"`
				Architecture            string `json:"architecture"`
			} `json:"nodeInfo"`
			Addresses []struct {
				Type    string `json:"type"`
				Address string `json:"address"`
			} `json:"addresses"`
			Conditions []struct {
				Type               string    `json:"type"`
				Status             string    `json:"status"`
				Reason             string    `json:"reason"`
				Message            string    `json:"message"`
				LastTransitionTime time.Time `json:"lastTransitionTime"`
			} `json:"conditions"`
			Capacity map[string]string `json:"capacity"`
		} `json:"status"`
	}
	if err := kubectlJSONForEnvironment(environmentID, &nodePayload, "get", "node", nodeName, "-o", "json"); err != nil {
		return nil, err
	}

	internalIP := ""
	for _, address := range nodePayload.Status.Addresses {
		if address.Type == "InternalIP" {
			internalIP = address.Address
			break
		}
	}

	conditions := make([]K8sNodeConditionInfo, 0, len(nodePayload.Status.Conditions))
	for _, condition := range nodePayload.Status.Conditions {
		conditions = append(conditions, K8sNodeConditionInfo{
			Type:               condition.Type,
			Status:             condition.Status,
			Reason:             strings.TrimSpace(condition.Reason),
			Message:            strings.TrimSpace(condition.Message),
			LastTransitionTime: humanAge(condition.LastTransitionTime),
		})
	}

	taints := make([]K8sNodeTaintInfo, 0, len(nodePayload.Spec.Taints))
	for _, taint := range nodePayload.Spec.Taints {
		taints = append(taints, K8sNodeTaintInfo{
			Key:    taint.Key,
			Value:  taint.Value,
			Effect: taint.Effect,
		})
	}

	var podsPayload struct {
		Items []struct {
			Metadata struct {
				Name              string    `json:"name"`
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Status struct {
				Phase string `json:"phase"`
				PodIP string `json:"podIP"`
			} `json:"status"`
		} `json:"items"`
	}
	pods := []K8sNodePodInfo{}
	if err := kubectlJSONForEnvironment(environmentID, &podsPayload, "get", "pods", "-A", "--field-selector", fmt.Sprintf("spec.nodeName=%s", nodeName), "-o", "json"); err == nil {
		pods = make([]K8sNodePodInfo, 0, len(podsPayload.Items))
		for _, item := range podsPayload.Items {
			pods = append(pods, K8sNodePodInfo{
				Name:      item.Metadata.Name,
				Namespace: item.Metadata.Namespace,
				Status:    item.Status.Phase,
				IP:        item.Status.PodIP,
				Age:       humanAge(item.Metadata.CreationTimestamp),
			})
		}
	}

	var eventsPayload struct {
		Items []struct {
			Metadata struct {
				Namespace         string    `json:"namespace"`
				CreationTimestamp time.Time `json:"creationTimestamp"`
			} `json:"metadata"`
			Type    string `json:"type"`
			Reason  string `json:"reason"`
			Message string `json:"message"`
		} `json:"items"`
	}
	events := []K8sNodeEventInfo{}
	if err := kubectlJSONForEnvironment(
		environmentID,
		&eventsPayload,
		"get", "events", "-A",
		"--field-selector", fmt.Sprintf("involvedObject.kind=Node,involvedObject.name=%s", nodeName),
		"-o", "json",
	); err == nil {
		events = make([]K8sNodeEventInfo, 0, len(eventsPayload.Items))
		for _, item := range eventsPayload.Items {
			events = append(events, K8sNodeEventInfo{
				Type:      strings.TrimSpace(item.Type),
				Reason:    strings.TrimSpace(item.Reason),
				Message:   strings.TrimSpace(item.Message),
				Namespace: strings.TrimSpace(item.Metadata.Namespace),
				Age:       humanAge(item.Metadata.CreationTimestamp),
			})
		}
	}

	nodeStatus := "Unknown"
	for _, condition := range nodePayload.Status.Conditions {
		if condition.Type == "Ready" {
			if strings.EqualFold(condition.Status, "True") {
				nodeStatus = "Ready"
			} else {
				nodeStatus = "NotReady"
			}
			break
		}
	}

	return &K8sNodeDetailInfo{
		Name:             nodePayload.Metadata.Name,
		Status:           nodeStatus,
		Role:             summarizeKubernetesNodeRole(nodePayload.Metadata.Labels),
		Version:          nodePayload.Status.NodeInfo.KubeletVersion,
		InternalIP:       internalIP,
		OSImage:          nodePayload.Status.NodeInfo.OSImage,
		KernelVersion:    nodePayload.Status.NodeInfo.KernelVersion,
		ContainerRuntime: nodePayload.Status.NodeInfo.ContainerRuntimeVersion,
		Architecture:     nodePayload.Status.NodeInfo.Architecture,
		CPUCapacity:      nodePayload.Status.Capacity["cpu"],
		MemoryCapacity:   nodePayload.Status.Capacity["memory"],
		PodCIDR:          nodePayload.Spec.PodCIDR,
		Schedulable:      !nodePayload.Spec.Unschedulable,
		Age:              humanAge(nodePayload.Metadata.CreationTimestamp),
		Labels:           nodePayload.Metadata.Labels,
		Annotations:      nodePayload.Metadata.Annotations,
		Taints:           taints,
		Conditions:       conditions,
		Pods:             pods,
		Events:           events,
	}, nil
}

func DescribeKubernetesNodeForEnvironment(environmentID, nodeName string) (string, error) {
	output, err := kubectlOutputWithEnvironment(environmentID, "", "", "describe", "node", strings.TrimSpace(nodeName))
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func CordonKubernetesNodeForEnvironment(environmentID, nodeName string) error {
	_, err := kubectlOutputWithEnvironment(environmentID, "", "", "cordon", strings.TrimSpace(nodeName))
	return err
}

func UncordonKubernetesNodeForEnvironment(environmentID, nodeName string) error {
	_, err := kubectlOutputWithEnvironment(environmentID, "", "", "uncordon", strings.TrimSpace(nodeName))
	return err
}

func DrainKubernetesNodeForEnvironment(environmentID, nodeName string) error {
	_, err := kubectlOutputWithEnvironment(
		environmentID,
		"",
		"",
		"drain",
		strings.TrimSpace(nodeName),
		"--ignore-daemonsets",
		"--delete-emptydir-data",
		"--force",
		"--grace-period=30",
		"--timeout=120s",
	)
	return err
}

func ListKubernetesNamespacesForEnvironment(environmentID string) ([]K8sNamespaceInfo, error) {
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
	if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "namespaces", "-o", "json"); err != nil {
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

func ListGenericKubernetesResourcesForEnvironment(environmentID, kind, namespace string, namespaced bool) ([]K8sGenericResourceInfo, error) {
	var payload struct {
		Items []struct {
			Kind     string `json:"kind"`
			Metadata struct {
				Name              string            `json:"name"`
				Namespace         string            `json:"namespace"`
				CreationTimestamp time.Time         `json:"creationTimestamp"`
				Labels            map[string]string `json:"labels"`
			} `json:"metadata"`
			Spec   map[string]any `json:"spec"`
			Status map[string]any `json:"status"`
		} `json:"items"`
	}
	args := []string{"get", kind}
	if namespaced {
		args = append(args, "-n", namespace)
	}
	args = append(args, "-o", "json")
	if err := kubectlJSONForEnvironment(environmentID, &payload, args...); err != nil {
		return nil, err
	}
	items := make([]K8sGenericResourceInfo, 0, len(payload.Items))
	for _, item := range payload.Items {
		status, detail, secondary := summarizeGenericKubernetesResource(strings.ToLower(strings.TrimSpace(kind)), item.Spec, item.Status, item.Metadata.Labels)
		group, version, plural, resourceKind, scope := extractGenericResourceMetadata(strings.ToLower(strings.TrimSpace(kind)), item.Spec)
		items = append(items, K8sGenericResourceInfo{
			Name:            item.Metadata.Name,
			Namespace:       item.Metadata.Namespace,
			Kind:            firstNonEmpty(item.Kind, kind),
			Status:          status,
			Detail:          detail,
			SecondaryDetail: secondary,
			Group:           group,
			Version:         version,
			Plural:          plural,
			ResourceKind:    resourceKind,
			Scope:           scope,
			Age:             humanAge(item.Metadata.CreationTimestamp),
		})
	}
	return items, nil
}

func summarizeKubernetesNodeRole(labels map[string]string) string {
	role := "worker"
	if _, ok := labels["node-role.kubernetes.io/control-plane"]; ok {
		return "control-plane"
	}
	if _, ok := labels["node-role.kubernetes.io/master"]; ok {
		return "master"
	}
	return role
}

func extractGenericResourceMetadata(kind string, spec map[string]any) (string, string, string, string, string) {
	switch kind {
	case "customresourcedefinitions", "crd", "crds":
		group := strings.TrimSpace(stringFromMap(spec, "group"))
		scope := strings.TrimSpace(stringFromMap(spec, "scope"))
		plural := strings.TrimSpace(stringFromMap(spec, "names", "plural"))
		resourceKind := strings.TrimSpace(stringFromMap(spec, "names", "kind"))
		version := firstCRDVersion(spec)
		return group, version, plural, resourceKind, scope
	default:
		return "", "", "", "", ""
	}
}

func firstCRDVersion(spec map[string]any) string {
	value := nestedValue(spec, "versions")
	versions, ok := value.([]any)
	if ok {
		for _, item := range versions {
			entry, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if name := strings.TrimSpace(stringFromMap(entry, "name")); name != "" {
				return name
			}
		}
	}
	return strings.TrimSpace(stringFromMap(spec, "version"))
}

func summarizeGenericKubernetesResource(kind string, spec map[string]any, status map[string]any, labels map[string]string) (string, string, string) {
	switch kind {
	case "statefulsets", "statefulset":
		ready := intFromMap(status, "readyReplicas")
		desired := intFromMap(spec, "replicas")
		if desired == 0 {
			desired = 1
		}
		return fmt.Sprintf("%d/%d ready", ready, desired), firstNonEmpty(stringFromMap(spec, "serviceName"), "service: none"), fmt.Sprintf("update: %s", firstNonEmpty(stringFromMap(spec, "updateStrategy", "type"), "RollingUpdate"))
	case "daemonsets", "daemonset":
		ready := intFromMap(status, "numberReady")
		desired := intFromMap(status, "desiredNumberScheduled")
		return fmt.Sprintf("%d/%d ready", ready, desired), fmt.Sprintf("available: %d", intFromMap(status, "numberAvailable")), fmt.Sprintf("updated: %d", intFromMap(status, "updatedNumberScheduled"))
	case "replicasets", "replicaset":
		ready := intFromMap(status, "readyReplicas")
		desired := intFromMap(spec, "replicas")
		return fmt.Sprintf("%d/%d ready", ready, desired), fmt.Sprintf("available: %d", intFromMap(status, "availableReplicas")), fmt.Sprintf("selector labels: %d", len(labels))
	case "networkpolicies", "networkpolicy":
		return firstNonEmpty(stringFromMap(spec, "policyTypes"), "configured"), fmt.Sprintf("ingress rules: %d", sliceLenFromMap(spec, "ingress")), fmt.Sprintf("egress rules: %d", sliceLenFromMap(spec, "egress"))
	case "endpoints", "endpoint":
		return fmt.Sprintf("subsets: %d", sliceLenFromMap(spec, "subsets")), "", ""
	case "endpointslices", "endpointslice":
		return firstNonEmpty(stringFromMap(spec, "addressType"), "address type"), fmt.Sprintf("ports: %d", sliceLenFromMap(spec, "ports")), fmt.Sprintf("endpoints: %d", sliceLenFromMap(spec, "endpoints"))
	case "ingressclasses", "ingressclass":
		return firstNonEmpty(stringFromMap(spec, "controller"), "controller"), "", ""
	case "gateways", "gateway":
		return firstNonEmpty(stringFromMap(spec, "gatewayClassName"), "gateway class"), fmt.Sprintf("listeners: %d", sliceLenFromMap(spec, "listeners")), fmt.Sprintf("addresses: %d", sliceLenFromMap(status, "addresses"))
	case "gatewayclasses", "gatewayclass":
		return firstNonEmpty(stringFromMap(spec, "controllerName"), "controller"), "", ""
	case "httproutes", "httproute":
		return fmt.Sprintf("hostnames: %d", sliceLenFromMap(spec, "hostnames")), fmt.Sprintf("rules: %d", sliceLenFromMap(spec, "rules")), ""
	case "storageclasses", "storageclass":
		return firstNonEmpty(stringFromMap(spec, "provisioner"), "provisioner unknown"), fmt.Sprintf("reclaim: %s", firstNonEmpty(stringFromMap(spec, "reclaimPolicy"), "default")), fmt.Sprintf("binding: %s", firstNonEmpty(stringFromMap(spec, "volumeBindingMode"), "Immediate"))
	case "serviceaccounts", "serviceaccount":
		return "service account", fmt.Sprintf("secrets: %d", sliceLenFromMap(spec, "secrets")), fmt.Sprintf("labels: %d", len(labels))
	case "roles", "clusterroles":
		return fmt.Sprintf("rules: %d", sliceLenFromMapMap(spec, "rules")), "", ""
	case "rolebindings", "clusterrolebindings":
		return fmt.Sprintf("subjects: %d", sliceLenFromMapMap(spec, "subjects")), fmt.Sprintf("roleRef: %s", firstNonEmpty(stringFromMap(spec, "roleRef", "name"), "unknown")), ""
	case "horizontalpodautoscalers", "hpa":
		return fmt.Sprintf("%d -> %d replicas", intFromMap(spec, "minReplicas"), intFromMap(spec, "maxReplicas")), fmt.Sprintf("current: %d", intFromMap(status, "currentReplicas")), fmt.Sprintf("desired: %d", intFromMap(status, "desiredReplicas"))
	case "customresourcedefinitions", "crd", "crds":
		return firstNonEmpty(stringFromMap(spec, "group"), "custom resource"), fmt.Sprintf("scope: %s", firstNonEmpty(stringFromMap(spec, "scope"), "Namespaced")), fmt.Sprintf("versions: %d", sliceLenFromMapMap(spec, "versions"))
	default:
		return firstNonEmpty(stringFromMap(status, "phase"), "ready"), "", ""
	}
}

func intFromMap(payload map[string]any, keys ...string) int {
	value := nestedValue(payload, keys...)
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		return 0
	}
}

func stringFromMap(payload map[string]any, keys ...string) string {
	value := nestedValue(payload, keys...)
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []any:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				parts = append(parts, strings.TrimSpace(text))
			}
		}
		return strings.Join(parts, ", ")
	default:
		return ""
	}
}

func sliceLenFromMap(payload map[string]any, keys ...string) int {
	value := nestedValue(payload, keys...)
	if items, ok := value.([]any); ok {
		return len(items)
	}
	return 0
}

func sliceLenFromMapMap(payload map[string]any, keys ...string) int {
	return sliceLenFromMap(payload, keys...)
}

func nestedValue(payload map[string]any, keys ...string) any {
	current := any(payload)
	for _, key := range keys {
		nextMap, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = nextMap[key]
	}
	return current
}

func importedKubernetesEnvironmentsPath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "kubernetes-imports.json"), nil
}

func writeImportedKubernetesEnvironments(items []ImportedKubernetesEnvironment) error {
	path, err := importedKubernetesEnvironmentsPath()
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

func kubernetesExecConfig(environmentID string) (string, string, error) {
	if strings.TrimSpace(environmentID) == "" || !IsImportedKubernetesEnvironment(environmentID) {
		return "", "", nil
	}
	item, err := FindImportedKubernetesEnvironment(environmentID)
	if err != nil {
		return "", "", err
	}
	return item.Context, item.KubeconfigPath, nil
}

func kubectlJSONForEnvironment(environmentID string, target any, args ...string) error {
	contextName, kubeconfigPath, err := kubernetesExecConfig(environmentID)
	if err != nil {
		return err
	}
	return kubectlJSONWithEnvironment(environmentID, kubeconfigPath, contextName, target, args...)
}

func kubectlJSONWithEnvironment(environmentID, kubeconfigPath, contextName string, target any, args ...string) error {
	output, err := kubectlOutputWithEnvironment(environmentID, kubeconfigPath, contextName, args...)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(output, target); err != nil {
		return fmt.Errorf("parse kubectl output: %w", err)
	}
	return nil
}

func kubectlOutputWithEnvironment(environmentID, kubeconfigPath, contextName string, args ...string) ([]byte, error) {
	if strings.TrimSpace(environmentID) != "" && strings.TrimSpace(kubeconfigPath) == "" && strings.TrimSpace(contextName) == "" {
		resolvedContext, resolvedPath, err := kubernetesExecConfig(environmentID)
		if err != nil {
			return nil, err
		}
		contextName = resolvedContext
		kubeconfigPath = resolvedPath
	}
	cmdArgs := make([]string, 0, len(args)+4)
	if strings.TrimSpace(kubeconfigPath) != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		cmdArgs = append(cmdArgs, "--context", contextName)
	}
	cmdArgs = append(cmdArgs, args...)
	output, err := exec.Command("kubectl", cmdArgs...).Output()
	if err != nil {
		return nil, fmt.Errorf("kubectl %s failed: %w", strings.Join(cmdArgs, " "), err)
	}
	return output, nil
}

func kubectlStreamWithEnvironment(environmentID, kubeconfigPath, contextName string, stdin io.Reader, stdout io.Writer, stderr io.Writer, args ...string) error {
	if strings.TrimSpace(environmentID) != "" && strings.TrimSpace(kubeconfigPath) == "" && strings.TrimSpace(contextName) == "" {
		resolvedContext, resolvedPath, err := kubernetesExecConfig(environmentID)
		if err != nil {
			return err
		}
		contextName = resolvedContext
		kubeconfigPath = resolvedPath
	}
	cmdArgs := make([]string, 0, len(args)+4)
	if strings.TrimSpace(kubeconfigPath) != "" {
		cmdArgs = append(cmdArgs, "--kubeconfig", kubeconfigPath)
	}
	if strings.TrimSpace(contextName) != "" {
		cmdArgs = append(cmdArgs, "--context", contextName)
	}
	cmdArgs = append(cmdArgs, args...)
	cmd := exec.Command("kubectl", cmdArgs...)
	if stdin != nil {
		cmd.Stdin = stdin
	}
	if stdout != nil {
		cmd.Stdout = stdout
	}
	if stderr != nil {
		cmd.Stderr = stderr
	}
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("kubectl %s failed: %w", strings.Join(cmdArgs, " "), err)
	}
	return nil
}

func countKubernetesItemsForEnvironment(environmentID, kubeconfigPath, contextName, resource string, extraArgs ...string) (int, error) {
	args := []string{"get", resource}
	args = append(args, extraArgs...)
	args = append(args, "-o", "json")
	var payload struct {
		Items []json.RawMessage `json:"items"`
	}
	if err := kubectlJSONWithEnvironment(environmentID, kubeconfigPath, contextName, &payload, args...); err != nil {
		return 0, err
	}
	return len(payload.Items), nil
}

func collectNodeCountsForEnvironment(environmentID, kubeconfigPath, contextName string) (int, int, error) {
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
	if err := kubectlJSONWithEnvironment(environmentID, kubeconfigPath, contextName, &payload, "get", "nodes", "-o", "json"); err != nil {
		return 0, 0, err
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

func appendKubernetesManifestHistory(environmentID, defaultNamespace, manifest string) error {
	entries, err := parseKubernetesManifestEntries(environmentID, defaultNamespace, manifest)
	if err != nil || len(entries) == 0 {
		return err
	}
	path, err := kubernetesManifestHistoryPath()
	if err != nil {
		return err
	}
	var existing []KubernetesManifestHistoryEntry
	content, readErr := os.ReadFile(path)
	if readErr == nil {
		_ = json.Unmarshal(content, &existing)
	}
	existing = append(entries, existing...)
	if len(existing) > 300 {
		existing = existing[:300]
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	payload, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, payload, 0o600)
}

func ListKubernetesManifestHistory(environmentID, kind, namespace, name string) ([]KubernetesManifestHistoryEntry, error) {
	path, err := kubernetesManifestHistoryPath()
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []KubernetesManifestHistoryEntry{}, nil
		}
		return nil, err
	}
	var items []KubernetesManifestHistoryEntry
	if err := json.Unmarshal(content, &items); err != nil {
		return nil, err
	}
	filtered := make([]KubernetesManifestHistoryEntry, 0, len(items))
	for _, item := range items {
		if !strings.EqualFold(strings.TrimSpace(item.EnvironmentID), strings.TrimSpace(environmentID)) {
			continue
		}
		if kind != "" && !strings.EqualFold(strings.TrimSpace(item.Kind), strings.TrimSpace(kind)) {
			continue
		}
		if name != "" && !strings.EqualFold(strings.TrimSpace(item.Name), strings.TrimSpace(name)) {
			continue
		}
		if namespace != "" && !strings.EqualFold(strings.TrimSpace(item.Namespace), strings.TrimSpace(namespace)) {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered, nil
}

func RollbackKubernetesManifestRevision(environmentID, revisionID string) (string, error) {
	history, err := ListKubernetesManifestHistory(environmentID, "", "", "")
	if err != nil {
		return "", err
	}
	for _, item := range history {
		if strings.EqualFold(strings.TrimSpace(item.ID), strings.TrimSpace(revisionID)) {
			return ApplyKubernetesManifestForEnvironment(environmentID, item.Namespace, item.Manifest)
		}
	}
	return "", fmt.Errorf("manifest revision not found")
}

func kubernetesManifestHistoryPath() (string, error) {
	root, err := runtimeStateRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "kubernetes-manifest-history.json"), nil
}

func parseKubernetesManifestEntries(environmentID, defaultNamespace, manifest string) ([]KubernetesManifestHistoryEntry, error) {
	decoder := yaml.NewDecoder(strings.NewReader(manifest))
	entries := []KubernetesManifestHistoryEntry{}
	for {
		var node map[string]any
		if err := decoder.Decode(&node); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
		if len(node) == 0 {
			continue
		}
		payload, err := yaml.Marshal(node)
		if err != nil {
			return nil, err
		}
		metadata, _ := node["metadata"].(map[string]any)
		kind, _ := node["kind"].(string)
		name, _ := metadata["name"].(string)
		namespace, _ := metadata["namespace"].(string)
		if strings.TrimSpace(namespace) == "" {
			namespace = defaultNamespace
		}
		if strings.TrimSpace(kind) == "" || strings.TrimSpace(name) == "" {
			continue
		}
		entries = append(entries, KubernetesManifestHistoryEntry{
			ID:            fmt.Sprintf("%s-%s-%d", sanitizeFileName(kind), sanitizeFileName(name), time.Now().UTC().UnixNano()),
			EnvironmentID: environmentID,
			Kind:          strings.TrimSpace(kind),
			Name:          strings.TrimSpace(name),
			Namespace:     strings.TrimSpace(namespace),
			Manifest:      string(payload),
			CreatedAt:     time.Now().UTC(),
		})
	}
	return entries, nil
}

func waitForKubernetesPodReady(environmentID, namespace, podName string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	lastPhase := ""
	for time.Now().Before(deadline) {
		var payload struct {
			Status struct {
				Phase string `json:"phase"`
			} `json:"status"`
		}
		if err := kubectlJSONForEnvironment(environmentID, &payload, "get", "pod", podName, "-n", namespace, "-o", "json"); err == nil {
			lastPhase = strings.TrimSpace(payload.Status.Phase)
			if strings.EqualFold(lastPhase, "Running") || strings.EqualFold(lastPhase, "Succeeded") {
				return lastPhase, nil
			}
		}
		time.Sleep(1500 * time.Millisecond)
	}
	if lastPhase == "" {
		lastPhase = "Pending"
	}
	return lastPhase, fmt.Errorf("debug pod did not become ready before timeout (last phase: %s)", lastPhase)
}

func sanitizeKubernetesName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "resource"
	}
	var builder strings.Builder
	lastDash := false
	for _, char := range value {
		isAlphaNum := (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')
		if isAlphaNum {
			builder.WriteRune(char)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	result := strings.Trim(builder.String(), "-")
	if result == "" {
		return "resource"
	}
	return result
}

func truncateKubernetesName(value string) string {
	value = strings.Trim(strings.TrimSpace(value), "-")
	if len(value) <= 63 {
		return value
	}
	return strings.Trim(value[:63], "-")
}

func sanitizeManifestValue(value string) string {
	return strings.ReplaceAll(strings.TrimSpace(value), `"`, `\"`)
}

func matchesK8sSearch(values ...string) bool {
	if len(values) == 0 {
		return false
	}
	query := strings.ToLower(strings.TrimSpace(values[len(values)-1]))
	for _, value := range values[:len(values)-1] {
		if strings.Contains(strings.ToLower(strings.TrimSpace(value)), query) {
			return true
		}
	}
	return false
}

func labelsMatchSelector(labels map[string]string, selector map[string]string) bool {
	if len(selector) == 0 {
		return false
	}
	for key, value := range selector {
		if strings.TrimSpace(labels[key]) != strings.TrimSpace(value) {
			return false
		}
	}
	return true
}
