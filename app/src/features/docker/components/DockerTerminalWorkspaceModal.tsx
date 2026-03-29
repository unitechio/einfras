import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Maximize2,
  Minimize2,
  Plus,
  PlugZap,
  RotateCcw,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { apiFetch, buildApiWebSocketUrl } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DockerTerminalWorkspaceSession = {
  tabId: string;
  containerName: string;
  containerId: string;
  environmentId: string;
  sessionId?: string;
};

type DockerTerminalWorkspaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessions: DockerTerminalWorkspaceSession[];
  activeTabId: string;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onUpdateSession: (
    tabId: string,
    patch: Partial<DockerTerminalWorkspaceSession>,
  ) => void;
};

type ConnectionState =
  | "connecting"
  | "connected"
  | "closed"
  | "error"
  | "fallback";

// ─────────────────────────────────────────────────────────────────────────────
// Shell exec helpers
// ─────────────────────────────────────────────────────────────────────────────

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
        {
          method: "POST",
          body: JSON.stringify({ command: [...shell, command] }),
        },
      );
      return res.output ?? "";
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("exec failed");
    }
  }
  throw lastError ?? new Error("exec failed");
}

// ─────────────────────────────────────────────────────────────────────────────
// FitAddon helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Root modal component
// ─────────────────────────────────────────────────────────────────────────────

