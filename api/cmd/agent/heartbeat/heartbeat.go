// Package heartbeat sends periodic system metrics to the control plane.
package heartbeat

import (
	"log"
	"time"

	"einfra-agent/client"
	"einfra-agent/collector"
	"einfra-agent/config"
)

// Heartbeat sends periodic HEARTBEAT messages to the control plane.
type Heartbeat struct {
	client   *client.Client
	cfg      *config.Config
	interval time.Duration
}

// New creates a new Heartbeat sender.
func New(c *client.Client, cfg *config.Config, interval time.Duration) *Heartbeat {
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

	payload := map[string]any{
		"cpu_percent":   metrics.CPUPercent,
		"mem_percent":   metrics.MemPercent,
		"disk_percent":  metrics.DiskPercent,
		"os":            metrics.OS,
		"arch":          metrics.Arch,
		"has_docker":    metrics.HasDocker,
		"has_k8s":       metrics.HasK8s,
		"agent_version": h.cfg.Version,
	}

	h.client.Send(map[string]any{
		"type":      "HEARTBEAT",
		"server_id": h.cfg.ServerID,
		"ts":        time.Now().UnixMilli(),
		"payload":   payload,
	})
}
