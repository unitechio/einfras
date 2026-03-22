package grpcclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	agent "einfra/api/internal/modules/agent/domain"
	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
	"einfra/api/internal/platform/agentruntime/collector"
	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/executor"
	"einfra/api/internal/platform/loggingx"
)

type GRPCClient struct {
	cfg    *config.Config
	conn   *grpc.ClientConn
	client agentpb.AgentServiceClient

	cmdExecutor     *executor.CommandExecutor
	serviceExecutor *executor.ServiceExecutor
	controlExecutor *executor.ControlExecutor

	tasks   map[string]context.CancelFunc
	tasksMu sync.Mutex

	outCh chan *agentpb.AgentEvent

	closeOnce sync.Once
	targetIdx int
	tracker   *loggingx.StateTracker
}

func NewGRPC(cfg *config.Config) *GRPCClient {
	return &GRPCClient{
		cfg:             cfg,
		tasks:           make(map[string]context.CancelFunc),
		cmdExecutor:     executor.NewCommandExecutor(),
		serviceExecutor: executor.NewServiceExecutor(),
		controlExecutor: executor.NewControlExecutor(cfg),
		outCh:           make(chan *agentpb.AgentEvent, 100),
		tracker:         loggingx.NewStateTracker(),
	}
}

func (c *GRPCClient) Connect(ctx context.Context) {
	attempt := 0
	for {
		if err := ctx.Err(); err != nil {
			return
		}

		c.preflight(ctx)
		target := c.nextTarget()
		if target == "" {
			loggingx.New("agent").Error(log.Logger, "grpc-target-missing", c.cfg.ServerID, "error", map[string]any{
				"grpc_targets": c.cfg.GRPCTargets(),
			})
			return
		}

		if err := c.connectAndServe(ctx, target); err != nil {
			if ctx.Err() != nil {
				return
			}
			if status.Code(err) == codes.Unauthenticated {
				loggingx.New("agent").Error(log.Logger, "grpc-auth", c.cfg.ServerID, "rejected", map[string]any{
					"target": target,
					"error":  err.Error(),
				})
				return
			}
			delay := c.backoff(attempt)
			attempt++
			if c.tracker.Changed("grpc-disconnect:"+target, "disconnected") {
				loggingx.New("agent").Warn(log.Logger, "grpc-connection", c.cfg.ServerID, "disconnected", map[string]any{
					"target":       target,
					"retry_in_ms":  delay.Milliseconds(),
					"error":        err.Error(),
					"grpc_targets": c.cfg.GRPCTargets(),
				})
			}
			if !sleepWithContext(ctx, delay) {
				return
			}
			continue
		}

		attempt = 0
	}
}

func (c *GRPCClient) connectAndServe(ctx context.Context, target string) error {
	if err := c.closeConn(); err != nil {
		loggingx.New("agent").Warn(log.Logger, "grpc-close-previous", c.cfg.ServerID, "warn", map[string]any{
			"target": target,
			"error":  err.Error(),
		})
	}

	conn, client, err := c.dial(ctx, target)
	if err != nil {
		return err
	}
	c.conn = conn
	c.client = client

	streamCtx := metadata.AppendToOutgoingContext(ctx,
		"server-id", c.cfg.ServerID,
		"authorization", "Bearer "+c.cfg.AgentToken,
	)
	stream, err := c.client.ConnectStream(streamCtx)
	if err != nil {
		_ = c.closeConn()
		return err
	}

	if c.tracker.Changed("grpc-connect:"+target, "connected") {
		loggingx.New("agent").Info(log.Logger, "grpc-register", c.cfg.ServerID, "connected", map[string]any{
			"target":             target,
			"heartbeat_interval": c.cfg.HeartbeatInterval.String(),
		})
	}

	metrics := collector.Collect()
	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_Register{
			Register: &agentpb.RegisterRequest{
				AgentVersion: c.cfg.Version,
				Os:           metrics.OS,
				Arch:         metrics.Arch,
				Capabilities: agent.AgentAdvertisedCapabilities(),
			},
		},
	})

	writeCtx, cancelWrite := context.WithCancel(ctx)
	defer cancelWrite()
	writeErrCh := make(chan error, 1)
	go c.writeLoop(writeCtx, stream, writeErrCh)

	for {
		msg, err := stream.Recv()
		if err != nil {
			cancelWrite()
			select {
			case sendErr := <-writeErrCh:
				if sendErr != nil && !errors.Is(sendErr, context.Canceled) {
					loggingx.New("agent").Warn(log.Logger, "grpc-write-loop", c.cfg.ServerID, "ended", map[string]any{
						"target": target,
						"error":  sendErr.Error(),
					})
				}
			default:
			}
			_ = c.closeConn()
			return err
		}
		go c.handleControlMessage(msg)
	}
}

