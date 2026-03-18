package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
)

// DockerSnapshot represents a snapshot of a specific Docker environment(endpoint) at a specific time
type (
	// AccessPolicy represent a policy that can be associated to a user or team
	AccessPolicy struct {
		// Role identifier. Reference the role that will be associated to this access policy
		RoleID RoleID `json:"RoleId" example:"1"`
		// Namespaces is a list of namespaces that this access policy applies to. Only used for namespaced level roles
		Namespaces []string `json:"Namespaces,omitempty"`
	}

	// AzureCredentials represents the credentials used to connect to an Azure
	// environment(endpoint).
	AzureCredentials struct {
		ApplicationID     string `json:"ApplicationID" example:"eag7cdo9-o09l-9i83-9dO9-f0b23oe78db4"`
		TenantID          string `json:"TenantID" example:"34ddc78d-4fel-2358-8cc1-df84c8o839f5"`
		AuthenticationKey string `json:"AuthenticationKey" example:"cOrXoK/1D35w8YQ8nH1/8ZGwzz45JIYD5jxHKXEQknk="`
	}

	Registry struct {
		// Registry Identifier
		ID RegistryID `json:"Id" example:"1"`
		// Registry Type (1 - Quay, 2 - Azure, 3 - Custom, 4 - Gitlab, 5 - ProGet, 6 - DockerHub, 7 - ECR)
		Type RegistryType `json:"Type" enums:"1,2,3,4,5,6,7"`
		// Registry Name
		Name string `json:"Name" example:"my-registry"`
		// URL or IP address of the Docker registry
		URL string `json:"URL" example:"registry.mydomain.tld:2375"`
		// Base URL, introduced for ProGet registry
		BaseURL string `json:"BaseURL" example:"registry.mydomain.tld:2375"`
		// Is authentication against this registry enabled
		Authentication bool `json:"Authentication" example:"true"`
		// Username or AccessKeyID used to authenticate against this registry
		Username string `json:"Username" example:"registry user"`
		// Password or SecretAccessKey used to authenticate against this registry
		Password                string                           `json:"Password,omitempty" example:"registry_password"`
		ManagementConfiguration *RegistryManagementConfiguration `json:"ManagementConfiguration"`
		Gitlab                  GitlabRegistryData               `json:"Gitlab"`
		Github                  GithubRegistryData               `json:"Github"`
		Quay                    QuayRegistryData                 `json:"Quay"`
		Ecr                     EcrData                          `json:"Ecr"`
		RegistryAccesses        RegistryAccesses                 `json:"RegistryAccesses"`

		// Deprecated fields
		// Deprecated in DBVersion == 31
		UserAccessPolicies UserAccessPolicies `json:"UserAccessPolicies"`
		// Deprecated in DBVersion == 31
		TeamAccessPolicies TeamAccessPolicies `json:"TeamAccessPolicies"`

		// Deprecated in DBVersion == 18
		AuthorizedUsers []UserID `json:"AuthorizedUsers"`
		// Deprecated in DBVersion == 18
		AuthorizedTeams []TeamID `json:"AuthorizedTeams"`

		// Stores temporary access token
		AccessToken       string `json:"AccessToken,omitempty"`
		AccessTokenExpiry int64  `json:"AccessTokenExpiry,omitempty"`
	}

	// Environment(Endpoint) represents a Docker environment(endpoint) with all the info required
	// to connect to it
	Endpoint struct {
		// Environment(Endpoint) Identifier
		ID EndpointID `json:"Id" example:"1"`
		// Environment(Endpoint) name
		Name string `json:"Name" example:"my-environment"`
		// Environment(Endpoint) environment(endpoint) type. 1 for a Docker environment(endpoint), 2 for an agent on Docker environment(endpoint) or 3 for an Azure environment(endpoint).
		Type EndpointType `json:"Type" example:"1"`
		// ContainerEngine represents the container engine type. This can be 'docker' or 'podman' when interacting directly with these environmentes, otherwise '' for kubernetes environments.
		ContainerEngine string `json:"ContainerEngine" example:"docker"`
		// URL or IP address of the Docker host associated to this environment(endpoint)
		URL string `json:"URL" example:"docker.mydomain.tld:2375"`
		// Environment(Endpoint) group identifier
		GroupID EndpointGroupID `json:"GroupId" example:"1"`
		// URL or IP address where exposed containers will be reachable
		PublicURL        string           `json:"PublicURL" example:"docker.mydomain.tld:2375"`
		Gpus             []Pair           `json:"Gpus"`
		TLSConfig        TLSConfiguration `json:"TLSConfig"`
		AzureCredentials AzureCredentials `json:"AzureCredentials,omitempty"`
		// List of tag identifiers to which this environment(endpoint) is associated
		TagIDs []TagID `json:"TagIds"`
		// The status of the environment(endpoint) (1 - up, 2 - down)
		Status EndpointStatus `json:"Status" example:"1"`
		// List of snapshots
		Snapshots []DockerSnapshot `json:"Snapshots"`
		// List of user identifiers authorized to connect to this environment(endpoint)
		UserAccessPolicies UserAccessPolicies `json:"UserAccessPolicies"`
		// List of team identifiers authorized to connect to this environment(endpoint)
		TeamAccessPolicies TeamAccessPolicies `json:"TeamAccessPolicies"`
		// The identifier of the edge agent associated with this environment(endpoint)
		EdgeID string `json:"EdgeID,omitempty"`
		// The key which is used to map the agent to EInfra
		EdgeKey string `json:"EdgeKey"`
		// The check in interval for edge agent (in seconds)
		EdgeCheckinInterval int `json:"EdgeCheckinInterval" example:"5"`
		// Associated Kubernetes data
		Kubernetes KubernetesData `json:"Kubernetes"`
		// Maximum version of docker-compose
		ComposeSyntaxMaxVersion string `json:"ComposeSyntaxMaxVersion" example:"3.8"`
		// Environment(Endpoint) specific security settings
		SecuritySettings EndpointSecuritySettings
		// The identifier of the AMT Device associated with this environment(endpoint)
		AMTDeviceGUID string `json:"AMTDeviceGUID,omitempty" example:"4c4c4544-004b-3910-8037-b6c04f504633"`
		// LastCheckInDate mark last check-in date on checkin
		LastCheckInDate int64
		// Heartbeat indicates the heartbeat status of an edge environment
		Heartbeat bool `json:"Heartbeat" example:"true"`

		// Whether the device has been trusted or not by the user
		UserTrusted bool `json:"UserTrusted,omitempty"`

		// Whether we need to run any "post init migrations".
		PostInitMigrations EndpointPostInitMigrations `json:"PostInitMigrations"`

		Edge EnvironmentEdgeSettings

		Agent struct {
			Version string `example:"1.0.0"`
		}

		EnableGPUManagement bool `json:"EnableGPUManagement,omitempty"`

		// Deprecated fields
		// Deprecated in DBVersion == 4
		TLS           bool   `json:"TLS,omitempty"`
		TLSCACertPath string `json:"TLSCACert,omitempty"`
		TLSCertPath   string `json:"TLSCert,omitempty"`
		TLSKeyPath    string `json:"TLSKey,omitempty"`

		// Deprecated in DBVersion == 18
		AuthorizedUsers []UserID `json:"AuthorizedUsers"`
		AuthorizedTeams []TeamID `json:"AuthorizedTeams"`

		// Deprecated in DBVersion == 22
		Tags []string `json:"Tags"`

		// Deprecated v2.18
		IsEdgeDevice bool `json:"IsEdgeDevice,omitempty"`
	}

	EnvironmentEdgeSettings struct {
		// Whether the device has been started in edge async mode
		AsyncMode bool
		// The ping interval for edge agent - used in edge async mode [seconds]
		PingInterval int `json:"PingInterval" example:"60"`
		// The snapshot interval for edge agent - used in edge async mode [seconds]
		SnapshotInterval int `json:"SnapshotInterval" example:"60"`
		// The command list interval for edge agent - used in edge async mode [seconds]
		CommandInterval int `json:"CommandInterval" example:"60"`
	}

	// EndpointPostInitMigrations
	EndpointPostInitMigrations struct {
		MigrateIngresses bool `json:"MigrateIngresses"`
		MigrateGPUs      bool `json:"MigrateGPUs"`
	}

	// DigitalSignatureService represents a service to manage digital signatures
	DigitalSignatureService interface {
		ParseKeyPair(private, public []byte) error
		GenerateKeyPair() ([]byte, []byte, error)
		EncodedPublicKey() string
		PEMHeaders() (string, string)
		CreateSignature(message string) (string, error)
	}

	// ReverseTunnelService represents a service used to manage reverse tunnel connections.
	ReverseTunnelService interface {
		StartTunnelServer(addr, port string, snapshotService SnapshotService) error
		StopTunnelServer() error
		GenerateEdgeKey(apiURL, tunnelAddr string, endpointIdentifier int) string
		Open(endpoint *Endpoint) error
		Config(endpointID EndpointID) TunnelDetails
		TunnelAddr(endpoint *Endpoint) (string, error)
		UpdateLastActivity(endpointID EndpointID)
		KeepTunnelAlive(endpointID EndpointID, ctx context.Context, maxKeepAlive time.Duration)
	}
	DockerSnapshot struct {
		Time                    int64               `json:"Time"`
		DockerVersion           string              `json:"DockerVersion"`
		Swarm                   bool                `json:"Swarm"`
		TotalCPU                int                 `json:"TotalCPU"`
		TotalMemory             int64               `json:"TotalMemory"`
		ContainerCount          int                 `json:"ContainerCount"`
		RunningContainerCount   int                 `json:"RunningContainerCount"`
		StoppedContainerCount   int                 `json:"StoppedContainerCount"`
		HealthyContainerCount   int                 `json:"HealthyContainerCount"`
		UnhealthyContainerCount int                 `json:"UnhealthyContainerCount"`
		VolumeCount             int                 `json:"VolumeCount"`
		ImageCount              int                 `json:"ImageCount"`
		ServiceCount            int                 `json:"ServiceCount"`
		StackCount              int                 `json:"StackCount"`
		SnapshotRaw             DockerSnapshotRaw   `json:"DockerSnapshotRaw"`
		NodeCount               int                 `json:"NodeCount"`
		GpuUseAll               bool                `json:"GpuUseAll"`
		GpuUseList              []string            `json:"GpuUseList"`
		IsPodman                bool                `json:"IsPodman"`
		DiagnosticsData         *DiagnosticsData    `json:"DiagnosticsData"`
		PerformanceMetrics      *PerformanceMetrics `json:"PerformanceMetrics"`
	}

	// EndpointSecuritySettings represents settings for an environment(endpoint)
	EndpointSecuritySettings struct {
		// Whether non-administrator should be able to use bind mounts when creating containers
		AllowBindMountsForRegularUsers bool `json:"allowBindMountsForRegularUsers" example:"false"`
		// Whether non-administrator should be able to use privileged mode when creating containers
		AllowPrivilegedModeForRegularUsers bool `json:"allowPrivilegedModeForRegularUsers" example:"false"`
		// Whether non-administrator should be able to browse volumes
		AllowVolumeBrowserForRegularUsers bool `json:"allowVolumeBrowserForRegularUsers" example:"true"`
		// Whether non-administrator should be able to use the host pid
		AllowHostNamespaceForRegularUsers bool `json:"allowHostNamespaceForRegularUsers" example:"true"`
		// Whether non-administrato
		AllowDeviceMappingForRegularUsers bool `json:"allowDeviceMappingForRegularUsers" example:"true"`
		// Whether non-administrator should be able to manage stacks
		AllowStackManagementForRegularUsers bool `json:"allowStackManagementForRegularUsers" example:"true"`
		// Whether non-administrator should be able to use container capabilities
		AllowContainerCapabilitiesForRegularUsers bool `json:"allowContainerCapabilitiesForRegularUsers" example:"true"`
		// Whether non-administrator should be able to use sysctl settings
		AllowSysctlSettingForRegularUsers bool `json:"allowSysctlSettingForRegularUsers" example:"true"`
		// Whether host management features are enabled
		EnableHostManagementFeatures bool `json:"enableHostManagementFeatures" example:"true"`
	}

	// PerformanceMetrics represents the performance metrics of a Docker, Swarm, Podman, and Kubernetes environments
	PerformanceMetrics struct {
		CPUUsage     float64 `json:"CPUUsage,omitempty"`
		MemoryUsage  float64 `json:"MemoryUsage,omitempty"`
		NetworkUsage float64 `json:"NetworkUsage,omitempty"`
	}

	// DiagnosticsData represents the diagnostics data for an environment
	// this contains the logs, telnet, traceroute, dns and proxy information
	// which will be part of the DockerSnapshot and KubernetesSnapshot structs
	DiagnosticsData struct {
		Log    string            `json:"Log,omitempty"`
		Telnet map[string]string `json:"Telnet,omitempty"`
		DNS    map[string]string `json:"DNS,omitempty"`
		Proxy  map[string]string `json:"Proxy,omitempty"`
	}

	// TunnelDetails represents information associated to a tunnel
	TunnelDetails struct {
		Status       string
		LastActivity time.Time
		Port         int
		Credentials  string
	}

	// DockerContainerSnapshot is an extent of Docker's Container struct
	// It contains some information of Docker's ContainerJSON struct
	DockerContainerSnapshot struct {
		types.Container
		Env []string `json:"Env,omitempty"` // EE-5240
	}

	// DockerSnapshotRaw represents all the information related to a snapshot as returned by the Docker API
	DockerSnapshotRaw struct {
		Containers []DockerContainerSnapshot `json:"Containers" swaggerignore:"true"`
		Volumes    volume.ListResponse       `json:"Volumes" swaggerignore:"true"`
		Networks   []network.Summary         `json:"Networks" swaggerignore:"true"`
		Images     []image.Summary           `json:"Images" swaggerignore:"true"`
		Info       system.Info               `json:"Info" swaggerignore:"true"`
		Version    types.Version             `json:"Version" swaggerignore:"true"`
	}
	// EcrData represents data required for ECR registry
	EcrData struct {
		Region string `json:"Region" example:"ap-southeast-2"`
	}

	// QuayRegistryData represents data required for Quay registry to work
	QuayRegistryData struct {
		UseOrganisation  bool   `json:"UseOrganisation,omitempty"`
		OrganisationName string `json:"OrganisationName"`
	}

	// GitlabRegistryData represents data required for gitlab registry to work
	GitlabRegistryData struct {
		ProjectID   int    `json:"ProjectId"`
		InstanceURL string `json:"InstanceURL"`
		ProjectPath string `json:"ProjectPath"`
	}

	// GithubRegistryData represents data required for Github registry to work
	GithubRegistryData struct {
		UseOrganisation  bool   `json:"UseOrganisation"`
		OrganisationName string `json:"OrganisationName"`
	}

	RoleID int

	EndpointID       int
	EndpointGroupID  int
	RegistryAccesses map[EndpointID]RegistryAccessPolicies

	RegistryAccessPolicies struct {
		// Docker specific fields (with docker, users/teams have access to a registry)
		UserAccessPolicies UserAccessPolicies `json:"UserAccessPolicies"`
		TeamAccessPolicies TeamAccessPolicies `json:"TeamAccessPolicies"`
		// Kubernetes specific fields (with kubernetes, namespaces have access to a registry, if users/teams have access to the same namespace, they have access to the registry)
		Namespaces []string `json:"Namespaces"`
	}

	// RegistryManagementConfiguration represents a configuration that can be used to query
	// the registry API via the registry management extension.
	RegistryManagementConfiguration struct {
		Type              RegistryType     `json:"Type"`
		Authentication    bool             `json:"Authentication"`
		Username          string           `json:"Username"`
		Password          string           `json:"Password"`
		TLSConfig         TLSConfiguration `json:"TLSConfig"`
		Ecr               EcrData          `json:"Ecr"`
		AccessToken       string           `json:"AccessToken,omitempty"`
		AccessTokenExpiry int64            `json:"AccessTokenExpiry,omitempty"`
	}

	// TLSConfiguration represents a TLS configuration
	TLSConfiguration struct {
		// Use TLS
		TLS bool `json:"TLS" example:"true"`
		// Skip the verification of the server TLS certificate
		TLSSkipVerify bool `json:"TLSSkipVerify" example:"false"`
		// Path to the TLS CA certificate file
		TLSCACertPath string `json:"TLSCACert,omitempty" example:"/data/tls/ca.pem"`
		// Path to the TLS client certificate file
		TLSCertPath string `json:"TLSCert,omitempty" example:"/data/tls/cert.pem"`
		// Path to the TLS client key file
		TLSKeyPath string `json:"TLSKey,omitempty" example:"/data/tls/key.pem"`
	}

	// RegistryID represents a registry identifier
	RegistryID int

	// RegistryType represents a type of registry
	RegistryType int

	// ResourceAccessLevel represents the level of control associated to a resource
	ResourceAccessLevel int

	// UserAccessPolicies represent the association of an access policy and a user
	UserAccessPolicies map[UserID]AccessPolicy

	// UserID represents a user identifier
	UserID int

	// UserResourceAccess represents the level of control on a resource for a specific user
	UserResourceAccess struct {
		UserID      UserID              `json:"UserId"`
		AccessLevel ResourceAccessLevel `json:"AccessLevel"`
	}

	// TeamAccessPolicies represent the association of an access policy and a team
	TeamAccessPolicies map[TeamID]AccessPolicy
	// TeamID represents a team identifier
	TeamID int

	// Pair defines a key/value string pair
	Pair struct {
		Name  string `json:"name" example:"name"`
		Value string `json:"value" example:"value"`
	}

	// Tag represents a tag that can be associated to a resource
	Tag struct {
		// Tag identifier
		ID TagID `example:"1"`
		// Tag name
		Name string `json:"Name" example:"org/acme"`
		// A set of environment(endpoint) ids that have this tag
		Endpoints map[EndpointID]bool `json:"Endpoints"`
		// A set of environment(endpoint) group ids that have this tag
		EndpointGroups map[EndpointGroupID]bool `json:"EndpointGroups"`
	}

	// TagID represents a tag identifier
	TagID int

	// EndpointType represents the type of an environment(endpoint)
	EndpointType int

	//EndpointStatus represents the status of an environment(endpoint)
	EndpointStatus int

	// KubernetesData contains all the Kubernetes related environment(endpoint) information
	KubernetesData struct {
		Snapshots     []KubernetesSnapshot    `json:"Snapshots"`
		Configuration KubernetesConfiguration `json:"Configuration"`
		Flags         KubernetesFlags         `json:"Flags"`
	}

	// KubernetesFlags are used to detect if we need to run initial cluster
	// detection again.
	KubernetesFlags struct {
		IsServerMetricsDetected      bool `json:"IsServerMetricsDetected"`
		IsServerIngressClassDetected bool `json:"IsServerIngressClassDetected"`
		IsServerStorageDetected      bool `json:"IsServerStorageDetected"`
	}

	// KubernetesSnapshot represents a snapshot of a specific Kubernetes environment(endpoint) at a specific time
	KubernetesSnapshot struct {
		Time               int64               `json:"Time"`
		KubernetesVersion  string              `json:"KubernetesVersion"`
		NodeCount          int                 `json:"NodeCount"`
		TotalCPU           int64               `json:"TotalCPU"`
		TotalMemory        int64               `json:"TotalMemory"`
		DiagnosticsData    *DiagnosticsData    `json:"DiagnosticsData"`
		PerformanceMetrics *PerformanceMetrics `json:"PerformanceMetrics"`
	}

	// KubernetesConfiguration represents the configuration of a Kubernetes environment(endpoint)
	KubernetesConfiguration struct {
		UseLoadBalancer                 bool                           `json:"UseLoadBalancer"`
		UseServerMetrics                bool                           `json:"UseServerMetrics"`
		EnableResourceOverCommit        bool                           `json:"EnableResourceOverCommit"`
		ResourceOverCommitPercentage    int                            `json:"ResourceOverCommitPercentage"`
		StorageClasses                  []KubernetesStorageClassConfig `json:"StorageClasses"`
		IngressClasses                  []KubernetesIngressClassConfig `json:"IngressClasses"`
		RestrictDefaultNamespace        bool                           `json:"RestrictDefaultNamespace"`
		IngressAvailabilityPerNamespace bool                           `json:"IngressAvailabilityPerNamespace"`
		AllowNoneIngressClass           bool                           `json:"AllowNoneIngressClass"`
	}

	// KubernetesStorageClassConfig represents a Kubernetes Storage Class configuration
	KubernetesStorageClassConfig struct {
		Name                 string   `json:"Name"`
		AccessModes          []string `json:"AccessModes"`
		Provisioner          string   `json:"Provisioner"`
		AllowVolumeExpansion bool     `json:"AllowVolumeExpansion"`
	}

	// KubernetesIngressClassConfig represents a Kubernetes Ingress Class configuration
	KubernetesIngressClassConfig struct {
		Name              string   `json:"Name"`
		Type              string   `json:"Type"`
		GloballyBlocked   bool     `json:"Blocked"`
		BlockedNamespaces []string `json:"BlockedNamespaces"`
	}

	// KubernetesShellPod represents a Kubectl Shell details to facilitate pod exec functionality
	KubernetesShellPod struct {
		Namespace        string
		PodName          string
		ContainerName    string
		ShellExecCommand string
	}

	// SnapshotService represents a service for managing environment(endpoint) snapshots
	SnapshotService interface {
		Start()
		SetSnapshotInterval(snapshotInterval string) error
		SnapshotEndpoint(endpoint *Endpoint) error
		FillSnapshotData(endpoint *Endpoint, includeRaw bool) error
	}
)

