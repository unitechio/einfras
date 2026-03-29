package serverhttp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	domain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/platform/agentruntime/collector"
)

type EnvironmentRuntimeHandler struct {
	servers domain.ServerRepository
}

type runtimeOperation struct {
	id            string
	environmentID string
	kind          string
	startedAt     time.Time
	completedAt   time.Time
	status        string
	mu            sync.RWMutex
	logs          string
	done          bool
	result        map[string]any
	cancel        context.CancelFunc
	subscribers   map[chan string]struct{}
}

type runtimeOperationSummary struct {
	ID            string         `json:"id"`
	EnvironmentID string         `json:"environment_id"`
	Kind          string         `json:"kind"`
	Status        string         `json:"status"`
	StartedAt     time.Time      `json:"started_at"`
	CompletedAt   time.Time      `json:"completed_at,omitempty"`
	LogSize       int            `json:"log_size"`
	Result        map[string]any `json:"result,omitempty"`
}

type terminalStreamEvent struct {
	Kind    string
	Payload []byte
	Status  string
	Message string
}

type terminalRuntimeSession struct {
	id            string
	runtimeKind   string
	environmentID string
	resourceType  string
	resourceID    string
	namespace     string
	containerName string
	stdin         io.WriteCloser
	resize        func(cols, rows uint16) error
	wait          func() error
	closeFn       func() error
	mu            sync.RWMutex
	subscribers   map[chan terminalStreamEvent]struct{}
	done          bool
	closedAt      time.Time
	lastAttached  time.Time
	commandBuffer []rune
}

var runtimeOperations = struct {
	mu    sync.RWMutex
	items map[string]*runtimeOperation
}{
	items: map[string]*runtimeOperation{},
}

var terminalRuntimeSessions = struct {
	mu    sync.RWMutex
	items map[string]*terminalRuntimeSession
}{
	items: map[string]*terminalRuntimeSession{},
}

var runtimeWSUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var (
	dockerTerminalIDPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$`)
	k8sTerminalNamePattern  = regexp.MustCompile(`^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$`)
)

func NewEnvironmentRuntimeHandler(servers domain.ServerRepository) *EnvironmentRuntimeHandler {
	return &EnvironmentRuntimeHandler{servers: servers}
}

func (h *EnvironmentRuntimeHandler) terminalWS(w http.ResponseWriter, r *http.Request) {
	sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
	if sessionID != "" {
		session, ok := getTerminalRuntimeSession(sessionID)
		if !ok {
			writeError(w, http.StatusNotFound, "environment_runtime", "terminal.ws", "session_not_found", "terminal session was not found or already expired", nil)
			return
		}
		h.attachTerminalRuntimeSession(w, r, session, true)
		return
	}

	runtimeKind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("runtime")))
	environmentID := strings.TrimSpace(r.URL.Query().Get("environment_id"))
	if runtimeKind == "" || environmentID == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "terminal.ws", "invalid_request", "runtime and environment_id are required", nil)
		return
	}

	switch runtimeKind {
	case "docker":
		containerID := strings.TrimSpace(r.URL.Query().Get("container_id"))
		if !dockerTerminalIDPattern.MatchString(containerID) {
			writeError(w, http.StatusBadRequest, "environment_runtime", "terminal.ws", "invalid_request", "valid container_id is required", nil)
			return
		}
		h.serveDockerTerminalWS(w, r, environmentID, containerID)
	case "kubernetes":
		namespace := firstQuery(r, "namespace", "default")
		podName := strings.TrimSpace(r.URL.Query().Get("pod"))
		containerName := strings.TrimSpace(r.URL.Query().Get("container"))
		if !isValidKubernetesTerminalName(namespace) || !isValidKubernetesTerminalName(podName) {
			writeError(w, http.StatusBadRequest, "environment_runtime", "terminal.ws", "invalid_request", "valid namespace and pod are required", nil)
			return
		}
		if containerName != "" && !isValidKubernetesTerminalName(containerName) {
			writeError(w, http.StatusBadRequest, "environment_runtime", "terminal.ws", "invalid_request", "container name is invalid", nil)
			return
		}
		h.serveKubernetesTerminalWS(w, r, environmentID, namespace, podName, containerName)
	default:
		writeError(w, http.StatusBadRequest, "environment_runtime", "terminal.ws", "unsupported_runtime", "runtime must be docker or kubernetes", nil)
	}
}

func (h *EnvironmentRuntimeHandler) Register(r *mux.Router) {
	r.HandleFunc("/ws/terminal", h.terminalWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers", h.listDockerContainers).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}", h.getDockerContainerConfig).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/start", h.startDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/stop", h.stopDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/restart", h.restartDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/kill", h.killDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/pause", h.pauseDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/unpause", h.unpauseDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/rename", h.renameDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/commit", h.commitDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/create", h.createDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/update", h.updateDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/exec", h.execDockerContainer).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/exec/ws", h.execDockerContainerWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/logs", h.dockerContainerLogs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/logs/ws", h.dockerContainerLogsWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/stats", h.getDockerContainerStats).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/stats/ws", h.getDockerContainerStatsWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/system-logs", h.getDockerSystemLogs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/swarm/status", h.getDockerSwarmStatus).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files", h.listDockerContainerFiles).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/read", h.readDockerContainerFile).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/save", h.saveDockerContainerFile).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/download", h.downloadDockerContainerFile).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/archive", h.archiveDockerContainerFile).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/upload", h.uploadDockerContainerFile).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files/extract", h.extractDockerContainerArchive).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/containers/{containerId}/files", h.deleteDockerContainerFile).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/images", h.listDockerImages).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/images/pull", h.pullDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/push", h.pushDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/build", h.buildDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/build/stream", h.buildDockerImageStream).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/import", h.importDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/import/stream", h.importDockerImageStream).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/export", h.exportDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/export/download", h.downloadDockerImageExport).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/images/retag", h.retagDockerImage).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/images/{imageRef}", h.deleteDockerImage).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/build-history", h.listDockerBuildHistory).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/operations/history", h.listDockerOperationHistory).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/build-history/{historyId}/context/download", h.downloadDockerBuildContext).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/build-history/{historyId}/rebuild/stream", h.rebuildDockerImageStream).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/operations/{operationId}/stream", h.streamDockerOperation).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/operations/{operationId}/cancel", h.cancelDockerOperation).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/networks", h.listDockerNetworks).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/networks", h.createDockerNetwork).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/networks/{networkId}", h.getDockerNetwork).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/networks/{networkId}", h.updateDockerNetwork).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/networks/{networkId}", h.deleteDockerNetwork).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/networks/{networkId}/attach", h.attachDockerNetwork).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/networks/{networkId}/detach", h.detachDockerNetwork).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes", h.listDockerVolumes).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/volumes", h.createDockerVolume).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}", h.getDockerVolume).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}", h.updateDockerVolume).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}", h.deleteDockerVolume).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files", h.listDockerVolumeFiles).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files/read", h.readDockerVolumeFile).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files/save", h.saveDockerVolumeFile).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files/download", h.downloadDockerVolumeFile).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files/upload", h.uploadDockerVolumeFile).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/files", h.deleteDockerVolumeFile).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/backup", h.backupDockerVolume).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/volumes/{volumeName}/clone", h.cloneDockerVolume).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks", h.listDockerStacks).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/deploy", h.deployDockerStack).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}", h.getDockerStack).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/services", h.listDockerStackServices).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/services/{serviceName}", h.getDockerStackService).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/services/{serviceName}/logs", h.getDockerStackServiceLogs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/services/{serviceName}/restart", h.restartDockerStackService).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/services/{serviceName}/scale", h.scaleDockerStackService).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/start", h.startDockerStack).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/stop", h.stopDockerStack).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}", h.deleteDockerStack).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/stacks/{stackName}/rollback", h.rollbackDockerStack).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/secrets", h.listDockerSecrets).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/secrets", h.saveDockerSecret).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/secrets/{name}", h.deleteDockerSecret).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/topology", h.getDockerTopology).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/autoheal/policies", h.listDockerAutoHealPolicies).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/docker/autoheal/policies", h.saveDockerAutoHealPolicy).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/autoheal/policies/{policyId}", h.deleteDockerAutoHealPolicy).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/docker/autoheal/run", h.runDockerAutoHeal).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/docker/disk-usage", h.getDockerDiskUsage).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/audit", h.listEnvironmentAudit).Methods(http.MethodGet)

	r.HandleFunc("/v1/environments/{id}/kubernetes/pods", h.listKubernetesPods).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/pods/ws", h.listKubernetesPodsWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/pods/{podName}/logs", h.getKubernetesPodLogs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/pods/{podName}/logs/ws", h.getKubernetesPodLogsWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/pods/{podName}/exec", h.execKubernetesPod).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/pods/{podName}/exec/ws", h.execKubernetesPodWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/deployments", h.listKubernetesDeployments).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/deployments/ws", h.listKubernetesDeploymentsWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/deployments/{deploymentName}/scale", h.scaleKubernetesDeployment).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/deployments/{deploymentName}/restart", h.restartKubernetesDeployment).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/services", h.listKubernetesServices).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/services/ws", h.listKubernetesServicesWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/ingresses", h.listKubernetesIngresses).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/configmaps", h.listKubernetesConfigMaps).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/secrets", h.listKubernetesSecrets).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes", h.listKubernetesNodes).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/ws", h.listKubernetesNodesWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}", h.getKubernetesNodeDetail).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}/describe", h.describeKubernetesNode).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}/debug", h.startKubernetesNodeDebugSession).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}/cordon", h.cordonKubernetesNode).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}/uncordon", h.uncordonKubernetesNode).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/nodes/{nodeName}/drain", h.drainKubernetesNode).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/namespaces", h.listKubernetesNamespaces).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/persistentvolumes", h.listKubernetesPersistentVolumes).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/persistentvolumeclaims", h.listKubernetesPersistentVolumeClaims).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/jobs", h.listKubernetesJobs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/cronjobs", h.listKubernetesCronJobs).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/search", h.searchKubernetesResources).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}", h.listGenericKubernetesResources).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}/ws", h.listGenericKubernetesResourcesWS).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}/{name}/yaml", h.getGenericKubernetesResourceYAML).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}/{name}/history", h.listGenericKubernetesResourceHistory).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}/{name}/rollback", h.rollbackGenericKubernetesResource).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/resources/{kind}/{name}", h.deleteGenericKubernetesResource).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/kubernetes/apply", h.applyKubernetesManifest).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/topology", h.getKubernetesTopology).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/helm/releases", h.listKubernetesHelmReleases).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/{id}/kubernetes/helm/releases", h.installKubernetesHelmRelease).Methods(http.MethodPost)
	r.HandleFunc("/v1/environments/{id}/kubernetes/helm/releases/{releaseName}", h.uninstallKubernetesHelmRelease).Methods(http.MethodDelete)
	r.HandleFunc("/v1/environments/{id}/kubernetes/agent/bootstrap", h.getKubernetesAgentBootstrap).Methods(http.MethodGet)
	r.HandleFunc("/v1/environments/kubernetes/import", h.importKubernetesKubeconfig).Methods(http.MethodPost)
	r.HandleFunc("/v1/registries", h.listRegistries).Methods(http.MethodGet)
	r.HandleFunc("/v1/registries", h.saveRegistry).Methods(http.MethodPost)
	r.HandleFunc("/v1/registries/test", h.testRegistry).Methods(http.MethodPost)
	r.HandleFunc("/v1/registries/{registryId}/catalog", h.registryCatalog).Methods(http.MethodGet)
	r.HandleFunc("/v1/registries/{registryId}/tags/delete", h.deleteRegistryTag).Methods(http.MethodPost)
	r.HandleFunc("/v1/registries/{registryId}", h.deleteRegistry).Methods(http.MethodDelete)
}

const dockerStreamResultPrefix = "__EINFRA_STREAM_RESULT__ "
const dockerStreamMetaPrefix = "__EINFRA_STREAM_META__ "

func (h *EnvironmentRuntimeHandler) listDockerContainers(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.containers", "unsupported_environment", err.Error(), nil)
		return
	}
	all := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("all")), "true")
	items, err := collector.ListDockerContainers(all)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.containers", "docker_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) getDockerContainerConfig(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.container.get", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.InspectDockerContainerConfig(mux.Vars(r)["containerId"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.container.get", "docker_container_get_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) startDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.start", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.StartDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.start", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.start", "docker_start_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.start", "container", mux.Vars(r)["containerId"], "success", "Container started successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container started successfully"})
}

func (h *EnvironmentRuntimeHandler) stopDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stop", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.StopDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.stop", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stop", "docker_stop_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.stop", "container", mux.Vars(r)["containerId"], "success", "Container stopped successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container stopped successfully"})
}

func (h *EnvironmentRuntimeHandler) restartDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.restart", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.RestartDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.restart", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.restart", "docker_restart_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.restart", "container", mux.Vars(r)["containerId"], "success", "Container restarted successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container restarted successfully"})
}

func (h *EnvironmentRuntimeHandler) killDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.kill", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.KillDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.kill", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.kill", "docker_kill_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.kill", "container", mux.Vars(r)["containerId"], "success", "Container killed successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container killed successfully"})
}

func (h *EnvironmentRuntimeHandler) pauseDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.pause", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.PauseDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.pause", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.pause", "docker_pause_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.pause", "container", mux.Vars(r)["containerId"], "success", "Container paused successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container paused successfully"})
}

func (h *EnvironmentRuntimeHandler) unpauseDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.unpause", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.UnpauseDockerContainer(mux.Vars(r)["containerId"]); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.unpause", "container", mux.Vars(r)["containerId"], "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.unpause", "docker_unpause_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.unpause", "container", mux.Vars(r)["containerId"], "success", "Container unpaused successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container unpaused successfully"})
}

func (h *EnvironmentRuntimeHandler) renameDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.rename", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.rename", "invalid_request", "name is required", nil)
		return
	}
	if err := collector.RenameDockerContainer(mux.Vars(r)["containerId"], request.Name); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.rename", "container", mux.Vars(r)["containerId"], "failed", err.Error(), map[string]any{"name": request.Name})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.rename", "docker_rename_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.rename", "container", mux.Vars(r)["containerId"], "success", "Container renamed successfully", map[string]any{"name": request.Name})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container renamed successfully"})
}

func (h *EnvironmentRuntimeHandler) commitDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.commit", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Image) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.commit", "invalid_request", "image is required", nil)
		return
	}
	if err := collector.CommitDockerContainer(mux.Vars(r)["containerId"], request.Image); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.commit", "container", mux.Vars(r)["containerId"], "failed", err.Error(), map[string]any{"image": request.Image})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.commit", "docker_commit_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.commit", "container", mux.Vars(r)["containerId"], "success", "Container committed successfully", map[string]any{"image": request.Image})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container committed successfully"})
}

func (h *EnvironmentRuntimeHandler) createDockerContainer(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.container.create", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerContainerCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Image) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.container.create", "invalid_request", "image is required", nil)
		return
	}
	containerRef, err := collector.CreateDockerContainer(request)
	if err != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "docker.container.create", "container", strings.TrimSpace(request.Name), "failed", err.Error(), map[string]any{"image": request.Image, "labels": request.Labels, "tags": extractRuntimeTags(request.Labels)})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.container.create", "docker_container_create_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.container.create", "container", containerRef, "success", "Container created successfully", map[string]any{"image": request.Image, "name": request.Name, "labels": request.Labels, "tags": extractRuntimeTags(request.Labels)})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container created successfully", "container_id": containerRef})
}

func (h *EnvironmentRuntimeHandler) updateDockerContainer(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	containerID := mux.Vars(r)["containerId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.container.update", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		collector.DockerContainerCreateRequest
		Recreate bool `json:"recreate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.container.update", "invalid_request", "invalid update payload", nil)
		return
	}
	updatedID, err := collector.UpdateDockerContainerConfig(containerID, request.DockerContainerCreateRequest, request.Recreate)
	if err != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "docker.container.update", "container", containerID, "failed", err.Error(), map[string]any{"recreate": request.Recreate, "labels": request.Labels, "tags": extractRuntimeTags(request.Labels)})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.container.update", "docker_container_update_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.container.update", "container", updatedID, "success", "Container updated successfully", map[string]any{"recreate": request.Recreate, "labels": request.Labels, "tags": extractRuntimeTags(request.Labels)})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container updated successfully", "container_id": updatedID})
}

