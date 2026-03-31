import { useEffect, useRef, useState, useCallback } from "react";
import {
  Copy,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  PlugZap,
  Terminal as TerminalIcon,
  X,
  Plus,
} from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { apiFetch, buildApiWebSocketUrl } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types & props
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  containerName: string;
  containerId: string;
  environmentId: string;
}

type ConnectionState =
  | "connecting"
  | "connected"
  | "closed"
  | "error"
  | "fallback";

interface SessionState {
  id: string;
  label: string;
  term: Terminal | null;
  fitAddon: FitAddon | null;
  socket: WebSocket | null;
  domRef: HTMLDivElement | null;
  connectionStatus: ConnectionState;
  fallbackMode: boolean;
  fallbackRunning: boolean;
  fallbackBuffer: string;
  fallbackCursor: number;
  shellCwd: string;
  shellUser: string;
  history: string[];
  historyIdx: number;
  historySavedCurrent: string;
  tabComplete: { prefix: string; options: string[]; cursor: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function canMeasureHost(host: HTMLDivElement | null) {
  return host?.isConnected && host.clientWidth > 0 && host.clientHeight > 0;
}

function safeFit(host: HTMLDivElement | null, fit: FitAddon | null) {
  if (!fit || !canMeasureHost(host)) return false;
  try {
    fit.fit();
    return true;
  } catch {
    return false;
  }
}

function safeProposeDimensions(host: HTMLDivElement | null, fit: FitAddon | null) {
  if (!fit || !canMeasureHost(host)) return null;
  try {
    return fit.proposeDimensions();
  } catch {
    return null;
  }
}

const EXEC_SHELLS = [
  ["sh", "-c"],
  ["/bin/sh", "-c"],
  ["bash", "-c"],
  ["/bin/bash", "-c"],
  ["ash", "-c"],
  ["/bin/ash", "-c"],
];

async function execShell(
  environmentId: string,
  containerId: string,
  command: string,
): Promise<string> {
  let lastError: Error | null = null;
  for (const shell of EXEC_SHELLS) {
    try {
      const res = await apiFetch<{ output: string }>(
        `/v1/environments/${environmentId}/docker/containers/${containerId}/exec`,
        { method: "POST", body: JSON.stringify({ command: [...shell, command] }) },
      );
      return res.output ?? "";
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("exec failed");
    }
  }
  throw lastError ?? new Error("exec failed");
}

let sessionCounter = 1;
function nextSessionId() {
  return `s${sessionCounter++}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TerminalModal({
  isOpen,
  onClose,
  containerName,
  containerId,
  environmentId,
}: TerminalModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  const sessionsRef = useRef<SessionState[]>([]);
  const activeSessionIdRef = useRef<string>("");

  const { showNotification } = useNotification();
  const showNotifRef = useRef(showNotification);
  showNotifRef.current = showNotification;

  // Keep refs in sync with state
  sessionsRef.current = sessions;
  activeSessionIdRef.current = activeSessionId;

  // ── Session builder ──────────────────────────────────────────────────────
  const buildSessionState = useCallback((id: string, label: string): SessionState => ({
    id,
    label,
    term: null,
    fitAddon: null,
    socket: null,
    domRef: null,
    connectionStatus: "connecting",
    fallbackMode: false,
    fallbackRunning: false,
    fallbackBuffer: "",
    fallbackCursor: 0,
    shellCwd: "/",
    shellUser: "root",
    history: [],
    historyIdx: -1,
    historySavedCurrent: "",
    tabComplete: null,
  }), []);

  // Update a specific session's fields
  const updateSession = useCallback((id: string, patch: Partial<SessionState>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  // ── Add new session ──────────────────────────────────────────────────────
  const addSession = useCallback(() => {
    const id = nextSessionId();
    const label = `Session ${sessionsRef.current.length + 1}`;
    const newSession = buildSessionState(id, label);
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(id);
  }, [buildSessionState]);

  // ── Close a session ──────────────────────────────────────────────────────
  const closeSession = useCallback((sessionId: string) => {
    const sess = sessionsRef.current.find(s => s.id === sessionId);
    if (sess) {
      if (sess.socket?.readyState === WebSocket.OPEN) {
        sess.socket.send(JSON.stringify({ type: "close", data: "" }));
        sess.socket.close();
      }
      sess.term?.dispose();
    }

    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (next.length === 0) {
        // No sessions left — close modal
        setTimeout(onClose, 0);
        return next;
      }
      // Switch active if needed
      if (activeSessionIdRef.current === sessionId) {
        const idx = prev.findIndex(s => s.id === sessionId);
        const newActive = next[Math.max(0, idx - 1)]?.id ?? next[0]?.id;
        setActiveSessionId(newActive);
      }
      return next;
    });
  }, [onClose]);

  // ── Init first session on open ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (sessions.length === 0) {
      const id = nextSessionId();
      const s = buildSessionState(id, "Session 1");
      setSessions([s]);
      setActiveSessionId(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Cleanup all on close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "unset";
      setSessions([]);
      setActiveSessionId("");
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // ── Refit on maximize change ─────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      const sess = sessionsRef.current.find(s => s.id === activeSessionIdRef.current);
      if (!sess) return;
      safeFit(sess.domRef, sess.fitAddon);
      const d = safeProposeDimensions(sess.domRef, sess.fitAddon);
      if (sess.socket?.readyState === WebSocket.OPEN && d) {
        sess.socket.send(JSON.stringify({ type: "resize", data: JSON.stringify({ cols: d.cols, rows: d.rows }) }));
      }
      sess.term?.focus();
    }, 200);
    return () => window.clearTimeout(t);
  }, [isMaximized, isOpen, activeSessionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-300 border border-white/5 ${isMaximized
          ? "absolute inset-0 rounded-none"
          : "h-[76vh] w-full max-w-6xl rounded-2xl"
          }`}
        style={{ background: "linear-gradient(180deg, #0f0f12 0%, #0a0a0d 100%)" }}
      >
        {/* ── Titlebar ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#13131a] px-4 py-3 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500/20 shrink-0">
              <TerminalIcon size={12} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold text-zinc-200 truncate max-w-[260px]">
                  {containerName}
                </span>
                <span className="text-[10px] text-zinc-600 hidden sm:block">
                  interactive runtime terminal
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-600 truncate max-w-[300px]">
                {containerId}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const sess = sessionsRef.current.find(s => s.id === activeSessionIdRef.current);
                const sel = sess?.term?.getSelection() || "";
                if (sel) await navigator.clipboard?.writeText(sel);
              }}
              className="rounded-md border border-white/5 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
              title="Copy selection"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={async () => {
                const text = await navigator.clipboard?.readText();
                if (!text) return;
                const sess = sessionsRef.current.find(s => s.id === activeSessionIdRef.current);
                if (!sess) return;
                if (sess.fallbackMode) {
                  const term = sess.term;
                  if (!term) return;
                  const cur = sess.fallbackCursor;
                  const buf = sess.fallbackBuffer;
                  sess.fallbackBuffer = buf.slice(0, cur) + text + buf.slice(cur);
                  sess.fallbackCursor = cur + text.length;
                  term.write(text.replace(/\n/g, "\r\n"));
                  const tail = sess.fallbackBuffer.slice(sess.fallbackCursor);
                  if (tail.length > 0) term.write(tail + `\x1b[${tail.length}D`);
                } else {
                  sess.socket?.send(JSON.stringify({ type: "input", data: text }));
                }
              }}
              className="rounded-md border border-white/5 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
              title="Paste"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
            <button
              onClick={() => setIsMaximized((v) => !v)}
              className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Session tabs ── */}
        <div className="flex items-center border-b border-white/[0.05] bg-[#0f0f14] px-2 gap-1 select-none overflow-x-auto">
          {sessions.map((sess) => (
            <SessionTab
              key={sess.id}
              session={sess}
              isActive={sess.id === activeSessionId}
              onActivate={() => {
                setActiveSessionId(sess.id);
                setTimeout(() => {
                  const s = sessionsRef.current.find(x => x.id === sess.id);
                  if (s) {
                    safeFit(s.domRef, s.fitAddon);
                    s.term?.focus();
                  }
                }, 50);
              }}
              onClose={() => closeSession(sess.id)}
            />
          ))}
          <button
            onClick={addSession}
            className="flex items-center gap-1 px-2 py-1.5 my-0.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0 text-[11px]"
            title="New session"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* ── Terminal panes (one per session, hidden unless active) ── */}
        <div className="flex-1 min-h-0 bg-[#0a0a0d] relative">
          {sessions.map((sess) => (
            <SessionPane
              key={sess.id}
              session={sess}
              isActive={sess.id === activeSessionId}
              containerId={containerId}
              containerName={containerName}
              environmentId={environmentId}
              showNotif={showNotifRef.current}
              onStatusChange={(status) => updateSession(sess.id, { connectionStatus: status })}
              onSessionUpdate={(patch) => {
                // Mutate the ref immediately for fallback logic
                const s = sessionsRef.current.find(x => x.id === sess.id);
                if (s) Object.assign(s, patch);
                // And update state for UI re-render if needed
                if (patch.connectionStatus !== undefined) {
                  updateSession(sess.id, patch);
                }
              }}
            />
          ))}
        </div>