export default function DockerTerminalWorkspaceModal({
  isOpen,
  onClose,
  sessions,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onUpdateSession,
}: DockerTerminalWorkspaceModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Keyboard: Alt+← / Alt+→ to switch tabs
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const idx = sessions.findIndex((s) => s.tabId === activeTabId);
      if (e.key === "ArrowLeft" && idx > 0) {
        onActivateTab(sessions[idx - 1].tabId);
        e.preventDefault();
      }
      if (e.key === "ArrowRight" && idx < sessions.length - 1) {
        onActivateTab(sessions[idx + 1].tabId);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, sessions, activeTabId, onActivateTab]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.tabId === activeTabId) ?? sessions[0] ?? null,
    [activeTabId, sessions],
  );

  if (!isOpen || sessions.length === 0 || !activeSession) return null;

  const canScrollLeft = sessions.findIndex((s) => s.tabId === activeTabId) > 0;
  const canScrollRight =
    sessions.findIndex((s) => s.tabId === activeTabId) < sessions.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-300 border border-white/5 ${
          isMaximized
            ? "absolute inset-0 rounded-none"
            : "h-[82vh] w-full max-w-7xl rounded-2xl"
        }`}
        style={{ background: "linear-gradient(180deg, #0f0f12 0%, #0a0a0d 100%)" }}
      >
        {/* ── Titlebar ── */}
        <div className="flex items-center gap-0 border-b border-white/[0.06] bg-[#13131a] px-4 py-0 select-none">
          {/* brand */}
          <div className="flex items-center gap-2 py-3 pr-4 border-r border-white/[0.06]">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500/20">
              <TerminalIcon size={12} className="text-blue-400" />
            </div>
            <span className="font-mono text-xs font-semibold text-zinc-200 whitespace-nowrap">
              Runtime Workspace
            </span>
          </div>

          {/* tab scroll left */}
          <button
            onClick={() => {
              const idx = sessions.findIndex((s) => s.tabId === activeTabId);
              if (idx > 0) onActivateTab(sessions[idx - 1].tabId);
            }}
            disabled={!canScrollLeft}
            className="ml-2 p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>

          {/* tabs */}
          <div
            ref={tabsRef}
            className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar py-1.5 px-1"
            style={{ scrollbarWidth: "none" }}
          >
            {sessions.map((session) => {
              const isActive = session.tabId === activeSession.tabId;
              return (
                <div
                  key={session.tabId}
                  className={`group relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#1e1e2e] border border-blue-500/30 text-blue-100 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                      : "border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  {/* green dot for connected, amber for connecting */}
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      session.sessionId ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onActivateTab(session.tabId)}
                    className="max-w-[160px] truncate font-mono"
                    title={session.containerName}
                  >
                    {session.containerName}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(session.tabId);
                    }}
                    className={`ml-0.5 flex-shrink-0 rounded p-0.5 transition-opacity ${
                      isActive
                        ? "opacity-60 hover:opacity-100 hover:bg-white/10"
                        : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10"
                    }`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* scroll right */}
          <button
            onClick={() => {
              const idx = sessions.findIndex((s) => s.tabId === activeTabId);
              if (idx < sessions.length - 1) onActivateTab(sessions[idx + 1].tabId);
            }}
            disabled={!canScrollRight}
            className="mr-1 p-1 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={14} />
          </button>

          {/* window controls */}
          <div className="flex items-center gap-0.5 pl-3 border-l border-white/[0.06] py-2">
            <button
              onClick={() => setIsMaximized((v) => !v)}
              title={isMaximized ? "Restore" : "Maximize"}
              className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={onClose}
              title="Close workspace"
              className="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Terminal pane ── */}
        <div className="relative flex-1 min-h-0">
          <div key={activeSession.tabId} className="h-full w-full">
            <DockerTerminalPane
              session={activeSession}
              active
              onUpdateSession={(patch) =>
                onUpdateSession(activeSession.tabId, patch)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal pane
// ─────────────────────────────────────────────────────────────────────────────

function DockerTerminalPane({
  session,
  active,
  onUpdateSession,
}: {
  session: DockerTerminalWorkspaceSession;
  active: boolean;
  onUpdateSession: (patch: Partial<DockerTerminalWorkspaceSession>) => void;
}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("connecting");

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Fallback state
  const fallbackModeRef = useRef(false);
  const fallbackRunningRef = useRef(false);
  const fallbackBufferRef = useRef("");
  const fallbackCursorRef = useRef(0); // cursor position within buffer
  const shellCwdRef = useRef("/");
  const shellUserRef = useRef("root");

  // Command history (for ↑ / ↓ navigation)
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const historySavedCurrentRef = useRef(""); // saves in-progress input when browsing

  // Tab-complete state
  const tabCompleteRef = useRef<{ prefix: string; options: string[]; cursor: number } | null>(null);

  const { showNotification } = useNotification();
  const showNotifRef = useRef(showNotification);
  showNotifRef.current = showNotification;
  const onUpdateSessionRef = useRef(onUpdateSession);
  onUpdateSessionRef.current = onUpdateSession;

  // ── xterm init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!terminalRef.current) return;
    const host = terminalRef.current;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      lineHeight: 1.4,
      letterSpacing: 0,
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
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Clipboard shortcuts
    term.attachCustomKeyEventHandler((event) => {
      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === "c" && term.hasSelection()) {
        void navigator.clipboard?.writeText(term.getSelection());
        return false;
      }
      if (isMod && event.key.toLowerCase() === "v") {
        void navigator.clipboard?.readText().then((text) => {
          if (!text) return;
          if (fallbackModeRef.current) {
            // insert at cursor
            const buf = fallbackBufferRef.current;
            const cur = fallbackCursorRef.current;
            fallbackBufferRef.current = buf.slice(0, cur) + text + buf.slice(cur);
            fallbackCursorRef.current = cur + text.length;
            // redraw from cursor
            _redrawFromCursor(term);
          } else {
            socketRef.current?.send(JSON.stringify({ type: "input", data: text }));
          }
        });
        return false;
      }
      return true;
    });

    const resizeObserver = new ResizeObserver(() => safeFit(host, fitAddon));
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Focus when tab becomes active
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      safeFit(terminalRef.current, fitAddonRef.current);
      xtermRef.current?.focus();
      const d = safeProposeDimensions(terminalRef.current, fitAddonRef.current);
      if (socketRef.current?.readyState === WebSocket.OPEN && d) {
        socketRef.current.send(
          JSON.stringify({ type: "resize", data: JSON.stringify(d) }),
        );
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [active]);

  // ── Connection / session logic ─────────────────────────────────────────────
  useEffect(() => {
    const term = xtermRef.current;
    const host = terminalRef.current;
    if (!term || !host) return;

    let disposed = false;
    let established = false;
    let receivedOutput = false;

    // Reset fallback state on new connection
    fallbackModeRef.current = false;
    fallbackRunningRef.current = false;
    fallbackBufferRef.current = "";
    fallbackCursorRef.current = 0;
    shellCwdRef.current = "/";
    shellUserRef.current = "root";
    historyRef.current = [];
    historyIdxRef.current = -1;
    tabCompleteRef.current = null;

    const buildPrompt = () => {
      const id = session.containerId.substring(0, 12);
      const user = shellUserRef.current;
      const cwd = shellCwdRef.current;
      const sym = user === "root" ? "#" : "$";
      // color: user@container:cwd symbol
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
      fallbackBufferRef.current = "";
      fallbackCursorRef.current = 0;
      tabCompleteRef.current = null;
      term.write(buildPrompt());
    };

    const sendResize = () => {
      if (disposed) return;
      const d = safeProposeDimensions(terminalRef.current, fitAddonRef.current);
      if (socketRef.current?.readyState === WebSocket.OPEN && d) {
        socketRef.current.send(
          JSON.stringify({ type: "resize", data: JSON.stringify(d) }),
        );
      }
    };

    // ── Tab autocomplete ────────────────────────────────────────────────────
    const handleTabComplete = async () => {
      const buf = fallbackBufferRef.current;
      const cur = fallbackCursorRef.current;
      const prefix = buf.slice(0, cur);

      // Check if already cycling through cached options
      const tc = tabCompleteRef.current;
      if (tc && tc.prefix === prefix && tc.options.length > 0) {
        tc.cursor = (tc.cursor + 1) % tc.options.length;
        const chosen = tc.options[tc.cursor];
        // Replace last word in buffer
        const lastSpaceIdx = prefix.lastIndexOf(" ");
        const beforeWord = lastSpaceIdx === -1 ? "" : prefix.slice(0, lastSpaceIdx + 1);
        const newBuf = beforeWord + chosen + buf.slice(cur);
        const newCur = beforeWord.length + chosen.length;
        _setBuffer(term, newBuf, newCur);
        return;
      }

      // Determine word to complete
      const lastSpaceIdx = prefix.lastIndexOf(" ");
      const word = lastSpaceIdx === -1 ? prefix : prefix.slice(lastSpaceIdx + 1);
      if (!word) return;

      try {
        const cwd = shellCwdRef.current.replace(/'/g, "'\\''");
        const raw = await execShell(
          session.environmentId,
          session.containerId,
          `cd '${cwd}' 2>/dev/null; compgen -f '${word.replace(/'/g, "'\\''")}' 2>/dev/null || ls -1p '${word.replace(/'/g, "'\\''")}' 2>/dev/null || true`,
        );
        const options = raw
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        if (options.length === 0) return;

        if (options.length === 1) {
          const beforeWord2 = lastSpaceIdx === -1 ? "" : prefix.slice(0, lastSpaceIdx + 1);
          const newBuf = beforeWord2 + options[0] + buf.slice(cur);
          const newCur = beforeWord2.length + options[0].length;
          _setBuffer(term, newBuf, newCur);
          tabCompleteRef.current = null;
        } else {
          // Show suggestions below current line
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
          tabCompleteRef.current = { prefix, options, cursor: 0 };
          // Re-draw prompt + current buffer
          term.write(buildPrompt());
          term.write(buf);
          // Move cursor back if needed
          const tail = buf.slice(cur);
          if (tail.length > 0) {
            term.write(`\x1b[${tail.length}D`);
          }
        }
      } catch {
        // ignore tab complete errors
      }
    };

    // ── Fallback command runner ─────────────────────────────────────────────
    const runFallbackCommand = async (rawCmd: string) => {
      const cmd = rawCmd.trim();

      // Built-in: clear — must happen BEFORE the \r\n so no stray blank line
      if (cmd === "clear" || cmd === "cls") {
        term.clear();
        writePrompt();
        return;
      }

      term.write("\r\n");

      if (!cmd) {
        writePrompt();
        return;
      }

      // Push to history
      if (historyRef.current[0] !== cmd) {
        historyRef.current.unshift(cmd);
        if (historyRef.current.length > 200) historyRef.current.pop();
      }
      historyIdxRef.current = -1;
      historySavedCurrentRef.current = "";

      if (fallbackRunningRef.current) {
        writePrompt();
        return;
      }
      fallbackRunningRef.current = true;
      tabCompleteRef.current = null;

      try {
        const cwd = shellCwdRef.current.replace(/'/g, "'\\''");
        // Pass terminal dimensions so tools like ls format output in columns
        const termEnv = `COLUMNS=${term.cols} LINES=${term.rows}`;

        // Built-in: cd
        if (cmd === "cd" || cmd.startsWith("cd ") || cmd.startsWith("cd\t")) {
          const target = (cmd.slice(2).trim() || "~").replace(/'/g, "'\\''");
          const newCwd = await execShell(
            session.environmentId,
            session.containerId,
            `${termEnv} cd '${cwd}' 2>/dev/null; cd '${target}' && pwd`,
          );
          const resolved = newCwd.trim();
          if (resolved.startsWith("/")) shellCwdRef.current = resolved;
        } else {
          const SENTINEL = "__EINFRA_CWD__";
          const fullCmd = `${termEnv} cd '${cwd}' 2>/dev/null; ${cmd}; printf '\\n${SENTINEL}:%s' "$(pwd)"`;
          const raw = await execShell(session.environmentId, session.containerId, fullCmd);

          const idx = raw.lastIndexOf(`\n${SENTINEL}:`);
          let output = raw;
          if (idx !== -1) {
            const pwdPart = raw.slice(idx + SENTINEL.length + 2).trim();
            if (pwdPart.startsWith("/")) shellCwdRef.current = pwdPart;
            output = raw.slice(0, idx);
          }

          if (output) {
            const normalized = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            term.write(normalized.replace(/\n/g, "\r\n"));
            if (!normalized.endsWith("\n") && normalized.length > 0) term.write("\r\n");
          }
        }
      } catch (err) {
        term.write(
          `\x1b[31m${err instanceof Error ? err.message : "error"}\x1b[0m\r\n`,
        );
      } finally {
        fallbackRunningRef.current = false;
        writePrompt();
      }
    };

    // ── Enable fallback mode ────────────────────────────────────────────────
    const enableFallbackMode = async (reason?: string) => {
      if (disposed || fallbackModeRef.current) return;
      fallbackModeRef.current = true;
      established = true;
      setConnectionStatus("fallback");

      term.writeln("");
      if (reason) {
        term.writeln(`\x1b[33m${reason}\x1b[0m`);
      }
      term.writeln(
        "\x1b[90mFallback command mode  ·  ↑↓ history  ·  Tab complete  ·  Ctrl+C cancel\x1b[0m",
      );

      // Probe container
      try {
        const u = await execShell(
          session.environmentId,
          session.containerId,
          "id -un 2>/dev/null || whoami 2>/dev/null || echo root",
        );
        const p = u.trim();
        if (p) shellUserRef.current = p;
      } catch { /* noop */ }
      try {
        const p = await execShell(session.environmentId, session.containerId, "pwd");
        const parsed = p.trim();
        if (parsed.startsWith("/")) shellCwdRef.current = parsed;
      } catch { /* noop */ }

      writePrompt();
    };

    // ── WebSocket ─────────────────────────────────────────────────────────
    try {
      term.clear();
    } catch { /* noop */ }

    term.writeln(
      `\x1b[90mConnecting to \x1b[0m\x1b[1m${session.containerName}\x1b[0m \x1b[90m(${session.containerId.substring(0, 12)})…\x1b[0m`,
    );
    setConnectionStatus("connecting");

    const endpoint = `/ws/terminal?runtime=docker&environment_id=${encodeURIComponent(session.environmentId)}&container_id=${encodeURIComponent(session.containerId)}`;
    const socket = new WebSocket(buildApiWebSocketUrl(endpoint));
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    const connectionTimeout = window.setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        void enableFallbackMode("Connection timed out.");
      }
    }, 8000);

    let promptTimeout: ReturnType<typeof window.setTimeout> | null = null;

    socket.onopen = () => {
      if (disposed) return;
      established = true;
      setConnectionStatus("connected");
      window.clearTimeout(connectionTimeout);
      term.writeln("\x1b[32mInteractive shell connected.\x1b[0m");
      socket.send(JSON.stringify({ type: "input", data: "\n" }));
      sendResize();
    };

    socket.onmessage = (event) => {
      if (disposed) return;
      established = true;
      setConnectionStatus("connected");
      if (typeof event.data !== "string") {
        if (!receivedOutput) {
          receivedOutput = true;
          if (promptTimeout !== null) window.clearTimeout(promptTimeout);
        }
        void new Response(event.data as ArrayBuffer)
          .text()
          .then((t) => xtermRef.current?.write(t));
        return;
      }
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          message?: string;
          status?: string;
          session_id?: string;
        };
        if (msg.type === "error") {
          void enableFallbackMode(msg.message ?? "Session error");
          return;
        }
        if (msg.type === "status" && msg.status === "connected") {
          if (msg.message) term.writeln(msg.message);
          return;
        }
        if (msg.type === "status" && msg.status === "closed") {
          void enableFallbackMode(msg.message ?? "Session closed by backend.");
          return;
        }
        if (msg.session_id) {
          onUpdateSessionRef.current({ sessionId: msg.session_id });
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
      if (disposed) return;
      window.clearTimeout(connectionTimeout);
      showNotifRef.current({
        type: "warning",
        message: "Docker terminal fallback",
        description: `WebSocket exec unavailable for ${session.containerName}. Switched to command mode.`,
      });
      void enableFallbackMode();
    };

    socket.onclose = () => {
      if (disposed) return;
      window.clearTimeout(connectionTimeout);
      if (fallbackModeRef.current) {
        setConnectionStatus("fallback");
        return;
      }
      if (!established) {
        void enableFallbackMode("Connection closed before shell was ready.");
        return;
      }
      showNotifRef.current({
        type: "warning",
        message: "Docker terminal fallback",
        description: `Interactive session closed for ${session.containerName}. Switched to command mode.`,
      });
      void enableFallbackMode("Interactive session disconnected.");
    };

    promptTimeout = window.setTimeout(() => {
      if (disposed) return;
      if (!fallbackModeRef.current && socket.readyState === WebSocket.OPEN && !receivedOutput) {
        showNotifRef.current({
          type: "warning",
          message: "Docker terminal fallback",
          description: `Shell did not respond for ${session.containerName}. Switched to command mode.`,
        });
        void enableFallbackMode("Shell did not emit output in time.");
      }
    }, 4000);

    // ── Input handler ─────────────────────────────────────────────────────
    const disposable = term.onData((data) => {
      if (fallbackModeRef.current) {
        tabCompleteRef.current = null; // any key other than Tab resets tab cycle

        // ── Enter ──
        if (data === "\r") {
          const cmd = fallbackBufferRef.current;
          fallbackBufferRef.current = "";
          fallbackCursorRef.current = 0;
          void runFallbackCommand(cmd);
          return;
        }

        // ── Tab ──
        if (data === "\t") {
          void handleTabComplete();
          return;
        }

        // ── Backspace ──
        if (data === "\u007F") {
          const cur = fallbackCursorRef.current;
          if (cur > 0) {
            const buf = fallbackBufferRef.current;
            fallbackBufferRef.current = buf.slice(0, cur - 1) + buf.slice(cur);
            fallbackCursorRef.current = cur - 1;
            // Move cursor left, delete char, shift right portion left
            term.write("\b");
            const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
            term.write(tail + " ");
            if (tail.length + 1 > 0) term.write(`\x1b[${tail.length + 1}D`);
          }
          return;
        }

        // ── Delete (forward) ──
        if (data === "\x1b[3~") {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          if (cur < buf.length) {
            fallbackBufferRef.current = buf.slice(0, cur) + buf.slice(cur + 1);
            const tail = fallbackBufferRef.current.slice(cur);
            term.write(tail + " ");
            if (tail.length + 1 > 0) term.write(`\x1b[${tail.length + 1}D`);
          }
          return;
        }

        // ── Arrow Left ──
        if (data === "\x1b[D") {
          if (fallbackCursorRef.current > 0) {
            fallbackCursorRef.current--;
            term.write("\x1b[D");
          }
          return;
        }

        // ── Arrow Right ──
        if (data === "\x1b[C") {
          if (fallbackCursorRef.current < fallbackBufferRef.current.length) {
            fallbackCursorRef.current++;
            term.write("\x1b[C");
          }
          return;
        }

        // ── Home / Ctrl+A ──
        if (data === "\x1b[H" || data === "\x01") {
          const n = fallbackCursorRef.current;
          if (n > 0) {
            term.write(`\x1b[${n}D`);
            fallbackCursorRef.current = 0;
          }
          return;
        }

        // ── End / Ctrl+E ──
        if (data === "\x1b[F" || data === "\x05") {
          const remaining = fallbackBufferRef.current.length - fallbackCursorRef.current;
          if (remaining > 0) {
            term.write(`\x1b[${remaining}C`);
            fallbackCursorRef.current = fallbackBufferRef.current.length;
          }
          return;
        }

        // ── Arrow Up (history prev) ──
        if (data === "\x1b[A") {
          const hist = historyRef.current;
          if (hist.length === 0) return;
          if (historyIdxRef.current === -1) {
            historySavedCurrentRef.current = fallbackBufferRef.current;
          }
          const newIdx = Math.min(historyIdxRef.current + 1, hist.length - 1);
          historyIdxRef.current = newIdx;
          _setBuffer(term, hist[newIdx], hist[newIdx].length);
          return;
        }

        // ── Arrow Down (history next) ──
        if (data === "\x1b[B") {
          if (historyIdxRef.current === -1) return;
          const newIdx = historyIdxRef.current - 1;
          historyIdxRef.current = newIdx;
          const text = newIdx === -1 ? historySavedCurrentRef.current : historyRef.current[newIdx];
          _setBuffer(term, text, text.length);
          return;
        }

        // ── Ctrl+C ──
        if (data === "\u0003") {
          const buf = fallbackBufferRef.current;
          const cur = fallbackCursorRef.current;
          // move cursor to end first
          const tail = buf.length - cur;
          if (tail > 0) term.write(`\x1b[${tail}C`);
          fallbackBufferRef.current = "";
          fallbackCursorRef.current = 0;
          historyIdxRef.current = -1;
          term.write("^C\r\n");
          writePrompt();
          return;
        }

        // ── Ctrl+U (clear left) ──
        if (data === "\u0015") {
          const cur = fallbackCursorRef.current;
          if (cur === 0) return;
          term.write(`\x1b[${cur}D`);
          const tail = fallbackBufferRef.current.slice(cur);
          fallbackBufferRef.current = tail;
          fallbackCursorRef.current = 0;
          term.write(tail + " ".repeat(cur));
          if (tail.length + cur > 0) term.write(`\x1b[${tail.length + cur}D`);
          return;
        }

        // ── Ctrl+K (clear right) ──
        if (data === "\u000B") {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          const right = buf.length - cur;
          if (right === 0) return;
          term.write(" ".repeat(right) + `\x1b[${right}D`);
          fallbackBufferRef.current = buf.slice(0, cur);
          return;
        }

        // ── Ctrl+W (delete word left) ──
        if (data === "\u0017") {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          const left = buf.slice(0, cur);
          const trimmed = left.trimEnd();
          const wordEnd = trimmed.replace(/\S+$/, "");
          const removed = cur - wordEnd.length;
          if (removed === 0) return;
          const newBuf = wordEnd + buf.slice(cur);
          fallbackBufferRef.current = newBuf;
          fallbackCursorRef.current = wordEnd.length;
          term.write(`\x1b[${removed}D`);
          const tail = newBuf.slice(wordEnd.length);
          term.write(tail + " ".repeat(removed));
          if (tail.length + removed > 0) term.write(`\x1b[${tail.length + removed}D`);
          return;
        }

        // ── Printable characters: insert at cursor ──
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          fallbackBufferRef.current = buf.slice(0, cur) + data + buf.slice(cur);
          fallbackCursorRef.current = cur + 1;
          term.write(data);
          const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
          if (tail.length > 0) {
            term.write(tail + `\x1b[${tail.length}D`);
          }
        }
        return;
      }

      // ── Interactive pass-through ──
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "input", data }));
    });

    const handleWindowResize = () => {
      safeFit(host, fitAddonRef.current);
      sendResize();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      disposed = true;
      window.clearTimeout(connectionTimeout);
      if (promptTimeout !== null) window.clearTimeout(promptTimeout);
      window.removeEventListener("resize", handleWindowResize);
      disposable.dispose();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close", data: "" }));
        socket.close();
      }
      socketRef.current = null;
      fallbackModeRef.current = false;
      fallbackRunningRef.current = false;
      fallbackBufferRef.current = "";
      fallbackCursorRef.current = 0;
    };
  }, [session.containerId, session.containerName, session.environmentId]);

  // ── Helpers for buffer manipulation ───────────────────────────────────────
  /** Replace current line buffer and move cursor */
  function _setBuffer(term: Terminal, newBuf: string, newCur: number) {
    const oldBuf = fallbackBufferRef.current;
    const oldCur = fallbackCursorRef.current;
    // Move to start of old buffer
    if (oldCur > 0) term.write(`\x1b[${oldCur}D`);
    // Over-write with new buffer + erase remainder
    term.write(newBuf);
    const overflow = oldBuf.length - newBuf.length;
    if (overflow > 0) term.write(" ".repeat(overflow) + `\x1b[${overflow}D`);
    // Move cursor if not at end
    const tailLen = newBuf.length - newCur;
    if (tailLen > 0) term.write(`\x1b[${tailLen}D`);
    fallbackBufferRef.current = newBuf;
    fallbackCursorRef.current = newCur;
  }

  /** Redraw from cursor to end of buffer (used after paste-at-cursor) */
  function _redrawFromCursor(term: Terminal) {
    const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
    term.write(tail);
  }

  // ── Clipboard actions ──────────────────────────────────────────────────────
  const copySelection = async () => {
    const sel = xtermRef.current?.getSelection() || "";
    if (sel) await navigator.clipboard?.writeText(sel);
  };

  const pasteClipboard = async () => {
    const text = await navigator.clipboard?.readText();
    if (!text) return;
    if (fallbackModeRef.current) {
      const term = xtermRef.current;
      if (!term) return;
      const cur = fallbackCursorRef.current;
      const buf = fallbackBufferRef.current;
      fallbackBufferRef.current = buf.slice(0, cur) + text + buf.slice(cur);
      fallbackCursorRef.current = cur + text.length;
      term.write(text.replace(/\n/g, "\r\n"));
      const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
      if (tail.length > 0) term.write(tail + `\x1b[${tail.length}D`);
    } else {
      socketRef.current?.send(JSON.stringify({ type: "input", data: text }));
    }
  };

  const reconnect = () => {
    // Trigger re-render which re-mounts the session effect
    setConnectionStatus("connecting");
    xtermRef.current?.clear();
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusConfig = {
    connected: { dot: "bg-emerald-400", label: "live", text: "text-emerald-400" },
    connecting: { dot: "bg-amber-400 animate-pulse", label: "connecting", text: "text-amber-400" },
    fallback: { dot: "bg-blue-400", label: "cmd mode", text: "text-blue-400" },
    error: { dot: "bg-red-400", label: "error", text: "text-red-400" },
    closed: { dot: "bg-zinc-500", label: "closed", text: "text-zinc-400" },
  }[connectionStatus];

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* ── Pane toolbar ── */}
      <div className="flex items-center gap-2 justify-between border-b border-white/[0.05] bg-[#111118] px-4 py-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </div>
          <span className="text-zinc-700">·</span>
          <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[200px]" title={session.containerId}>
            {session.containerId.substring(0, 12)}
          </span>
          {connectionStatus === "fallback" && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {shellUserRef.current}@{shellCwdRef.current}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void copySelection()}
            className="rounded-md border border-white/5 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
            title="Copy selection (Ctrl+C)"
          >
            <ClipboardCopy className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => void pasteClipboard()}
            className="rounded-md border border-white/5 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
            title="Paste (Ctrl+V)"
          >
            <ClipboardPaste className="h-3 w-3" />
          </button>
          {(connectionStatus === "closed" || connectionStatus === "error") && (
            <button
              type="button"
              onClick={reconnect}
              className="rounded-md border border-amber-500/20 bg-amber-500/5 p-1.5 text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Reconnect"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── xterm canvas ── */}
      <div className="flex-1 min-h-0 bg-[#0a0a0d]" style={{ padding: "10px 12px" }}>
        <div ref={terminalRef} className="h-full w-full" />
      </div>

      {/* ── Bottom status bar ── */}
      <div className="flex items-center justify-between border-t border-white/[0.04] bg-[#0d0d12] px-4 py-1 select-none">
        <span className="font-mono text-[10px] text-zinc-600">
          {session.containerName}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-zinc-700">
          <span>↑↓ history</span>
          <span>Tab complete</span>
          <span>Ctrl+C cancel</span>
          {connectionStatus === "fallback" && <span>Ctrl+U clear line</span>}
        </div>
      </div>
    </div>
  );
}