func (h *EnvironmentRuntimeHandler) execDockerContainer(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.exec", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Command []string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Command) == 0 {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.exec", "invalid_request", "command is required", nil)
		return
	}
	output, err := collector.ExecDockerContainer(mux.Vars(r)["containerId"], request.Command)
	if err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.exec", "container", mux.Vars(r)["containerId"], "failed", err.Error(), map[string]any{"command": request.Command})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.exec", "docker_exec_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.container.exec", "container", mux.Vars(r)["containerId"], "success", "Container command executed", map[string]any{"command": request.Command})
	writeJSON(w, http.StatusOK, map[string]any{"output": output})
}

func (h *EnvironmentRuntimeHandler) execDockerContainerWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	containerID := mux.Vars(r)["containerId"]
	h.serveDockerTerminalWS(w, r, environmentID, containerID)
}

func (h *EnvironmentRuntimeHandler) serveDockerTerminalWS(w http.ResponseWriter, r *http.Request, environmentID, containerID string) {
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.exec.ws", "unsupported_environment", err.Error(), nil)
		return
	}

	session, ok := getTerminalRuntimeSession(strings.TrimSpace(r.URL.Query().Get("session_id")))
	if !ok || session == nil || session.environmentID != environmentID || session.runtimeKind != "docker" || session.resourceID != containerID {
		execSession, err := collector.StartDockerExecSession(containerID, nil)
		if err != nil {
			writeError(w, http.StatusBadGateway, "environment_runtime", "docker.exec.ws", "docker_exec_failed", err.Error(), nil)
			_ = h.auditEnvironmentAction(r, environmentID, "docker.container.exec.ws", "container", containerID, "failed", err.Error(), nil)
			return
		}
		session = newTerminalRuntimeSession(
			"docker",
			environmentID,
			"container",
			containerID,
			"",
			"",
			execSession.Stdin,
			execSession.Resize,
			execSession.Wait,
			execSession.Close,
		)
		session.startOutputPumps(execSession.Stdout, execSession.Stderr)
	}

	h.attachTerminalRuntimeSession(w, r, session, false)
}

func (h *EnvironmentRuntimeHandler) dockerContainerLogs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.logs", "unsupported_environment", err.Error(), nil)
		return
	}
	tail := parseInt(r.URL.Query().Get("tail"), 100)
	logs, err := collector.GetDockerContainerLogs(mux.Vars(r)["containerId"], tail)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.logs", "docker_logs_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": logs})
}

func (h *EnvironmentRuntimeHandler) dockerContainerLogsWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	containerID := mux.Vars(r)["containerId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.logs.ws", "unsupported_environment", err.Error(), nil)
		return
	}
	conn, err := runtimeWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	tail := parseInt(r.URL.Query().Get("tail"), 200)
	if tail <= 0 {
		tail = 200
	}
	interval := time.Second
	if raw := parseInt(r.URL.Query().Get("interval_ms"), 1500); raw > 0 {
		interval = time.Duration(raw) * time.Millisecond
	}
	_ = conn.WriteJSON(map[string]any{"type": "status", "status": "connected"})
	if err := h.streamDockerLogsSnapshots(conn, containerID, tail, interval); err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		_ = conn.WriteJSON(map[string]any{"type": "error", "message": err.Error()})
	}
}

func (h *EnvironmentRuntimeHandler) getDockerContainerStats(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stats", "unsupported_environment", err.Error(), nil)
		return
	}
	stats, err := collector.GetDockerContainerStats(mux.Vars(r)["containerId"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stats", "docker_stats_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *EnvironmentRuntimeHandler) getDockerContainerStatsWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	containerID := mux.Vars(r)["containerId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stats.ws", "unsupported_environment", err.Error(), nil)
		return
	}
	conn, err := runtimeWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	interval := time.Second
	if raw := parseInt(r.URL.Query().Get("interval_ms"), 1500); raw > 0 {
		interval = time.Duration(raw) * time.Millisecond
	}
	_ = conn.WriteJSON(map[string]any{"type": "status", "status": "connected"})
	if err := h.streamDockerStatsSnapshots(conn, containerID, interval); err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		_ = conn.WriteJSON(map[string]any{"type": "error", "message": err.Error()})
	}
}

func (h *EnvironmentRuntimeHandler) getDockerSystemLogs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.system_logs", "unsupported_environment", err.Error(), nil)
		return
	}
	lines := parseInt(r.URL.Query().Get("lines"), 200)
	logs, err := collector.GetDockerSystemLogs(lines)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.system_logs", "docker_system_logs_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"raw_output": logs})
}

func (h *EnvironmentRuntimeHandler) streamDockerLogsSnapshots(conn *websocket.Conn, containerID string, tail int, interval time.Duration) error {
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	lastPayload := ""
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		logs, err := collector.GetDockerContainerLogs(containerID, tail)
		if err != nil {
			return err
		}
		if logs != lastPayload {
			lastPayload = logs
			if err := conn.WriteJSON(map[string]any{
				"type": "snapshot",
				"logs": logs,
			}); err != nil {
				return err
			}
		}
		select {
		case <-done:
			return nil
		case <-ticker.C:
		}
	}
}

func (h *EnvironmentRuntimeHandler) streamDockerStatsSnapshots(conn *websocket.Conn, containerID string, interval time.Duration) error {
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		stats, err := collector.GetDockerContainerStats(containerID)
		if err != nil {
			return err
		}
		if err := conn.WriteJSON(map[string]any{
			"type": "snapshot",
			"data": stats,
		}); err != nil {
			return err
		}
		select {
		case <-done:
			return nil
		case <-ticker.C:
		}
	}
}

func (h *EnvironmentRuntimeHandler) streamKubernetesSnapshotWS(
	w http.ResponseWriter,
	r *http.Request,
	environmentID string,
	auditAction string,
	producer func() (any, error),
) {
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", auditAction, "unsupported_environment", err.Error(), nil)
		return
	}
	conn, err := runtimeWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	_ = h.auditEnvironmentAction(r, environmentID, auditAction, "kubernetes", environmentID, "started", "Kubernetes live snapshot stream opened", nil)

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	sendSnapshot := func() error {
		items, err := producer()
		if err != nil {
			return err
		}
		return conn.WriteJSON(map[string]any{
			"type":  "snapshot",
			"items": items,
			"ts":    time.Now().UTC().Format(time.RFC3339),
		})
	}

	if err := sendSnapshot(); err != nil {
		_ = conn.WriteJSON(map[string]any{"type": "error", "message": err.Error()})
		_ = h.auditEnvironmentAction(r, environmentID, auditAction, "kubernetes", environmentID, "failed", err.Error(), nil)
		return
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			_ = h.auditEnvironmentAction(r, environmentID, auditAction, "kubernetes", environmentID, "closed", "Kubernetes live snapshot stream closed", nil)
			return
		case <-ticker.C:
			if err := sendSnapshot(); err != nil {
				_ = conn.WriteJSON(map[string]any{"type": "error", "message": err.Error()})
				_ = h.auditEnvironmentAction(r, environmentID, auditAction, "kubernetes", environmentID, "failed", err.Error(), nil)
				return
			}
		}
	}
}

func (h *EnvironmentRuntimeHandler) listDockerContainerFiles(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.list", "unsupported_environment", err.Error(), nil)
		return
	}
	path := firstQuery(r, "path", "/")
	items, err := collector.ListDockerContainerFiles(mux.Vars(r)["containerId"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.list", "docker_files_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "items": items})
}

