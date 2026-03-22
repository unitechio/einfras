import { Copy, Download, FileText, Pause, Play, RefreshCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { servicesApi } from "@/shared/api/client";

type LogLevel = "all" | "info" | "warn" | "error";
type ParsedLogLine = {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
};

interface ServiceLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serviceName: string;
}

export function ServiceLogDrawer({ isOpen, onClose, serverId, serviceName }: ServiceLogDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<ParsedLogLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lineCount, setLineCount] = useState(100);
  const [filterLevel, setFilterLevel] = useState<LogLevel>("all");
  const [isFollowing, setIsFollowing] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !serverId || !serviceName) return;

    let cancelled = false;
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response = await servicesApi.logs(serverId, serviceName, lineCount);
        if (cancelled) return;
        const output = String(response.raw_output ?? response.result ?? "");
        setLogs(parseLogOutput(output));
      } catch (error) {
        if (!cancelled) {
          setLogs([
            {
              timestamp: new Date().toISOString(),
              level: "error",
              message: error instanceof Error ? error.message : "Unable to load service logs.",
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchLogs();
    const interval = isFollowing ? window.setInterval(fetchLogs, 4000) : undefined;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [isOpen, serverId, serviceName, lineCount, refreshTrigger, isFollowing]);

  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const filteredLogs = useMemo(
    () => logs.filter((log) => filterLevel === "all" || log.level === filterLevel),
    [logs, filterLevel],
  );

  const exportText = filteredLogs.map((line) => `[${line.timestamp}] [${line.level.toUpperCase()}] ${line.message}`).join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportText);
  };

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${serviceName}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div
        ref={drawerRef}
        className="flex h-full w-full max-w-3xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-white">
                <FileText size={18} />
                Service Logs
                <span className="font-mono text-blue-600 dark:text-blue-400">{serviceName}</span>
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Viewing the latest {lineCount} lines through the real backend service log endpoint.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                <Copy size={18} />
              </button>
              <button onClick={handleDownload} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                <Download size={18} />
              </button>
              <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-50 hover:text-red-500 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-300">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
            <select
              value={lineCount}
              onChange={(event) => setLineCount(Number(event.target.value))}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <option value={100}>Last 100 lines</option>
              <option value={500}>Last 500 lines</option>
              <option value={1000}>Last 1000 lines</option>
            </select>

            <div className="flex items-center rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
              {(["all", "info", "warn", "error"] as LogLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterLevel(level)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition",
                    filterLevel === level
                      ? level === "warn"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : level === "error"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : level === "info"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <button
              onClick={() => setIsFollowing((value) => !value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                isFollowing
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
              )}
            >
              {isFollowing ? <Pause size={14} /> : <Play size={14} />}
              {isFollowing ? "Pause Follow" : "Resume Follow"}
            </button>

            <button
              onClick={() => setRefreshTrigger((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto bg-zinc-950 px-6 py-4 font-mono text-sm text-zinc-100">
          {isLoading && logs.length === 0 ? (
            <div className="py-10 text-center text-zinc-400">Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-zinc-400">No log lines returned for this service yet.</div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="mb-2 flex gap-3">
                <span className="shrink-0 text-xs text-zinc-500">{log.timestamp}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-bold uppercase",
                    log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-blue-400",
                  )}
                >
                  {log.level}
                </span>
                <span className="whitespace-pre-wrap break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function parseLogOutput(output: string): ParsedLogLine[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const level = /\b(error|fatal)\b/i.test(line)
        ? "error"
        : /\b(warn|warning)\b/i.test(line)
          ? "warn"
          : "info";
      const timestampMatch = line.match(/^\[?([0-9]{4}-[0-9]{2}-[0-9]{2}[^ ]*)\]?/);
      return {
        timestamp: timestampMatch?.[1] ?? new Date().toISOString(),
        level,
        message: line,
      };
    });
}
