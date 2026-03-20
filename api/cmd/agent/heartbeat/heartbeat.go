// Package heartbeat sends periodic system metrics to the control plane.
package heartbeat

import (
	"log"
	"time"

	"einfra/api/cmd/agent/client"
	"einfra/api/cmd/agent/collector"
	"einfra/api/cmd/agent/config"

	agentpb "einfra/api/internal/modules/agent/infrastructure/grpcpb"
)

// Heartbeat sends periodic HEARTBEAT messages to the control plane.
type Heartbeat struct {
	client   *client.GRPCClient
	cfg      *config.Config
	interval time.Duration
}

// New creates a new Heartbeat sender.
func New(c *client.GRPCClient, cfg *config.Config, interval time.Duration) *Heartbeat {
	return &Heartbeat{client: c, cfg: cfg, interval: interval}
}

// Start runs the heartbeat loop. Should be called in a goroutine.
func (h *Heartbeat) Start() {
	log.Printf("[heartbeat] starting — interval %s", h.interval)
	ticker := time.NewTicker(h.interval)
	defer ticker.Stop()

	for range ticker.C {
		h.send()
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
