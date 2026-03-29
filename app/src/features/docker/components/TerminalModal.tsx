import { useEffect, useRef, useState } from "react";
import {
  ClipboardCopy,
  ClipboardPaste,
  Maximize2,
  Minimize2,
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("connecting");

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Fallback shell state
  const fallbackModeRef = useRef(false);
  const fallbackRunningRef = useRef(false);
  const fallbackBufferRef = useRef(""); // current line input
  const fallbackCursorRef = useRef(0);   // cursor offset within buffer
  const shellCwdRef = useRef("/");
  const shellUserRef = useRef("root");

  // History
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const historySavedCurrentRef = useRef("");

  // Tab-complete
  const tabCompleteRef = useRef<{
    prefix: string;
    options: string[];
    cursor: number;
  } | null>(null);

  // Session guard
  const sessionKeyRef = useRef("");

  const { showNotification } = useNotification();
  const showNotifRef = useRef(showNotification);
  showNotifRef.current = showNotification;

  // ── xterm init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;
    if (xtermRef.current) return;

    const sessionKey = `${containerId}::${environmentId}`;
    sessionKeyRef.current = sessionKey;

    const host = terminalRef.current;

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
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Reset state
    Object.assign(fallbackModeRef, { current: false });
    fallbackRunningRef.current = false;
    fallbackBufferRef.current = "";
    fallbackCursorRef.current = 0;
    shellCwdRef.current = "/";
    shellUserRef.current = "root";
    historyRef.current = [];
    historyIdxRef.current = -1;
    tabCompleteRef.current = null;

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
        });
        return false;
      }
      return true;
    });

    // ── Prompt builder ─────────────────────────────────────────────────────
    const buildPrompt = () => {
      const id = containerId.substring(0, 12);
      const user = shellUserRef.current;
      const cwd = shellCwdRef.current;
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
      fallbackBufferRef.current = "";
      fallbackCursorRef.current = 0;
      tabCompleteRef.current = null;
      term.write(buildPrompt());
    };

    // ── Tab autocomplete ───────────────────────────────────────────────────
    const handleTabComplete = async () => {
      const buf = fallbackBufferRef.current;
      const cur = fallbackCursorRef.current;
      const prefix = buf.slice(0, cur);

      const tc = tabCompleteRef.current;
      if (tc && tc.prefix === prefix && tc.options.length > 0) {
        tc.cursor = (tc.cursor + 1) % tc.options.length;
        const chosen = tc.options[tc.cursor];
        const lastSpaceIdx = prefix.lastIndexOf(" ");
        const beforeWord = lastSpaceIdx === -1 ? "" : prefix.slice(0, lastSpaceIdx + 1);
        const newBuf = beforeWord + chosen + buf.slice(cur);
        const newCur = beforeWord.length + chosen.length;
        _setBuffer(term, newBuf, newCur);
        return;
      }

      const lastSpaceIdx = prefix.lastIndexOf(" ");
      const word = lastSpaceIdx === -1 ? prefix : prefix.slice(lastSpaceIdx + 1);
      if (!word) return;

      try {
        const cwd = shellCwdRef.current.replace(/'/g, "'\\''");
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
          _setBuffer(term, newBuf, newCur);
          tabCompleteRef.current = null;
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
          tabCompleteRef.current = { prefix, options, cursor: 0 };
          term.write(buildPrompt());
          term.write(buf);
          const tail = buf.slice(cur);
          if (tail.length > 0) term.write(`\x1b[${tail.length}D`);
        }
      } catch {
        // silent
      }
    };

    // ── Helper: replace current line buffer ───────────────────────────────
    const _setBuffer = (term: Terminal, newBuf: string, newCur: number) => {
      const oldBuf = fallbackBufferRef.current;
      const oldCur = fallbackCursorRef.current;
      if (oldCur > 0) term.write(`\x1b[${oldCur}D`);
      term.write(newBuf);
      const overflow = oldBuf.length - newBuf.length;
      if (overflow > 0) term.write(" ".repeat(overflow) + `\x1b[${overflow}D`);
      const tailLen = newBuf.length - newCur;
      if (tailLen > 0) term.write(`\x1b[${tailLen}D`);
      fallbackBufferRef.current = newBuf;
      fallbackCursorRef.current = newCur;
    };

    // ── Fallback command runner ────────────────────────────────────────────
    const runFallbackCommand = async (rawCmd: string) => {
      const cmd = rawCmd.trim();

      // Built-in: clear — must happen BEFORE \r\n to avoid stray blank line
      if (cmd === "clear" || cmd === "cls") {
        term.clear();
        writePrompt();
        return;
      }

      term.write("\r\n");
      if (!cmd) { writePrompt(); return; }

      if (historyRef.current[0] !== cmd) {
        historyRef.current.unshift(cmd);
        if (historyRef.current.length > 200) historyRef.current.pop();
      }
      historyIdxRef.current = -1;
      historySavedCurrentRef.current = "";

      if (fallbackRunningRef.current) { writePrompt(); return; }
      fallbackRunningRef.current = true;
      tabCompleteRef.current = null;

      try {
        const cwd = shellCwdRef.current.replace(/'/g, "'\\''");
        // Pass terminal dimensions so ls/other tools format output in columns
        const termEnv = `COLUMNS=${term.cols} LINES=${term.rows}`;

        if (cmd === "cd" || cmd.startsWith("cd ") || cmd.startsWith("cd\t")) {
          const target = (cmd.slice(2).trim() || "~").replace(/'/g, "'\\''");
          const newCwd = await execShell(
            environmentId,
            containerId,
            `${termEnv} cd '${cwd}' 2>/dev/null; cd '${target}' && pwd`,
          );
          const resolved = newCwd.trim();
          if (resolved.startsWith("/")) shellCwdRef.current = resolved;
        } else {
          const SENTINEL = "__EINFRA_CWD__";
          const fullCmd = `${termEnv} cd '${cwd}' 2>/dev/null; ${cmd}; printf '\\n${SENTINEL}:%s' "$(pwd)"`;
          const raw = await execShell(environmentId, containerId, fullCmd);
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
        term.write(`\x1b[31m${err instanceof Error ? err.message : "error"}\x1b[0m\r\n`);
      } finally {
        fallbackRunningRef.current = false;
        writePrompt();
      }
    };

    // ── Enable fallback mode ───────────────────────────────────────────────
    const enableFallbackMode = async (reason?: string) => {
      if (fallbackModeRef.current) return;
      fallbackModeRef.current = true;
      setConnectionStatus("fallback");
      term.writeln("");
      if (reason) term.writeln(`\x1b[33m${reason}\x1b[0m`);
      term.writeln(
        "\x1b[90mFallback command mode  ·  ↑↓ history  ·  Tab complete  ·  Ctrl+C cancel\x1b[0m",
      );
      try {
        const u = await execShell(environmentId, containerId, "id -un 2>/dev/null || whoami || echo root");
        const p = u.trim();
        if (p) shellUserRef.current = p;
      } catch { /* default root */ }
      try {
        const p = await execShell(environmentId, containerId, "pwd");
        const parsed = p.trim();
        if (parsed.startsWith("/")) shellCwdRef.current = parsed;
      } catch { /* default / */ }
      writePrompt();
    };

    // ── WebSocket setup ────────────────────────────────────────────────────
    term.writeln(
      `\x1b[90mConnecting to \x1b[0m\x1b[1m${containerName}\x1b[0m \x1b[90m(${containerId.substring(0, 12)})…\x1b[0m`,
    );
    setConnectionStatus("connecting");

    const socket = new WebSocket(
      buildApiWebSocketUrl(
        `/ws/terminal?runtime=docker&environment_id=${encodeURIComponent(environmentId)}&container_id=${encodeURIComponent(containerId)}`,
      ),
    );
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    let established = false;
    let receivedOutput = false;

    const sendResize = () => {
      const d = safeProposeDimensions(terminalRef.current, fitAddon);
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
      setConnectionStatus("connected");
      window.clearTimeout(connectionTimeout);
      term.writeln("\x1b[32mInteractive shell connected.\x1b[0m");
      socket.send(JSON.stringify({ type: "input", data: "\n" }));
      sendResize();
    };

    socket.onmessage = (event: MessageEvent) => {
      established = true;
      setConnectionStatus("connected");
      if (typeof event.data !== "string") {
        if (!receivedOutput) {
          receivedOutput = true;
          if (promptTimeout !== null) window.clearTimeout(promptTimeout);
        }
        void new Response(event.data as ArrayBuffer).text().then((t) => xtermRef.current?.write(t));
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
          setConnectionStatus((c) => (c === "fallback" ? c : "closed"));
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
      showNotifRef.current({
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
      setConnectionStatus((c) => (c === "fallback" || c === "error" ? c : "closed"));
      if (!fallbackModeRef.current) term.writeln("\r\nSession closed.");
    };

    promptTimeout = window.setTimeout(() => {
      if (!fallbackModeRef.current && socket.readyState === WebSocket.OPEN && !receivedOutput) {
        showNotifRef.current({
          type: "warning",
          message: "Docker terminal fallback",
          description: `Shell did not respond for ${containerName}. Switched to command mode.`,
        });
        void enableFallbackMode("Shell did not emit output in time.");
      }
    }, 4000);

    // ── Input handler ──────────────────────────────────────────────────────
    const disposable = term.onData((data: string) => {
      if (fallbackModeRef.current) {
        // Any key except Tab resets tab complete cycling
        if (data !== "\t") tabCompleteRef.current = null;

        if (data === "\r") {
          const cmd = fallbackBufferRef.current;
          fallbackBufferRef.current = "";
          fallbackCursorRef.current = 0;
          void runFallbackCommand(cmd);
          return;
        }
        if (data === "\t") { void handleTabComplete(); return; }

        // Backspace
        if (data === "\u007F") {
          const cur = fallbackCursorRef.current;
          if (cur > 0) {
            const buf = fallbackBufferRef.current;
            fallbackBufferRef.current = buf.slice(0, cur - 1) + buf.slice(cur);
            fallbackCursorRef.current = cur - 1;
            term.write("\b");
            const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
            term.write(tail + " ");
            if (tail.length + 1 > 0) term.write(`\x1b[${tail.length + 1}D`);
          }
          return;
        }
        // Delete
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
        // Arrow Left
        if (data === "\x1b[D") {
          if (fallbackCursorRef.current > 0) { fallbackCursorRef.current--; term.write("\x1b[D"); }
          return;
        }
        // Arrow Right
        if (data === "\x1b[C") {
          if (fallbackCursorRef.current < fallbackBufferRef.current.length) { fallbackCursorRef.current++; term.write("\x1b[C"); }
          return;
        }
        // Home / Ctrl+A
        if (data === "\x1b[H" || data === "\x01") {
          const n = fallbackCursorRef.current;
          if (n > 0) { term.write(`\x1b[${n}D`); fallbackCursorRef.current = 0; }
          return;
        }
        // End / Ctrl+E
        if (data === "\x1b[F" || data === "\x05") {
          const remaining = fallbackBufferRef.current.length - fallbackCursorRef.current;
          if (remaining > 0) { term.write(`\x1b[${remaining}C`); fallbackCursorRef.current = fallbackBufferRef.current.length; }
          return;
        }
        // Arrow Up (history prev)
        if (data === "\x1b[A") {
          const hist = historyRef.current;
          if (hist.length === 0) return;
          if (historyIdxRef.current === -1) historySavedCurrentRef.current = fallbackBufferRef.current;
          const newIdx = Math.min(historyIdxRef.current + 1, hist.length - 1);
          historyIdxRef.current = newIdx;
          _setBuffer(term, hist[newIdx], hist[newIdx].length);
          return;
        }
        // Arrow Down (history next)
        if (data === "\x1b[B") {
          if (historyIdxRef.current === -1) return;
          const newIdx = historyIdxRef.current - 1;
          historyIdxRef.current = newIdx;
          const text = newIdx === -1 ? historySavedCurrentRef.current : historyRef.current[newIdx];
          _setBuffer(term, text, text.length);
          return;
        }
        // Ctrl+C
        if (data === "\u0003") {
          const buf = fallbackBufferRef.current;
          const cur = fallbackCursorRef.current;
          const tail = buf.length - cur;
          if (tail > 0) term.write(`\x1b[${tail}C`);
          fallbackBufferRef.current = "";
          fallbackCursorRef.current = 0;
          historyIdxRef.current = -1;
          term.write("^C\r\n");
          writePrompt();
          return;
        }
        // Ctrl+U (clear left)
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
        // Ctrl+K (clear right)
        if (data === "\u000B") {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          const right = buf.length - cur;
          if (right === 0) return;
          term.write(" ".repeat(right) + `\x1b[${right}D`);
          fallbackBufferRef.current = buf.slice(0, cur);
          return;
        }
        // Ctrl+W (delete word left)
        if (data === "\u0017") {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          const left = buf.slice(0, cur);
          const wordEnd = left.trimEnd().replace(/\S+$/, "");
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
        // Printable
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          const cur = fallbackCursorRef.current;
          const buf = fallbackBufferRef.current;
          fallbackBufferRef.current = buf.slice(0, cur) + data + buf.slice(cur);
          fallbackCursorRef.current = cur + 1;
          term.write(data);
          const tail = fallbackBufferRef.current.slice(fallbackCursorRef.current);
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
    document.body.style.overflow = "hidden";

    return () => {
      if (sessionKeyRef.current !== sessionKey) return;
      disposable.dispose();
      window.clearTimeout(connectionTimeout);
      if (promptTimeout !== null) window.clearTimeout(promptTimeout);
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = "unset";
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close", data: "" }));
        socket.close();
      }
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
      fallbackModeRef.current = false;
      fallbackRunningRef.current = false;
      fallbackBufferRef.current = "";
      fallbackCursorRef.current = 0;
    };
  }, [containerId, containerName, environmentId, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) document.body.style.overflow = "unset";
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      safeFit(terminalRef.current, fitAddonRef.current);
      const d = safeProposeDimensions(terminalRef.current, fitAddonRef.current);
      if (socketRef.current?.readyState === WebSocket.OPEN && d) {
        socketRef.current.send(
          JSON.stringify({ type: "resize", data: JSON.stringify({ cols: d.cols, rows: d.rows }) }),
        );
      }
      xtermRef.current?.focus();
    }, 200);
    return () => window.clearTimeout(t);
  }, [isMaximized, isOpen]);

  if (!isOpen) return null;

  const statusConfig = {
    connected: { dot: "bg-emerald-400", label: "live", text: "text-emerald-400" },
    connecting: { dot: "bg-amber-400 animate-pulse", label: "connecting", text: "text-amber-400" },
    fallback: { dot: "bg-blue-400", label: "cmd mode", text: "text-blue-400" },
    error: { dot: "bg-red-400", label: "error", text: "text-red-400" },
    closed: { dot: "bg-zinc-500", label: "closed", text: "text-zinc-400" },
  }[connectionStatus];

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-300 border border-white/5 ${
          isMaximized
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
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 border shrink-0 ${
              connectionStatus === "connected" ? "border-emerald-500/20 bg-emerald-500/5" :
              connectionStatus === "connecting" ? "border-amber-500/20 bg-amber-500/5" :
              connectionStatus === "fallback" ? "border-blue-500/20 bg-blue-500/5" :
              "border-zinc-700 bg-zinc-800/50"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void copySelection()}
              className="rounded-md border border-white/5 bg-white/[0.03] p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/8 transition-colors"
              title="Copy selection"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void pasteClipboard()}
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

        {/* ── xterm canvas ── */}
        <div className="flex-1 min-h-0 bg-[#0a0a0d]" style={{ padding: "10px 12px" }}>
          <div ref={terminalRef} className="h-full w-full" />
        </div>

        {/* ── Bottom status bar ── */}
        <div className="flex items-center justify-between border-t border-white/[0.04] bg-[#0d0d12] px-4 py-1 select-none">
          <div className="flex items-center gap-1.5">
            <PlugZap className="h-3 w-3 text-zinc-700" />
            <span className="font-mono text-[10px] text-zinc-600">
              {containerId.substring(0, 12)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-700">
            <span>↑↓ history</span>
            <span>Tab complete</span>
            <span>Ctrl+C cancel</span>
            <span>Ctrl+A/E line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
