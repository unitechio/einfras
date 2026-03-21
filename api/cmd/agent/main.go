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

	agentruntimeapp "einfra/api/internal/platform/agentruntime/app"
)

func main() {
	if err := agentruntimeapp.Run(); err != nil {
		log.Fatal(err)
	}
}
