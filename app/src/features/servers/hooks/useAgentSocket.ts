/**
 * useAgentSocket — Real-time WebSocket hook for the EINFRA agent.
 *
 * Connects to the backend's WS `/ws/client/{server_id}` endpoint to receive:
 *  - COMMAND_OUTPUT  — real-time stdout chunks from running commands
 *  - COMMAND_DONE    — command completed successfully
 *  - COMMAND_ERROR   — command failed
 *  - AGENT_ONLINE    — agent came online
 *  - AGENT_OFFLINE   — agent disconnected
 *  - METRICS_UPDATE  — periodic system metrics from the agent
 */
import { useEffect, useRef, useCallback, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLine = {
  ts: number;
  chunk: string;
  seq: number;
};

export type CommandStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED" | "TIMEOUT";

export type CommandState = {
  id: string;
  cmd: string;
  status: CommandStatus;
  logs: LogLine[];
  exitCode?: number;
  startedAt?: number; // unix ms
  doneAt?: number;    // unix ms
};

export type AgentMetrics = {
  cpu_percent: number;
  mem_percent: number;
  disk_percent: number;
  os: string;
  arch: string;
  has_docker: boolean;
  has_k8s: boolean;
  agent_version: string;
};

export type AgentConnectionState = "connecting" | "online" | "offline" | "reconnecting";

type UseAgentSocketOptions = {
  serverId: string;
  /** Base URL of the backend API (e.g. http://localhost:8080) */
  baseUrl?: string;
  /** Auth token for API calls */
  authToken?: string;
};

type UseAgentSocketReturn = {
  /** Whether the WS is connected */
  wsConnected: boolean;
  /** Live agent status */
  agentStatus: AgentConnectionState;
  /** Last known metrics from the agent */
  metrics: AgentMetrics | null;
  /** Map of commandId → CommandState (most recent first) */
  commands: Record<string, CommandState>;
  /** Ordered array of command IDs (newest first) */
  commandIds: string[];
  /** Submit a command to the server agent. Returns the command ID. */
  sendCommand: (cmd: string, timeoutSec?: number) => Promise<string>;
  /** Clear command history */
  clearCommands: () => void;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgentSocket({
  serverId,
  baseUrl = "",
  authToken = "",
}: UseAgentSocketOptions): UseAgentSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentConnectionState>("connecting");
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [commands, setCommands] = useState<Record<string, CommandState>>({});
  const [commandIds, setCommandIds] = useState<string[]>([]);

  // ── Update a single command in state ─────────────────────────────────────
  const updateCommand = useCallback(
    (commandId: string, updater: (prev: CommandState) => CommandState) => {
      setCommands((prev) => {
        const existing = prev[commandId] ?? {
          id: commandId,
          cmd: "",
          status: "RUNNING" as CommandStatus,
          logs: [],
        };
        return { ...prev, [commandId]: updater(existing) };
      });
    },
    [],
  );

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!serverId) return;

    const wsBase = baseUrl
      .replace(/^http/, "ws")
      .replace(/^https/, "wss")
      || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

    const url = `${wsBase}/ws/client/${serverId}`;

    const connect = () => {
      const socket = new WebSocket(url);
      wsRef.current = socket;
      setAgentStatus("connecting");

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onclose = () => {
        setWsConnected(false);
        setAgentStatus("reconnecting");
        // Auto-reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      socket.onerror = (e) => {
        console.warn("[useAgentSocket] WebSocket error:", e);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          handleMessage(msg);
        } catch (e) {
          console.warn("[useAgentSocket] failed to parse message:", e);
        }
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, baseUrl]);

  const handleMessage = useCallback(
    (msg: { type: string; payload?: Record<string, unknown>; server_id?: string; ts?: number }) => {
      const payload = msg.payload ?? {};

      switch (msg.type) {
        case "AGENT_STATUS":
          setAgentStatus((payload as { online: boolean }).online ? "online" : "offline");
          break;

        case "AGENT_ONLINE":
          setAgentStatus("online");
          break;

        case "AGENT_OFFLINE":
          setAgentStatus("offline");
          break;

        case "METRICS_UPDATE":
          setMetrics(payload as unknown as AgentMetrics);
          break;

        case "COMMAND_OUTPUT": {
          const commandId = payload["command_id"] as string;
          const chunk = payload["chunk"] as string;
          const seq = payload["seq"] as number;
          updateCommand(commandId, (prev) => ({
            ...prev,
            status: "RUNNING",
            logs: [...prev.logs, { ts: msg.ts ?? Date.now(), chunk, seq }],
          }));
          break;
        }

        case "COMMAND_DONE": {
          const commandId = payload["command_id"] as string;
          const exitCode = payload["exit_code"] as number;
          updateCommand(commandId, (prev) => ({
            ...prev,
            status: "SUCCESS",
            exitCode,
            doneAt: Date.now(),
          }));
          break;
        }

        case "COMMAND_ERROR": {
          const commandId = payload["command_id"] as string;
          const exitCode = (payload["exit_code"] as number) ?? 1;
          updateCommand(commandId, (prev) => ({
            ...prev,
            status: "FAILED",
            exitCode,
            doneAt: Date.now(),
          }));
          break;
        }
      }
    },
    [updateCommand],
  );

  // ── Send command via REST API ─────────────────────────────────────────────
  const sendCommand = useCallback(
    async (cmd: string, timeoutSec = 120): Promise<string> => {
      const res = await fetch(`${baseUrl}/api/v1/servers/${serverId}/commands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ cmd, timeout_sec: timeoutSec }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        throw new Error(err.error ?? "Failed to dispatch command");
      }

      const data = await res.json();
      const commandId: string = data.id;

      // Optimistic update — register the command immediately
      setCommands((prev) => ({
        ...prev,
        [commandId]: { id: commandId, cmd, status: "PENDING", logs: [], startedAt: Date.now() },
      }));
      setCommandIds((prev) => [commandId, ...prev]);

      return commandId;
    },
    [serverId, baseUrl, authToken],
  );

  const clearCommands = useCallback(() => {
    setCommands({});
    setCommandIds([]);
  }, []);

  return {
    wsConnected,
    agentStatus,
    metrics,
    commands,
    commandIds,
    sendCommand,
    clearCommands,
  };
}