const (
	_ ResourceAccessLevel = iota
	// ReadWriteAccessLevel represents an access level with read-write permissions on a resource
	ReadWriteAccessLevel
)

const (
	_ EndpointStatus = iota
	// EndpointStatusUp is used to represent an available environment(endpoint)
	EndpointStatusUp
	// EndpointStatusDown is used to represent an unavailable environment(endpoint)
	EndpointStatusDown
)

const (
	_ EndpointType = iota
	// DockerEnvironment represents an environment(endpoint) connected to a Docker environment(endpoint) via the Docker API or Socket
	DockerEnvironment
	// AgentOnDockerEnvironment represents an environment(endpoint) connected to a EInfra agent deployed on a Docker environment(endpoint)
	AgentOnDockerEnvironment
	// AzureEnvironment represents an environment(endpoint) connected to an Azure environment(endpoint)
	AzureEnvironment
	// EdgeAgentOnDockerEnvironment represents an environment(endpoint) connected to an Edge agent deployed on a Docker environment(endpoint)
	EdgeAgentOnDockerEnvironment
	// KubernetesLocalEnvironment represents an environment(endpoint) connected to a local Kubernetes environment(endpoint)
	KubernetesLocalEnvironment
	// AgentOnKubernetesEnvironment represents an environment(endpoint) connected to a EInfra agent deployed on a Kubernetes environment(endpoint)
	AgentOnKubernetesEnvironment
	// EdgeAgentOnKubernetesEnvironment represents an environment(endpoint) connected to an Edge agent deployed on a Kubernetes environment(endpoint)
	EdgeAgentOnKubernetesEnvironment
)

const (
	// EInfraAgentTargetHeader represent the name of the header containing the target node name
	EInfraAgentTargetHeader = "X-EInfraAgent-Target"
	// EInfraAgentSignatureHeader represent the name of the header containing the digital signature
	EInfraAgentSignatureHeader = "X-EInfraAgent-Signature"
	// EInfraAgentPublicKeyHeader represent the name of the header containing the public key
	EInfraAgentPublicKeyHeader = "X-EInfraAgent-PublicKey"
	// EInfraAgentKubernetesSATokenHeader represent the name of the header containing a Kubernetes SA token
	EInfraAgentKubernetesSATokenHeader = "X-EInfraAgent-SA-Token"
	// EInfraAgentSignatureMessage represents the message used to create a digital signature
	// to be used when communicating with an agent
	EInfraAgentSignatureMessage = "EInfra-App"
)
