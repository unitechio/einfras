package domain

import (
	"context"
	"time"
)

// ServerStatus defines string-based statuses matching the handler's usage and DB schema.
type ServerStatus string

const (
	ServerStatusOnline      ServerStatus = "online"
	ServerStatusOffline     ServerStatus = "offline"
	ServerStatusMaintenance ServerStatus = "maintenance"
	ServerStatusError       ServerStatus = "error"
)

type ServerOS string

const (
	ServerOSLinux      ServerOS = "linux"
	ServerOSUbuntu     ServerOS = "ubuntu"
	ServerOSDebian     ServerOS = "debian"
	ServerOSCentOS     ServerOS = "centos"
	ServerOSRockyLinux ServerOS = "rocky"
	ServerOSAlmaLinux  ServerOS = "alma"
	ServerOSFedora     ServerOS = "fedora"
	ServerOSRHEL       ServerOS = "rhel"
	ServerOSWindows    ServerOS = "windows"
	ServerOSMacOS      ServerOS = "macos"
)

type ServerEnvironment string

const (
	ServerEnvironmentProduction  ServerEnvironment = "production"
	ServerEnvironmentStaging     ServerEnvironment = "staging"
	ServerEnvironmentDevelopment ServerEnvironment = "development"
)

type ServerConnectionMode string

const (
	ServerConnectionModeAgent   ServerConnectionMode = "agent"
	ServerConnectionModeSSH     ServerConnectionMode = "ssh"
	ServerConnectionModeBastion ServerConnectionMode = "bastion"
	ServerConnectionModeHybrid  ServerConnectionMode = "hybrid"
)

type ServerOnboardingStatus string

const (
	ServerOnboardingStatusPending   ServerOnboardingStatus = "pending"
	ServerOnboardingStatusReady     ServerOnboardingStatus = "ready"
	ServerOnboardingStatusInstalled ServerOnboardingStatus = "installed"
	ServerOnboardingStatusFailed    ServerOnboardingStatus = "failed"
)

