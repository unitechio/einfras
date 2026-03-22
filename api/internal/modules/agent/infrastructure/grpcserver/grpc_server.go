package agentgrpc

import (
	"context"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	agentregistry "einfra/api/internal/modules/agent/application"
	"einfra/api/internal/modules/agent/domain"
	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
	serverdomain "einfra/api/internal/modules/server/domain"
	"einfra/api/internal/platform/loggingx"
)

// AgentInfoUpdater updates agent info in the database on connect/disconnect.
type AgentInfoUpdater interface {
	Upsert(serverID string, info *agent.AgentInfo) error
	SetOnline(serverID string, online bool) error
	GetByServerID(serverID string) (*agent.AgentInfo, error)
}

// AgentTokenValidatorGRPC validates tokens extracted from gRPC metadata.
type AgentTokenValidatorGRPC interface {
	Validate(ctx context.Context, serverID, rawToken string) error
}

// CommandUpdater updates command status after agent reports completion.
type CommandUpdater interface {
	UpdateStatus(ctx context.Context, id string, status agent.CommandStatus, exitCode *int) error
	AppendLog(ctx context.Context, l *agent.CommandLog) error
}

// ServiceUpdater updates system services in the database.
type ServiceUpdater interface {
	UpdateServices(ctx context.Context, serverID string, services []*agentpb.ServiceEntry) error
}

type ServerSnapshotRepository interface {
	GetByID(ctx context.Context, id string) (*serverdomain.Server, error)
	Update(ctx context.Context, server *serverdomain.Server) error
}

// Server implements agentpb.AgentServiceServer.
type Server struct {
	agentpb.UnimplementedAgentServiceServer
	hub         *agentregistry.Hub
	agentRepo   AgentInfoUpdater
	tokenSvc    AgentTokenValidatorGRPC
	cmdRepo     CommandUpdater
	serviceRepo ServiceUpdater
	serverRepo  ServerSnapshotRepository
	grpcServer  *grpc.Server
}

// New creates a new gRPC agent server.
func New(
	hub *agentregistry.Hub,
	agentRepo AgentInfoUpdater,
	tokenSvc AgentTokenValidatorGRPC,
	cmdRepo CommandUpdater,
	serviceRepo ServiceUpdater,
	serverRepo ServerSnapshotRepository,
) *Server {
	return &Server{
		hub:         hub,
		agentRepo:   agentRepo,
		tokenSvc:    tokenSvc,
		cmdRepo:     cmdRepo,
		serviceRepo: serviceRepo,
		serverRepo:  serverRepo,
	}
}

// Start creates the gRPC server, registers the service, and listens on addr.
func (s *Server) Start(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("grpc listen %s: %w", addr, err)
	}

	s.grpcServer = grpc.NewServer(
		grpc.Creds(insecure.NewCredentials()),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 5 * time.Minute,
			Time:              30 * time.Second,
			Timeout:           10 * time.Second,
		}),
	)

	agentpb.RegisterAgentServiceServer(s.grpcServer, s)

	loggingx.New("grpc-server").Info(log.Logger, "grpc-listener", "", "starting", map[string]any{
		"addr": addr,
	})
	return s.grpcServer.Serve(lis)
}

// Stop gracefully shuts down the gRPC server.
func (s *Server) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
}

