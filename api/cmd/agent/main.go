// EINFRA Agent — main entry point
//
// This binary runs on each managed server. It connects to the EINFRA
// Control Plane via WebSocket and:
//   - Executes commands sent from the control plane
//   - Streams stdout/stderr back in real-time
//   - Sends periodic heartbeat metrics (CPU, RAM, disk, Docker status)
//   - Auto-reconnects on network failure
//
// Usage:
//
//	CONTROL_PLANE_URL=wss://einfra.example.com \
//	AGENT_TOKEN=<issued_token> \
//	SERVER_ID=<uuid> \
//	./einfra-agent
package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"einfra/api/cmd/agent/client"
	"einfra/api/cmd/agent/config"
	"einfra/api/cmd/agent/heartbeat"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)

	cfg := config.Load()
	log.Printf("[agent] EINFRA Agent v%s starting", cfg.Version)
	log.Printf("[agent] server_id=%s → %s", cfg.ServerID, cfg.ControlPlaneURL)

	c := client.NewGRPC(cfg)

	// Start periodic heartbeat
	hb := heartbeat.New(c, cfg, cfg.HeartbeatInterval)
	go hb.Start()

	// Connect to control plane (blocks with auto-reconnect)
	go c.Connect()

	// Graceful shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("[agent] received signal %v — shutting down", sig)
}