func (h *EnvironmentRuntimeHandler) readDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.read", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.read", "invalid_request", "path is required", nil)
		return
	}
	content, err := collector.ReadDockerContainerFile(mux.Vars(r)["containerId"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.read", "docker_files_read_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "content": content})
}

func (h *EnvironmentRuntimeHandler) saveDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.save", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Path) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.save", "invalid_request", "path is required", nil)
		return
	}
	if err := collector.SaveDockerContainerFile(mux.Vars(r)["containerId"], request.Path, request.Content); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.save", "docker_files_save_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "File saved successfully"})
}

func (h *EnvironmentRuntimeHandler) downloadDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.download", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.download", "invalid_request", "path is required", nil)
		return
	}
	content, fileName, err := collector.CopyDockerFileFromContainer(mux.Vars(r)["containerId"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.download", "docker_files_download_failed", err.Error(), nil)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(content)
}

func (h *EnvironmentRuntimeHandler) archiveDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.archive", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.archive", "invalid_request", "path is required", nil)
		return
	}
	content, fileName, err := collector.ArchiveDockerContainerPath(mux.Vars(r)["containerId"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.archive", "docker_files_archive_failed", err.Error(), nil)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	w.Header().Set("Content-Type", "application/gzip")
	_, _ = w.Write(content)
}

func (h *EnvironmentRuntimeHandler) uploadDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.upload", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.upload", "invalid_request", "invalid multipart payload", nil)
		return
	}
	path := firstQuery(r, "path", r.FormValue("path"))
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.upload", "invalid_request", "file is required", nil)
		return
	}
	defer file.Close()
	if err := collector.CopyDockerFileToContainer(mux.Vars(r)["containerId"], path, file); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.upload", "docker_files_upload_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "File uploaded successfully"})
}

func (h *EnvironmentRuntimeHandler) extractDockerContainerArchive(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.extract", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.extract", "invalid_request", "invalid multipart payload", nil)
		return
	}
	path := firstQuery(r, "path", r.FormValue("path"))
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.extract", "invalid_request", "file is required", nil)
		return
	}
	defer file.Close()
	if err := collector.ExtractArchiveToDockerContainer(mux.Vars(r)["containerId"], path, file); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.extract", "docker_files_extract_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Archive extracted successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerContainerFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.files.delete", "invalid_request", "path is required", nil)
		return
	}
	if err := collector.DeleteDockerContainerFile(mux.Vars(r)["containerId"], path); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.files.delete", "docker_files_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "File deleted successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerImages(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.images", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerImages()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.images", "docker_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) pullDockerImage(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.pull", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		ImageName  string `json:"image_name"`
		RegistryID string `json:"registry_id"`
	}
	if err := jsonNewDecoder(r).Decode(&request); err != nil || strings.TrimSpace(request.ImageName) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.pull", "invalid_request", "image_name is required", nil)
		return
	}
	if err := collector.PullDockerImageWithCredential(strings.TrimSpace(request.ImageName), strings.TrimSpace(request.RegistryID)); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.pull", "image", strings.TrimSpace(request.ImageName), "failed", err.Error(), map[string]any{"registry_id": strings.TrimSpace(request.RegistryID)})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.pull", "docker_pull_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.pull", "image", strings.TrimSpace(request.ImageName), "success", "Image pulled successfully", map[string]any{"registry_id": strings.TrimSpace(request.RegistryID)})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Image pulled successfully"})
}

func (h *EnvironmentRuntimeHandler) pushDockerImage(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.push", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		ImageRef   string `json:"image_ref"`
		RegistryID string `json:"registry_id"`
	}
	if err := jsonNewDecoder(r).Decode(&request); err != nil || strings.TrimSpace(request.ImageRef) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.push", "invalid_request", "image_ref is required", nil)
		return
	}
	if err := collector.PushDockerImage(strings.TrimSpace(request.ImageRef), strings.TrimSpace(request.RegistryID)); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.push", "docker_push_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.push", "image", strings.TrimSpace(request.ImageRef), "success", "Image pushed successfully", map[string]any{"registry_id": strings.TrimSpace(request.RegistryID)})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Image pushed successfully"})
}

func (h *EnvironmentRuntimeHandler) buildDockerImage(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build", "invalid_request", "build context is required", nil)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build", "invalid_request", "build context file is required", nil)
		return
	}
	defer file.Close()

	record, buildErr := collector.BuildDockerImage(environmentID, r.FormValue("dockerfile"), header.Filename, file, r.MultipartForm.Value["tags"])
	if buildErr != nil {
		metadata := map[string]any{
			"dockerfile": r.FormValue("dockerfile"),
			"tags":       r.MultipartForm.Value["tags"],
		}
		if record != nil {
			metadata["history_id"] = record.ID
		}
		_ = h.auditEnvironmentAction(r, environmentID, "docker.image.build", "image_build", firstNonEmpty(strings.Join(r.MultipartForm.Value["tags"], ","), header.Filename), "failed", buildErr.Error(), metadata)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.image.build", "docker_build_failed", buildErr.Error(), map[string]any{"history": record})
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.image.build", "image_build", record.Target, "success", "Docker image built successfully", map[string]any{
		"history_id": record.ID,
		"dockerfile": record.Dockerfile,
		"tags":       r.MultipartForm.Value["tags"],
	})
	writeJSON(w, http.StatusOK, record)
}

func (h *EnvironmentRuntimeHandler) buildDockerImageStream(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.stream", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.stream", "invalid_request", "build context is required", nil)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.stream", "invalid_request", "build context file is required", nil)
		return
	}
	defer file.Close()
	stream, ok := newRuntimeStream(w)
	if !ok {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.build.stream", "stream_unsupported", "streaming is not supported for this response writer", nil)
		return
	}
	operation := newRuntimeOperation(environmentID, "build")
	stream.WriteMeta(map[string]any{"operation_id": operation.id, "kind": operation.kind})
	go func() {
		record, buildErr := collector.BuildDockerImageStreamContext(contextWithCancel(operation), environmentID, r.FormValue("dockerfile"), header.Filename, file, r.MultipartForm.Value["tags"], operation)
		if buildErr != nil {
			auditStatus := "failed"
			if strings.Contains(strings.ToLower(buildErr.Error()), "cancelled") {
				auditStatus = "cancelled"
			}
			metadata := map[string]any{
				"dockerfile": r.FormValue("dockerfile"),
				"tags":       r.MultipartForm.Value["tags"],
				"operation":  operation.id,
			}
			if record != nil {
				metadata["history_id"] = record.ID
			}
			_ = h.auditEnvironmentAction(r, environmentID, "docker.image.build", "image_build", firstNonEmpty(strings.Join(r.MultipartForm.Value["tags"], ","), header.Filename), auditStatus, buildErr.Error(), metadata)
			operation.finish(map[string]any{
				"ok":           false,
				"message":      buildErr.Error(),
				"history":      record,
				"operation_id": operation.id,
			})
			return
		}
		_ = h.auditEnvironmentAction(r, environmentID, "docker.image.build", "image_build", record.Target, "success", "Docker image built successfully", map[string]any{
			"history_id":   record.ID,
			"dockerfile":   record.Dockerfile,
			"tags":         record.Tags,
			"operation_id": operation.id,
		})
		operation.finish(map[string]any{
			"ok":           true,
			"history":      record,
			"operation_id": operation.id,
		})
	}()
	operation.attach(stream, r.Context())
}

func (h *EnvironmentRuntimeHandler) importDockerImage(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import", "invalid_request", "docker save archive is required", nil)
		return
	}
	file, header, err := r.FormFile("archive")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import", "invalid_request", "archive file is required", nil)
		return
	}
	defer file.Close()

	result, importErr := collector.ImportDockerImageArchive(file, header.Filename)
	if importErr != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "docker.image.import", "image_archive", header.Filename, "failed", importErr.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.image.import", "docker_import_failed", importErr.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.image.import", "image_archive", header.Filename, "success", "Docker image archive imported successfully", map[string]any{
		"loaded_images": result.LoadedImages,
	})
	writeJSON(w, http.StatusOK, result)
}

func (h *EnvironmentRuntimeHandler) importDockerImageStream(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import.stream", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import.stream", "invalid_request", "docker save archive is required", nil)
		return
	}
	file, header, err := r.FormFile("archive")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.import.stream", "invalid_request", "archive file is required", nil)
		return
	}
	defer file.Close()
	stream, ok := newRuntimeStream(w)
	if !ok {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.import.stream", "stream_unsupported", "streaming is not supported for this response writer", nil)
		return
	}
	operation := newRuntimeOperation(environmentID, "import")
	stream.WriteMeta(map[string]any{"operation_id": operation.id, "kind": operation.kind})
	go func() {
		result, importErr := collector.ImportDockerImageArchiveStreamContext(contextWithCancel(operation), file, header.Filename, operation)
		if importErr != nil {
			auditStatus := "failed"
			if strings.Contains(strings.ToLower(importErr.Error()), "cancelled") {
				auditStatus = "cancelled"
			}
			_ = h.auditEnvironmentAction(r, environmentID, "docker.image.import", "image_archive", header.Filename, auditStatus, importErr.Error(), map[string]any{"operation_id": operation.id})
			operation.finish(map[string]any{
				"ok":           false,
				"message":      importErr.Error(),
				"operation_id": operation.id,
			})
			return
		}
		_ = h.auditEnvironmentAction(r, environmentID, "docker.image.import", "image_archive", header.Filename, "success", "Docker image archive imported successfully", map[string]any{
			"loaded_images": result.LoadedImages,
			"operation_id":  operation.id,
		})
		operation.finish(map[string]any{
			"ok":           true,
			"import":       result,
			"operation_id": operation.id,
		})
	}()
	operation.attach(stream, r.Context())
}

func (h *EnvironmentRuntimeHandler) listDockerBuildHistory(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.history", "unsupported_environment", err.Error(), nil)
		return
	}
	limit := parseInt(r.URL.Query().Get("limit"), 50)
	items, err := collector.ListDockerBuildHistory(environmentID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.build.history", "docker_build_history_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listDockerOperationHistory(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.operation.history", "unsupported_environment", err.Error(), nil)
		return
	}
	limit := parseInt(r.URL.Query().Get("limit"), 50)
	items := listRuntimeOperations(environmentID, limit)
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) downloadDockerBuildContext(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	historyID := mux.Vars(r)["historyId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.context.download", "unsupported_environment", err.Error(), nil)
		return
	}
	record, err := collector.GetDockerBuildHistoryRecord(environmentID, historyID)
	if err != nil {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.image.build.context.download", "build_history_not_found", err.Error(), nil)
		return
	}
	if strings.TrimSpace(record.ContextPath) == "" {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.image.build.context.download", "context_not_found", "stored build context is unavailable", nil)
		return
	}
	contextsRoot, err := collector.DockerBuildContextsRootPath(environmentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.build.context.download", "runtime_state_failed", err.Error(), nil)
		return
	}
	resolvedPath, err := filepath.Abs(record.ContextPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.build.context.download", "invalid_path", err.Error(), nil)
		return
	}
	allowedRootAbs, err := filepath.Abs(contextsRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.build.context.download", "runtime_state_failed", err.Error(), nil)
		return
	}
	relativePath, err := filepath.Rel(allowedRootAbs, resolvedPath)
	if err != nil || strings.HasPrefix(relativePath, "..") {
		writeError(w, http.StatusForbidden, "environment_runtime", "docker.image.build.context.download", "path_forbidden", "context archive is outside the runtime context directory", nil)
		return
	}
	file, err := os.Open(resolvedPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.image.build.context.download", "file_not_found", err.Error(), nil)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.build.context.download", "file_stat_failed", err.Error(), nil)
		return
	}
	fileName := firstNonEmpty(strings.TrimSpace(record.ArchiveName), filepath.Base(resolvedPath))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", strings.ReplaceAll(fileName, "\"", "")))
	http.ServeContent(w, r, fileName, info.ModTime(), file)
}

