# 🏗️ EINFRA: Control Plane + Agent Architecture

## Production-Grade Redesign: Server → Agent → Docker → K8s

---

> [!IMPORTANT]
> This document is the **single source of truth** for the EINFRA agent-based architecture redesign.
> All operations MUST go through the agent layer. Direct server access is forbidden.

---

## 🗺️ Table of Contents

1. [System Architecture Overview](#architecture)
2. [Communication Protocol](#protocol)
3. [Backend Design (Go Control Plane)](#backend)
4. [Agent Design (Go)](#agent)
5. [Frontend Integration](#frontend)
6. [Phase-Based Implementation](#phases)
7. [Security Model](#security)
8. [File Structure](#structure)

---

## 1. System Architecture Overview {#architecture}

```mermaid
graph TB
    subgraph FE["🖥️ Frontend (React + WebSocket)"]
        UI[Command UI / Terminal]
        LS[Logs Streamer]
        SS[Status Panel]
    end

    subgraph CP["☁️ Control Plane (Go — einfra-be)"]
        API[REST API :8080]
        WSHub[WebSocket Hub]
        Dispatcher[Command Dispatcher]
        Store[(PostgreSQL + Redis)]
        Auth[Auth Middleware]
    end

    subgraph SRV1["🖥️ Server 1"]
        A1[EINFRA Agent]
        OS1[OS / systemd]
        D1[Docker Engine]
        K1[kubectl / k8s]
    end

    subgraph SRV2["🖥️ Server 2"]
        A2[EINFRA Agent]
        OS2[OS / systemd]
        D2[Docker Engine]
    end

    UI -->|HTTP POST /v1/commands| API
    UI <-->|WS /ws/client/{session}| WSHub
    API --> Auth
    Auth --> Dispatcher
    Dispatcher --> WSHub
    WSHub <-->|WS /ws/agent/{server_id}| A1
    WSHub <-->|WS /ws/agent/{server_id}| A2
    Dispatcher <--> Store
    A1 --> OS1
    A1 --> D1
    A1 --> K1
    A2 --> OS2
    A2 --> D2
```

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **No Direct SSH** | All ops go through agent WS channel |
| **Async Command** | Commands queued, results streamed back |
| **Heartbeat** | Agent pings every 15s, timeout = 45s |
| **Reconnect** | Agent auto-reconnects with exponential backoff |
| **Auth** | JWT token issued at onboarding, verified per message |
| **Streaming** | Real-time stdout/stderr via WS chunked frames |

---

## 2. Communication Protocol {#protocol}

### WebSocket Message Schema

All messages are JSON with an envelope:

```go
// Upstream: Control Plane → Agent
type CPMessage struct {
    Type      string          `json:"type"`       // EXEC_COMMAND | PING | CONFIG_UPDATE
    MessageID string          `json:"message_id"` // UUID for correlation
    Payload   json.RawMessage `json:"payload"`
}

// Downstream: Agent → Control Plane
type AgentMessage struct {
    Type      string          `json:"type"`       // COMMAND_OUTPUT | COMMAND_DONE | COMMAND_ERROR | HEARTBEAT | METRICS
    MessageID string          `json:"message_id"` // correlates to CPMessage
    ServerID  string          `json:"server_id"`
    Payload   json.RawMessage `json:"payload"`
    Timestamp int64           `json:"ts"`
}
```

### Message Types

```
Control Plane → Agent:
  EXEC_COMMAND    → { command_id, cmd, timeout_s, env }
  PING            → { ts }
  CONFIG_UPDATE   → { new_token }
  CANCEL_COMMAND  → { command_id }

Agent → Control Plane:
  COMMAND_OUTPUT  → { command_id, chunk, seq }
  COMMAND_DONE    → { command_id, exit_code, duration_ms }
  COMMAND_ERROR   → { command_id, error }
  HEARTBEAT       → { metrics: { cpu, mem, disk } }
  METRICS         → { docker_summary, k8s_summary }
```

### WebSocket Endpoints

```
# Agent registration (called by the Go agent binary)
WS  /ws/agent/{server_id}
    Header: Authorization: Bearer <agent_token>

# Frontend live updates (called by React UI)
WS  /ws/client/{session_id}
    Header: Authorization: Bearer <user_jwt>
```

---

## 3. Backend Design (Go Control Plane) {#backend}

### 3.1 New Domain: `agent`

```
api/internal/
└── infrastructure/
    └── agent/               ← NEW DOMAIN
        ├── handler/
        │   ├── agent_ws_handler.go     ← Agent WebSocket endpoint
        │   ├── client_ws_handler.go    ← Frontend WS endpoint
        │   └── command_handler.go      ← REST: submit/query commands
        ├── usecase/
        │   ├── command_usecase.go      ← Dispatch, track, cancel
        │   ├── agent_registry.go       ← In-memory + Redis agent map
        │   └── metrics_usecase.go      ← Aggregate heartbeats
        ├── repository/
        │   ├── command_repo.go         ← PostgreSQL: commands + logs
        │   └── agent_repo.go           ← PostgreSQL: agent metadata
        └── interfaces.go               ← Port interfaces
```

### 3.2 Domain Models

```go
// api/internal/domain/agent/types.go
package agent

import "time"

type CommandStatus string

const (
    StatusPending   CommandStatus = "PENDING"
    StatusRunning   CommandStatus = "RUNNING"
    StatusSuccess   CommandStatus = "SUCCESS"
    StatusFailed    CommandStatus = "FAILED"
    StatusCancelled CommandStatus = "CANCELLED"
    StatusTimeout   CommandStatus = "TIMEOUT"
)

type Command struct {
    ID         string        `gorm:"primarykey" json:"id"`
    ServerID   string        `gorm:"index"      json:"server_id"`
    UserID     string        `gorm:"index"      json:"user_id"`
    Cmd        string        `json:"cmd"`
    Status     CommandStatus `gorm:"index"      json:"status"`
    ExitCode   *int          `json:"exit_code,omitempty"`
    Output     string        `json:"output"` // accumulated
    TimeoutSec int           `json:"timeout_sec"`
    CreatedAt  time.Time     `json:"created_at"`
    StartedAt  *time.Time    `json:"started_at,omitempty"`
    DoneAt     *time.Time    `json:"done_at,omitempty"`
}

type CommandLog struct {
    ID        uint      `gorm:"primarykey;autoIncrement"`
    CommandID string    `gorm:"index" json:"command_id"`
    Seq       int       `json:"seq"`
    Chunk     string    `json:"chunk"`
    Ts        time.Time `json:"ts"`
}

type AgentInfo struct {
    ServerID    string    `gorm:"primarykey" json:"server_id"`
    Version     string    `json:"version"`
    Online      bool      `json:"online"`
    LastSeen    time.Time `json:"last_seen"`
    CPUPercent  float64   `json:"cpu_percent"`
    MemPercent  float64   `json:"mem_percent"`
    DiskPercent float64   `json:"disk_percent"`
    HasDocker   bool      `json:"has_docker"`
    HasK8s      bool      `json:"has_k8s"`
}
```

### 3.3 Agent WebSocket Hub

```go
// api/internal/infrastructure/agent/usecase/agent_registry.go
package agentregistry

import (
    "fmt"
    "sync"
    "time"
    "github.com/gorilla/websocket"
)

type AgentConn struct {
    ServerID string
    Conn     *websocket.Conn
    mu       sync.Mutex
    done     chan struct{}
}

func (a *AgentConn) Send(msg any) error {
    a.mu.Lock()
    defer a.mu.Unlock()
    return a.Conn.WriteJSON(msg)
}

type Hub struct {
    mu     sync.RWMutex
    agents map[string]*AgentConn
    // client subscriptions: server_id → list of client WS conns
    clients map[string][]*websocket.Conn
}

var globalHub = &Hub{
    agents:  make(map[string]*AgentConn),
    clients: make(map[string][]*websocket.Conn),
}

func GetHub() *Hub { return globalHub }

func (h *Hub) RegisterAgent(serverID string, conn *websocket.Conn) *AgentConn {
    ac := &AgentConn{ServerID: serverID, Conn: conn, done: make(chan struct{})}
    h.mu.Lock()
    h.agents[serverID] = ac
    h.mu.Unlock()
    return ac
}

func (h *Hub) UnregisterAgent(serverID string) {
    h.mu.Lock()
    delete(h.agents, serverID)
    h.mu.Unlock()
}

func (h *Hub) GetAgent(serverID string) (*AgentConn, bool) {
    h.mu.RLock()
    defer h.mu.RUnlock()
    a, ok := h.agents[serverID]
    return a, ok
}

func (h *Hub) IsOnline(serverID string) bool {
    _, ok := h.GetAgent(serverID)
    return ok
}

func (h *Hub) BroadcastToClients(serverID string, msg any) {
    h.mu.RLock()
    conns := h.clients[serverID]
    h.mu.RUnlock()
    for _, c := range conns {
        _ = c.WriteJSON(msg)
    }
}
```

### 3.4 Command Dispatcher

```go
// api/internal/infrastructure/agent/usecase/command_usecase.go
package commandusecase

import (
    "context"
    "fmt"
    "time"

    "github.com/google/uuid"
    "einfra/api/internal/domain/agent"
    agentregistry "einfra/api/internal/infrastructure/agent/usecase"
)

type Dispatcher struct {
    hub  *agentregistry.Hub
    repo CommandRepository
}

type CommandRepository interface {
    Create(ctx context.Context, cmd *agent.Command) error
    UpdateStatus(ctx context.Context, id string, status agent.CommandStatus, exitCode *int) error
    AppendLog(ctx context.Context, log *agent.CommandLog) error
    FindByID(ctx context.Context, id string) (*agent.Command, error)
    ListByServer(ctx context.Context, serverID string, limit int) ([]*agent.Command, error)
}

func (d *Dispatcher) Dispatch(ctx context.Context, serverID, userID, cmd string, timeoutSec int) (*agent.Command, error) {
    ag, ok := d.hub.GetAgent(serverID)
    if !ok {
        return nil, fmt.Errorf("agent for server %s is not connected", serverID)
    }

    command := &agent.Command{
        ID:         uuid.NewString(),
        ServerID:   serverID,
        UserID:     userID,
        Cmd:        cmd,
        Status:     agent.StatusPending,
        TimeoutSec: timeoutSec,
        CreatedAt:  time.Now(),
    }
    if err := d.repo.Create(ctx, command); err != nil {
        return nil, err
    }

    if err := ag.Send(map[string]any{
        "type":       "EXEC_COMMAND",
        "message_id": command.ID,
        "payload": map[string]any{
            "command_id": command.ID,
            "cmd":        cmd,
            "timeout_s":  timeoutSec,
        },
    }); err != nil {
        _ = d.repo.UpdateStatus(ctx, command.ID, agent.StatusFailed, nil)
        return nil, fmt.Errorf("failed to send command to agent: %w", err)
    }

    now := time.Now()
    command.Status = agent.StatusRunning
    command.StartedAt = &now
    _ = d.repo.UpdateStatus(ctx, command.ID, agent.StatusRunning, nil)
    return command, nil
}
```

### 3.5 REST API Endpoints

```go
// New routes to add in router.go

// Agent WebSocket (for agent binary)
api.HandleFunc("/ws/agent/{server_id}", agentHandler.HandleAgentWS).Methods("GET")

// Client WebSocket (for frontend)
api.HandleFunc("/ws/client/{session_id}", clientHandler.HandleClientWS).Methods("GET")

// Command REST APIs
api.HandleFunc("/v1/servers/onboard",                  serverHandler.Onboard).Methods("POST")
api.HandleFunc("/v1/servers/{id}/commands",             commandHandler.CreateCommand).Methods("POST")
api.HandleFunc("/v1/servers/{id}/commands",             commandHandler.ListCommands).Methods("GET")
api.HandleFunc("/v1/servers/{id}/commands/{cmd_id}",    commandHandler.GetCommand).Methods("GET")
api.HandleFunc("/v1/servers/{id}/commands/{cmd_id}",    commandHandler.CancelCommand).Methods("DELETE")
api.HandleFunc("/v1/servers/{id}/status",               serverHandler.GetAgentStatus).Methods("GET")
api.HandleFunc("/v1/servers/{id}/metrics",              serverHandler.GetMetrics).Methods("GET")
api.HandleFunc("/v1/agents/token",                      agentHandler.IssueToken).Methods("POST")
```

---

## 4. Agent Design (Go) {#agent}

### 4.1 Agent Project Structure

```
cmd/agent/                    ← STANDALONE Go binary
├── main.go                   ← Entry point
├── config/
│   └── config.go             ← Env-based config
├── client/
│   └── ws_client.go          ← WS connection + reconnect logic
├── executor/
│   ├── executor.go           ← Command execution engine
│   ├── docker_executor.go    ← Docker commands (Phase 2)
│   └── k8s_executor.go       ← Kubectl wrapper (Phase 3)
├── collector/
│   ├── system.go             ← CPU, RAM, disk, uptime
│   ├── docker.go             ← Docker container/image info
│   └── k8s.go                ← Kubernetes pod/node info
└── heartbeat/
    └── heartbeat.go          ← Periodic metrics reporting
```

### 4.2 Agent Main

```go
// cmd/agent/main.go
package main

import (
    "log"
    "os"
    "os/signal"
    "syscall"

    "einfra-agent/client"
    "einfra-agent/config"
    "einfra-agent/heartbeat"
)

func main() {
    cfg := config.Load()
    log.Printf("[agent] starting einfra-agent v%s → %s", cfg.Version, cfg.ControlPlaneURL)

    c := client.New(cfg)

    // Start heartbeat in background
    hb := heartbeat.New(c, cfg.HeartbeatInterval)
    go hb.Start()

    // Connect (blocks with reconnect loop)
    go c.Connect()

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    log.Println("[agent] shutting down...")
}
```

### 4.3 Agent WebSocket Client

```go
// cmd/agent/client/ws_client.go
package client

import (
    "bufio"
    "encoding/json"
    "log"
    "math"
    "os/exec"
    "time"

    "github.com/gorilla/websocket"
    "einfra-agent/config"
)

type Client struct {
    cfg  *config.Config
    conn *websocket.Conn
    send chan any
}

func New(cfg *config.Config) *Client {
    return &Client{cfg: cfg, send: make(chan any, 256)}
}

func (c *Client) Connect() {
    attempt := 0
    for {
        attempt++
        url := c.cfg.ControlPlaneURL + "/ws/agent/" + c.cfg.ServerID
        headers := map[string][]string{
            "Authorization": {"Bearer " + c.cfg.AgentToken},
        }

        conn, _, err := websocket.DefaultDialer.Dial(url, headers)
        if err != nil {
            backoff := time.Duration(math.Min(float64(attempt)*2, 60)) * time.Second
            log.Printf("[agent] connect failed (attempt %d): %v — retry in %s", attempt, err, backoff)
            time.Sleep(backoff)
            continue
        }

        attempt = 0
        c.conn = conn
        log.Println("[agent] connected to control plane ✓")

        // Start writer goroutine
        go c.writeLoop()

        // Block on read loop (returns on disconnect)
        c.readLoop()

        log.Println("[agent] disconnected — reconnecting...")
        time.Sleep(3 * time.Second)
    }
}

func (c *Client) Send(msg any) {
    c.send <- msg
}

func (c *Client) writeLoop() {
    for msg := range c.send {
        if err := c.conn.WriteJSON(msg); err != nil {
            log.Printf("[agent] write error: %v", err)
            return
        }
    }
}

func (c *Client) readLoop() {
    for {
        _, data, err := c.conn.ReadMessage()
        if err != nil {
            return
        }

        var msg map[string]json.RawMessage
        if err := json.Unmarshal(data, &msg); err != nil {
            continue
        }

        msgType := string(msg["type"])
        switch msgType {
        case `"EXEC_COMMAND"`:
            go c.execCommand(msg["payload"])
        case `"PING"`:
            c.Send(map[string]any{"type": "PONG", "ts": time.Now().UnixMilli()})
        case `"CANCEL_COMMAND"`:
            // TODO: cancel running process by command_id
        }
    }
}

func (c *Client) execCommand(rawPayload json.RawMessage) {
    var payload struct {
        CommandID string `json:"command_id"`
        Cmd       string `json:"cmd"`
        TimeoutS  int    `json:"timeout_s"`
    }
    if err := json.Unmarshal(rawPayload, &payload); err != nil {
        return
    }

    cmd := exec.Command("sh", "-c", payload.Cmd)
    stdout, err := cmd.StdoutPipe()
    if err != nil {
        c.sendError(payload.CommandID, err)
        return
    }
    stderr, _ := cmd.StderrPipe()
    _ = cmd.Start()

    seq := 0
    sendChunk := func(line string) {
        c.Send(map[string]any{
            "type":       "COMMAND_OUTPUT",
            "message_id": payload.CommandID,
            "payload": map[string]any{
                "command_id": payload.CommandID,
                "chunk":      line,
                "seq":        seq,
            },
            "server_id": c.cfg.ServerID,
            "ts":         time.Now().UnixMilli(),
        })
        seq++
    }

    // Stream stdout
    scanner := bufio.NewScanner(stdout)
    for scanner.Scan() {
        sendChunk(scanner.Text())
    }

    // Stream stderr
    scanner2 := bufio.NewScanner(stderr)
    for scanner2.Scan() {
        sendChunk("[stderr] " + scanner2.Text())
    }

    err = cmd.Wait()
    exitCode := 0
    if err != nil {
        if exitErr, ok := err.(*exec.ExitError); ok {
            exitCode = exitErr.ExitCode()
        }
    }

    if exitCode != 0 {
        c.Send(map[string]any{
            "type": "COMMAND_ERROR",
            "payload": map[string]any{
                "command_id": payload.CommandID,
                "error":      "exit code " + string(rune(exitCode)),
                "exit_code":  exitCode,
            },
            "server_id": c.cfg.ServerID,
            "ts":         time.Now().UnixMilli(),
        })
    } else {
        c.Send(map[string]any{
            "type": "COMMAND_DONE",
            "payload": map[string]any{
                "command_id": payload.CommandID,
                "exit_code":  exitCode,
            },
            "server_id": c.cfg.ServerID,
            "ts":         time.Now().UnixMilli(),
        })
    }
}

func (c *Client) sendError(commandID string, err error) {
    c.Send(map[string]any{
        "type": "COMMAND_ERROR",
        "payload": map[string]any{
            "command_id": commandID,
            "error":      err.Error(),
        },
        "server_id": c.cfg.ServerID,
    })
}
```

### 4.4 Heartbeat / Metrics Collector

```go
// cmd/agent/heartbeat/heartbeat.go
package heartbeat

import (
    "time"
    "runtime"

    "github.com/shirou/gopsutil/v3/cpu"
    "github.com/shirou/gopsutil/v3/mem"
    "github.com/shirou/gopsutil/v3/disk"
    "einfra-agent/client"
)

type Heartbeat struct {
    client   *client.Client
    interval time.Duration
}

func New(c *client.Client, interval time.Duration) *Heartbeat {
    return &Heartbeat{client: c, interval: interval}
}

func (h *Heartbeat) Start() {
    ticker := time.NewTicker(h.interval)
    for range ticker.C {
        h.sendHeartbeat()
    }
}

func (h *Heartbeat) sendHeartbeat() {
    cpuPercent, _ := cpu.Percent(0, false)
    memStat, _ := mem.VirtualMemory()
    diskStat, _ := disk.Usage("/")

    h.client.Send(map[string]any{
        "type": "HEARTBEAT",
        "payload": map[string]any{
            "cpu_percent":  safeFirst(cpuPercent),
            "mem_percent":  memStat.UsedPercent,
            "disk_percent": diskStat.UsedPercent,
            "os":           runtime.GOOS,
        },
    })
}

func safeFirst(s []float64) float64 {
    if len(s) > 0 { return s[0] }
    return 0
}
```

---

## 5. Frontend Integration {#frontend}

### 5.1 Hook: Agent WebSocket

```typescript
// app/src/features/servers/hooks/useAgentSocket.ts
import { useEffect, useRef, useCallback, useState } from "react";

export type LogLine = {
  ts: number;
  chunk: string;
  seq: number;
};

export type CommandState = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  logs: LogLine[];
  exitCode?: number;
};

type UseAgentSocketOptions = {
  serverId: string;
  sessionToken: string;
};

export function useAgentSocket({ serverId, sessionToken }: UseAgentSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [commands, setCommands] = useState<Record<string, CommandState>>({});

  const updateCommand = useCallback((commandId: string, updater: (prev: CommandState) => CommandState) => {
    setCommands((prev) => {
      const existing = prev[commandId] ?? { id: commandId, status: "RUNNING", logs: [] };
      return { ...prev, [commandId]: updater(existing) };
    });
  }, []);

  useEffect(() => {
    const url = `${import.meta.env.VITE_WS_URL}/ws/client/${crypto.randomUUID()}`;
    const socket = new WebSocket(url, [sessionToken]);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const payload = msg.payload ?? {};

      switch (msg.type) {
        case "COMMAND_OUTPUT":
          updateCommand(payload.command_id, (prev) => ({
            ...prev,
            status: "RUNNING",
            logs: [...prev.logs, { ts: msg.ts, chunk: payload.chunk, seq: payload.seq }],
          }));
          break;

        case "COMMAND_DONE":
          updateCommand(payload.command_id, (prev) => ({
            ...prev,
            status: "SUCCESS",
            exitCode: payload.exit_code,
          }));
          break;

        case "COMMAND_ERROR":
          updateCommand(payload.command_id, (prev) => ({
            ...prev,
            status: "FAILED",
          }));
          break;
      }
    };

    return () => socket.close();
  }, [serverId, sessionToken]);

  const sendCommand = useCallback(
    async (cmd: string): Promise<string> => {
      const res = await fetch(`/api/v1/servers/${serverId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ cmd, timeout_sec: 120 }),
      });
      const data = await res.json();
      updateCommand(data.id, () => ({ id: data.id, status: "PENDING", logs: [] }));
      return data.id;
    },
    [serverId, sessionToken],
  );

  return { connected, commands, sendCommand };
}
```

### 5.2 Terminal Component

```typescript
// app/src/features/servers/components/AgentTerminal.tsx
import { useRef, useEffect, useState, useCallback } from "react";
import { useAgentSocket, type CommandState } from "../hooks/useAgentSocket";
import { Terminal as TerminalIcon, Wifi, WifiOff, X, Copy, RotateCcw } from "lucide-react";

interface Props {
  serverId: string;
  sessionToken: string;
}

export function AgentTerminal({ serverId, sessionToken }: Props) {
  const { connected, commands, sendCommand } = useAgentSocket({ serverId, sessionToken });
  const [input, setInput] = useState("");
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeCommand: CommandState | null = activeCommandId ? commands[activeCommandId] ?? null : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeCommand?.logs.length]);

  const run = useCallback(async () => {
    if (!input.trim() || !connected) return;
    const id = await sendCommand(input.trim());
    setActiveCommandId(id);
    setInput("");
  }, [input, connected, sendCommand]);

  const statusColor = {
    PENDING: "text-amber-400",
    RUNNING: "text-blue-400",
    SUCCESS: "text-emerald-400",
    FAILED: "text-red-400",
    CANCELLED: "text-zinc-400",
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] text-zinc-500 ml-2">einfra — remote terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
              <Wifi size={12} /> LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400 text-[11px]">
              <WifiOff size={12} /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-4 text-[12px] leading-relaxed space-y-0.5">
        {!activeCommand && (
          <span className="text-zinc-600">Agent terminal ready. Type a command below...</span>
        )}
        {activeCommand?.logs
          .sort((a, b) => a.seq - b.seq)
          .map((line, i) => (
            <div key={i} className="flex items-start gap-3 group hover:bg-zinc-900/40 -mx-2 px-2 py-0.5 rounded">
              <span className="text-zinc-700 shrink-0 tabular-nums text-[10px] pt-px w-16">
                {new Date(line.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="text-green-400 break-all">{line.chunk}</span>
            </div>
          ))}
        {activeCommand && (
          <div className={`text-[11px] font-bold mt-2 ${statusColor[activeCommand.status]}`}>
            [{activeCommand.status}] {activeCommand.exitCode !== undefined && `exit code: ${activeCommand.exitCode}`}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-3 flex items-center gap-3 bg-zinc-900/50">
        <span className="text-emerald-500 text-sm shrink-0">$</span>
        <input
          className="flex-1 bg-transparent text-zinc-100 text-[13px] outline-none placeholder:text-zinc-700 font-mono"
          placeholder="Enter command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          disabled={!connected || activeCommand?.status === "RUNNING"}
        />
        <button
          onClick={run}
          disabled={!connected || !input.trim() || activeCommand?.status === "RUNNING"}
          className="px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition"
        >
          RUN
        </button>
      </div>
    </div>
  );
}
```

### 5.3 Server Status Badge Component

```typescript
// app/src/features/servers/components/AgentStatusBadge.tsx
import { useEffect, useState } from "react";
import { Activity, WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

interface Props {
  serverId: string;
  className?: string;
}

export function AgentStatusBadge({ serverId, className }: Props) {
  const [status, setStatus] = useState<AgentStatus>("UNKNOWN");

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/servers/${serverId}/status`);
        const data = await res.json();
        setStatus(data.online ? "ONLINE" : "OFFLINE");
      } catch {
        setStatus("UNKNOWN");
      }
    };
    poll();
    const id = setInterval(poll, 15_000); // poll every 15s
    return () => clearInterval(id);
  }, [serverId]);

  const cfg = {
    ONLINE:   { label: "Online",   dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", Icon: Activity },
    OFFLINE:  { label: "Offline",  dot: "bg-red-500",     text: "text-red-600 dark:text-red-400",         Icon: WifiOff },
    DEGRADED: { label: "Degraded", dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",     Icon: AlertTriangle },
    UNKNOWN:  { label: "Unknown",  dot: "bg-zinc-400",    text: "text-zinc-500",                           Icon: Activity },
  }[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800", cfg.text, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
```

---

## 6. Phase-Based Implementation {#phases}

### Phase 1 — Server + Agent Core ✅ START HERE

| Task | File | Priority |
|------|------|----------|
| Create `cmd/agent/` project | New Go module | 🔴 Critical |
| Agent WS connection + reconnect | `cmd/agent/client/ws_client.go` | 🔴 Critical |
| Command executor (sh -c) | `cmd/agent/executor/executor.go` | 🔴 Critical |
| Heartbeat + metrics | `cmd/agent/heartbeat/heartbeat.go` | 🔴 Critical |
| Backend: Agent WS handler | `api/internal/infrastructure/agent/` | 🔴 Critical |
| Backend: Command dispatcher | `api/internal/infrastructure/agent/usecase/` | 🔴 Critical |
| DB migrations: commands, logs, agent_info | `api/internal/repository/` | 🟡 High |
| REST APIs: POST /v1/servers/{id}/commands | Router update | 🟡 High |
| Frontend: `useAgentSocket` hook | `app/src/features/servers/hooks/` | 🟡 High |
| Frontend: `AgentTerminal` component | `app/src/features/servers/components/` | 🟡 High |
| Frontend: `AgentStatusBadge` | `app/src/features/servers/components/` | 🟡 High |
| Onboarding: real API calls | [ServerOnboardingPage.tsx](file:///d:/Code/EPASS/EINFRA/einfra/app/src/features/servers/pages/ServerOnboardingPage.tsx) | 🟢 Medium |

### Phase 2 — Docker via Agent

```go
// cmd/agent/executor/docker_executor.go
// Routes EXEC_COMMAND with cmd prefix "docker:" to Docker SDK
// e.g., command = "docker:containers:list" → calls Docker API locally

// New message types:
// DOCKER_CONTAINERS → list of containers
// DOCKER_LOGS_CHUNK → streaming container logs
// DOCKER_EXEC_OUTPUT → exec result inside container
```

| Task | Notes |
|------|-------|
| Docker executor in agent | Use `docker/docker` client locally |
| `GET /v1/servers/{id}/docker/containers` | Backend proxies via agent WS |
| `POST /v1/servers/{id}/docker/containers/{id}/start` | Proxied command |
| Frontend: Docker tab on ServerDashboard | Extend existing Docker feature |
| Container log streaming | WS streaming, same pattern as command output |

### Phase 3 — Kubernetes via Agent

```go
// cmd/agent/executor/k8s_executor.go
// Uses kubectl or k8s client-go locally

// New message types:
// K8S_PODS → pod list
// K8S_POD_LOG_CHUNK → pod log streaming
// K8S_METRICS → node/pod metrics
```

| Task | Notes |
|------|-------|
| K8s executor in agent | `client-go` or `kubectl exec` wrapper |
| Pod/deployment queries | Backend proxies from agent |
| Log streaming for pods | Same WS streaming pattern |
| Frontend K8s integration | Extend existing Kubernetes feature |

---

## 7. Security Model {#security}

### Agent Authentication

```
1. Admin calls POST /v1/agents/token { server_id: "..." }
2. Backend issues signed JWT: { sub: server_id, role: "agent", exp: 365d }
3. Token embedded in agent install script:
   AGENT_TOKEN=eyJ... CONTROL_PLANE=https://... ./install-agent.sh
4. Agent sends token in WS header: Authorization: Bearer <token>
5. Backend verifies token on every WS upgrade
```

### Token Refresh

```go
// Agent receives CONFIG_UPDATE message → stores new token → reconnects
// Control plane rotates tokens every 90 days → sends update before expiry
```

### Encryption

- All communication over **WSS (TLS)**
- Agent token is **server-scoped** (cannot impersonate another server)
- Commands are **user-scoped** (audit log includes user_id)
- Future: mTLS with client certificates for agent identity

---

## 8. File Structure {#structure}

```
einfra/
├── api/                          ← Go backend (Control Plane)
│   ├── cmd/
│   │   ├── server/               ← Existing backend entrypoint
│   │   └── agent/                ← 🆕 Agent standalone binary
│   │       ├── main.go
│   │       ├── config/
│   │       ├── client/           ← WS client + reconnect
│   │       ├── executor/         ← Command, Docker, K8s executors
│   │       ├── collector/        ← System/Docker/K8s metrics
│   │       └── heartbeat/
│   │
│   └── internal/
│       ├── infrastructure/
│       │   └── agent/            ← 🆕 Agent domain (backend side)
│       │       ├── handler/
│       │       │   ├── agent_ws_handler.go
│       │       │   ├── client_ws_handler.go
│       │       │   └── command_handler.go
│       │       ├── usecase/
│       │       │   ├── command_usecase.go
│       │       │   ├── agent_registry.go
│       │       │   └── metrics_usecase.go
│       │       ├── repository/
│       │       │   ├── command_repo.go
│       │       │   └── agent_repo.go
│       │       └── interfaces.go
│       │
│       └── domain/
│           └── agent/            ← 🆕 Agent domain entities
│               └── types.go
│
└── app/src/features/servers/     ← React frontend
    ├── hooks/
    │   └── useAgentSocket.ts     ← 🆕 WS hook
    ├── components/
    │   ├── AgentTerminal.tsx     ← 🆕 Terminal UI
    │   └── AgentStatusBadge.tsx  ← 🆕 Status badge
    └── pages/
        ├── ServerDashboard.tsx   ← 🔄 Extend with agent tab
        └── ServerOnboardingPage.tsx ← 🔄 Wire to real API
```

---

## 🚀 Quick Start: Build Agent Binary

```bash
# 1. Create agent go module
mkdir -p api/cmd/agent
cd api/cmd/agent
go mod init einfra-agent

# 2. Add dependencies
go get github.com/gorilla/websocket
go get github.com/shirou/gopsutil/v3

# 3. Build agent binary
go build -o einfra-agent ./...

# 4. Install on target server
scp einfra-agent user@server:/usr/local/bin/
AGENT_TOKEN=<token> CONTROL_PLANE=wss://your-backend ./einfra-agent
```

## 📋 Install Script (Generated at Onboarding)

```bash
#!/bin/bash
# Generated by EINFRA Control Plane
AGENT_TOKEN="{{ .Token }}"
CONTROL_PLANE="{{ .ControlPlaneURL }}"
SERVER_ID="{{ .ServerID }}"

# Download agent binary
curl -fsSL $CONTROL_PLANE/downloads/einfra-agent-linux-amd64 -o /usr/local/bin/einfra-agent
chmod +x /usr/local/bin/einfra-agent

# Create systemd service
cat > /etc/systemd/system/einfra-agent.service <<EOF
[Unit]
Description=EINFRA Agent
After=network.target

[Service]
Environment=AGENT_TOKEN=$AGENT_TOKEN
Environment=CONTROL_PLANE_URL=$CONTROL_PLANE
Environment=SERVER_ID=$SERVER_ID
ExecStart=/usr/local/bin/einfra-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now einfra-agent
echo "✓ EINFRA Agent installed and running"
```

---

*Architecture Version: 1.0 | Date: 2026-03-18 | Status: Active*
