import {
  X,
  FileText,
  Download,
  Copy,
  RefreshCcw,
  Pause,
  Play,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ServiceLog } from "../shared/mockServerService";
import { mockServerService } from "../shared/mockServerService";

interface ServiceLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
}

export function ServiceLogDrawer({
  isOpen,
  onClose,
  serviceName,
}: ServiceLogDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lineCount, setLineCount] = useState(100);
  const [filterLevel, setFilterLevel] = useState<
    "all" | "info" | "warn" | "error"
  >("all");
  const [isFollowing, setIsFollowing] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node)
      ) {
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

  // Fetch logs
  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const data = await mockServerService.getLogs(serviceName, lineCount);
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch logs", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    // Polling if following
    let interval: ReturnType<typeof setInterval>;
    if (isFollowing) {
      interval = setInterval(fetchLogs, 3000);
    }

    return () => clearInterval(interval);
  }, [isOpen, serviceName, lineCount, refreshTrigger, isFollowing]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isFollowing]);

  const filteredLogs = logs.filter(
    (log) => filterLevel === "all" || log.level === filterLevel,
  );

  const handleCopy = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${serviceName}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <div
        ref={drawerRef}
        className="h-full w-full max-w-3xl bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText size={18} />
                Service Logs:{" "}
                <span className="text-blue-600 dark:text-blue-400 font-mono">
                  {serviceName}
                </span>
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Viewing last {lineCount} lines •{" "}
                {isFollowing ? "Live update" : "Paused"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-300 dark:border-zinc-700"
                title="Copy logs"
              >
                <Copy size={18} />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-300 dark:border-zinc-700"
                title="Download logs"
              >
                <Download size={18} />
              </button>
              <button
                onClick={onClose}
                className="p-2 ml-2 text-zinc-600 dark:text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 flex flex-wrap items-center gap-3 text-sm border-t border-zinc-200 dark:border-zinc-800">
            <select
              value={lineCount}
              onChange={(e) => setLineCount(Number(e.target.value))}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-zinc-700 dark:text-zinc-300"
            >
              <option value={100}>Last 100 lines</option>
              <option value={500}>Last 500 lines</option>
              <option value={1000}>Last 1000 lines</option>
            </select>

            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1"></div>

            <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md p-1">
              <button
                onClick={() => setFilterLevel("all")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  filterLevel === "all"
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200",
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilterLevel("info")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  filterLevel === "info"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200",
                )}
              >
                Info
              </button>
              <button
                onClick={() => setFilterLevel("warn")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  filterLevel === "warn"
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200",
                )}
              >
                Warn
              </button>
              <button
                onClick={() => setFilterLevel("error")}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  filterLevel === "error"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200",
                )}
              >
                Error
              </button>
            </div>

            <div className="flex-1"></div>

            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                isFollowing
                  ? "bg-blue-600 border-blue-600 text-zinc-900 dark:text-white hover:bg-blue-700 shadow-sm"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-100 dark:bg-zinc-800",
              )}
            >
              {isFollowing ? <Pause size={14} /> : <Play size={14} />}
              {isFollowing ? "Pause Follow" : "Resume Follow"}
            </button>
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-800 rounded-md transition-colors"
              title="Refresh now"
            >
              <RefreshCcw
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-950 font-mono text-sm leading-relaxed"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500">
              {isLoading
                ? "Loading logs..."
                : "No logs found matching your filter."}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex group hover:bg-zinc-900/50 -mx-4 px-4 py-0.5"
                >
                  <span className="text-zinc-500 w-36 shrink-0 select-none text-xs pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={cn(
                      "w-16 shrink-0 text-xs font-bold pt-0.5 select-none uppercase",
                      log.level === "error"
                        ? "text-red-500"
                        : log.level === "warn"
                          ? "text-yellow-500"
                          : "text-blue-500",
                    )}
                  >
                    [{log.level}]
                  </span>
                  <span
                    className={cn(
                      "break-all",
                      log.level === "error"
                        ? "text-red-200"
                        : log.level === "warn"
                          ? "text-yellow-200"
                          : "text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {/* Dummy element to scroll to */}
              <div className="h-4"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