func (h *EnvironmentRuntimeHandler) rebuildDockerImageStream(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	historyID := mux.Vars(r)["historyId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.rebuild.stream", "unsupported_environment", err.Error(), nil)
		return
	}
	stream, ok := newRuntimeStream(w)
	if !ok {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.rebuild.stream", "stream_unsupported", "streaming is not supported for this response writer", nil)
		return
	}
	var request struct {
		Tags []string `json:"tags"`
	}
	if r.ContentLength > 0 {
		_ = jsonNewDecoder(r).Decode(&request)
	}
	operation := newRuntimeOperation(environmentID, "rebuild")
	stream.WriteMeta(map[string]any{"operation_id": operation.id, "kind": operation.kind})
	go func() {
		record, rebuildErr := collector.RebuildDockerImageStreamContext(contextWithCancel(operation), environmentID, historyID, request.Tags, operation)
		if rebuildErr != nil {
			auditStatus := "failed"
			if strings.Contains(strings.ToLower(rebuildErr.Error()), "cancelled") {
				auditStatus = "cancelled"
			}
			_ = h.auditEnvironmentAction(r, environmentID, "docker.image.rebuild", "image_build", historyID, auditStatus, rebuildErr.Error(), map[string]any{"history_id": historyID, "tags": request.Tags, "operation_id": operation.id})
			operation.finish(map[string]any{
				"ok":           false,
				"message":      rebuildErr.Error(),
				"history":      record,
				"operation_id": operation.id,
			})
			return
		}
		_ = h.auditEnvironmentAction(r, environmentID, "docker.image.rebuild", "image_build", record.Target, "success", "Docker image rebuilt successfully", map[string]any{
			"history_id":        record.ID,
			"source_history_id": historyID,
			"tags":              record.Tags,
			"operation_id":      operation.id,
		})
		operation.finish(map[string]any{
			"ok":           true,
			"history":      record,
			"operation_id": operation.id,
		})
	}()
	operation.attach(stream, r.Context())
}

func (h *EnvironmentRuntimeHandler) streamDockerOperation(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	operationID := mux.Vars(r)["operationId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.operation.stream", "unsupported_environment", err.Error(), nil)
		return
	}
	operation, ok := getRuntimeOperation(operationID)
	if !ok || operation.environmentID != environmentID {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.operation.stream", "operation_not_found", "runtime operation not found", nil)
		return
	}
	stream, ok := newRuntimeStream(w)
	if !ok {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.operation.stream", "stream_unsupported", "streaming is not supported for this response writer", nil)
		return
	}
	stream.WriteMeta(map[string]any{"operation_id": operation.id, "kind": operation.kind})
	operation.attach(stream, r.Context())
}

func (h *EnvironmentRuntimeHandler) cancelDockerOperation(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	operationID := mux.Vars(r)["operationId"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.operation.cancel", "unsupported_environment", err.Error(), nil)
		return
	}
	operation, ok := getRuntimeOperation(operationID)
	if !ok || operation.environmentID != environmentID {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.operation.cancel", "operation_not_found", "runtime operation not found", nil)
		return
	}
	if operation.cancel != nil {
		operation.cancel()
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Operation cancellation requested", "operation_id": operationID})
}

type runtimeStreamWriter struct {
	writer  http.ResponseWriter
	flusher http.Flusher
}

func newRuntimeStream(w http.ResponseWriter) (*runtimeStreamWriter, bool) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, false
	}
	headers := w.Header()
	headers.Set("Content-Type", "text/plain; charset=utf-8")
	headers.Set("Cache-Control", "no-cache")
	headers.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	return &runtimeStreamWriter{writer: w, flusher: flusher}, true
}

func (s *runtimeStreamWriter) Write(p []byte) (int, error) {
	n, err := s.writer.Write(p)
	s.flusher.Flush()
	return n, err
}

func (s *runtimeStreamWriter) WriteResult(payload map[string]any) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		_, _ = s.Write([]byte("\n" + dockerStreamResultPrefix + `{"ok":false,"message":"unable to encode stream result"}` + "\n"))
		return
	}
	_, _ = s.Write([]byte("\n" + dockerStreamResultPrefix + string(encoded) + "\n"))
}

func (s *runtimeStreamWriter) WriteMeta(payload map[string]any) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = s.Write([]byte(dockerStreamMetaPrefix + string(encoded) + "\n"))
}

func newRuntimeOperation(environmentID, kind string) *runtimeOperation {
	ctx, cancel := context.WithCancel(context.Background())
	_ = ctx
	operation := &runtimeOperation{
		id:            fmt.Sprintf("docker-op-%d", time.Now().UTC().UnixNano()),
		environmentID: environmentID,
		kind:          kind,
		startedAt:     time.Now().UTC(),
		status:        "running",
		cancel:        cancel,
		subscribers:   map[chan string]struct{}{},
	}
	runtimeOperations.mu.Lock()
	runtimeOperations.items[operation.id] = operation
	runtimeOperations.mu.Unlock()
	return operation
}

func getRuntimeOperation(id string) (*runtimeOperation, bool) {
	runtimeOperations.mu.RLock()
	defer runtimeOperations.mu.RUnlock()
	item, ok := runtimeOperations.items[id]
	return item, ok
}

func contextWithCancel(operation *runtimeOperation) context.Context {
	ctx, cancel := context.WithCancel(context.Background())
	operation.mu.Lock()
	operation.cancel = cancel
	operation.mu.Unlock()
	return ctx
}

func (o *runtimeOperation) Write(p []byte) (int, error) {
	text := string(p)
	o.mu.Lock()
	o.logs += text
	subscribers := make([]chan string, 0, len(o.subscribers))
	for subscriber := range o.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	o.mu.Unlock()
	for _, subscriber := range subscribers {
		select {
		case subscriber <- text:
		default:
		}
	}
	return len(p), nil
}

func (o *runtimeOperation) finish(result map[string]any) {
	o.mu.Lock()
	o.done = true
	o.completedAt = time.Now().UTC()
	o.result = result
	if ok, exists := result["ok"].(bool); exists && ok {
		o.status = "success"
	} else if message, exists := result["message"].(string); exists && strings.Contains(strings.ToLower(message), "cancel") {
		o.status = "cancelled"
	} else {
		o.status = "failed"
	}
	subscribers := make([]chan string, 0, len(o.subscribers))
	for subscriber := range o.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	o.mu.Unlock()
	for _, subscriber := range subscribers {
		close(subscriber)
	}
}

func listRuntimeOperations(environmentID string, limit int) []runtimeOperationSummary {
	runtimeOperations.mu.RLock()
	items := make([]*runtimeOperation, 0, len(runtimeOperations.items))
	for _, item := range runtimeOperations.items {
		if strings.TrimSpace(environmentID) == "" || item.environmentID == environmentID {
			items = append(items, item)
		}
	}
	runtimeOperations.mu.RUnlock()
	summaries := make([]runtimeOperationSummary, 0, len(items))
	for _, item := range items {
		item.mu.RLock()
		summary := runtimeOperationSummary{
			ID:            item.id,
			EnvironmentID: item.environmentID,
			Kind:          item.kind,
			Status:        item.status,
			StartedAt:     item.startedAt,
			CompletedAt:   item.completedAt,
			LogSize:       len(item.logs),
			Result:        item.result,
		}
		item.mu.RUnlock()
		summaries = append(summaries, summary)
	}
	sort.Slice(summaries, func(i, j int) bool {
		return summaries[i].StartedAt.After(summaries[j].StartedAt)
	})
	if limit > 0 && len(summaries) > limit {
		summaries = summaries[:limit]
	}
	return summaries
}

func (o *runtimeOperation) attach(stream *runtimeStreamWriter, ctx context.Context) {
	o.mu.RLock()
	snapshot := o.logs
	done := o.done
	result := o.result
	o.mu.RUnlock()
	if snapshot != "" {
		_, _ = stream.Write([]byte(snapshot))
	}
	if done {
		if result != nil {
			stream.WriteResult(result)
		}
		return
	}
	ch := make(chan string, 64)
	o.mu.Lock()
	if o.done {
		result = o.result
		o.mu.Unlock()
		if result != nil {
			stream.WriteResult(result)
		}
		return
	}
	o.subscribers[ch] = struct{}{}
	o.mu.Unlock()
	defer func() {
		o.mu.Lock()
		delete(o.subscribers, ch)
		o.mu.Unlock()
	}()
	for {
		select {
		case <-ctx.Done():
			return
		case chunk, ok := <-ch:
			if !ok {
				o.mu.RLock()
				result := o.result
				o.mu.RUnlock()
				if result != nil {
					stream.WriteResult(result)
				}
				return
			}
			_, _ = stream.Write([]byte(chunk))
		}
	}
}

func newTerminalRuntimeSession(
	runtimeKind string,
	environmentID string,
	resourceType string,
	resourceID string,
	namespace string,
	containerName string,
	stdin io.WriteCloser,
	resize func(cols, rows uint16) error,
	waitFn func() error,
	closeFn func() error,
) *terminalRuntimeSession {
	session := &terminalRuntimeSession{
		id:            fmt.Sprintf("term-%d", time.Now().UTC().UnixNano()),
		runtimeKind:   runtimeKind,
		environmentID: environmentID,
		resourceType:  resourceType,
		resourceID:    resourceID,
		namespace:     namespace,
		containerName: containerName,
		stdin:         stdin,
		resize:        resize,
		wait:          waitFn,
		closeFn:       closeFn,
		lastAttached:  time.Now().UTC(),
		subscribers:   map[chan terminalStreamEvent]struct{}{},
	}
	terminalRuntimeSessions.mu.Lock()
	terminalRuntimeSessions.items[session.id] = session
	terminalRuntimeSessions.mu.Unlock()
	go session.cleanupWhenIdle()
	return session
}

func getTerminalRuntimeSession(id string) (*terminalRuntimeSession, bool) {
	terminalRuntimeSessions.mu.RLock()
	defer terminalRuntimeSessions.mu.RUnlock()
	item, ok := terminalRuntimeSessions.items[id]
	return item, ok
}

func deleteTerminalRuntimeSession(id string) {
	terminalRuntimeSessions.mu.Lock()
	delete(terminalRuntimeSessions.items, id)
	terminalRuntimeSessions.mu.Unlock()
}

func (s *terminalRuntimeSession) cleanupWhenIdle() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.RLock()
		done := s.done
		subscriberCount := len(s.subscribers)
		lastAttached := s.lastAttached
		closedAt := s.closedAt
		s.mu.RUnlock()
		if done {
			if !closedAt.IsZero() && time.Since(closedAt) > 5*time.Minute {
				deleteTerminalRuntimeSession(s.id)
				return
			}
			continue
		}
		if subscriberCount == 0 && time.Since(lastAttached) > 2*time.Minute {
			_ = s.close()
			return
		}
	}
}

func (s *terminalRuntimeSession) attachSubscriber() chan terminalStreamEvent {
	ch := make(chan terminalStreamEvent, 128)
	s.mu.Lock()
	s.subscribers[ch] = struct{}{}
	s.lastAttached = time.Now().UTC()
	s.mu.Unlock()
	return ch
}

func (s *terminalRuntimeSession) detachSubscriber(ch chan terminalStreamEvent) {
	s.mu.Lock()
	delete(s.subscribers, ch)
	s.lastAttached = time.Now().UTC()
	s.mu.Unlock()
	close(ch)
}

func (s *terminalRuntimeSession) broadcast(event terminalStreamEvent) {
	s.mu.RLock()
	subscribers := make([]chan terminalStreamEvent, 0, len(s.subscribers))
	for subscriber := range s.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	s.mu.RUnlock()
	for _, subscriber := range subscribers {
		func(ch chan terminalStreamEvent) {
			defer func() {
				_ = recover()
			}()
			select {
			case ch <- event:
			default:
			}
		}(subscriber)
	}
}

