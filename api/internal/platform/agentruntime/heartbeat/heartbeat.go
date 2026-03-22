// Package heartbeat sends periodic system metrics to the control plane.
package heartbeat

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"einfra/api/internal/platform/agentruntime/collector"
	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/grpcclient"
	"einfra/api/internal/platform/loggingx"

	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
)

// Heartbeat sends periodic HEARTBEAT messages to the control plane.
type Heartbeat struct {
	client   *grpcclient.GRPCClient
	cfg      *config.Config
	interval time.Duration
}

// New creates a new Heartbeat sender.
func New(c *grpcclient.GRPCClient, cfg *config.Config, interval time.Duration) *Heartbeat {
	return &Heartbeat{client: c, cfg: cfg, interval: interval}
}

// Start runs the heartbeat loop. Should be called in a goroutine.
func (h *Heartbeat) Start(ctx context.Context) {
	loggingx.New("agent").Info(log.Logger, "heartbeat-loop", h.cfg.ServerID, "starting", map[string]any{
		"interval_ms": h.interval.Milliseconds(),
	})
	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			loggingx.New("agent").Info(log.Logger, "heartbeat-loop", h.cfg.ServerID, "stopped", map[string]any{})
			return
		case <-ticker.C:
			h.send()
		}
	}
}

func (h *Heartbeat) send() {
	metrics := collector.Collect()

	h.client.SendEvent(&agentpb.AgentEvent{
		Payload: &agentpb.AgentEvent_Heartbeat{
			Heartbeat: &agentpb.Heartbeat{
				CpuPercent:    float32(metrics.CPUPercent),
				MemPercent:    float32(metrics.MemPercent),
				UptimeSeconds: 0, // TODO: add to metrics
				DiskPercent:   float32(metrics.DiskPercent),
				CpuCores:      int32(metrics.CPUCores),
				MemoryGb:      float32(metrics.MemoryGB),
				DiskGb:        int32(metrics.DiskGB),
				HasDocker:     metrics.HasDocker,
				HasK8S:        metrics.HasK8s,
				Os:            metrics.OS,
				Arch:          metrics.Arch,
				AgentVersion:  h.cfg.Version,
			},
		},
	})
}
