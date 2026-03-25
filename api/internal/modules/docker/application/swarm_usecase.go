//go:build legacy
// +build legacy

package usecase

import (
	"context"
	"fmt"

	"einfra/api/internal/domain"
	"einfra/api/pkg/docker"
)

// DockerSwarmUsecase handles Docker Swarm operations
type DockerSwarmUsecase interface {
	// Swarm operations
	InitSwarm(ctx context.Context, serverID string, req docker.SwarmInitRequest) (string, error)
	JoinSwarm(ctx context.Context, serverID string, req docker.SwarmJoinRequest) error
	LeaveSwarm(ctx context.Context, serverID string, force bool) error
	InspectSwarm(ctx context.Context, serverID string) (*docker.SwarmInfo, error)
	GetUnlockKey(ctx context.Context, serverID string) (string, error)
	UnlockSwarm(ctx context.Context, serverID string, unlockKey string) error

	// Service operations
	CreateService(ctx context.Context, serverID string, config docker.ServiceCreateConfig) (string, error)
	ListServices(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmService, error)
	InspectService(ctx context.Context, serverID string, serviceID string) (*docker.ServiceInfo, error)
	UpdateService(ctx context.Context, serverID string, serviceID string, version uint64, config docker.ServiceUpdateConfig) error
	RemoveService(ctx context.Context, serverID string, serviceID string) error
	ScaleService(ctx context.Context, serverID string, serviceID string, replicas uint64) error
	GetServiceLogs(ctx context.Context, serverID string, serviceID string, tail string, follow bool) ([]byte, error)

	// Node operations
	ListNodes(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmNode, error)
	InspectNode(ctx context.Context, serverID string, nodeID string) (*docker.NodeInfo, error)
	UpdateNode(ctx context.Context, serverID string, nodeID string, version uint64, config docker.NodeUpdateConfig) error
	RemoveNode(ctx context.Context, serverID string, nodeID string, force bool) error
	PromoteNode(ctx context.Context, serverID string, nodeID string) error
	DemoteNode(ctx context.Context, serverID string, nodeID string) error

	// Secret operations
	CreateSecret(ctx context.Context, serverID string, config docker.SecretCreateConfig) (string, error)
	ListSecrets(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmSecret, error)
	InspectSecret(ctx context.Context, serverID string, secretID string) (*docker.SecretInfo, error)
	RemoveSecret(ctx context.Context, serverID string, secretID string) error

	// Config operations
	CreateConfig(ctx context.Context, serverID string, config docker.ConfigCreateConfig) (string, error)
	ListConfigs(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmConfig, error)
	InspectConfig(ctx context.Context, serverID string, configID string) (*docker.ConfigInfo, error)
	RemoveConfig(ctx context.Context, serverID string, configID string) error

	// Task operations
	ListTasks(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmTask, error)
	InspectTask(ctx context.Context, serverID string, taskID string) (*docker.TaskInfo, error)
}

type dockerSwarmUsecase struct {
	serverRepo domain.ServerRepository
}

// NewDockerSwarmUsecase creates a new Docker Swarm usecase
func NewDockerSwarmUsecase(serverRepo domain.ServerRepository) DockerSwarmUsecase {
	return &dockerSwarmUsecase{
		serverRepo: serverRepo,
	}
}

// Helper to get Docker client
func (u *dockerSwarmUsecase) getDockerClient(ctx context.Context, serverID string) (*docker.Client, error) {
	server, err := u.serverRepo.GetByID(ctx, serverID)
	if err != nil {
		return nil, fmt.Errorf("failed to get server: %w", err)
	}

	if server.DockerClient == nil {
		return nil, fmt.Errorf("server does not have Docker client configured")
	}

	client, ok := server.DockerClient.(*docker.Client)
	if !ok {
		return nil, fmt.Errorf("invalid Docker client type")
	}

	return client, nil
}

// Swarm operations
func (u *dockerSwarmUsecase) InitSwarm(ctx context.Context, serverID string, req docker.SwarmInitRequest) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.SwarmInit(ctx, req)
}

func (u *dockerSwarmUsecase) JoinSwarm(ctx context.Context, serverID string, req docker.SwarmJoinRequest) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.SwarmJoin(ctx, req)
}

func (u *dockerSwarmUsecase) LeaveSwarm(ctx context.Context, serverID string, force bool) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.SwarmLeave(ctx, force)
}

func (u *dockerSwarmUsecase) InspectSwarm(ctx context.Context, serverID string) (*docker.SwarmInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.SwarmInspect(ctx)
}

func (u *dockerSwarmUsecase) GetUnlockKey(ctx context.Context, serverID string) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.SwarmGetUnlockKey(ctx)
}

func (u *dockerSwarmUsecase) UnlockSwarm(ctx context.Context, serverID string, unlockKey string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.SwarmUnlock(ctx, unlockKey)
}

// Service operations
func (u *dockerSwarmUsecase) CreateService(ctx context.Context, serverID string, config docker.ServiceCreateConfig) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.ServiceCreate(ctx, config)
}

func (u *dockerSwarmUsecase) ListServices(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmService, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	services, err := client.ServiceList(ctx, filters)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmService, len(services))
	for i, svc := range services {
		result[i] = domain.SwarmService{
			ID:        svc.ID,
			Name:      svc.Spec.Name,
			Image:     svc.Spec.TaskTemplate.ContainerSpec.Image,
			Mode:      getServiceMode(svc.Spec.Mode),
			Replicas:  getServiceReplicas(svc.Spec.Mode),
			CreatedAt: svc.CreatedAt,
			UpdatedAt: svc.UpdatedAt,
		}
	}

	return result, nil
}