func (s *terminalRuntimeSession) markClosed(status string, message string) {
	s.mu.Lock()
	if s.done {
		s.mu.Unlock()
		return
	}
	s.done = true
	s.closedAt = time.Now().UTC()
	s.mu.Unlock()
	s.broadcast(terminalStreamEvent{Kind: "status", Status: status, Message: message})
}

func (s *terminalRuntimeSession) close() error {
	s.mu.Lock()
	if s.done {
		s.mu.Unlock()
		return nil
	}
	s.done = true
	s.closedAt = time.Now().UTC()
	closeFn := s.closeFn
	s.mu.Unlock()
	if closeFn != nil {
		if err := closeFn(); err != nil {
			s.broadcast(terminalStreamEvent{Kind: "error", Message: err.Error()})
			return err
		}
	}
	s.broadcast(terminalStreamEvent{Kind: "status", Status: "closed", Message: "Interactive session closed"})
	return nil
}

func (s *terminalRuntimeSession) sendInput(data string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.done {
		return io.EOF
	}
	_, err := io.WriteString(s.stdin, data)
	return err
}

func (s *terminalRuntimeSession) resizeTerminal(cols, rows uint16) error {
	s.mu.RLock()
	resizeFn := s.resize
	done := s.done
	s.mu.RUnlock()
	if done || resizeFn == nil {
		return nil
	}
	return resizeFn(cols, rows)
}

func (s *terminalRuntimeSession) popExecutedCommands(data string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.done {
		return nil
	}
	commands := make([]string, 0, 2)
	for _, char := range []rune(data) {
		switch char {
		case '\r', '\n':
			command := strings.TrimSpace(string(s.commandBuffer))
			if command != "" {
				commands = append(commands, command)
			}
			s.commandBuffer = s.commandBuffer[:0]
		case '\b', 0x7f:
			if len(s.commandBuffer) > 0 {
				s.commandBuffer = s.commandBuffer[:len(s.commandBuffer)-1]
			}
		case 0x03:
			s.commandBuffer = s.commandBuffer[:0]
		default:
			if char >= 32 {
				s.commandBuffer = append(s.commandBuffer, char)
			}
		}
	}
	return commands
}

func (s *terminalRuntimeSession) startOutputPumps(stdout io.Reader, stderr io.Reader) {
	pump := func(reader io.Reader) {
		if reader == nil {
			return
		}
		if err := collector.StreamReaderChunks(reader, func(chunk []byte) error {
			s.broadcast(terminalStreamEvent{Kind: "binary", Payload: append([]byte(nil), chunk...)})
			return nil
		}); err != nil && err != io.EOF {
			s.broadcast(terminalStreamEvent{Kind: "error", Message: err.Error()})
			_ = s.close()
		}
	}
	go pump(stdout)
	go pump(stderr)
	go func() {
		if s.wait == nil {
			return
		}
		if err := s.wait(); err != nil {
			s.broadcast(terminalStreamEvent{Kind: "error", Message: err.Error()})
			s.markClosed("failed", err.Error())
			return
		}
		s.markClosed("closed", "Interactive session closed")
	}()
}

func (h *EnvironmentRuntimeHandler) exportDockerImage(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.export", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		ImageRef string `json:"image_ref"`
	}
	if err := jsonNewDecoder(r).Decode(&request); err != nil || strings.TrimSpace(request.ImageRef) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.export", "invalid_request", "image_ref is required", nil)
		return
	}
	path, err := collector.ExportDockerImage(strings.TrimSpace(request.ImageRef))
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.image.export", "docker_export_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.image.export", "image", strings.TrimSpace(request.ImageRef), "success", "Image exported successfully", map[string]any{"path": path})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Image exported successfully", "path": path})
}

func (h *EnvironmentRuntimeHandler) downloadDockerImageExport(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.export.download", "unsupported_environment", err.Error(), nil)
		return
	}
	requestedPath := strings.TrimSpace(r.URL.Query().Get("path"))
	if requestedPath == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.export.download", "invalid_request", "path is required", nil)
		return
	}
	resolvedPath, err := filepath.Abs(requestedPath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.export.download", "invalid_request", "path is invalid", nil)
		return
	}
	allowedRoot := strings.TrimSpace(os.Getenv("EINFRA_RUNTIME_STATE_DIR"))
	if allowedRoot == "" {
		root, err := os.UserConfigDir()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.export.download", "runtime_state_failed", err.Error(), nil)
			return
		}
		allowedRoot = filepath.Join(root, "einfra")
	}
	allowedRoot = filepath.Join(allowedRoot, "docker-image-exports")
	allowedRootAbs, err := filepath.Abs(allowedRoot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.export.download", "runtime_state_failed", err.Error(), nil)
		return
	}
	relative, err := filepath.Rel(allowedRootAbs, resolvedPath)
	if err != nil || strings.HasPrefix(relative, "..") {
		writeError(w, http.StatusForbidden, "environment_runtime", "docker.image.export.download", "path_forbidden", "path is outside the export directory", nil)
		return
	}
	file, err := os.Open(resolvedPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "environment_runtime", "docker.image.export.download", "file_not_found", err.Error(), nil)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.image.export.download", "file_stat_failed", err.Error(), nil)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", info.Name()))
	w.Header().Set("Content-Type", "application/gzip")
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func (h *EnvironmentRuntimeHandler) retagDockerImage(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.retag", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		SourceRef string `json:"source_ref"`
		TargetRef string `json:"target_ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.SourceRef) == "" || strings.TrimSpace(request.TargetRef) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.retag", "invalid_request", "source_ref and target_ref are required", nil)
		return
	}
	if err := collector.RetagDockerImage(request.SourceRef, request.TargetRef); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.retag", "docker_retag_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Image retagged successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerImage(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	imageRef := strings.TrimSpace(mux.Vars(r)["imageRef"])
	if imageRef == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.image.delete", "invalid_request", "imageRef is required", nil)
		return
	}
	force := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force")), "true")
	if err := collector.RemoveDockerImage(imageRef, force); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.image.delete", "image", imageRef, "failed", err.Error(), map[string]any{"force": force})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.image.delete", "docker_image_delete_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.image.delete", "image", imageRef, "success", "Image removed successfully", map[string]any{"force": force})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Image removed successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerNetworks(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.networks", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerNetworks()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.networks", "docker_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) createDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.create", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerNetworkConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.create", "invalid_request", "name is required", nil)
		return
	}
	if err := collector.CreateDockerNetwork(request); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.create", "docker_network_create_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Network created successfully"})
}

func (h *EnvironmentRuntimeHandler) getDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.get", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.InspectDockerNetworkConfig(mux.Vars(r)["networkId"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.get", "docker_network_get_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) updateDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.update", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerNetworkConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.update", "invalid_request", "name is required", nil)
		return
	}
	if err := collector.UpdateDockerNetwork(mux.Vars(r)["networkId"], request); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.update", "docker_network_update_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Network updated successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.DeleteDockerNetwork(mux.Vars(r)["networkId"]); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.delete", "docker_network_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Network deleted successfully"})
}

func (h *EnvironmentRuntimeHandler) attachDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.attach", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		ContainerID string `json:"container_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.ContainerID) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.attach", "invalid_request", "container_id is required", nil)
		return
	}
	if err := collector.AttachDockerNetwork(mux.Vars(r)["networkId"], request.ContainerID); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.attach", "docker_network_attach_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container attached successfully"})
}

func (h *EnvironmentRuntimeHandler) detachDockerNetwork(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.detach", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		ContainerID string `json:"container_id"`
		Force       bool   `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.ContainerID) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.network.detach", "invalid_request", "container_id is required", nil)
		return
	}
	if err := collector.DetachDockerNetwork(mux.Vars(r)["networkId"], request.ContainerID, request.Force); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.network.detach", "docker_network_detach_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Container detached successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerVolumes(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volumes", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerVolumes()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volumes", "docker_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"Volumes": items})
}

func (h *EnvironmentRuntimeHandler) createDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.create", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerVolumeConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.create", "invalid_request", "name is required", nil)
		return
	}
	if err := collector.CreateDockerVolume(request); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.create", "docker_volume_create_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume created successfully"})
}

func (h *EnvironmentRuntimeHandler) getDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.get", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.InspectDockerVolumeConfig(mux.Vars(r)["volumeName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.get", "docker_volume_get_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) updateDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.update", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerVolumeConfig
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.update", "invalid_request", "name is required", nil)
		return
	}
	if err := collector.UpdateDockerVolume(mux.Vars(r)["volumeName"], request); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.update", "docker_volume_update_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume updated successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	force := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("force")), "true")
	if err := collector.DeleteDockerVolume(mux.Vars(r)["volumeName"], force); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.delete", "docker_volume_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume deleted successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerVolumeFiles(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.list", "unsupported_environment", err.Error(), nil)
		return
	}
	path := firstQuery(r, "path", "/")
	items, err := collector.ListDockerVolumeFiles(mux.Vars(r)["volumeName"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.list", "docker_volume_files_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "items": items})
}

func (h *EnvironmentRuntimeHandler) readDockerVolumeFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.read", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.read", "invalid_request", "path is required", nil)
		return
	}
	content, err := collector.ReadDockerVolumeFile(mux.Vars(r)["volumeName"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.read", "docker_volume_files_read_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "content": content})
}

func (h *EnvironmentRuntimeHandler) saveDockerVolumeFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.save", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Path) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.save", "invalid_request", "path is required", nil)
		return
	}
	if err := collector.SaveDockerVolumeFile(mux.Vars(r)["volumeName"], request.Path, request.Content); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.save", "docker_volume_files_save_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume file saved successfully"})
}

func (h *EnvironmentRuntimeHandler) downloadDockerVolumeFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.download", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.download", "invalid_request", "path is required", nil)
		return
	}
	content, fileName, err := collector.CopyDockerFileFromVolume(mux.Vars(r)["volumeName"], path)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.download", "docker_volume_files_download_failed", err.Error(), nil)
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(content)
}

func (h *EnvironmentRuntimeHandler) uploadDockerVolumeFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.upload", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.upload", "invalid_request", "invalid multipart payload", nil)
		return
	}
	path := firstQuery(r, "path", r.FormValue("path"))
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.upload", "invalid_request", "file is required", nil)
		return
	}
	defer file.Close()
	if err := collector.CopyDockerFileToVolume(mux.Vars(r)["volumeName"], path, file); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.upload", "docker_volume_files_upload_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume file uploaded successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerVolumeFile(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.files.delete", "invalid_request", "path is required", nil)
		return
	}
	if err := collector.DeleteDockerVolumeFile(mux.Vars(r)["volumeName"], path); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.files.delete", "docker_volume_files_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume file deleted successfully"})
}

func (h *EnvironmentRuntimeHandler) backupDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.backup", "unsupported_environment", err.Error(), nil)
		return
	}
	backupPath, err := collector.BackupDockerVolume(mux.Vars(r)["volumeName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.backup", "docker_volume_backup_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume backup created successfully", "path": backupPath})
}

func (h *EnvironmentRuntimeHandler) cloneDockerVolume(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.clone", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		TargetName string `json:"target_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.TargetName) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.volume.clone", "invalid_request", "target_name is required", nil)
		return
	}
	if err := collector.CloneDockerVolume(mux.Vars(r)["volumeName"], request.TargetName); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.volume.clone", "docker_volume_clone_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Volume cloned successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerStacks(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerStacks()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks", "docker_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) deployDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.deploy", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Name        string            `json:"name"`
		Compose     string            `json:"compose"`
		Environment map[string]string `json:"environment"`
		Secrets     map[string]string `json:"secrets"`
		Configs     map[string]string `json:"configs"`
		Tags        []string          `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" || strings.TrimSpace(request.Compose) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.deploy", "invalid_request", "name and compose are required", nil)
		return
	}
	if err := collector.DeployDockerStack(request.Name, request.Compose, request.Environment, request.Secrets, request.Configs); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.stack.deploy", "stack", request.Name, "failed", err.Error(), map[string]any{"env_keys": keysOf(request.Environment), "secret_keys": keysOf(request.Secrets), "config_keys": keysOf(request.Configs), "tags": request.Tags})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.deploy", "docker_stack_deploy_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.stack.deploy", "stack", request.Name, "success", "Stack deployed successfully", map[string]any{"env_keys": keysOf(request.Environment), "secret_keys": keysOf(request.Secrets), "config_keys": keysOf(request.Configs), "tags": request.Tags})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Stack deployed successfully"})
}

func (h *EnvironmentRuntimeHandler) getDockerSwarmStatus(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.swarm.status", "unsupported_environment", err.Error(), nil)
		return
	}
	status, err := collector.GetDockerSwarmStatus()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.swarm.status", "docker_swarm_status_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (h *EnvironmentRuntimeHandler) getDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.get", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.GetDockerStackDetail(mux.Vars(r)["stackName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.get", "docker_stack_get_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) listDockerStackServices(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.services", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerStackServices(mux.Vars(r)["stackName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.services", "docker_stack_services_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) getDockerStackService(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.service.get", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.InspectDockerService(mux.Vars(r)["serviceName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.service.get", "docker_service_get_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) getDockerStackServiceLogs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.service.logs", "unsupported_environment", err.Error(), nil)
		return
	}
	logs, err := collector.GetDockerServiceLogs(mux.Vars(r)["serviceName"], parseInt(r.URL.Query().Get("tail"), 200))
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.service.logs", "docker_service_logs_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": logs})
}

func (h *EnvironmentRuntimeHandler) restartDockerStackService(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.service.restart", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.RestartDockerService(mux.Vars(r)["serviceName"]); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.service.restart", "docker_service_restart_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Service restart triggered successfully"})
}

func (h *EnvironmentRuntimeHandler) scaleDockerStackService(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.service.scale", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Replicas int `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || request.Replicas < 0 {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.service.scale", "invalid_request", "replicas must be >= 0", nil)
		return
	}
	if err := collector.ScaleDockerService(mux.Vars(r)["serviceName"], request.Replicas); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.service.scale", "docker_service_scale_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Service scaled successfully"})
}