// ConnectStream handles the bidirectional stream from an agent.
func (s *Server) ConnectStream(stream agentpb.AgentService_ConnectStreamServer) error {
	serverID, rawToken, err := extractCredentials(stream.Context())
	if err != nil {
		return status.Errorf(codes.Unauthenticated, "missing credentials: %v", err)
	}

	if s.tokenSvc != nil {
		if err := s.tokenSvc.Validate(stream.Context(), serverID, rawToken); err != nil {
			loggingx.New("grpc-server").Warn(log.Logger, "grpc-auth", serverID, "rejected", map[string]any{
				"reason": err.Error(),
			})
			return status.Errorf(codes.Unauthenticated, "invalid agent token")
		}
	}

	s.hub.RegisterGRPCAgent(serverID, stream)

	defer func() {
		s.hub.UnregisterGRPCAgent(serverID)
		_ = s.agentRepo.SetOnline(serverID, false)
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":      "AGENT_OFFLINE",
			"transport": "grpc",
			"server_id": serverID,
			"ts":        time.Now().UnixMilli(),
		})
		loggingx.New("grpc-server").Info(log.Logger, "grpc-connection", serverID, "disconnected", map[string]any{
			"transport": "grpc",
		})
	}()

	s.hub.BroadcastToClients(serverID, map[string]any{
		"type":      "AGENT_ONLINE",
		"transport": "grpc",
		"server_id": serverID,
		"ts":        time.Now().UnixMilli(),
	})
	loggingx.New("grpc-server").Info(log.Logger, "grpc-connection", serverID, "connected", map[string]any{
		"transport": "grpc",
	})

	for {
		event, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return status.Errorf(codes.Internal, "stream error: %v", err)
		}

		if err := s.handleEvent(stream.Context(), serverID, event); err != nil {
			loggingx.New("grpc-server").Error(log.Logger, "grpc-event", serverID, "error", map[string]any{
				"reason": err.Error(),
			})
		}
	}
}

func (s *Server) handleEvent(ctx context.Context, serverID string, event *agentpb.AgentEvent) error {
	if event == nil || event.Payload == nil {
		return nil
	}

	switch p := event.Payload.(type) {
	case *agentpb.AgentEvent_Register:
		reg := p.Register
		info := &agent.AgentInfo{
			ServerID:     serverID,
			Online:       true,
			LastSeen:     time.Now(),
			OS:           reg.Os,
			Arch:         reg.Arch,
			Version:      reg.AgentVersion,
			Capabilities: reg.Capabilities,
		}
		_ = s.agentRepo.Upsert(serverID, info)
		s.syncServerSnapshot(ctx, serverID, reg.AgentVersion, reg.Os, reg.Arch, 0, 0, 0)
		loggingx.New("grpc-server").Info(log.Logger, "agent-register", serverID, "updated", map[string]any{
			"version":      reg.AgentVersion,
			"os":           reg.Os,
			"arch":         reg.Arch,
			"capabilities": reg.Capabilities,
		})
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":         "AGENT_REGISTERED",
			"server_id":    serverID,
			"version":      reg.AgentVersion,
			"os":           reg.Os,
			"arch":         reg.Arch,
			"capabilities": reg.Capabilities,
		})

	case *agentpb.AgentEvent_Heartbeat:
		hb := p.Heartbeat
		now := time.Now()
		info := &agent.AgentInfo{
			ServerID: serverID,
			Online:   true,
			LastSeen: now,
		}
		if existing, err := s.agentRepo.GetByServerID(serverID); err == nil && existing != nil {
			info.Version = existing.Version
			info.OS = existing.OS
			info.Arch = existing.Arch
			info.HasDocker = existing.HasDocker
			info.HasK8s = existing.HasK8s
			info.Capabilities = append([]string(nil), existing.Capabilities...)
		}
		if hb.GetAgentVersion() != "" {
			info.Version = hb.GetAgentVersion()
		}
		if hb.GetOs() != "" {
			info.OS = hb.GetOs()
		}
		if hb.GetArch() != "" {
			info.Arch = hb.GetArch()
		}
		info.HasDocker = hb.GetHasDocker()
		info.HasK8s = hb.GetHasK8S()
		info.CPUPercent = float64(hb.CpuPercent)
		info.MemPercent = float64(hb.MemPercent)
		info.DiskPercent = float64(hb.GetDiskPercent())
		_ = s.agentRepo.Upsert(serverID, info)
		s.syncServerSnapshot(ctx, serverID, info.Version, info.OS, info.Arch, int(hb.GetCpuCores()), float64(hb.GetMemoryGb()), int(hb.GetDiskGb()))
		loggingx.New("grpc-server").Debug(log.Logger, "agent-heartbeat", serverID, "received", map[string]any{
			"cpu_percent":  hb.CpuPercent,
			"mem_percent":  hb.MemPercent,
			"disk_percent": hb.GetDiskPercent(),
			"cpu_cores":    hb.GetCpuCores(),
			"memory_gb":    hb.GetMemoryGb(),
			"disk_gb":      hb.GetDiskGb(),
			"has_docker":   hb.GetHasDocker(),
			"has_k8s":      hb.GetHasK8S(),
			"os":           hb.GetOs(),
			"arch":         hb.GetArch(),
			"version":      hb.GetAgentVersion(),
			"uptime_s":     hb.UptimeSeconds,
		})
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":      "HEARTBEAT",
			"server_id": serverID,
			"cpu":       hb.CpuPercent,
			"mem":       hb.MemPercent,
			"disk":      hb.GetDiskPercent(),
			"os":        hb.GetOs(),
			"arch":      hb.GetArch(),
			"version":   hb.GetAgentVersion(),
			"uptime_s":  hb.UptimeSeconds,
		})

	case *agentpb.AgentEvent_TaskOutput:
		out := p.TaskOutput
		if out.TaskId == "" {
			return nil
		}
		l := &agent.CommandLog{
			CommandID: out.TaskId,
			Chunk:     string(out.Data),
			Seq:       int(out.Seq),
			Ts:        time.Now(),
		}
		if s.cmdRepo != nil {
			_ = s.cmdRepo.AppendLog(ctx, l)
		}
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":       "COMMAND_OUTPUT",
			"command_id": out.TaskId,
			"data":       string(out.Data),
			"is_stderr":  out.IsStderr,
			"seq":        out.Seq,
		})

	case *agentpb.AgentEvent_SkillResult:
		res := p.SkillResult
		exitCode := int(res.ExitCode)
		cmdStatus := agent.StatusSuccess
		if exitCode != 0 {
			cmdStatus = agent.StatusFailed
		}
		if s.cmdRepo != nil {
			_ = s.cmdRepo.UpdateStatus(ctx, res.TaskId, cmdStatus, &exitCode)
		}

		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":        "SKILL_DONE",
			"task_id":     res.TaskId,
			"skill_name":  res.SkillName,
			"exit_code":   exitCode,
			"final_out":   res.FinalOutput,
			"error":       res.ErrorReason,
			"duration_ms": res.DurationMs,
		})

	case *agentpb.AgentEvent_ServiceList:
		sl := p.ServiceList
		if s.serviceRepo != nil {
			_ = s.serviceRepo.UpdateServices(ctx, serverID, sl.Services)
		}
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":       "SERVICE_LIST",
			"server_id":  serverID,
			"request_id": sl.RequestId,
			"services":   sl.Services,
		})
	}
	return nil
}