func (c *GRPCClient) dial(ctx context.Context, target string) (*grpc.ClientConn, agentpb.AgentServiceClient, error) {
	dialCtx, cancel := context.WithTimeout(ctx, c.cfg.ConnectTimeout)
	defer cancel()

	conn, err := grpc.DialContext(
		dialCtx,
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                20 * time.Second,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		return nil, nil, err
	}
	return conn, agentpb.NewAgentServiceClient(conn), nil
}

func (c *GRPCClient) writeLoop(ctx context.Context, stream agentpb.AgentService_ConnectStreamClient, errCh chan<- error) {
	defer close(errCh)
	for {
		select {
		case <-ctx.Done():
			errCh <- ctx.Err()
			return
		case event, ok := <-c.outCh:
			if !ok {
				errCh <- nil
				return
			}
			event.ServerId = c.cfg.ServerID
			event.TimestampMs = time.Now().UnixMilli()
			if err := stream.Send(event); err != nil {
				errCh <- err
				return
			}
		}
	}
}

func (c *GRPCClient) SendEvent(event *agentpb.AgentEvent) {
	select {
	case c.outCh <- event:
	default:
		loggingx.New("agent").Warn(log.Logger, "outbound-queue", c.cfg.ServerID, "dropped", map[string]any{
			"reason": "queue full",
		})
	}
}

func (c *GRPCClient) Close() {
	c.closeOnce.Do(func() {
		close(c.outCh)
		_ = c.closeConn()
	})
}

func (c *GRPCClient) closeConn() error {
	if c.conn == nil {
		return nil
	}
	err := c.conn.Close()
	c.conn = nil
	c.client = nil
	return err
}

func (c *GRPCClient) nextTarget() string {
	targets := c.cfg.GRPCTargets()
	if len(targets) == 0 {
		return ""
	}
	target := targets[c.targetIdx%len(targets)]
	c.targetIdx = (c.targetIdx + 1) % len(targets)
	return target
}

func (c *GRPCClient) preflight(ctx context.Context) {
	healthURLs := c.cfg.HealthCheckURLs()
	for _, item := range healthURLs {
		reqCtx, cancel := context.WithTimeout(ctx, c.cfg.HealthCheckTimeout)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, item, nil)
		if err != nil {
			cancel()
			continue
		}
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 500 {
				log.Debug().Str("url", item).Int("status_code", resp.StatusCode).Msg("control plane health check completed")
				loggingx.New("agent").Debug(log.Logger, "control-plane-health", c.cfg.ServerID, "reachable", map[string]any{
					"url":         loggingx.NormalizeURL(item),
					"status_code": resp.StatusCode,
				})
				cancel()
				return
			}
		}
		cancel()
	}

	targets := c.cfg.GRPCTargets()
	for _, target := range targets {
		conn, err := net.DialTimeout("tcp", target, c.cfg.ConnectTimeout)
		if err == nil {
			_ = conn.Close()
			loggingx.New("agent").Debug(log.Logger, "grpc-preflight", c.cfg.ServerID, "reachable", map[string]any{
				"target": target,
			})
			return
		}
	}

	loggingx.New("agent").Warn(log.Logger, "grpc-preflight", c.cfg.ServerID, "retrying", map[string]any{
		"control_plane_urls": c.cfg.ControlPlaneURLs,
		"grpc_targets":       targets,
	})
}

func (c *GRPCClient) backoff(attempt int) time.Duration {
	delay := c.cfg.BackoffInitial
	for i := 0; i < attempt; i++ {
		delay *= 2
		if delay >= c.cfg.BackoffMax {
			delay = c.cfg.BackoffMax
			break
		}
	}
	if delay > c.cfg.BackoffMax {
		delay = c.cfg.BackoffMax
	}
	jitterMax := delay / 5
	if jitterMax <= 0 {
		return delay
	}
	return delay + time.Duration(rand.Int63n(int64(jitterMax)))
}

func (c *GRPCClient) handleControlMessage(msg *agentpb.ControlMessage) {
	if msg == nil || msg.Payload == nil {
		return
	}

	switch p := msg.Payload.(type) {
	case *agentpb.ControlMessage_ExecuteTask:
		go c.executeTask(p.ExecuteTask)
	case *agentpb.ControlMessage_CancelExecution:
		c.cancelTask(p.CancelExecution.TargetTaskId)
	case *agentpb.ControlMessage_TriggerSkill:
		go c.handleTriggerSkill(msg.MessageId, p.TriggerSkill)
	case *agentpb.ControlMessage_ServiceAction:
		go c.handleServiceAction(msg.MessageId, p.ServiceAction)
	case *agentpb.ControlMessage_ListServices:
		go c.handleListServices(msg.MessageId, p.ListServices)
	default:
		loggingx.New("agent").Warn(log.Logger, "control-message", c.cfg.ServerID, "unknown", map[string]any{
			"payload_type": fmt.Sprintf("%T", p),
		})
	}
}

