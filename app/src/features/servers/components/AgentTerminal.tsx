/**
 * AgentTerminal — A professional terminal-style UI for executing commands
 * on a remote server through the EINFRA agent.
 *
 * Features:
 * - Real-time streaming output
 * - Auto-scroll with pause-on-hover
 * - Copy output
 * - Command history (↑/↓)
 * - Clear button
 * - Connection status indicator
 */
import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from "react";
import {
  Terminal as TerminalIcon,
  Copy,
  Trash2,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentSocket, type CommandState, type AgentConnectionState } from "../hooks/useAgentSocket";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: AgentConnectionState }) {
  const cfg: Record<AgentConnectionState, { color: string; label: string; pulse: boolean }> = {
    online: { color: "bg-emerald-500", label: "LIVE", pulse: true },
    offline: { color: "bg-red-500", label: "OFFLINE", pulse: false },
    connecting: { color: "bg-amber-500", label: "CONNECTING", pulse: true },
    reconnecting: { color: "bg-amber-500", label: "RECONNECTING", pulse: true },
  };
  const { color, label, pulse } = cfg[status];
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
      <span className={cn("w-1.5 h-1.5 rounded-full", color, pulse && "animate-pulse")} />
      {label}
    </span>
  );
}

function CommandStatusIcon({ status }: { status: CommandState["status"] }) {
  if (status === "RUNNING") return <Loader2 size={12} className="animate-spin text-blue-400 shrink-0 mt-0.5" />;
  if (status === "SUCCESS") return <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
  if (status === "FAILED") return <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />;
  if (status === "PENDING") return <Clock size={12} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />;
  return <span className="w-3 h-3 rounded-full bg-zinc-600 shrink-0 mt-1" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AgentTerminalProps {
  serverId: string;
  serverName?: string;
  authToken?: string;
  className?: string;
}

export function AgentTerminal({ serverId, serverName, authToken, className }: AgentTerminalProps) {
  const { wsConnected, agentStatus, commands, commandIds, sendCommand, clearCommands } =
    useAgentSocket({ serverId, authToken });

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [autoscroll, setAutoscroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const logBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const activeCommand = activeCommandId ? commands[activeCommandId] : null;
  const isRunning = activeCommand?.status === "RUNNING" || activeCommand?.status === "PENDING";

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoscroll) {
      logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeCommand?.logs.length, autoscroll]);

  // ── Pause autoscroll when user scrolls up ───────────────────────────────
  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 40;
    setAutoscroll(atBottom);
  }, []);

  // ── Run command ─────────────────────────────────────────────────────────
  const runCommand = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || !wsConnected || agentStatus !== "online") return;

    setHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput("");

    try {
      const id = await sendCommand(cmd);
      setActiveCommandId(id);
      setAutoscroll(true);
    } catch (err: unknown) {
      console.error("[AgentTerminal] dispatch failed:", err);
    }
  }, [input, wsConnected, agentStatus, sendCommand]);

  // ── Keyboard: Enter / ↑ / ↓ ─────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? "" : history[next]);
    }
  };

  // ── Copy logs ───────────────────────────────────────────────────────────
  const copyLogs = useCallback(() => {
    if (!activeCommand) return;
    const text = activeCommand.logs
      .sort((a, b) => a.seq - b.seq)
      .map((l) => l.chunk)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [activeCommand]);

  // ── Ordered logs ────────────────────────────────────────────────────────
  const sortedLogs = activeCommand
    ? [...activeCommand.logs].sort((a, b) => a.seq - b.seq)
    : [];

  const statusTextColor: Record<CommandState["status"], string> = {
    PENDING: "text-amber-400",
    RUNNING: "text-blue-400",
    SUCCESS: "text-emerald-400",
    FAILED: "text-red-400",
    CANCELLED: "text-zinc-600 dark:text-zinc-400",
    TIMEOUT: "text-orange-400",
  };

  return (
    <div className={cn("flex flex-col bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden font-mono", className)}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          {/* macOS traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] text-zinc-500 ml-1">
            einfra — {serverName ?? serverId}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status={agentStatus} />
          <button
            onClick={copyLogs}
            disabled={!activeCommand}
            title="Copy output"
            className="p-1 rounded hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:text-zinc-700 dark:text-zinc-300 transition disabled:opacity-30"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => { clearCommands(); setActiveCommandId(null); }}
            title="Clear terminal"
            className="p-1 rounded hover:bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:text-zinc-700 dark:text-zinc-300 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Log Output ───────────────────────────────────────────────────── */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 overflow-y-auto p-4 text-[12px] leading-relaxed space-y-0.5 min-h-0 cursor-text"
        style={{ minHeight: "300px" }}
      >
        {commandIds.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3 select-none">
            <TerminalIcon size={32} className="text-zinc-700" />
            <p className="text-zinc-600 text-sm">
              {agentStatus === "online"
                ? "Agent online — type a command to begin"
                : "Waiting for agent to connect..."}
            </p>
          </div>
        )}

        {/* Show all historical commands */}
        {[...commandIds].reverse().map((id) => {
          const cmd = commands[id];
          if (!cmd) return null;
          const isActive = id === activeCommandId;

          return (
            <div key={id} className="group" onClick={() => setActiveCommandId(id)}>
              {/* Command prompt line */}
              <div className={cn("flex items-start gap-2 mt-4 first:mt-0 cursor-pointer", isActive ? "opacity-100" : "opacity-60 hover:opacity-80 transition-opacity")}>
                <ChevronRight size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-zinc-800 dark:text-zinc-200 break-all">{cmd.cmd}</span>
                <CommandStatusIcon status={cmd.status} />
              </div>

              {/* Output lines (only for active or show collapsed) */}
              {isActive && sortedLogs.map((line, i) => (
                <div
                  key={`${line.seq}-${i}`}
                  className="flex items-start gap-3 group/line hover:bg-zinc-900/40 -mx-2 px-2 py-[1px] rounded"
                >
                  <span className="text-zinc-700 shrink-0 text-[10px] tabular-nums pt-px w-16">
                    {new Date(line.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={cn(
                      "break-all text-green-400",
                      line.chunk.startsWith("[stderr]") && "text-amber-400",
                    )}
                  >
                    {line.chunk}
                  </span>
                </div>
              ))}

              {/* Status footer */}
              {isActive && cmd.status !== "RUNNING" && cmd.status !== "PENDING" && (
                <div className={cn("text-[10px] font-bold mt-1.5 ml-5 pb-2", statusTextColor[cmd.status])}>
                  [{cmd.status}]
                  {cmd.exitCode !== undefined && ` exit=${cmd.exitCode}`}
                  {cmd.doneAt && cmd.startedAt && (
                    <span className="text-zinc-600 font-normal ml-2">
                      {((cmd.doneAt - cmd.startedAt) / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={logBottomRef} />
      </div>

      {/* ── Input Bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800/80 px-4 py-3 flex items-center gap-3 bg-zinc-900/60">
        <span className="text-emerald-500 text-sm shrink-0 select-none">
          {isRunning ? (
            <Loader2 size={14} className="animate-spin text-blue-400" />
          ) : (
            "$"
          )}
        </span>
        <input
          ref={inputRef}
          autoFocus
          className="flex-1 bg-transparent text-zinc-100 text-[13px] outline-none placeholder:text-zinc-700 font-mono caret-emerald-400"
          placeholder={
            agentStatus !== "online"
              ? "Agent offline..."
              : isRunning
                ? "Command running..."
                : "Enter command... (↑↓ for history)"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={agentStatus !== "online" || isRunning}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <button
          onClick={runCommand}
          disabled={agentStatus !== "online" || !input.trim() || isRunning}
          className="shrink-0 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          RUN
        </button>
      </div>

      {/* ── Autoscroll paused notice ──────────────────────────────────────── */}
      {!autoscroll && isRunning && (
        <div
          className="absolute bottom-16 right-4 cursor-pointer"
          onClick={() => {
            setAutoscroll(true);
            logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 backdrop-blur-sm hover:bg-zinc-700/90 transition">
            ↓ Jump to bottom
          </span>
        </div>
      )}
    </div>
  );
}
