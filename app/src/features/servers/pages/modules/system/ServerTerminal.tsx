import { Clock3, Maximize2, Minimize2, Play, RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useNotification } from "@/core/NotificationContext";
import { terminalApi } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";

type TerminalEntry =
  | { type: "system"; text: string }
  | { type: "command"; text: string }
  | { type: "output"; text: string }
  | { type: "error"; text: string };

export default function ServerTerminal() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<number>(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [command, setCommand] = useState("uname -a");
  const [running, setRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [history, setHistory] = useState<string[]>(["uname -a", "hostnamectl", "systemctl --failed"]);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    { type: "system", text: "Connected to the real backend terminal execution flow." },
    { type: "system", text: "Use Enter to run, ArrowUp/ArrowDown for command history, or click a preset." },
  ]);

  const presets = useMemo(
    () => ["uname -a", "hostnamectl", "df -h", "free -m", "systemctl --failed", "ip -brief address", "docker ps", "kubectl get nodes"],
    [],
  );

  const appendEntries = (...next: TerminalEntry[]) => {
    setEntries((current) => [...current, ...next]);
  };

  useEffect(() => {
    if (!autoScroll) return;
    outputRef.current?.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries, autoScroll]);

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const runCommand = async (explicit?: string) => {
    const nextCommand = (explicit ?? command).trim();
    if (!serverId || !nextCommand) return;
    setRunning(true);
    appendEntries({ type: "command", text: nextCommand });
    try {
      const response = await terminalApi.exec(serverId, {
        command: nextCommand,
        timeout_sec: 30,
      });
      const text =
        typeof response.raw_output === "string" && response.raw_output.trim()
          ? response.raw_output.trim()
          : "Command completed with no visible output.";
      appendEntries({ type: "output", text });
      setHistory((prev) => [nextCommand, ...prev.filter((item) => item !== nextCommand)].slice(0, 20));
      historyRef.current = -1;
      setCommand("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed.";
      appendEntries({ type: "error", text: message });
      showNotification({
        type: "error",
        message: "Terminal command failed",
        description: message,
      });
    } finally {
      setRunning(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const navigateHistory = (direction: "up" | "down") => {
    if (history.length === 0) return;
    if (direction === "up") {
      historyRef.current = Math.min(historyRef.current + 1, history.length - 1);
    } else {
      historyRef.current = Math.max(historyRef.current - 1, -1);
    }

    if (historyRef.current === -1) {
      setCommand("");
      return;
    }
    setCommand(history[historyRef.current] ?? "");
  };

  const scrollToBottom = () => {
    outputRef.current?.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: "smooth",
    });
    setAutoScroll(true);
  };

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-[#09090b] text-zinc-100 shadow-xl transition-all duration-300 dark:border-zinc-800 ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "h-[680px] w-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-white px-4 py-3 dark:bg-[#121212]">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full border border-red-500/50 bg-red-500/20 shadow-inner" />
            <div className="h-3 w-3 rounded-full border border-yellow-500/50 bg-yellow-500/20 shadow-inner" />
            <div className="h-3 w-3 rounded-full border border-emerald-500/50 bg-emerald-500/20 shadow-inner" />
          </div>
          <div className="mx-2 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            <TerminalIcon size={12} />
            <span>interactive command session</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${running ? "bg-yellow-900/30 text-yellow-400" : "bg-green-900/30 text-green-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-yellow-400" : "bg-green-500"}`} />
            {running ? "running" : "ready"}
          </span>
          <button
            onClick={() => setEntries([{ type: "system", text: "Terminal cleared. Session is still connected." }])}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={scrollToBottom}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white"
            title="Scroll to latest output"
          >
            <TerminalIcon size={14} />
          </button>
          <button
            onClick={() => setIsFullscreen((current) => !current)}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setCommand(preset);
                inputRef.current?.focus();
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                command === preset
                  ? "border-blue-500 bg-blue-500/15 text-blue-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="text-xs text-zinc-500">
          Tip: Enter to run, ArrowUp / ArrowDown for history, and use presets for common inspection commands.
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          <div
            ref={outputRef}
            className="flex-1 overflow-auto overscroll-contain p-4 font-mono text-xs"
            onClick={() => inputRef.current?.focus()}
            onScroll={() => {
              const node = outputRef.current;
              if (!node) return;
              const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
              setAutoScroll(nearBottom);
            }}
          >
            {entries.map((entry, index) => (
              <div key={`${entry.type}-${index}`} className="mb-2">
                {entry.type === "command" ? (
                  <div className="text-cyan-300">
                    <span className="mr-2 text-emerald-400">$</span>
                    {entry.text}
                  </div>
                ) : entry.type === "error" ? (
                  <div className="whitespace-pre-wrap text-red-300">{entry.text}</div>
                ) : entry.type === "system" ? (
                  <div className="whitespace-pre-wrap text-zinc-500">{entry.text}</div>
                ) : (
                  <div className="whitespace-pre-wrap text-zinc-200">{entry.text}</div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-black/40 px-3 py-2">
              <span className="font-mono text-sm text-emerald-400">$</span>
              <input
                ref={inputRef}
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void runCommand();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    navigateHistory("up");
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    navigateHistory("down");
                  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
                    event.preventDefault();
                    setEntries([{ type: "system", text: "Terminal cleared. Session is still connected." }]);
                  }
                }}
                className="flex-1 bg-transparent font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                placeholder="Type a command here..."
              />
              <Button variant="primary" onClick={() => void runCommand()} isLoading={running} disabled={!command.trim()}>
                <Play size={14} className="mr-2" />
                Run
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <span>Click anywhere in the terminal output to focus the prompt.</span>
              <span>Shortcuts: Enter run, Ctrl+L clear, ArrowUp/ArrowDown history, scroll up to pause auto-stick.</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Clock3 size={14} />
            Recent Commands
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item}
                onClick={() => setCommand(item)}
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left font-mono text-[11px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