// Server is the Aggregate Root for the Server domain.
type Server struct {
	ID               string                 `json:"id" gorm:"column:id;primaryKey" db:"id"`
	TenantID         string                 `json:"tenant_id" gorm:"column:tenant_id" db:"tenant_id"`
	Name             string                 `json:"name" gorm:"column:name" db:"name"`
	Description      string                 `json:"description" gorm:"column:description" db:"description"`
	Hostname         string                 `json:"hostname" gorm:"column:hostname" db:"hostname"`
	IPAddress        string                 `json:"ip_address" gorm:"column:ip_address" db:"ip_address"`
	OS               ServerOS               `json:"os" gorm:"column:os" db:"os"`
	OSVersion        string                 `json:"os_version" gorm:"column:os_version" db:"os_version"`
	Status           ServerStatus           `json:"status" gorm:"column:status" db:"status"`
	Environment      ServerEnvironment      `json:"environment" gorm:"column:environment" db:"environment"`
	ConnectionMode   ServerConnectionMode   `json:"connection_mode" gorm:"column:connection_mode" db:"connection_mode"`
	OnboardingStatus ServerOnboardingStatus `json:"onboarding_status" gorm:"column:onboarding_status" db:"onboarding_status"`
	Location         string                 `json:"location" gorm:"column:location" db:"location"`
	Provider         string                 `json:"provider" gorm:"column:provider" db:"provider"`
	CPUCores         int                    `json:"cpu_cores" gorm:"column:cpu_cores" db:"cpu_cores"`
	MemoryGB         float64                `json:"memory_gb" gorm:"column:memory_gb" db:"memory_gb"`
	DiskGB           int                    `json:"disk_gb" gorm:"column:disk_gb" db:"disk_gb"`

	// SSH Configuration
	SSHPort       int    `json:"ssh_port" gorm:"column:ssh_port" db:"ssh_port"`
	SSHUser       string `json:"ssh_user" gorm:"column:ssh_user" db:"ssh_user"`
	SSHPassword   string `json:"ssh_password,omitempty" gorm:"column:ssh_password" db:"ssh_password"`
	SSHKeyPath    string `json:"ssh_key_path,omitempty" gorm:"column:ssh_key_path" db:"ssh_key_path"`
	TunnelEnabled bool   `json:"tunnel_enabled" gorm:"column:tunnel_enabled" db:"tunnel_enabled"`
	TunnelHost    string `json:"tunnel_host,omitempty" gorm:"column:tunnel_host" db:"tunnel_host"`
	TunnelPort    int    `json:"tunnel_port,omitempty" gorm:"column:tunnel_port" db:"tunnel_port"`
	TunnelUser    string `json:"tunnel_user,omitempty" gorm:"column:tunnel_user" db:"tunnel_user"`
	TunnelKeyPath string `json:"tunnel_key_path,omitempty" gorm:"column:tunnel_key_path" db:"tunnel_key_path"`

	Tags         []string   `json:"tags" gorm:"serializer:json;column:tags" db:"tags"`
	LastCheckAt  *time.Time `json:"last_check_at,omitempty" gorm:"column:last_check_at" db:"last_check_at"`
	AgentVersion string     `json:"agent_version,omitempty" gorm:"column:agent_version" db:"agent_version"`
	CreatedAt    time.Time  `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (Server) TableName() string { return "servers" }

type ServerFilter struct {
	TenantID string       `json:"tenant_id"`
	Status   ServerStatus `json:"status"`
	OS       ServerOS     `json:"os"`
	Location string       `json:"location"`
	Provider string       `json:"provider"`
	Search   string       `json:"search"`
	Tags     []string     `json:"tags"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

type ServerMetrics struct {
	ServerID       string    `json:"server_id"`
	CPUUsage       float64   `json:"cpu_usage"`
	MemoryUsage    float64   `json:"memory_usage"`
	DiskUsage      float64   `json:"disk_usage"`
	NetworkInMbps  float64   `json:"network_in_mbps"`
	NetworkOutMbps float64   `json:"network_out_mbps"`
	Uptime         int64     `json:"uptime"`
	LoadAverage    []float64 `json:"load_average"`
}

// --- Backup ---

type BackupStatus string

const (
	BackupStatusPending    BackupStatus = "pending"
	BackupStatusInProgress BackupStatus = "in_progress"
	BackupStatusCompleted  BackupStatus = "completed"
	BackupStatusFailed     BackupStatus = "failed"
)

type BackupType string

const (
	BackupTypeFull         BackupType = "full"
	BackupTypeIncremental  BackupType = "incremental"
	BackupTypeDifferential BackupType = "differential"
)

type ServerBackup struct {
	ID           string       `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID     string       `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Name         string       `json:"name" gorm:"column:name" db:"name"`
	Description  string       `json:"description" gorm:"column:description" db:"description"`
	Type         BackupType   `json:"type" gorm:"column:type" db:"type"`
	Status       BackupStatus `json:"status" gorm:"column:status" db:"status"`
	SizeBytes    int64        `json:"size_bytes" gorm:"column:size_bytes" db:"size_bytes"`
	SizeGB       float64      `json:"size_gb" gorm:"-" db:"-"`
	BackupPath   string       `json:"backup_path" gorm:"column:backup_path" db:"backup_path"`
	Compressed   bool         `json:"compressed" gorm:"column:compressed" db:"compressed"`
	Encrypted    bool         `json:"encrypted" gorm:"column:encrypted" db:"encrypted"`
	ErrorMessage string       `json:"error_message" gorm:"column:error_message" db:"error_message"`
	StartedAt    *time.Time   `json:"started_at" gorm:"column:started_at" db:"started_at"`
	CompletedAt  *time.Time   `json:"completed_at" gorm:"column:completed_at" db:"completed_at"`
	ExpiresAt    *time.Time   `json:"expires_at" gorm:"column:expires_at" db:"expires_at"`
	CreatedAt    time.Time    `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (ServerBackup) TableName() string { return "server_backups" }

type BackupFilter struct {
	ServerID string `json:"server_id"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// --- Service ---

type ServiceStatus string

const (
	ServiceStatusRunning ServiceStatus = "running"
	ServiceStatusStopped ServiceStatus = "stopped"
	ServiceStatusFailed  ServiceStatus = "failed"
	ServiceStatusUnknown ServiceStatus = "unknown"
)

type ServiceAction string

const (
	ServiceActionStart   ServiceAction = "start"
	ServiceActionStop    ServiceAction = "stop"
	ServiceActionRestart ServiceAction = "restart"
	ServiceActionReload  ServiceAction = "reload"
	ServiceActionEnable  ServiceAction = "enable"
	ServiceActionDisable ServiceAction = "disable"
)

type ServerService struct {
	ID            string        `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID      string        `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Name          string        `json:"name" gorm:"column:name" db:"name"`
	DisplayName   string        `json:"display_name" gorm:"column:display_name" db:"display_name"`
	Description   string        `json:"description" gorm:"column:description" db:"description"`
	Status        ServiceStatus `json:"status" gorm:"column:status" db:"status"`
	Enabled       bool          `json:"enabled" gorm:"column:enabled" db:"enabled"`
	PID           int           `json:"pid" gorm:"column:pid" db:"pid"`
	Port          int           `json:"port" gorm:"column:port" db:"port"`
	ConfigPath    string        `json:"config_path" gorm:"column:config_path" db:"config_path"`
	LogPath       string        `json:"log_path" gorm:"column:log_path" db:"log_path"`
	LastCheckedAt time.Time     `json:"last_checked_at" gorm:"column:last_checked_at" db:"last_checked_at"`
	CreatedAt     time.Time     `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (ServerService) TableName() string { return "server_services" }

type ServiceFilter struct {
	ServerID string `json:"server_id"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

type ServiceInstallPlanMode string

const (
	ServiceInstallPlanModePublic  ServiceInstallPlanMode = "public"
	ServiceInstallPlanModePrivate ServiceInstallPlanMode = "private"
	ServiceInstallPlanModeRelay   ServiceInstallPlanMode = "relay"
)

type ServiceInstallPlanStatus string

const (
	ServiceInstallPlanStatusPending ServiceInstallPlanStatus = "pending"
	ServiceInstallPlanStatusPlanned ServiceInstallPlanStatus = "planned"
)

type ServerServiceInstallPlan struct {
	ID           string                   `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID     string                   `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Mode         ServiceInstallPlanMode   `json:"mode" gorm:"column:mode" db:"mode"`
	PackageName  string                   `json:"package_name,omitempty" gorm:"column:package_name" db:"package_name"`
	ArtifactName string                   `json:"artifact_name,omitempty" gorm:"column:artifact_name" db:"artifact_name"`
	RelayHost    string                   `json:"relay_host,omitempty" gorm:"column:relay_host" db:"relay_host"`
	Status       ServiceInstallPlanStatus `json:"status" gorm:"column:status" db:"status"`
	Notes        string                   `json:"notes,omitempty" gorm:"column:notes" db:"notes"`
	CreatedAt    time.Time                `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt    time.Time                `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (ServerServiceInstallPlan) TableName() string { return "server_service_install_plans" }

// --- Cronjob ---

type CronjobStatus string

const (
	CronjobStatusActive   CronjobStatus = "active"
	CronjobStatusInactive CronjobStatus = "inactive"
	CronjobStatusFailed   CronjobStatus = "failed"
)

type ServerCronjob struct {
	ID              string        `json:"id" db:"id"`
	ServerID        string        `json:"server_id" db:"server_id"`
	Name            string        `json:"name" db:"name"`
	Description     string        `json:"description" db:"description"`
	Status          CronjobStatus `json:"status" db:"status"`
	CronExpression  string        `json:"cron_expression" db:"cron_expression"`
	Command         string        `json:"command" db:"command"`
	WorkingDir      string        `json:"working_dir" db:"working_dir"`
	User            string        `json:"user" db:"user"`
	LastRunAt       *time.Time    `json:"last_run_at" db:"last_run_at"`
	NextRunAt       *time.Time    `json:"next_run_at" db:"next_run_at"`
	LastExitCode    int           `json:"last_exit_code" db:"last_exit_code"`
	LastOutput      string        `json:"last_output" db:"last_output"`
	LastError       string        `json:"last_error" db:"last_error"`
	ExecutionCount  int           `json:"execution_count" db:"execution_count"`
	FailureCount    int           `json:"failure_count" db:"failure_count"`
	NotifyOnFailure bool          `json:"notify_on_failure" db:"notify_on_failure"`
	NotifyEmail     string        `json:"notify_email" db:"notify_email"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at" db:"updated_at"`
}

type CronjobExecution struct {
	ID         string    `json:"id" db:"id"`
	CronjobID  string    `json:"cronjob_id" db:"cronjob_id"`
	StartedAt  time.Time `json:"started_at" db:"started_at"`
	FinishedAt time.Time `json:"finished_at" db:"finished_at"`
	ExitCode   int       `json:"exit_code" db:"exit_code"`
	Output     string    `json:"output" db:"output"`
	Error      string    `json:"error" db:"error"`
	Duration   int       `json:"duration" db:"duration"` // seconds
	Success    bool      `json:"success" db:"success"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type CronjobFilter struct {
	ServerID string `json:"server_id"`
	Status   string `json:"status"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// --- IPTables ---

type IPTableChain string

const (
	ChainInput   IPTableChain = "INPUT"
	ChainForward IPTableChain = "FORWARD"
	ChainOutput  IPTableChain = "OUTPUT"
)

type IPTableAction string

const (
	ActionAccept IPTableAction = "ACCEPT"
	ActionDrop   IPTableAction = "DROP"
	ActionReject IPTableAction = "REJECT"
)

type IPTableProtocol string

const (
	IPTableProtocolTCP IPTableProtocol = "tcp"
	IPTableProtocolUDP IPTableProtocol = "udp"
	IPTableProtocolAll IPTableProtocol = "all"
)

type ServerIPTable struct {
	ID          string          `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID    string          `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Name        string          `json:"name" gorm:"column:name" db:"name"`
	Description string          `json:"description" gorm:"column:description" db:"description"`
	Enabled     bool            `json:"enabled" gorm:"column:enabled" db:"enabled"`
	Chain       IPTableChain    `json:"chain" gorm:"column:chain" db:"chain"`
	Action      IPTableAction   `json:"action" gorm:"column:action" db:"action"`
	Protocol    IPTableProtocol `json:"protocol" gorm:"column:protocol" db:"protocol"`
	SourceIP    string          `json:"source_ip" gorm:"column:source_ip" db:"source_ip"`
	SourcePort  string          `json:"source_port" gorm:"column:source_port" db:"source_port"`
	DestIP      string          `json:"dest_ip" gorm:"column:dest_ip" db:"dest_ip"`
	DestPort    string          `json:"dest_port" gorm:"column:dest_port" db:"dest_port"`
	Interface   string          `json:"interface" gorm:"column:interface" db:"interface"`
	State       string          `json:"state" gorm:"column:state" db:"state"`
	Position    int             `json:"position" gorm:"column:position" db:"position"`
	RawRule     string          `json:"raw_rule" gorm:"column:raw_rule" db:"raw_rule"`
	Comment     string          `json:"comment" gorm:"column:comment" db:"comment"`
	PacketCount int64           `json:"packet_count" gorm:"column:packet_count" db:"packet_count"`
	ByteCount   int64           `json:"byte_count" gorm:"column:byte_count" db:"byte_count"`
	LastApplied time.Time       `json:"last_applied" gorm:"column:last_applied" db:"last_applied"`
	CreatedAt   time.Time       `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (ServerIPTable) TableName() string { return "server_iptables" }

type IPTableBackup struct {
	ID          string    `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID    string    `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Name        string    `json:"name" gorm:"column:name" db:"name"`
	Description string    `json:"description" gorm:"column:description" db:"description"`
	Content     string    `json:"content" gorm:"column:content" db:"content"`
	RuleCount   int       `json:"rule_count" gorm:"column:rule_count" db:"rule_count"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at" db:"created_at"`
}

func (IPTableBackup) TableName() string { return "iptable_backups" }

// --- Network ---

type NetworkInterface struct {
	ID            string    `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID      string    `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	Name          string    `json:"name" gorm:"column:name" db:"name"`
	Type          string    `json:"type" gorm:"column:type" db:"type"`
	IPAddress     string    `json:"ip_address" gorm:"column:ip_address" db:"ip_address"`
	MACAddress    string    `json:"mac_address" gorm:"column:mac_address" db:"mac_address"`
	Netmask       string    `json:"netmask" gorm:"column:netmask" db:"netmask"`
	Gateway       string    `json:"gateway" gorm:"column:gateway" db:"gateway"`
	MTU           int       `json:"mtu" gorm:"column:mtu" db:"mtu"`
	Speed         int       `json:"speed" gorm:"column:speed" db:"speed"`
	IsUp          bool      `json:"is_up" gorm:"column:is_up" db:"is_up"`
	BytesReceived int64     `json:"bytes_received" gorm:"column:bytes_received" db:"bytes_received"`
	BytesSent     int64     `json:"bytes_sent" gorm:"column:bytes_sent" db:"bytes_sent"`
	LastUpdatedAt time.Time `json:"last_updated_at" gorm:"column:last_updated_at" db:"last_updated_at"`
	CreatedAt     time.Time `json:"created_at" gorm:"column:created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"column:updated_at" db:"updated_at"`
}

func (NetworkInterface) TableName() string { return "network_interfaces" }

type NetworkStats struct {
	ServerID      string    `json:"server_id"`
	InterfaceName string    `json:"interface_name"`
	BytesIn       int64     `json:"bytes_in"`
	BytesOut      int64     `json:"bytes_out"`
	PacketsIn     int64     `json:"packets_in"`
	PacketsOut    int64     `json:"packets_out"`
	Timestamp     time.Time `json:"timestamp"`
}

type NetworkConnectivityCheck struct {
	ID           string    `json:"id" gorm:"column:id;primaryKey" db:"id"`
	ServerID     string    `json:"server_id" gorm:"column:server_id;index" db:"server_id"`
	TargetHost   string    `json:"target_host" gorm:"column:target_host" db:"target_host"`
	TargetPort   int       `json:"target_port" gorm:"column:target_port" db:"target_port"`
	Protocol     string    `json:"protocol" gorm:"column:protocol" db:"protocol"`
	Success      bool      `json:"success" gorm:"column:success" db:"success"`
	Latency      float64   `json:"latency" gorm:"column:latency" db:"latency"` // ms
	ErrorMessage string    `json:"error_message" gorm:"column:error_message" db:"error_message"`
	TestedAt     time.Time `json:"tested_at" gorm:"column:tested_at" db:"tested_at"`
	CreatedAt    time.Time `json:"created_at" gorm:"column:created_at" db:"created_at"`
}

func (NetworkConnectivityCheck) TableName() string { return "network_connectivity_checks" }

type PortCheckRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	Timeout  int    `json:"timeout"`
}

// --- Monitoring / Alert ---

type AlertRule struct {
	ID        string  `json:"id"`
	Metric    string  `json:"metric"` // cpu, memory, disk, network
	Threshold float64 `json:"threshold"`
	Enabled   bool    `json:"enabled"`
}

func DefaultAlertRules() []AlertRule {
	return []AlertRule{
		{ID: "cpu-high", Metric: "cpu", Threshold: 80.0, Enabled: true},
		{ID: "memory-high", Metric: "memory", Threshold: 85.0, Enabled: true},
		{ID: "disk-high", Metric: "disk", Threshold: 90.0, Enabled: true},
	}
}

// --- Interfaces ---

type ServerUsecase interface {
	CreateServer(ctx context.Context, server *Server) error
	ListServers(ctx context.Context, filter ServerFilter) ([]*Server, int64, error)
	GetServer(ctx context.Context, id string) (*Server, error)
	UpdateServer(ctx context.Context, server *Server) error
	DeleteServer(ctx context.Context, id string) error
	GetServerMetrics(ctx context.Context, serverID string) (*ServerMetrics, error)
	HealthCheck(ctx context.Context, serverID string) (bool, error)
}

type ServerBackupUsecase interface {
	CreateBackup(ctx context.Context, backup *ServerBackup) error
	GetBackup(ctx context.Context, id string) (*ServerBackup, error)
	ListBackups(ctx context.Context, filter BackupFilter) ([]*ServerBackup, int64, error)
	RestoreBackup(ctx context.Context, backupID string) error
	DeleteBackup(ctx context.Context, id string) error
	CleanupExpiredBackups(ctx context.Context) (int64, error)
	GetBackupStatus(ctx context.Context, backupID string) (*ServerBackup, error)
}

type ServerServiceUsecase interface {
	ListServices(ctx context.Context, serverID string) ([]*ServerService, error)
	GetService(ctx context.Context, id string) (*ServerService, error)
	GetServiceStatus(ctx context.Context, serverID, serviceName string) (*ServerService, error)
	PerformAction(ctx context.Context, serverID, serviceName string, action ServiceAction) error
	GetServiceLogs(ctx context.Context, serverID, serviceName string, lines int) ([]string, error)
	RefreshServices(ctx context.Context, serverID string) error
}

type ServerCronjobUsecase interface {
	CreateCronjob(ctx context.Context, cronjob *ServerCronjob) error
	GetCronjob(ctx context.Context, id string) (*ServerCronjob, error)
	ListCronjobs(ctx context.Context, filter CronjobFilter) ([]*ServerCronjob, int64, error)
	UpdateCronjob(ctx context.Context, cronjob *ServerCronjob) error
	DeleteCronjob(ctx context.Context, id string) error
	ExecuteCronjob(ctx context.Context, cronjobID string) error
	ValidateCronExpression(expression string) error
	GetExecutionHistory(ctx context.Context, cronjobID string, limit int) ([]*CronjobExecution, error)
}

type ServerIPTableUsecase interface {
	ListRules(ctx context.Context, serverID string) ([]*ServerIPTable, error)
	GetRule(ctx context.Context, id string) (*ServerIPTable, error)
	AddRule(ctx context.Context, rule *ServerIPTable) error
	UpdateRule(ctx context.Context, rule *ServerIPTable) error
	DeleteRule(ctx context.Context, id string) error
	ApplyRules(ctx context.Context, serverID string) error
	RefreshRules(ctx context.Context, serverID string) error
	BackupConfiguration(ctx context.Context, serverID, name, description string) (*IPTableBackup, error)
	RestoreConfiguration(ctx context.Context, backupID string) error
	GetBackups(ctx context.Context, serverID string, limit int) ([]*IPTableBackup, error)
	FlushRules(ctx context.Context, serverID string, chain IPTableChain) error
}

type ServerNetworkUsecase interface {
	GetNetworkInterfaces(ctx context.Context, serverID string) ([]*NetworkInterface, error)
	RefreshNetworkInterfaces(ctx context.Context, serverID string) error
	GetNetworkStats(ctx context.Context, serverID string) ([]*NetworkStats, error)
	CheckConnectivity(ctx context.Context, serverID, targetHost string, targetPort int, protocol string) (*NetworkConnectivityCheck, error)
	TestPort(ctx context.Context, serverID string, request PortCheckRequest) (bool, error)
	GetConnectivityHistory(ctx context.Context, serverID string, limit int) ([]*NetworkConnectivityCheck, error)
	MonitorBandwidth(ctx context.Context, serverID string, duration int) ([]*NetworkStats, error)
}

type AlertUsecase interface {
	StartMonitoring(ctx context.Context)
	CheckResources(ctx context.Context)
}

// --- Repositories ---

type ServerRepository interface {
	Create(ctx context.Context, server *Server) error
	GetByID(ctx context.Context, id string) (*Server, error)
	GetByIPAddress(ctx context.Context, ip string) (*Server, error)
	List(ctx context.Context, filter ServerFilter) ([]*Server, int64, error)
	Update(ctx context.Context, server *Server) error
	UpdateStatus(ctx context.Context, id string, status ServerStatus) error
	Delete(ctx context.Context, id string) error
}

type ServerBackupRepository interface {
	Create(ctx context.Context, backup *ServerBackup) error
	GetByID(ctx context.Context, id string) (*ServerBackup, error)
	List(ctx context.Context, filter BackupFilter) ([]*ServerBackup, int64, error)
	Update(ctx context.Context, backup *ServerBackup) error
	Delete(ctx context.Context, id string) error
	DeleteExpired(ctx context.Context) (int64, error)
}

type ServerServiceRepository interface {
	Create(ctx context.Context, service *ServerService) error
	GetByID(ctx context.Context, id string) (*ServerService, error)
	GetByServerAndName(ctx context.Context, serverID, name string) (*ServerService, error)
	List(ctx context.Context, filter ServiceFilter) ([]*ServerService, int64, error)
	Update(ctx context.Context, service *ServerService) error
	Delete(ctx context.Context, id string) error
}

type ServerServiceInstallPlanRepository interface {
	Create(ctx context.Context, plan *ServerServiceInstallPlan) error
	ListByServerID(ctx context.Context, serverID string) ([]*ServerServiceInstallPlan, error)
}

type ServerCronjobRepository interface {
	Create(ctx context.Context, cronjob *ServerCronjob) error
	GetByID(ctx context.Context, id string) (*ServerCronjob, error)
	List(ctx context.Context, filter CronjobFilter) ([]*ServerCronjob, int64, error)
	Update(ctx context.Context, cronjob *ServerCronjob) error
	Delete(ctx context.Context, id string) error
	CreateExecution(ctx context.Context, execution *CronjobExecution) error
	GetExecutions(ctx context.Context, cronjobID string, limit int) ([]*CronjobExecution, error)
}

type ServerIPTableRepository interface {
	Create(ctx context.Context, rule *ServerIPTable) error
	GetByID(ctx context.Context, id string) (*ServerIPTable, error)
	GetByServerID(ctx context.Context, serverID string) ([]*ServerIPTable, error)
	Update(ctx context.Context, rule *ServerIPTable) error
	Delete(ctx context.Context, id string) error
	CreateBackup(ctx context.Context, backup *IPTableBackup) error
	GetBackupByID(ctx context.Context, id string) (*IPTableBackup, error)
	GetBackups(ctx context.Context, serverID string, limit int) ([]*IPTableBackup, error)
}

type ServerNetworkRepository interface {
	CreateInterface(ctx context.Context, iface *NetworkInterface) error
	GetInterfacesByServerID(ctx context.Context, serverID string) ([]*NetworkInterface, error)
	UpdateInterface(ctx context.Context, iface *NetworkInterface) error
	DeleteInterfacesByServerID(ctx context.Context, serverID string) error
	CreateConnectivityCheck(ctx context.Context, check *NetworkConnectivityCheck) error
	GetConnectivityCheckByID(ctx context.Context, id string) (*NetworkConnectivityCheck, error)
	UpdateConnectivityCheck(ctx context.Context, check *NetworkConnectivityCheck) error
	GetConnectivityHistory(ctx context.Context, serverID string, limit int) ([]*NetworkConnectivityCheck, error)
}