func (h *EnvironmentRuntimeHandler) startDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.start", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.StartDockerStack(mux.Vars(r)["stackName"]); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.start", "docker_stack_start_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Stack started successfully"})
}

func (h *EnvironmentRuntimeHandler) stopDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.stop", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.StopDockerStack(mux.Vars(r)["stackName"]); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.stop", "docker_stack_stop_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Stack stopped successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	purge := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("purge")), "true")
	if err := collector.RemoveDockerStack(mux.Vars(r)["stackName"], purge); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.delete", "docker_stack_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Stack removed successfully"})
}

func (h *EnvironmentRuntimeHandler) rollbackDockerStack(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.rollback", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Revision string `json:"revision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Revision) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.stacks.rollback", "invalid_request", "revision is required", nil)
		return
	}
	if err := collector.RollbackDockerStack(mux.Vars(r)["stackName"], request.Revision); err != nil {
		_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.stack.rollback", "stack", mux.Vars(r)["stackName"], "failed", err.Error(), map[string]any{"revision": request.Revision})
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.stacks.rollback", "docker_stack_rollback_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, mux.Vars(r)["id"], "docker.stack.rollback", "stack", mux.Vars(r)["stackName"], "success", "Stack rollback completed successfully", map[string]any{"revision": request.Revision})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Stack rollback completed successfully"})
}

func (h *EnvironmentRuntimeHandler) listDockerSecrets(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.secrets.list", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerSecretAssets(environmentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.secrets.list", "docker_secrets_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) saveDockerSecret(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.secrets.save", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerSecretAsset
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.secrets.save", "invalid_request", "name is required", nil)
		return
	}
	item, err := collector.SaveDockerSecretAsset(environmentID, request)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.secrets.save", "docker_secrets_save_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.secret.save", "secret", item.Name, "success", "Docker secret asset saved", nil)
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) deleteDockerSecret(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	name := mux.Vars(r)["name"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.secrets.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.DeleteDockerSecretAsset(environmentID, name); err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.secrets.delete", "docker_secrets_delete_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.secret.delete", "secret", name, "success", "Docker secret asset deleted", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Docker secret asset deleted"})
}

func (h *EnvironmentRuntimeHandler) getDockerTopology(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.topology", "unsupported_environment", err.Error(), nil)
		return
	}
	topology, err := collector.BuildDockerTopology()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.topology", "docker_topology_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, topology)
}

func (h *EnvironmentRuntimeHandler) listEnvironmentAudit(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, ""); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "environment.audit", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListRuntimeAuditFiltered(collector.RuntimeAuditFilterOptions{
		EnvironmentID: environmentID,
		Limit:         parseInt(r.URL.Query().Get("limit"), 100),
		Search:        r.URL.Query().Get("search"),
		Status:        r.URL.Query().Get("status"),
		Action:        r.URL.Query().Get("action"),
		Actor:         r.URL.Query().Get("actor"),
		ResourceType:  r.URL.Query().Get("resource_type"),
		Tag:           r.URL.Query().Get("tag"),
		From:          r.URL.Query().Get("from"),
		To:            r.URL.Query().Get("to"),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "environment.audit", "runtime_audit_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listDockerAutoHealPolicies(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.autoheal.list", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListDockerAutoHealPolicies(environmentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.autoheal.list", "docker_autoheal_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) saveDockerAutoHealPolicy(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.autoheal.save", "unsupported_environment", err.Error(), nil)
		return
	}
	var request collector.DockerAutoHealPolicy
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.autoheal.save", "invalid_request", "name is required", nil)
		return
	}
	request.EnvironmentID = environmentID
	item, err := collector.SaveDockerAutoHealPolicy(request)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.autoheal.save", "docker_autoheal_save_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.autoheal.save", "autoheal_policy", item.ID, "success", "Auto-heal policy saved", map[string]any{"name": item.Name, "trigger": item.Trigger})
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) deleteDockerAutoHealPolicy(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.autoheal.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.DeleteDockerAutoHealPolicy(mux.Vars(r)["policyId"]); err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "docker.autoheal.delete", "docker_autoheal_delete_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.autoheal.delete", "autoheal_policy", mux.Vars(r)["policyId"], "success", "Auto-heal policy deleted", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Auto-heal policy removed successfully"})
}

func (h *EnvironmentRuntimeHandler) runDockerAutoHeal(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	policyID := strings.TrimSpace(r.URL.Query().Get("policy_id"))
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.autoheal.run", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.RunDockerAutoHealPolicies(environmentID, policyID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.autoheal.run", "docker_autoheal_run_failed", err.Error(), nil)
		return
	}
	details := "Auto-heal evaluation executed"
	if policyID != "" {
		details = fmt.Sprintf("Auto-heal policy %s evaluation executed", policyID)
	}
	_ = h.auditEnvironmentAction(r, environmentID, "docker.autoheal.run", "autoheal_policy", environmentID, "success", details, map[string]any{"policies": len(items), "policy_id": policyID})
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) getDockerDiskUsage(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "docker"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "docker.disk_usage", "unsupported_environment", err.Error(), nil)
		return
	}
	result, err := collector.GetDockerDiskUsage()
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "docker.disk_usage", "docker_disk_usage_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *EnvironmentRuntimeHandler) listKubernetesPods(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pods", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesPodsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.pods", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesPodsWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	namespace := firstQuery(r, "namespace", "default")
	h.streamKubernetesSnapshotWS(
		w,
		r,
		environmentID,
		"kubernetes.pods.ws",
		func() (any, error) {
			return collector.ListKubernetesPodsForEnvironment(environmentID, namespace)
		},
	)
}

func (h *EnvironmentRuntimeHandler) listKubernetesDeployments(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.deployments", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesDeploymentsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.deployments", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesDeploymentsWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	namespace := firstQuery(r, "namespace", "default")
	h.streamKubernetesSnapshotWS(
		w,
		r,
		environmentID,
		"kubernetes.deployments.ws",
		func() (any, error) {
			return collector.ListKubernetesDeploymentsForEnvironment(environmentID, namespace)
		},
	)
}

func (h *EnvironmentRuntimeHandler) listKubernetesServices(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.services", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesServicesForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.services", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesServicesWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	namespace := firstQuery(r, "namespace", "default")
	h.streamKubernetesSnapshotWS(
		w,
		r,
		environmentID,
		"kubernetes.services.ws",
		func() (any, error) {
			return collector.ListKubernetesServicesForEnvironment(environmentID, namespace)
		},
	)
}

func (h *EnvironmentRuntimeHandler) listKubernetesIngresses(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.ingresses", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesIngressesForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.ingresses", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesConfigMaps(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.configmaps", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesConfigMapsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.configmaps", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesSecrets(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.secrets", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesSecretsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.secrets", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesNodes(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.nodes", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListKubernetesNodesForEnvironment(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.nodes", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesNodesWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	h.streamKubernetesSnapshotWS(
		w,
		r,
		environmentID,
		"kubernetes.nodes.ws",
		func() (any, error) {
			return collector.ListKubernetesNodesForEnvironment(environmentID)
		},
	)
}

func (h *EnvironmentRuntimeHandler) getKubernetesNodeDetail(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.detail", "unsupported_environment", err.Error(), nil)
		return
	}
	item, err := collector.GetKubernetesNodeDetailForEnvironment(mux.Vars(r)["id"], mux.Vars(r)["nodeName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.detail", "kubernetes_node_detail_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) describeKubernetesNode(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.describe", "unsupported_environment", err.Error(), nil)
		return
	}
	output, err := collector.DescribeKubernetesNodeForEnvironment(mux.Vars(r)["id"], mux.Vars(r)["nodeName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.describe", "kubernetes_node_describe_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"output": output})
}

func (h *EnvironmentRuntimeHandler) cordonKubernetesNode(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	nodeName := mux.Vars(r)["nodeName"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.cordon", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.CordonKubernetesNodeForEnvironment(environmentID, nodeName); err != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.cordon", "node", nodeName, "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.cordon", "kubernetes_node_cordon_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.cordon", "node", nodeName, "success", "Node cordoned successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Node cordoned successfully"})
}

func (h *EnvironmentRuntimeHandler) uncordonKubernetesNode(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	nodeName := mux.Vars(r)["nodeName"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.uncordon", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.UncordonKubernetesNodeForEnvironment(environmentID, nodeName); err != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.uncordon", "node", nodeName, "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.uncordon", "kubernetes_node_uncordon_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.uncordon", "node", nodeName, "success", "Node uncordoned successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Node uncordoned successfully"})
}

func (h *EnvironmentRuntimeHandler) drainKubernetesNode(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	nodeName := mux.Vars(r)["nodeName"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.drain", "unsupported_environment", err.Error(), nil)
		return
	}
	if err := collector.DrainKubernetesNodeForEnvironment(environmentID, nodeName); err != nil {
		_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.drain", "node", nodeName, "failed", err.Error(), nil)
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.drain", "kubernetes_node_drain_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.node.drain", "node", nodeName, "success", "Node drained successfully", nil)
	writeJSON(w, http.StatusOK, map[string]any{"message": "Node drained successfully"})
}

func (h *EnvironmentRuntimeHandler) listKubernetesNamespaces(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.namespaces", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListKubernetesNamespacesForEnvironment(mux.Vars(r)["id"])
	if err != nil {
		writeJSON(w, http.StatusOK, []map[string]string{
			{"name": "default", "status": "Active", "age": "-"},
			{"name": "kube-system", "status": "Active", "age": "-"},
			{"name": "kube-public", "status": "Active", "age": "-"},
		})
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) importKubernetesKubeconfig(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.import", "invalid_request", "failed to parse multipart form", nil)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.import", "invalid_request", "file is required", nil)
		return
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.import", "invalid_request", "failed to read kubeconfig", nil)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	items, err := collector.ImportKubernetesKubeconfig(name, content)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.import", "kubernetes_import_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (h *EnvironmentRuntimeHandler) getKubernetesPodLogs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pod.logs", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	tail := parseInt(r.URL.Query().Get("tail"), 200)
	logs, err := collector.GetKubernetesPodLogsForEnvironment(mux.Vars(r)["id"], namespace, mux.Vars(r)["podName"], tail)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.pod.logs", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"logs": logs})
}

func (h *EnvironmentRuntimeHandler) getKubernetesPodLogsWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pod.logs.ws", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	tail := parseInt(r.URL.Query().Get("tail"), 200)

	conn, err := runtimeWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	writeMu := &sync.Mutex{}
	writeJSONMessage := func(payload map[string]any) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteJSON(payload)
	}
	writeBinary := func(chunk []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteMessage(websocket.BinaryMessage, chunk)
	}
	_ = writeJSONMessage(map[string]any{"type": "status", "status": "connected", "message": "Live pod log stream connected"})
	err = collector.StreamKubernetesPodLogs(environmentID, namespace, mux.Vars(r)["podName"], tail, true, writerFunc(writeBinary), writerFunc(writeBinary))
	if err != nil {
		_ = writeJSONMessage(map[string]any{"type": "error", "message": err.Error()})
		return
	}
	_ = writeJSONMessage(map[string]any{"type": "status", "status": "closed", "message": "Log stream closed"})
}

func (h *EnvironmentRuntimeHandler) execKubernetesPod(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pod.exec", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string   `json:"namespace"`
		Command   []string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Command) == 0 {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pod.exec", "invalid_request", "command is required", nil)
		return
	}
	output, err := collector.ExecKubernetesPodForEnvironment(mux.Vars(r)["id"], firstNonEmpty(request.Namespace, "default"), mux.Vars(r)["podName"], request.Command)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.pod.exec", "kubernetes_exec_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"output": output})
}

