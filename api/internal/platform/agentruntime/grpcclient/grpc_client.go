package grpcclient

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	agent "einfra/api/internal/modules/agent/domain"
	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
	"einfra/api/internal/platform/agentruntime/collector"
	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/executor"
)

// GRPCCLient manages the gRPC lifecycle and command execution.
type GRPCClient struct {
	cfg    *config.Config
	conn   *grpc.ClientConn
	client agentpb.AgentServiceClient
	stream agentpb.AgentService_ConnectStreamClient

	// executors
	cmdExecutor     *executor.CommandExecutor
	serviceExecutor *executor.ServiceExecutor
	controlExecutor *executor.ControlExecutor

	// tasks tracks active executions by task_id
	tasks   map[string]context.CancelFunc
	tasksMu sync.Mutex

	// outCh for streaming events to the server
	outCh chan *agentpb.AgentEvent

	closeOnce sync.Once
}

// NewGRPC creates a new agent gRPC client.
func NewGRPC(cfg *config.Config) *GRPCClient {
	return &GRPCClient{
		cfg:             cfg,
		tasks:           make(map[string]context.CancelFunc),
		cmdExecutor:     executor.NewCommandExecutor(),
		serviceExecutor: executor.NewServiceExecutor(),
		controlExecutor: executor.NewControlExecutor(cfg),
		outCh:           make(chan *agentpb.AgentEvent, 100),
	}
}

// Connect establishes a connection and starts the stream.
func (c *GRPCClient) Connect(ctx context.Context) {
	for {
		if err := ctx.Err(); err != nil {
			return
		}
		if err := c.dial(); err != nil {
			log.Printf("[agent] gRPC dial failed: %v — retry in 5s", err)
			if !sleepWithContext(ctx, 5*time.Second) {
				return
			}
			continue
		}

		if err := c.runStream(ctx); err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[agent] stream error: %v — reconnecting...", err)
			_ = c.conn.Close()
			if !sleepWithContext(ctx, 3*time.Second) {
				return
			}
		}
	}
}

func (c *GRPCClient) dial() error {
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}
	conn, err := grpc.NewClient(c.cfg.GRPCURL, opts...)
	if err != nil {
		return err
	}
	c.conn = conn
	c.client = agentpb.NewAgentServiceClient(conn)
	return nil
}

func (c *GRPCClient) runStream(ctx context.Context) error {
	streamCtx := metadata.AppendToOutgoingContext(ctx,
		"server-id", c.cfg.ServerID,
		"authorization", "Bearer "+c.cfg.AgentToken,
	)

	stream, err := c.client.ConnectStream(streamCtx)
	if err != nil {
		return err
	}
	c.stream = stream

	log.Printf("[agent] gRPC stream established with %s ✓", c.cfg.GRPCURL)

	// Send initial registration
	m := collector.Collect()
	c.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_Register{
			Register: &agentpb.RegisterRequest{
				AgentVersion: c.cfg.Version,
				Os:           m.OS,
				Arch:         m.Arch,
				Capabilities: agent.AgentAdvertisedCapabilities(),
			},
		},
	})

	// Start outgoing loop
	go c.writeLoop(ctx)

	// Handle incoming messages
	for {
		msg, err := stream.Recv()
		if err != nil {
			return err
		}
		go c.handleControlMessage(msg)
	}
}

func (c *GRPCClient) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-c.outCh:
			if !ok {
				return
			}
			event.ServerId = c.cfg.ServerID
			event.TimestampMs = time.Now().UnixMilli()
			if err := c.stream.Send(event); err != nil {
				log.Printf("[agent] failed to send event: %v", err)
				return
			}
		}
	}
}

// SendEvent enqueues an event for the control plane.
func (c *GRPCClient) SendEvent(event *agentpb.AgentEvent) {
	select {
	case c.outCh <- event:
	default:
		log.Printf("[agent] outCh full — dropping event")
	}
}

func (c *GRPCClient) Close() {
	c.closeOnce.Do(func() {
		if c.conn != nil {
			_ = c.conn.Close()
		}
	})
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
		log.Printf("[agent] unknown control message: %v", p)
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
	operation := req.Context["operation"]
	timeout := 300 * time.Second
	if rawTimeout := req.Context["timeout_s"]; rawTimeout != "" {
		if seconds, err := time.ParseDuration(rawTimeout + "s"); err == nil && seconds > 0 {
			timeout = seconds
		}
	}

	params := map[string]any{}
	if raw := req.Context["params_json"]; raw != "" {
		if err := json.Unmarshal([]byte(raw), &params); err != nil {
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

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	start := time.Now()
	output, exitCode, err := c.controlExecutor.Execute(ctx, operation, params)
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
	log.Printf("[agent] service action [%s]: %s on %q", msgID, req.Action, req.ServiceName)

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
	log.Printf("[agent] listing services [%s] (pattern: %q)", msgID, req.FilterPattern)

	services, err := c.serviceExecutor.ListServices(context.Background())
	if err != nil {
		log.Printf("[agent] failed to list services: %v", err)
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
	log.Printf("[agent] executing task [%s]: %q", task.TaskId, task.Cmd)

	timeout := time.Duration(task.TimeoutS) * time.Second
	if timeout == 0 {
		timeout = 5 * time.Minute
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// Track task
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
	pw.Close()
	ew.Close()
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

	log.Printf("[agent] task [%s] done (exit=%d)", task.TaskId, exitCode)
}

func (c *GRPCClient) cancelTask(taskID string) {
	c.tasksMu.Lock()
	cancel, ok := c.tasks[taskID]
	c.tasksMu.Unlock()

	if ok && cancel != nil {
		log.Printf("[agent] canceling task [%s]", taskID)
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

func (c *GRPCClient) heartbeatLoop() {
	ticker := time.NewTicker(10 * time.Second)
	for range ticker.C {
		c.SendEvent(&agentpb.AgentEvent{
			Payload: &agentpb.AgentEvent_Heartbeat{
				Heartbeat: &agentpb.Heartbeat{
					TimestampMs: time.Now().UnixMilli(),
				},
			},
		})
	}
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