func (s *Server) syncServerSnapshot(ctx context.Context, serverID, version, osName, arch string, cpuCores int, memoryGB float64, diskGB int) {
	if s.serverRepo == nil {
		return
	}
	server, err := s.serverRepo.GetByID(ctx, serverID)
	if err != nil || server == nil {
		return
	}
	changed := false
	if version != "" && server.AgentVersion != version {
		server.AgentVersion = version
		changed = true
	}
	if osName != "" && server.OS != serverdomain.ServerOS(osName) {
		server.OS = serverdomain.ServerOS(osName)
		changed = true
	}
	if cpuCores > 0 && server.CPUCores != cpuCores {
		server.CPUCores = cpuCores
		changed = true
	}
	if memoryGB > 0 && server.MemoryGB != memoryGB {
		server.MemoryGB = memoryGB
		changed = true
	}
	if diskGB > 0 && server.DiskGB != diskGB {
		server.DiskGB = diskGB
		changed = true
	}
	if server.OnboardingStatus != serverdomain.ServerOnboardingStatusInstalled {
		server.OnboardingStatus = serverdomain.ServerOnboardingStatusInstalled
		changed = true
	}
	if server.Status != serverdomain.ServerStatusOnline {
		server.Status = serverdomain.ServerStatusOnline
		changed = true
	}
	now := time.Now()
	server.LastCheckAt = &now
	server.UpdatedAt = now
	if changed {
		_ = s.serverRepo.Update(ctx, server)
	}
}

func extractCredentials(ctx context.Context) (serverID, rawToken string, err error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", "", fmt.Errorf("no metadata")
	}

	if vals := md.Get("server-id"); len(vals) > 0 {
		serverID = vals[0]
	}
	if vals := md.Get("authorization"); len(vals) > 0 {
		token := vals[0]
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		rawToken = token
	}

	return serverID, rawToken, nil
}