func (h *EnvironmentRuntimeHandler) execKubernetesPodWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	namespace := firstQuery(r, "namespace", "default")
	h.serveKubernetesTerminalWS(w, r, environmentID, namespace, mux.Vars(r)["podName"], strings.TrimSpace(r.URL.Query().Get("container")))
}

func (h *EnvironmentRuntimeHandler) serveKubernetesTerminalWS(w http.ResponseWriter, r *http.Request, environmentID, namespace, podName, containerName string) {
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.pod.exec.ws", "unsupported_environment", err.Error(), nil)
		return
	}

	resourceID := podName
	if strings.TrimSpace(containerName) != "" {
		resourceID = fmt.Sprintf("%s/%s", podName, containerName)
	}
	session, ok := getTerminalRuntimeSession(strings.TrimSpace(r.URL.Query().Get("session_id")))
	if !ok || session == nil || session.environmentID != environmentID || session.runtimeKind != "kubernetes" || session.resourceID != resourceID {
		execSession, err := collector.StartKubernetesPodExecSession(environmentID, namespace, podName, containerName, nil)
		if err != nil {
			writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.pod.exec.ws", "kubernetes_exec_failed", err.Error(), nil)
			_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.pod.exec.ws", "pod", podName, "failed", err.Error(), map[string]any{"namespace": namespace, "container": containerName})
			return
		}
		session = newTerminalRuntimeSession(
			"kubernetes",
			environmentID,
			"pod",
			resourceID,
			namespace,
			containerName,
			execSession.Stdin,
			execSession.Resize,
			execSession.Wait,
			execSession.Close,
		)
		session.startOutputPumps(execSession.Stdout, execSession.Stderr)
	}

	h.attachTerminalRuntimeSession(w, r, session, false)
}

func (h *EnvironmentRuntimeHandler) attachTerminalRuntimeSession(w http.ResponseWriter, r *http.Request, session *terminalRuntimeSession, resumed bool) {
	conn, err := runtimeWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	subscriber := session.attachSubscriber()

	writeMu := &sync.Mutex{}
	writeJSONMessage := func(payload map[string]any) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteJSON(payload)
	}
	writeBinary := func(payload []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteMessage(websocket.BinaryMessage, payload)
	}

	statusMessage := "Interactive runtime session established"
	if session.runtimeKind == "kubernetes" {
		statusMessage = "Interactive pod shell established"
	}
	if resumed {
		statusMessage = "Interactive session reconnected"
	}
	_ = writeJSONMessage(map[string]any{
		"type":       "status",
		"status":     "connected",
		"message":    statusMessage,
		"session_id": session.id,
		"resumed":    resumed,
	})

	done := make(chan struct{})
	go func() {
		defer close(done)
		for event := range subscriber {
			switch event.Kind {
			case "binary":
				if err := writeBinary(event.Payload); err != nil {
					return
				}
			case "error":
				if err := writeJSONMessage(map[string]any{"type": "error", "message": event.Message, "session_id": session.id}); err != nil {
					return
				}
			case "status":
				if err := writeJSONMessage(map[string]any{"type": "status", "status": event.Status, "message": event.Message, "session_id": session.id}); err != nil {
					return
				}
			}
		}
	}()

	inputErr := h.handleTerminalWSInput(conn, session, r)
	session.detachSubscriber(subscriber)
	if inputErr != nil && !websocket.IsCloseError(inputErr, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
		_ = writeJSONMessage(map[string]any{"type": "error", "message": inputErr.Error(), "session_id": session.id})
	}
	<-done
}

func (h *EnvironmentRuntimeHandler) handleTerminalWSInput(conn *websocket.Conn, session *terminalRuntimeSession, r *http.Request) error {
	for {
		var message struct {
			Type string `json:"type"`
			Data string `json:"data"`
		}
		if err := conn.ReadJSON(&message); err != nil {
			return err
		}
		switch strings.ToLower(strings.TrimSpace(message.Type)) {
		case "close":
			if err := session.close(); err != nil {
				return err
			}
			return nil
		case "input":
			if err := session.sendInput(message.Data); err != nil {
				return err
			}
			for _, command := range session.popExecutedCommands(message.Data) {
				h.auditTerminalCommand(r, session, command)
			}
		case "resize":
			var resize struct {
				Cols uint16 `json:"cols"`
				Rows uint16 `json:"rows"`
			}
			if err := json.Unmarshal([]byte(message.Data), &resize); err == nil && resize.Cols > 0 && resize.Rows > 0 {
				if err := session.resizeTerminal(resize.Cols, resize.Rows); err != nil {
					return err
				}
			}
		}
	}
}

func (h *EnvironmentRuntimeHandler) auditTerminalCommand(r *http.Request, session *terminalRuntimeSession, command string) {
	command = strings.TrimSpace(command)
	if command == "" {
		return
	}
	action := "docker.container.terminal.command"
	resource := "container"
	resourceID := session.resourceID
	metadata := map[string]any{
		"session_id": session.id,
		"runtime":    session.runtimeKind,
		"command":    command,
	}
	if session.runtimeKind == "kubernetes" {
		action = "kubernetes.pod.terminal.command"
		resource = "pod"
		metadata["namespace"] = session.namespace
		if session.containerName != "" {
			metadata["container"] = session.containerName
		}
	}
	_ = h.auditEnvironmentAction(r, session.environmentID, action, resource, resourceID, "success", "Terminal command executed", metadata)
}

func (h *EnvironmentRuntimeHandler) startKubernetesNodeDebugSession(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.node.debug", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string `json:"namespace"`
		Image     string `json:"image"`
	}
	_ = json.NewDecoder(r.Body).Decode(&request)
	session, err := collector.StartKubernetesNodeDebugSessionForEnvironment(environmentID, mux.Vars(r)["nodeName"], request.Namespace, request.Image)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.node.debug", "debug_session_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (h *EnvironmentRuntimeHandler) scaleKubernetesDeployment(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.deployment.scale", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string `json:"namespace"`
		Replicas  int    `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.deployment.scale", "invalid_request", "replicas is required", nil)
		return
	}
	if err := collector.ScaleKubernetesDeploymentForEnvironment(mux.Vars(r)["id"], firstNonEmpty(request.Namespace, "default"), mux.Vars(r)["deploymentName"], request.Replicas); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.deployment.scale", "kubernetes_scale_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Deployment scaled successfully"})
}

func (h *EnvironmentRuntimeHandler) restartKubernetesDeployment(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.deployment.restart", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string `json:"namespace"`
	}
	_ = json.NewDecoder(r.Body).Decode(&request)
	if err := collector.RestartKubernetesDeploymentForEnvironment(mux.Vars(r)["id"], firstNonEmpty(request.Namespace, "default"), mux.Vars(r)["deploymentName"]); err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.deployment.restart", "kubernetes_restart_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Deployment restarted successfully"})
}

func (h *EnvironmentRuntimeHandler) listKubernetesPersistentVolumes(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.persistentvolumes", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListKubernetesPersistentVolumesForEnvironment(mux.Vars(r)["id"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.persistentvolumes", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesPersistentVolumeClaims(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.persistentvolumeclaims", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesPersistentVolumeClaimsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.persistentvolumeclaims", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesJobs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.jobs", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesJobsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.jobs", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listKubernetesCronJobs(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireLocalEnvironment(r.Context(), mux.Vars(r)["id"], "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.cronjobs", "unsupported_environment", err.Error(), nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListKubernetesCronJobsForEnvironment(mux.Vars(r)["id"], namespace)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.cronjobs", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) searchKubernetesResources(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.search", "unsupported_environment", err.Error(), nil)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	items, err := collector.SearchKubernetesResourcesForEnvironment(environmentID, namespace, query)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.search", "kubernetes_search_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listGenericKubernetesResources(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resources", "unsupported_environment", err.Error(), nil)
		return
	}
	kind := strings.TrimSpace(mux.Vars(r)["kind"])
	if kind == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resources", "invalid_request", "kind is required", nil)
		return
	}
	namespaced, ok := resolveGenericKubernetesKind(r, kind)
	if !ok {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resources", "unsupported_kind", "resource kind is not supported", nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	items, err := collector.ListGenericKubernetesResourcesForEnvironment(environmentID, kind, namespace, namespaced)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.resources", "kubernetes_unavailable", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) listGenericKubernetesResourcesWS(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resources.ws", "unsupported_environment", err.Error(), nil)
		return
	}
	kind := strings.TrimSpace(mux.Vars(r)["kind"])
	namespaced, ok := resolveGenericKubernetesKind(r, kind)
	if !ok {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resources.ws", "unsupported_kind", "resource kind is not supported", nil)
		return
	}
	namespace := firstQuery(r, "namespace", "default")
	h.streamKubernetesSnapshotWS(
		w,
		r,
		environmentID,
		"kubernetes.resources.ws",
		func() (any, error) {
			return collector.ListGenericKubernetesResourcesForEnvironment(environmentID, kind, namespace, namespaced)
		},
	)
}

func (h *EnvironmentRuntimeHandler) getGenericKubernetesResourceYAML(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.yaml", "unsupported_environment", err.Error(), nil)
		return
	}
	kind := strings.TrimSpace(mux.Vars(r)["kind"])
	name := strings.TrimSpace(mux.Vars(r)["name"])
	namespaced, ok := resolveGenericKubernetesKind(r, kind)
	if !ok {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.yaml", "unsupported_kind", "resource kind is not supported", nil)
		return
	}
	yaml, err := collector.GetKubernetesResourceYAMLForEnvironment(environmentID, kind, firstQuery(r, "namespace", "default"), name, namespaced)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.resource.yaml", "kubernetes_yaml_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"yaml": yaml})
}

func (h *EnvironmentRuntimeHandler) deleteGenericKubernetesResource(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.delete", "unsupported_environment", err.Error(), nil)
		return
	}
	kind := strings.TrimSpace(mux.Vars(r)["kind"])
	name := strings.TrimSpace(mux.Vars(r)["name"])
	namespaced, ok := resolveGenericKubernetesKind(r, kind)
	if !ok {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.delete", "unsupported_kind", "resource kind is not supported", nil)
		return
	}
	output, err := collector.DeleteKubernetesResourceForEnvironment(environmentID, kind, firstQuery(r, "namespace", "default"), name, namespaced)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.resource.delete", "kubernetes_delete_failed", err.Error(), nil)
		return
	}
	_ = h.auditEnvironmentAction(r, environmentID, "kubernetes.resource.delete", kind, name, "success", "Kubernetes resource deleted", map[string]any{"output": output})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Resource deleted successfully", "output": output})
}

func (h *EnvironmentRuntimeHandler) listGenericKubernetesResourceHistory(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.history", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListKubernetesManifestHistory(environmentID, strings.TrimSpace(mux.Vars(r)["kind"]), firstQuery(r, "namespace", ""), strings.TrimSpace(mux.Vars(r)["name"]))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "environment_runtime", "kubernetes.resource.history", "history_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) rollbackGenericKubernetesResource(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.rollback", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		RevisionID string `json:"revision_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.RevisionID) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.resource.rollback", "invalid_request", "revision_id is required", nil)
		return
	}
	output, err := collector.RollbackKubernetesManifestRevision(environmentID, request.RevisionID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.resource.rollback", "rollback_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Resource rollback completed successfully", "output": output})
}

