/**
 * AgentStatusBadge — Shows the live connection status of an EINFRA agent.
 *
 * Polls GET /api/v1/servers/{serverId}/status every 15 seconds
 * and displays a color-coded badge.
 */
import { useEffect, useState } from "react";
import { Activity, WifiOff, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";

interface AgentStatusBadgeProps {
  serverId: string;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; dot: string; ring: string; text: string; bg: string; Icon: React.FC<{ size?: number; className?: string }> }
> = {
  ONLINE: {
    label: "Online",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
    Icon: Activity,
  },
  OFFLINE: {
    label: "Offline",
    dot: "bg-red-500",
    ring: "ring-red-500/20",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20",
    Icon: WifiOff,
  },
  DEGRADED: {
    label: "Degraded",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
    Icon: AlertTriangle,
  },
  UNKNOWN: {
    label: "Unknown",
    dot: "bg-zinc-400",
    ring: "ring-zinc-400/20",
    text: "text-zinc-500",
    bg: "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700",
    Icon: Activity,
  },
};

export function AgentStatusBadge({
  serverId,
  className,
  showLabel = true,
  size = "sm",
}: AgentStatusBadgeProps) {
  const [status, setStatus] = useState<AgentStatus>("UNKNOWN");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/v1/servers/${serverId}/status`);
        if (!res.ok) throw new Error("not ok");
        const data = await res.json();
        setStatus(data.online ? "ONLINE" : "OFFLINE");
      } catch {
        setStatus("UNKNOWN");
      } finally {
        setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [serverId]);

  const cfg = STATUS_CONFIG[status];

  if (loading) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400", className)}>
        <Loader2 size={size === "sm" ? 12 : 14} className="animate-spin" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        cfg.bg,
        cfg.text,
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          cfg.dot,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
          status === "ONLINE" && "animate-pulse",
        )}
      />
      {showLabel && cfg.label}
    </span>
  );
}

/**
 * AgentMetricsBar — A compact metrics strip showing CPU / RAM / Disk from the last heartbeat.
 */
interface AgentMetricsBarProps {
  cpu?: number;
  mem?: number;
  disk?: number;
  className?: string;
}

export function AgentMetricsBar({ cpu = 0, mem = 0, disk = 0, className }: AgentMetricsBarProps) {
  const bar = (label: string, val: number, color: string) => {
    const danger = val > 90;
    const warn = val > 70;
    const barColor = danger ? "bg-red-500" : warn ? "bg-amber-500" : color;

    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-bold text-zinc-500 w-9 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${Math.min(val, 100)}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px] tabular-nums font-mono shrink-0 w-9 text-right",
            danger ? "text-red-400" : warn ? "text-amber-400" : "text-zinc-500",
          )}
        >
          {val.toFixed(0)}%
        </span>
      </div>
    );
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {bar("CPU", cpu, "bg-blue-500")}
      {bar("MEM", mem, "bg-purple-500")}
      {bar("DISK", disk, "bg-orange-500")}
    </div>
  );
}
