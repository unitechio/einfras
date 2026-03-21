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
)

// AgentInfoUpdater updates agent info in the database on connect/disconnect.
type AgentInfoUpdater interface {
	Upsert(serverID string, info *agent.AgentInfo) error
	SetOnline(serverID string, online bool) error
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

// Server implements agentpb.AgentServiceServer.
type Server struct {
	agentpb.UnimplementedAgentServiceServer
	hub         *agentregistry.Hub
	agentRepo   AgentInfoUpdater
	tokenSvc    AgentTokenValidatorGRPC
	cmdRepo     CommandUpdater
	serviceRepo ServiceUpdater
	grpcServer  *grpc.Server
}

// New creates a new gRPC agent server.
func New(
	hub *agentregistry.Hub,
	agentRepo AgentInfoUpdater,
	tokenSvc AgentTokenValidatorGRPC,
	cmdRepo CommandUpdater,
	serviceRepo ServiceUpdater,
) *Server {
	return &Server{
		hub:         hub,
		agentRepo:   agentRepo,
		tokenSvc:    tokenSvc,
		cmdRepo:     cmdRepo,
		serviceRepo: serviceRepo,
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

	log.Info().Str("addr", addr).Msg("[grpc-server] agent gRPC server starting")
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
			log.Warn().Str("server_id", serverID).Err(err).Msg("[grpc-server] auth rejected")
			return status.Errorf(codes.Unauthenticated, "invalid agent token")
		}
	}

	// Ideally, hub.RegisterGRPCAgent is mapped to handle ConnectStreamServer properly
	// The implementation of Hub internally stores this stream to dispatch TriggerSkill.
	// conn := s.hub.RegisterGRPCAgent(serverID, stream)

	defer func() {
		// s.hub.UnregisterGRPCAgent(serverID)
		_ = s.agentRepo.SetOnline(serverID, false)
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":      "AGENT_OFFLINE",
			"transport": "grpc",
			"server_id": serverID,
			"ts":        time.Now().UnixMilli(),
		})
		log.Info().Str("server_id", serverID).Msg("[grpc-server] agent disconnected")
	}()

	s.hub.BroadcastToClients(serverID, map[string]any{
		"type":      "AGENT_ONLINE",
		"transport": "grpc",
		"server_id": serverID,
		"ts":        time.Now().UnixMilli(),
	})
	log.Info().Str("server_id", serverID).Msg("[grpc-server] agent connected via gRPC")

	for {
		event, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return status.Errorf(codes.Internal, "stream error: %v", err)
		}

		if err := s.handleEvent(stream.Context(), serverID, event); err != nil {
			log.Error().Str("server_id", serverID).Err(err).Msg("[grpc-server] event handling error")
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
		info := &agent.AgentInfo{ServerID: serverID, Online: true, LastSeen: time.Now()}
		_ = s.agentRepo.Upsert(serverID, info)
		s.hub.BroadcastToClients(serverID, map[string]any{
			"type":      "HEARTBEAT",
			"server_id": serverID,
			"cpu":       hb.CpuPercent,
			"mem":       hb.MemPercent,
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