        {/* ── Bottom status bar ── */}
        {(() => {
          const activeSess = sessions.find(s => s.id === activeSessionId);
          const cs = activeSess?.connectionStatus ?? "connecting";
          const statusConfig = {
            connected: { dot: "bg-emerald-400", label: "live", text: "text-emerald-400" },
            connecting: { dot: "bg-amber-400 animate-pulse", label: "connecting", text: "text-amber-400" },
            fallback: { dot: "bg-blue-400", label: "cmd mode", text: "text-blue-400" },
            error: { dot: "bg-red-400", label: "error", text: "text-red-400" },
            closed: { dot: "bg-zinc-500", label: "closed", text: "text-zinc-400" },
          }[cs];
          return (
            <div className="flex items-center justify-between border-t border-white/[0.04] bg-[#0d0d12] px-4 py-1 select-none">
              <div className="flex items-center gap-2">
                <PlugZap className="h-3 w-3 text-zinc-700" />
                <span className="font-mono text-[10px] text-zinc-600">
                  {containerId.substring(0, 12)}
                </span>
                <div className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 border shrink-0 ${cs === "connected" ? "border-emerald-500/20 bg-emerald-500/5" :
                  cs === "connecting" ? "border-amber-500/20 bg-amber-500/5" :
                    cs === "fallback" ? "border-blue-500/20 bg-blue-500/5" :
                      "border-zinc-700 bg-zinc-800/50"
                  }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-700">
                <span>↑↓ history</span>
                <span>Tab complete</span>
                <span>Ctrl+C cancel</span>
                <span>Ctrl+A/E line</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionTab
// ─────────────────────────────────────────────────────────────────────────────

function SessionTab({
  session,
  isActive,
  onActivate,
  onClose,
}: {
  session: SessionState;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const cs = session.connectionStatus;
  const dotColor =
    cs === "connected" ? "bg-emerald-400" :
      cs === "connecting" ? "bg-amber-400 animate-pulse" :
        cs === "fallback" ? "bg-blue-400" :
          cs === "error" ? "bg-red-400" :
            "bg-zinc-600";

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 my-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors shrink-0 group ${isActive
        ? "bg-white/8 text-zinc-200 border border-white/8"
        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/4 border border-transparent"
        }`}
      onClick={onActivate}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{session.label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-0.5 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-opacity"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionPane — mounts/initialises xterm for one session
// ─────────────────────────────────────────────────────────────────────────────

interface SessionPaneProps {
  session: SessionState;
  isActive: boolean;
  containerId: string;
  containerName: string;
  environmentId: string;
  showNotif: ReturnType<typeof useNotification>["showNotification"];
  onStatusChange: (s: ConnectionState) => void;
  onSessionUpdate: (patch: Partial<SessionState>) => void;
}

function SessionPane({
  session,
  isActive,
  containerId,
  containerName,
  environmentId,
  showNotif,
  onStatusChange,
  onSessionUpdate,
}: SessionPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  // Keep a mutable object for fallback state (avoid stale closures)
  const stateRef = useRef<SessionState>(session);
  stateRef.current = session;

  const setDomRef = useCallback((el: HTMLDivElement | null) => {
    hostRef.current = el;
    onSessionUpdate({ domRef: el });
  }, [onSessionUpdate]);

  useEffect(() => {
    if (!hostRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const host = hostRef.current;
    const sess = stateRef.current; // mutable ref

    // ── Build xterm ────────────────────────────────────────────────────────
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      lineHeight: 1.4,
      convertEol: true,
      scrollback: 3000,
      allowProposedApi: true,
      theme: {
        background: "#0a0a0d",
        foreground: "#c9d1d9",
        cursor: "#60a5fa",
        cursorAccent: "#0a0a0d",
        selectionBackground: "rgba(96,165,250,0.25)",
        black: "#21262d",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    safeFit(host, fitAddon);
    term.focus();

    onSessionUpdate({ term, fitAddon, domRef: host });

    // ── Prompt builder ─────────────────────────────────────────────────────
    const buildPrompt = () => {
      const id = containerId.substring(0, 12);
      const user = stateRef.current.shellUser;
      const cwd = stateRef.current.shellCwd;
      const sym = user === "root" ? "#" : "$";
      return (
        `\x1b[38;5;114m${user}\x1b[0m` +
        `\x1b[90m@\x1b[0m` +
        `\x1b[38;5;75m${id}\x1b[0m` +
        `\x1b[90m:\x1b[0m` +
        `\x1b[38;5;117m${cwd}\x1b[0m` +
        `\x1b[${user === "root" ? "31" : "32"}m${sym}\x1b[0m `
      );
    };

    const writePrompt = () => {
      stateRef.current.fallbackBuffer = "";
      stateRef.current.fallbackCursor = 0;
      stateRef.current.tabComplete = null;
      term.write(buildPrompt());
    };

    // ── Helper: replace current line buffer ───────────────────────────────
    // FIX: always move cursor back to start of buffer before rewriting
    const setBuffer = (newBuf: string, newCur: number) => {
      const oldBuf = stateRef.current.fallbackBuffer;
      const oldCur = stateRef.current.fallbackCursor;

      // Move to start of buffer
      if (oldCur > 0) term.write(`\x1b[${oldCur}D`);

      // Overwrite with new buffer
      term.write(newBuf);

      // Erase leftover characters if old buffer was longer
      const overflow = oldBuf.length - newBuf.length;
      if (overflow > 0) {
        term.write(" ".repeat(overflow) + `\x1b[${overflow}D`);
      }

      // Move cursor to newCur position from end
      const tailLen = newBuf.length - newCur;
      if (tailLen > 0) term.write(`\x1b[${tailLen}D`);

      stateRef.current.fallbackBuffer = newBuf;
      stateRef.current.fallbackCursor = newCur;
    };

    // ── Tab autocomplete ───────────────────────────────────────────────────
    const handleTabComplete = async () => {
      const buf = stateRef.current.fallbackBuffer;
      const cur = stateRef.current.fallbackCursor;
      const prefix = buf.slice(0, cur);

      const tc = stateRef.current.tabComplete;
      if (tc && tc.prefix === prefix && tc.options.length > 0) {
        tc.cursor = (tc.cursor + 1) % tc.options.length;
        const chosen = tc.options[tc.cursor];
        const lastSpaceIdx = prefix.lastIndexOf(" ");
        const beforeWord = lastSpaceIdx === -1 ? "" : prefix.slice(0, lastSpaceIdx + 1);
        const newBuf = beforeWord + chosen + buf.slice(cur);
        const newCur = beforeWord.length + chosen.length;
        setBuffer(newBuf, newCur);
        return;
      }

      const lastSpaceIdx = prefix.lastIndexOf(" ");
      const word = lastSpaceIdx === -1 ? prefix : prefix.slice(lastSpaceIdx + 1);
      if (!word) return;

      try {
        const cwd = stateRef.current.shellCwd.replace(/'/g, "'\\''");
        const raw = await execShell(
          environmentId,
          containerId,
          `cd '${cwd}' 2>/dev/null; compgen -f '${word.replace(/'/g, "'\\''")}' 2>/dev/null || ls -1p '${word.replace(/'/g, "'\\''")}' 2>/dev/null || true`,
        );
        const options = raw.split("\n").map((s) => s.trim()).filter(Boolean);
        if (options.length === 0) return;

        if (options.length === 1) {
          const beforeWord2 = lastSpaceIdx === -1 ? "" : prefix.slice(0, lastSpaceIdx + 1);
          const newBuf = beforeWord2 + options[0] + buf.slice(cur);
          const newCur = beforeWord2.length + options[0].length;
          setBuffer(newBuf, newCur);
          stateRef.current.tabComplete = null;
        } else {
          term.write("\r\n");
          const cols = term.cols;
          let line = "";
          for (const opt of options) {
            const piece = opt.padEnd(20).slice(0, 20) + "  ";
            if (line.length + piece.length > cols) {
              term.write("\x1b[90m" + line + "\x1b[0m\r\n");
              line = piece;
            } else {
              line += piece;
            }
          }
          if (line) term.write("\x1b[90m" + line + "\x1b[0m\r\n");
          stateRef.current.tabComplete = { prefix, options, cursor: 0 };
          term.write(buildPrompt());
          term.write(buf);
          const tail = buf.slice(cur);
          if (tail.length > 0) term.write(`\x1b[${tail.length}D`);
        }
      } catch {
        // silent
      }
    };

    // ── Fallback command runner ────────────────────────────────────────────
    const runFallbackCommand = async (rawCmd: string) => {
      const cmd = rawCmd.trim();

      // FIX: clear — write \r\n first so the prompt line ends, then clear
      if (cmd === "clear" || cmd === "cls") {
        term.write("\r\n");
        term.clear();
        writePrompt();
        return;
      }

      term.write("\r\n");
      if (!cmd) { writePrompt(); return; }

      if (stateRef.current.history[0] !== cmd) {
        stateRef.current.history.unshift(cmd);
        if (stateRef.current.history.length > 200) stateRef.current.history.pop();
      }
      stateRef.current.historyIdx = -1;
      stateRef.current.historySavedCurrent = "";

      if (stateRef.current.fallbackRunning) { writePrompt(); return; }
      stateRef.current.fallbackRunning = true;
      stateRef.current.tabComplete = null;

      try {
        const cwd = stateRef.current.shellCwd.replace(/'/g, "'\\''");
        const cols = term.cols;
        const rows = term.rows;

        if (cmd === "cd" || cmd.startsWith("cd ") || cmd.startsWith("cd\t")) {
          const target = (cmd.slice(2).trim() || "~").replace(/'/g, "'\\''");
          const newCwd = await execShell(
            environmentId,
            containerId,
            `cd '${cwd}' 2>/dev/null; cd '${target}' && pwd`,
          );
          const resolved = newCwd.trim();
          if (resolved.startsWith("/")) stateRef.current.shellCwd = resolved;
        } else {
          const SENTINEL = "__EINFRA_CWD__";
          const termEnv = `export COLUMNS=${cols} LINES=${rows} TERM=xterm-256color;`;
          const proxyLs = `ls() { command ls -C --color=auto "$@" 2>/dev/null || command ls -C "$@" 2>/dev/null || command ls "$@"; };`;
          const fullCmd = `${termEnv} ${proxyLs} cd '${cwd}' 2>/dev/null; ${cmd}; printf '\\n${SENTINEL}:%s' "$(pwd)"`;
          const raw = await execShell(environmentId, containerId, fullCmd);
          const idx = raw.lastIndexOf(`\n${SENTINEL}:`);
          let output = raw;
          if (idx !== -1) {
            const pwdPart = raw.slice(idx + SENTINEL.length + 2).trim();
            if (pwdPart.startsWith("/")) stateRef.current.shellCwd = pwdPart;
            output = raw.slice(0, idx);
          }
          if (output) {
            const normalized = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            term.write(normalized.replace(/\n/g, "\r\n"));
            if (!normalized.endsWith("\n") && normalized.length > 0) term.write("\r\n");
          }
        }
      } catch (err) {
        term.write(`\x1b[31m${err instanceof Error ? err.message : "error"}\x1b[0m\r\n`);
      } finally {
        stateRef.current.fallbackRunning = false;
        writePrompt();
      }
    };

    // ── Enable fallback mode ───────────────────────────────────────────────
    const enableFallbackMode = async (reason?: string) => {
      if (stateRef.current.fallbackMode) return;
      stateRef.current.fallbackMode = true;
      onStatusChange("fallback");
      onSessionUpdate({ fallbackMode: true, connectionStatus: "fallback" });
      term.writeln("");
      if (reason) term.writeln(`\x1b[33m${reason}\x1b[0m`);
      term.writeln(
        "\x1b[90mFallback command mode  ·  ↑↓ history  ·  Tab complete  ·  Ctrl+C cancel\x1b[0m",
      );
      try {
        const u = await execShell(environmentId, containerId, "id -un 2>/dev/null || whoami || echo root");
        const p = u.trim();
        if (p) stateRef.current.shellUser = p;
      } catch { /* default root */ }
      try {
        const p = await execShell(environmentId, containerId, "pwd");
        const parsed = p.trim();
        if (parsed.startsWith("/")) stateRef.current.shellCwd = parsed;
      } catch { /* default / */ }
      writePrompt();
    };

    // ── WebSocket setup ────────────────────────────────────────────────────
    term.writeln(
      `\x1b[90mConnecting to \x1b[0m\x1b[1m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})…\x1b[0m`,
    );
    onStatusChange("connecting");

    const socket = new WebSocket(
      buildApiWebSocketUrl(
        `/ws/terminal?runtime=docker&environment_id=${encodeURIComponent(environmentId)}&container_id=${encodeURIComponent(containerId)}`,
      ),
    );
    socket.binaryType = "arraybuffer";
    stateRef.current.socket = socket;
    onSessionUpdate({ socket });

    let established = false;
    let receivedOutput = false;

    const sendResize = () => {
      const d = safeProposeDimensions(host, fitAddon);
      if (socket.readyState === WebSocket.OPEN && d) {
        socket.send(JSON.stringify({ type: "resize", data: JSON.stringify({ cols: d.cols, rows: d.rows }) }));
      }
    };

    const connectionTimeout = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) void enableFallbackMode("Connection timed out.");
    }, 8000);

    let promptTimeout: ReturnType<typeof window.setTimeout> | null = null;

    socket.onopen = () => {
      established = true;
      onStatusChange("connected");
      onSessionUpdate({ connectionStatus: "connected" });
      window.clearTimeout(connectionTimeout);
      term.writeln("\x1b[32mInteractive shell connected.\x1b[0m");
      socket.send(JSON.stringify({ type: "input", data: "\n" }));
      sendResize();
    };

    socket.onmessage = (event: MessageEvent) => {
      established = true;
      onStatusChange("connected");
      if (typeof event.data !== "string") {
        if (!receivedOutput) {
          receivedOutput = true;
          if (promptTimeout !== null) window.clearTimeout(promptTimeout);
        }
        void new Response(event.data as ArrayBuffer).text().then((t) => term.write(t));
        return;
      }
      try {
        const msg = JSON.parse(String(event.data)) as { type?: string; message?: string; status?: string };
        if (msg.type === "error") { void enableFallbackMode(msg.message ?? "Session error"); return; }
        if (msg.type === "status" && msg.status === "connected") {
          if (msg.message) term.writeln(msg.message);
          return;
        }
        if (msg.type === "status" && msg.status === "closed") {
          onStatusChange("closed");
          onSessionUpdate({ connectionStatus: "closed" });
          term.writeln("\r\nSession closed.");
          return;
        }
      } catch {
        if (!receivedOutput) {
          receivedOutput = true;
          if (promptTimeout !== null) window.clearTimeout(promptTimeout);
        }
        term.write(String(event.data));
      }
    };

    socket.onerror = () => {
      window.clearTimeout(connectionTimeout);
      showNotif({
        type: "warning",
        message: "Docker terminal fallback",
        description: `WebSocket exec unavailable for ${containerName}. Switched to command mode.`,
      });
      void enableFallbackMode();
    };

    socket.onclose = () => {
      window.clearTimeout(connectionTimeout);
      if (!established) {
        void enableFallbackMode("Connection closed before shell was ready.");
        return;
      }
      if (!stateRef.current.fallbackMode) {
        onStatusChange("closed");
        onSessionUpdate({ connectionStatus: "closed" });
        term.writeln("\r\nSession closed.");
      }
    };

    promptTimeout = window.setTimeout(() => {
      if (!stateRef.current.fallbackMode && socket.readyState === WebSocket.OPEN && !receivedOutput) {
        showNotif({
          type: "warning",
          message: "Docker terminal fallback",
          description: `Shell did not respond for ${containerName}. Switched to command mode.`,
        });
        void enableFallbackMode("Shell did not emit output in time.");
      }
    }, 4000);

    // ── Clipboard shortcuts ────────────────────────────────────────────────
    term.attachCustomKeyEventHandler((event) => {
      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === "c" && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
        return false;
      }
      if (isMod && event.key.toLowerCase() === "v") {
        void navigator.clipboard?.readText().then((text) => {
          if (!text) return;
          if (stateRef.current.fallbackMode) {
            const cur = stateRef.current.fallbackCursor;
            const buf = stateRef.current.fallbackBuffer;
            stateRef.current.fallbackBuffer = buf.slice(0, cur) + text + buf.slice(cur);
            stateRef.current.fallbackCursor = cur + text.length;
            term.write(text.replace(/\n/g, "\r\n"));
            const tail = stateRef.current.fallbackBuffer.slice(stateRef.current.fallbackCursor);
            if (tail.length > 0) term.write(tail + `\x1b[${tail.length}D`);
          } else {
            socket.send(JSON.stringify({ type: "input", data: text }));
          }
        });
        return false;
      }
      return true;
    });

    // ── Input handler ──────────────────────────────────────────────────────
    const disposable = term.onData((data: string) => {
      if (stateRef.current.fallbackMode) {
        if (data !== "\t") stateRef.current.tabComplete = null;

        if (data === "\r") {
          const cmd = stateRef.current.fallbackBuffer;
          stateRef.current.fallbackBuffer = "";
          stateRef.current.fallbackCursor = 0;
          void runFallbackCommand(cmd);
          return;
        }
        if (data === "\t") { void handleTabComplete(); return; }

        // Backspace
        if (data === "\u007F") {
          const cur = stateRef.current.fallbackCursor;
          if (cur > 0) {
            const buf = stateRef.current.fallbackBuffer;
            stateRef.current.fallbackBuffer = buf.slice(0, cur - 1) + buf.slice(cur);
            stateRef.current.fallbackCursor = cur - 1;
            term.write("\b");
            const tail = stateRef.current.fallbackBuffer.slice(stateRef.current.fallbackCursor);
            term.write(tail + " ");
            if (tail.length + 1 > 0) term.write(`\x1b[${tail.length + 1}D`);
          }
          return;
        }
        // Delete
        if (data === "\x1b[3~") {
          const cur = stateRef.current.fallbackCursor;
          const buf = stateRef.current.fallbackBuffer;
          if (cur < buf.length) {
            stateRef.current.fallbackBuffer = buf.slice(0, cur) + buf.slice(cur + 1);
            const tail = stateRef.current.fallbackBuffer.slice(cur);
            term.write(tail + " ");
            if (tail.length + 1 > 0) term.write(`\x1b[${tail.length + 1}D`);
          }
          return;
        }
        // Arrow Left
        if (data === "\x1b[D") {
          if (stateRef.current.fallbackCursor > 0) {
            stateRef.current.fallbackCursor--;
            term.write("\x1b[D");
          }
          return;
        }
        // Arrow Right
        if (data === "\x1b[C") {
          if (stateRef.current.fallbackCursor < stateRef.current.fallbackBuffer.length) {
            stateRef.current.fallbackCursor++;
            term.write("\x1b[C");
          }
          return;
        }
        // Home / Ctrl+A
        if (data === "\x1b[H" || data === "\x01") {
          const n = stateRef.current.fallbackCursor;
          if (n > 0) { term.write(`\x1b[${n}D`); stateRef.current.fallbackCursor = 0; }
          return;
        }
        // End / Ctrl+E
        if (data === "\x1b[F" || data === "\x05") {
          const remaining = stateRef.current.fallbackBuffer.length - stateRef.current.fallbackCursor;
          if (remaining > 0) {
            term.write(`\x1b[${remaining}C`);
            stateRef.current.fallbackCursor = stateRef.current.fallbackBuffer.length;
          }
          return;
        }
        // Arrow Up — history prev
        if (data === "\x1b[A") {
          const hist = stateRef.current.history;
          if (hist.length === 0) return;
          if (stateRef.current.historyIdx === -1) {
            stateRef.current.historySavedCurrent = stateRef.current.fallbackBuffer;
          }
          const newIdx = Math.min(stateRef.current.historyIdx + 1, hist.length - 1);
          stateRef.current.historyIdx = newIdx;
          setBuffer(hist[newIdx], hist[newIdx].length);
          return;
        }
        // Arrow Down — history next
        if (data === "\x1b[B") {
          if (stateRef.current.historyIdx === -1) return;
          const newIdx = stateRef.current.historyIdx - 1;
          stateRef.current.historyIdx = newIdx;
          const text = newIdx === -1
            ? stateRef.current.historySavedCurrent
            : stateRef.current.history[newIdx];
          setBuffer(text, text.length);
          return;
        }
        // Ctrl+C
        if (data === "\u0003") {
          const buf = stateRef.current.fallbackBuffer;
          const cur = stateRef.current.fallbackCursor;
          const tail = buf.length - cur;
          if (tail > 0) term.write(`\x1b[${tail}C`);
          stateRef.current.fallbackBuffer = "";
          stateRef.current.fallbackCursor = 0;
          stateRef.current.historyIdx = -1;
          term.write("^C\r\n");
          writePrompt();
          return;
        }
        // Ctrl+U (clear left)
        if (data === "\u0015") {
          const cur = stateRef.current.fallbackCursor;
          if (cur === 0) return;
          term.write(`\x1b[${cur}D`);
          const tail = stateRef.current.fallbackBuffer.slice(cur);
          stateRef.current.fallbackBuffer = tail;
          stateRef.current.fallbackCursor = 0;
          term.write(tail + " ".repeat(cur));
          if (tail.length + cur > 0) term.write(`\x1b[${tail.length + cur}D`);
          return;
        }
        // Ctrl+K (clear right)
        if (data === "\u000B") {
          const cur = stateRef.current.fallbackCursor;
          const buf = stateRef.current.fallbackBuffer;
          const right = buf.length - cur;
          if (right === 0) return;
          term.write(" ".repeat(right) + `\x1b[${right}D`);
          stateRef.current.fallbackBuffer = buf.slice(0, cur);
          return;
        }
        // Ctrl+W (delete word left)
        if (data === "\u0017") {
          const cur = stateRef.current.fallbackCursor;
          const buf = stateRef.current.fallbackBuffer;
          const left = buf.slice(0, cur);
          const wordEnd = left.trimEnd().replace(/\S+$/, "");
          const removed = cur - wordEnd.length;
          if (removed === 0) return;
          const newBuf = wordEnd + buf.slice(cur);
          stateRef.current.fallbackBuffer = newBuf;
          stateRef.current.fallbackCursor = wordEnd.length;
          term.write(`\x1b[${removed}D`);
          const tail = newBuf.slice(wordEnd.length);
          term.write(tail + " ".repeat(removed));
          if (tail.length + removed > 0) term.write(`\x1b[${tail.length + removed}D`);
          return;
        }
        // Printable
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          const cur = stateRef.current.fallbackCursor;
          const buf = stateRef.current.fallbackBuffer;
          stateRef.current.fallbackBuffer = buf.slice(0, cur) + data + buf.slice(cur);
          stateRef.current.fallbackCursor = cur + 1;
          term.write(data);
          const tail = stateRef.current.fallbackBuffer.slice(stateRef.current.fallbackCursor);
          if (tail.length > 0) term.write(tail + `\x1b[${tail.length}D`);
        }
        return;
      }

      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "input", data }));
    });

    const handleResize = () => {
      safeFit(host, fitAddon);
      sendResize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposable.dispose();
      window.clearTimeout(connectionTimeout);
      if (promptTimeout !== null) window.clearTimeout(promptTimeout);
      window.removeEventListener("resize", handleResize);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close", data: "" }));
        socket.close();
      }
      term.dispose();
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="absolute inset-0"
      style={{ display: isActive ? "block" : "none", padding: "10px 12px" }}
    >
      <div ref={setDomRef} className="h-full w-full" />
    </div>
  );
}