func (u *dockerSwarmUsecase) InspectService(ctx context.Context, serverID string, serviceID string) (*docker.ServiceInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.ServiceInspect(ctx, serviceID)
}

func (u *dockerSwarmUsecase) UpdateService(ctx context.Context, serverID string, serviceID string, version uint64, config docker.ServiceUpdateConfig) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ServiceUpdate(ctx, serviceID, version, config)
}

func (u *dockerSwarmUsecase) RemoveService(ctx context.Context, serverID string, serviceID string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ServiceRemove(ctx, serviceID)
}

func (u *dockerSwarmUsecase) ScaleService(ctx context.Context, serverID string, serviceID string, replicas uint64) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ServiceScale(ctx, serviceID, replicas)
}

func (u *dockerSwarmUsecase) GetServiceLogs(ctx context.Context, serverID string, serviceID string, tail string, follow bool) ([]byte, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.ServiceLogs(ctx, serviceID, tail, follow)
}

// Node operations
func (u *dockerSwarmUsecase) ListNodes(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmNode, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	nodes, err := client.NodeList(ctx, filters)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmNode, len(nodes))
	for i, node := range nodes {
		result[i] = domain.SwarmNode{
			ID:            node.ID,
			Hostname:      node.Description.Hostname,
			Role:          string(node.Spec.Role),
			Availability:  string(node.Spec.Availability),
			Status:        string(node.Status.State),
			ManagerStatus: getManagerStatus(node.ManagerStatus),
		}
	}

	return result, nil
}

func (u *dockerSwarmUsecase) InspectNode(ctx context.Context, serverID string, nodeID string) (*docker.NodeInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.NodeInspect(ctx, nodeID)
}

func (u *dockerSwarmUsecase) UpdateNode(ctx context.Context, serverID string, nodeID string, version uint64, config docker.NodeUpdateConfig) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.NodeUpdate(ctx, nodeID, version, config)
}

func (u *dockerSwarmUsecase) RemoveNode(ctx context.Context, serverID string, nodeID string, force bool) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.NodeRemove(ctx, nodeID, force)
}

func (u *dockerSwarmUsecase) PromoteNode(ctx context.Context, serverID string, nodeID string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.NodePromote(ctx, nodeID)
}

func (u *dockerSwarmUsecase) DemoteNode(ctx context.Context, serverID string, nodeID string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.NodeDemote(ctx, nodeID)
}

// Secret operations
func (u *dockerSwarmUsecase) CreateSecret(ctx context.Context, serverID string, config docker.SecretCreateConfig) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.SecretCreate(ctx, config)
}

func (u *dockerSwarmUsecase) ListSecrets(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmSecret, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	secrets, err := client.SecretList(ctx, filters)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmSecret, len(secrets))
	for i, secret := range secrets {
		result[i] = domain.SwarmSecret{
			ID:        secret.ID,
			Name:      secret.Spec.Name,
			CreatedAt: secret.CreatedAt,
			UpdatedAt: secret.UpdatedAt,
		}
	}

	return result, nil
}

func (u *dockerSwarmUsecase) InspectSecret(ctx context.Context, serverID string, secretID string) (*docker.SecretInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.SecretInspect(ctx, secretID)
}

func (u *dockerSwarmUsecase) RemoveSecret(ctx context.Context, serverID string, secretID string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.SecretRemove(ctx, secretID)
}

// Config operations
func (u *dockerSwarmUsecase) CreateConfig(ctx context.Context, serverID string, config docker.ConfigCreateConfig) (string, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return "", err
	}
	return client.ConfigCreate(ctx, config)
}

func (u *dockerSwarmUsecase) ListConfigs(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmConfig, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	configs, err := client.ConfigList(ctx, filters)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmConfig, len(configs))
	for i, cfg := range configs {
		result[i] = domain.SwarmConfig{
			ID:        cfg.ID,
			Name:      cfg.Spec.Name,
			CreatedAt: cfg.CreatedAt,
			UpdatedAt: cfg.UpdatedAt,
		}
	}

	return result, nil
}

func (u *dockerSwarmUsecase) InspectConfig(ctx context.Context, serverID string, configID string) (*docker.ConfigInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.ConfigInspect(ctx, configID)
}

func (u *dockerSwarmUsecase) RemoveConfig(ctx context.Context, serverID string, configID string) error {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return err
	}
	return client.ConfigRemove(ctx, configID)
}

// Task operations
func (u *dockerSwarmUsecase) ListTasks(ctx context.Context, serverID string, filters map[string][]string) ([]domain.SwarmTask, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}

	tasks, err := client.TaskList(ctx, filters)
	if err != nil {
		return nil, err
	}

	result := make([]domain.SwarmTask, len(tasks))
	for i, task := range tasks {
		result[i] = domain.SwarmTask{
			ID:           task.ID,
			ServiceID:    task.ServiceID,
			NodeID:       task.NodeID,
			DesiredState: string(task.DesiredState),
			State:        string(task.Status.State),
			CreatedAt:    task.CreatedAt,
		}
	}

	return result, nil
}

func (u *dockerSwarmUsecase) InspectTask(ctx context.Context, serverID string, taskID string) (*docker.TaskInfo, error) {
	client, err := u.getDockerClient(ctx, serverID)
	if err != nil {
		return nil, err
	}
	return client.TaskInspect(ctx, taskID)
}

// Helper functions
func getServiceMode(mode interface{}) string {
	// Simplified - would need proper type assertion
	return "replicated"
}

func getServiceReplicas(mode interface{}) uint64 {
	// Simplified - would need proper type assertion
	return 1
}

func getManagerStatus(status interface{}) string {
	if status == nil {
		return ""
	}
	return "leader" // Simplified
}