func (c *GRPCClient) handleTriggerSkill(msgID string, req *agentpb.TriggerSkill) {
	if req == nil {
		return
	}
	switch req.SkillName {
	case "control-operation":
		go c.handleControlOperation(msgID, req)
	default:
		c.SendEvent(&agentpb.AgentEvent{
			Payload: &agentpb.AgentEvent_SkillResult{
				SkillResult: &agentpb.SkillExecutionResult{
					TaskId:      msgID,
					SkillName:   req.SkillName,
					ExitCode:    1,
					ErrorReason: "unsupported skill",
				},
			},
		})
	}
}

func (c *GRPCClient) handleControlOperation(msgID string, req *agentpb.TriggerSkill) {
	payload := agent.ControlOperationPayload{
		CommandID: msgID,
		Operation: req.Context["operation"],
		TimeoutS:  300,
		Params:    map[string]any{},
	}
	if raw := req.Context["payload_json"]; raw != "" {
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			c.SendEvent(&agentpb.AgentEvent{
				Payload: &agentpb.AgentEvent_SkillResult{
					SkillResult: &agentpb.SkillExecutionResult{
						TaskId:      msgID,
						SkillName:   req.SkillName,
						ExitCode:    1,
						ErrorReason: "invalid payload_json: " + err.Error(),
					},
				},
			})
			return
		}
	}
	if payload.CommandID == "" {
		payload.CommandID = msgID
	}
	if rawTimeout := req.Context["timeout_s"]; rawTimeout != "" {
		if seconds, err := time.ParseDuration(rawTimeout + "s"); err == nil && seconds > 0 {
			payload.TimeoutS = int(seconds.Seconds())
		}
	}
	if payload.TimeoutS <= 0 {
		payload.TimeoutS = 300
	}
	if raw := req.Context["params_json"]; raw != "" && len(payload.Params) == 0 {
		if err := json.Unmarshal([]byte(raw), &payload.Params); err != nil {
			c.SendEvent(&agentpb.AgentEvent{
				Payload: &agentpb.AgentEvent_SkillResult{
					SkillResult: &agentpb.SkillExecutionResult{
						TaskId:      msgID,
						SkillName:   req.SkillName,
						ExitCode:    1,
						ErrorReason: "invalid params_json: " + err.Error(),
					},
				},
			})
			return
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(payload.TimeoutS)*time.Second)
	defer cancel()

	start := time.Now()
	output, exitCode, err := c.controlExecutor.ExecutePayload(ctx, payload)
	if output != "" {
		c.sendStructuredOperationOutput(msgID, output)
	}

	result := &agentpb.SkillExecutionResult{
		TaskId:      msgID,
		SkillName:   req.SkillName,
		ExitCode:    int32(exitCode),
		FinalOutput: output,
		DurationMs:  time.Since(start).Milliseconds(),
	}
	if err != nil {
		result.ErrorReason = err.Error()
		if result.ExitCode == 0 {
			result.ExitCode = 1
		}
	}
	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_SkillResult{
			SkillResult: result,
		},
	})
}

func (c *GRPCClient) handleServiceAction(msgID string, req *agentpb.ServiceAction) {
	loggingx.New("agent").Info(log.Logger, "service-action", c.cfg.ServerID, "running", map[string]any{
		"task_id": msgID,
		"action":  req.Action,
		"service": req.ServiceName,
	})

	err := c.serviceExecutor.PerformAction(context.Background(), req.ServiceName, executor.ServiceAction(req.Action))

	finalStatus := "SUCCESS"
	exitCode := 0
	if err != nil {
		finalStatus = "ERROR: " + err.Error()
		exitCode = 1
	}

	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_SkillResult{
			SkillResult: &agentpb.SkillExecutionResult{
				TaskId:      msgID,
				ExitCode:    int32(exitCode),
				FinalOutput: finalStatus,
			},
		},
	})
}

func (c *GRPCClient) handleListServices(msgID string, req *agentpb.ListServices) {
	loggingx.New("agent").Info(log.Logger, "service-list", c.cfg.ServerID, "running", map[string]any{
		"task_id": msgID,
		"pattern": req.FilterPattern,
	})

	services, err := c.serviceExecutor.ListServices(context.Background())
	if err != nil {
		loggingx.New("agent").Error(log.Logger, "service-list", c.cfg.ServerID, "error", map[string]any{
			"task_id": msgID,
			"error":   err.Error(),
		})
		return
	}

	pbServices := make([]*agentpb.ServiceEntry, 0, len(services))
	for _, s := range services {
		pbServices = append(pbServices, &agentpb.ServiceEntry{
			Name:        s.Name,
			Description: s.Description,
			Status:      s.Status,
			Startup:     s.Startup,
		})
	}

	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_ServiceList{
			ServiceList: &agentpb.ServiceListResponse{
				RequestId: msgID,
				Services:  pbServices,
			},
		},
	})
}