func (h *EnvironmentRuntimeHandler) getKubernetesTopology(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.topology", "unsupported_environment", err.Error(), nil)
		return
	}
	graph, err := collector.BuildKubernetesTopologyForEnvironment(environmentID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.topology", "topology_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, graph)
}

func (h *EnvironmentRuntimeHandler) applyKubernetesManifest(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.apply", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string `json:"namespace"`
		Manifest  string `json:"manifest"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Manifest) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.apply", "invalid_request", "manifest is required", nil)
		return
	}
	output, err := collector.ApplyKubernetesManifestForEnvironment(environmentID, request.Namespace, request.Manifest)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.apply", "kubernetes_apply_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Manifest applied successfully", "output": output})
}

func (h *EnvironmentRuntimeHandler) listKubernetesHelmReleases(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.helm.list", "unsupported_environment", err.Error(), nil)
		return
	}
	items, err := collector.ListHelmReleasesForEnvironment(environmentID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.helm.list", "helm_release_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) installKubernetesHelmRelease(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.helm.install", "unsupported_environment", err.Error(), nil)
		return
	}
	var request struct {
		Namespace string `json:"namespace"`
		Name      string `json:"name"`
		Chart     string `json:"chart"`
		ValuesYML string `json:"values_yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" || strings.TrimSpace(request.Chart) == "" {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.helm.install", "invalid_request", "name and chart are required", nil)
		return
	}
	output, err := collector.InstallHelmReleaseForEnvironment(environmentID, request.Namespace, request.Name, request.Chart, request.ValuesYML)
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.helm.install", "helm_release_install_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Helm release installed successfully", "output": output})
}

func (h *EnvironmentRuntimeHandler) uninstallKubernetesHelmRelease(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.helm.uninstall", "unsupported_environment", err.Error(), nil)
		return
	}
	output, err := collector.UninstallHelmReleaseForEnvironment(environmentID, strings.TrimSpace(r.URL.Query().Get("namespace")), mux.Vars(r)["releaseName"])
	if err != nil {
		writeError(w, http.StatusBadGateway, "environment_runtime", "kubernetes.helm.uninstall", "helm_release_uninstall_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Helm release removed successfully", "output": output})
}

func (h *EnvironmentRuntimeHandler) getKubernetesAgentBootstrap(w http.ResponseWriter, r *http.Request) {
	environmentID := mux.Vars(r)["id"]
	if _, err := h.requireLocalEnvironment(r.Context(), environmentID, "kubernetes"); err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.agent.bootstrap", "unsupported_environment", err.Error(), nil)
		return
	}
	manifest, err := collector.GenerateKubernetesAgentBootstrap(environmentID, strings.TrimSpace(r.URL.Query().Get("token")), strings.TrimSpace(r.URL.Query().Get("image")))
	if err != nil {
		writeError(w, http.StatusBadRequest, "environment_runtime", "kubernetes.agent.bootstrap", "bootstrap_manifest_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"manifest": manifest})
}

func (h *EnvironmentRuntimeHandler) requireLocalEnvironment(ctx context.Context, environmentID, expectedPlatform string) (*domain.Server, error) {
	serverID, platform := splitEnvironmentID(environmentID)
	if expectedPlatform != "" && platform != "" && platform != expectedPlatform {
		return nil, fmt.Errorf("environment %s is not a %s environment", environmentID, expectedPlatform)
	}
	if expectedPlatform == "kubernetes" && collector.IsImportedKubernetesEnvironment(environmentID) {
		return &domain.Server{
			ID:       environmentID,
			Name:     environmentID,
			Provider: "imported-kubeconfig",
		}, nil
	}
	server, err := h.servers.GetByID(ctx, serverID)
	if err != nil || server == nil {
		return nil, fmt.Errorf("environment node not found")
	}
	if !strings.EqualFold(strings.TrimSpace(server.Provider), "local-control-plane") {
		return nil, fmt.Errorf("only self-host runtime environments are supported by the current control plane")
	}
	return server, nil
}

func splitEnvironmentID(value string) (string, string) {
	parts := strings.SplitN(strings.TrimSpace(value), ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return strings.TrimSpace(value), ""
}

func isValidKubernetesTerminalName(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	return k8sTerminalNamePattern.MatchString(trimmed)
}

func firstQuery(r *http.Request, key, fallback string) string {
	value := strings.TrimSpace(r.URL.Query().Get(key))
	if value == "" {
		return fallback
	}
	return value
}

func jsonNewDecoder(r *http.Request) *json.Decoder {
	return json.NewDecoder(r.Body)
}

func (h *EnvironmentRuntimeHandler) listRegistries(w http.ResponseWriter, _ *http.Request) {
	items, err := collector.ListRegistryCredentials()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "registry", "registry.list", "registry_list_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *EnvironmentRuntimeHandler) saveRegistry(w http.ResponseWriter, r *http.Request) {
	var request collector.RegistryCredential
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Name) == "" || strings.TrimSpace(request.URL) == "" {
		writeError(w, http.StatusBadRequest, "registry", "registry.save", "invalid_request", "name and url are required", nil)
		return
	}
	if err := collector.DockerLoginRegistry(request); err != nil {
		writeError(w, http.StatusBadGateway, "registry", "registry.login", "registry_login_failed", err.Error(), nil)
		return
	}
	item, err := collector.SaveRegistryCredential(request)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "registry", "registry.save", "registry_save_failed", err.Error(), nil)
		return
	}
	_ = collector.AppendRuntimeAudit(collector.RuntimeAuditRecord{
		EnvironmentID: "",
		Action:        "registry.save",
		ResourceType:  "registry",
		ResourceID:    item.ID,
		Status:        "success",
		Details:       fmt.Sprintf("Registry %s saved", item.Name),
		Actor:         strings.TrimSpace(r.RemoteAddr),
		Metadata: map[string]any{
			"name":     item.Name,
			"provider": item.Provider,
			"url":      item.URL,
		},
	})
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) testRegistry(w http.ResponseWriter, r *http.Request) {
	var request collector.RegistryCredential
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.URL) == "" {
		writeError(w, http.StatusBadRequest, "registry", "registry.test", "invalid_request", "url is required", nil)
		return
	}
	if err := collector.DockerLoginRegistry(request); err != nil {
		writeError(w, http.StatusBadGateway, "registry", "registry.test", "registry_test_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Registry connection validated successfully"})
}

func (h *EnvironmentRuntimeHandler) registryCatalog(w http.ResponseWriter, r *http.Request) {
	item, err := collector.BrowseRegistryCatalog(mux.Vars(r)["registryId"], strings.TrimSpace(r.URL.Query().Get("repository")))
	if err != nil {
		writeError(w, http.StatusBadGateway, "registry", "registry.catalog", "registry_catalog_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *EnvironmentRuntimeHandler) deleteRegistryTag(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Repository string `json:"repository"`
		Tag        string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil || strings.TrimSpace(request.Repository) == "" || strings.TrimSpace(request.Tag) == "" {
		writeError(w, http.StatusBadRequest, "registry", "registry.tag.delete", "invalid_request", "repository and tag are required", nil)
		return
	}
	if err := collector.DeleteRegistryTag(mux.Vars(r)["registryId"], request.Repository, request.Tag); err != nil {
		writeError(w, http.StatusBadGateway, "registry", "registry.tag.delete", "registry_tag_delete_failed", err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Registry tag deleted successfully"})
}

func (h *EnvironmentRuntimeHandler) deleteRegistry(w http.ResponseWriter, r *http.Request) {
	if err := collector.DeleteRegistryCredential(mux.Vars(r)["registryId"]); err != nil {
		writeError(w, http.StatusInternalServerError, "registry", "registry.delete", "registry_delete_failed", err.Error(), nil)
		return
	}
	_ = collector.AppendRuntimeAudit(collector.RuntimeAuditRecord{
		EnvironmentID: "",
		Action:        "registry.delete",
		ResourceType:  "registry",
		ResourceID:    mux.Vars(r)["registryId"],
		Status:        "success",
		Details:       "Registry removed successfully",
		Actor:         strings.TrimSpace(r.RemoteAddr),
	})
	writeJSON(w, http.StatusOK, map[string]any{"message": "Registry removed successfully"})
}

func (h *EnvironmentRuntimeHandler) auditEnvironmentAction(r *http.Request, environmentID, action, resourceType, resourceID, status, details string, metadata map[string]any) error {
	return collector.AppendRuntimeAudit(collector.RuntimeAuditRecord{
		EnvironmentID: environmentID,
		Action:        action,
		ResourceType:  resourceType,
		ResourceID:    resourceID,
		Status:        status,
		Details:       details,
		Actor:         strings.TrimSpace(r.RemoteAddr),
		Metadata:      metadata,
	})
}

func keysOf(values map[string]string) []string {
	items := make([]string, 0, len(values))
	for key := range values {
		items = append(items, key)
	}
	return items
}

func extractRuntimeTags(labels map[string]string) []string {
	if len(labels) == 0 {
		return nil
	}
	raw := strings.TrimSpace(labels["einfra.tags"])
	if raw == "" {
		return nil
	}
	items := strings.Split(raw, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

type writerFunc func([]byte) error

func (fn writerFunc) Write(payload []byte) (int, error) {
	if err := fn(payload); err != nil {
		return 0, err
	}
	return len(payload), nil
}

func supportedGenericKubernetesKinds() map[string]bool {
	return map[string]bool{
		"pods":                      true,
		"deployments":               true,
		"services":                  true,
		"ingresses":                 true,
		"configmaps":                true,
		"secrets":                   true,
		"namespaces":                false,
		"nodes":                     false,
		"persistentvolumes":         false,
		"persistentvolumeclaims":    true,
		"jobs":                      true,
		"cronjobs":                  true,
		"statefulsets":              true,
		"daemonsets":                true,
		"replicasets":               true,
		"networkpolicies":           true,
		"endpoints":                 true,
		"endpointslices":            true,
		"gateways":                  true,
		"gatewayclasses":            false,
		"ingressclasses":            false,
		"httproutes":                true,
		"serviceaccounts":           true,
		"roles":                     true,
		"rolebindings":              true,
		"clusterroles":              false,
		"clusterrolebindings":       false,
		"horizontalpodautoscalers":  true,
		"verticalpodautoscalers":    true,
		"storageclasses":            false,
		"customresourcedefinitions": false,
	}
}

func resolveGenericKubernetesKind(r *http.Request, kind string) (bool, bool) {
	normalized := strings.ToLower(strings.TrimSpace(kind))
	if normalized == "" {
		return false, false
	}
	if namespaced, exists := supportedGenericKubernetesKinds()[normalized]; exists {
		return namespaced, true
	}
	for _, char := range normalized {
		if !(char >= 'a' && char <= 'z') && !(char >= '0' && char <= '9') && char != '-' && char != '.' {
			return false, false
		}
	}
	namespaced := !strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("namespaced")), "false")
	return namespaced, true
}
