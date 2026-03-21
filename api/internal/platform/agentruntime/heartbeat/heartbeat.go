// Package heartbeat sends periodic system metrics to the control plane.
package heartbeat

import (
	"context"
	"log"
	"time"

	"einfra/api/internal/platform/agentruntime/collector"
	"einfra/api/internal/platform/agentruntime/config"
	"einfra/api/internal/platform/agentruntime/grpcclient"

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
	log.Printf("[heartbeat] starting — interval %s", h.interval)
	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[heartbeat] stopped")
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
			},
		},
	})
}