func (c *GRPCClient) executeTask(task *agentpb.ExecuteTask) {
	loggingx.New("agent").Info(log.Logger, "task-execute", c.cfg.ServerID, "running", map[string]any{
		"task_id": task.TaskId,
	})

	timeout := time.Duration(task.TimeoutS) * time.Second
	if timeout == 0 {
		timeout = 5 * time.Minute
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	c.tasksMu.Lock()
	c.tasks[task.TaskId] = cancel
	c.tasksMu.Unlock()
	defer func() {
		c.tasksMu.Lock()
		delete(c.tasks, task.TaskId)
		c.tasksMu.Unlock()
	}()

	start := time.Now()
	pr, pw := io.Pipe()
	er, ew := io.Pipe()

	var wg sync.WaitGroup
	var seqMu sync.Mutex
	seq := int64(0)

	sendOutput := func(data []byte, isStderr bool) {
		seqMu.Lock()
		s := seq
		seq++
		seqMu.Unlock()

		c.SendEvent(&agentpb.AgentEvent{
			Payload: &agentpb.AgentEvent_TaskOutput{
				TaskOutput: &agentpb.TaskOutput{
					TaskId:   task.TaskId,
					Data:     data,
					IsStderr: isStderr,
					Seq:      s,
				},
			},
		})
	}

	wg.Add(2)
	go func() {
		defer wg.Done()
		buf := make([]byte, 4096)
		for {
			n, err := pr.Read(buf)
			if n > 0 {
				sendOutput(buf[:n], false)
			}
			if err != nil {
				return
			}
		}
	}()
	go func() {
		defer wg.Done()
		buf := make([]byte, 4096)
		for {
			n, err := er.Read(buf)
			if n > 0 {
				sendOutput(buf[:n], true)
			}
			if err != nil {
				return
			}
		}
	}()

	exitCode, err := c.cmdExecutor.ExecuteCommand(ctx, task.Cmd, pw, ew)
	_ = pw.Close()
	_ = ew.Close()
	wg.Wait()

	durationMs := time.Since(start).Milliseconds()
	finalStatus := "SUCCESS"
	if err != nil {
		finalStatus = "ERROR: " + err.Error()
	}

	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_SkillResult{
			SkillResult: &agentpb.SkillExecutionResult{
				TaskId:      task.TaskId,
				ExitCode:    int32(exitCode),
				FinalOutput: finalStatus,
				DurationMs:  durationMs,
			},
		},
	})

	loggingx.New("agent").Info(log.Logger, "task-execute", c.cfg.ServerID, "finished", map[string]any{
		"task_id":     task.TaskId,
		"exit_code":   exitCode,
		"duration_ms": durationMs,
	})
}

func (c *GRPCClient) cancelTask(taskID string) {
	c.tasksMu.Lock()
	cancel, ok := c.tasks[taskID]
	c.tasksMu.Unlock()

	if ok && cancel != nil {
		loggingx.New("agent").Info(log.Logger, "task-cancel", c.cfg.ServerID, "canceling", map[string]any{
			"task_id": taskID,
		})
		cancel()
	}
}

func (c *GRPCClient) sendChunkedOutput(taskID, output string, isStderr bool) {
	chunkSize := c.cfg.StreamChunkBytes
	if chunkSize <= 0 {
		chunkSize = 32 * 1024
	}
	data := []byte(output)
	var seq int64
	for len(data) > 0 {
		end := chunkSize
		if end > len(data) {
			end = len(data)
		}
		chunk := data[:end]
		data = data[end:]
		c.SendEvent(&agentpb.AgentEvent{
			Payload: &agentpb.AgentEvent_TaskOutput{
				TaskOutput: &agentpb.TaskOutput{
					TaskId:   taskID,
					Data:     chunk,
					IsStderr: isStderr,
					Seq:      seq,
				},
			},
		})
		seq++
	}
}

func (c *GRPCClient) sendStructuredOperationOutput(taskID, output string) {
	if result, _ := agent.ParseTypedControlResult(output); result != nil && result.Preview != "" {
		c.sendChunkedOutput(taskID, result.Preview, false)
		return
	}
	c.sendChunkedOutput(taskID, output, false)
}

func sleepWithContext(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
