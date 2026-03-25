import { Area, AreaChart, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import { Activity, Cpu, HardDrive, RefreshCw, Waves } from "lucide-react";
import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { monitoringApi, serversApi } from "@/shared/api/client";

type HistoryPoint = {
  time: string;
  cpu: number;
  ram: number;
  netIn: number;
  netOut: number;
};

export default function ServerDashboard() {
  const { serverId = "" } = useParams();
  const { data: currentMetrics, isLoading, error } = useQuery({
    queryKey: ["server-dashboard", "metrics", serverId],
    queryFn: () => monitoringApi.getMetrics(serverId),
    enabled: !!serverId,
    refetchInterval: 5_000,
  });
  const { data: agentStatus } = useQuery({
    queryKey: ["server-dashboard", "agent-status", serverId],
    queryFn: () => serversApi.agentStatus(serverId),
    enabled: !!serverId,
    refetchInterval: 10_000,
  });

  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (!currentMetrics) return;
    const time = new Date(currentMetrics.collectedAt || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time,
          cpu: Math.round(currentMetrics.cpuUsage || 0),
          ram: Math.round(currentMetrics.memPercent || 0),
          netIn: Number((((currentMetrics.netRxBytes || 0) as number) / 1024 / 1024).toFixed(2)),
          netOut: Number((((currentMetrics.netTxBytes || 0) as number) / 1024 / 1024).toFixed(2)),
        },
      ];
      return next.slice(-18);
    });
  }, [currentMetrics]);

  const diskData = useMemo(() => {
    const mounts = Array.isArray(currentMetrics?.diskMounts)
      ? (currentMetrics.diskMounts as Array<{ mount?: string; used?: number; total?: number }>)
      : [];
    if (mounts.length === 0) {
      return [];
    }
    return mounts.map((disk) => ({
      name: disk.mount || "/",
      used: Math.round((disk.used || 0) / 1_073_741_824),
      total: Math.round((disk.total || 0) / 1_073_741_824),
    }));
  }, [currentMetrics]);

  const integrationCards = [
    {
      label: "Agent",
      value: agentStatus?.online ? "online" : "offline",
      helper: agentStatus?.version || "pending",
      accent: agentStatus?.online ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-red-400 border-red-500/30 bg-red-500/10",
    },
    {
      label: "Docker",
      value: agentStatus?.has_docker ? "detected" : "not found",
      helper: agentStatus?.has_docker ? "Container runtime available on node" : "No Docker runtime reported",
      accent: agentStatus?.has_docker ? "text-sky-300 border-sky-500/30 bg-sky-500/10" : "text-zinc-300 border-zinc-700 bg-zinc-800/60",
    },
    {
      label: "Kubernetes",
      value: agentStatus?.has_k8s ? "detected" : "not found",
      helper: agentStatus?.has_k8s ? "kubectl / cluster tooling detected" : "No Kubernetes tooling reported",
      accent: agentStatus?.has_k8s ? "text-violet-300 border-violet-500/30 bg-violet-500/10" : "text-zinc-300 border-zinc-700 bg-zinc-800/60",
    },
  ];

  if (isLoading && history.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-pulse">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[320px] rounded-2xl border border-zinc-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-[#121212]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200/60 bg-white p-8 text-center dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="font-semibold text-red-500">Failed to load overview metrics</div>
        <p className="text-sm text-zinc-500">Make sure the backend API and node agent are both running, then refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {integrationCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border px-5 py-4 shadow-sm ${card.accent}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">{card.label}</div>
            <div className="mt-2 text-2xl font-bold tracking-tight capitalize">{card.value}</div>
            <div className="mt-1 text-sm opacity-80">{card.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MetricChartCard title="CPU Usage" subtitle="Real-time processor load" icon={<Cpu size={16} className="text-cyan-300" />}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.length > 0 ? history : [{ time: "--:--", cpu: 0, ram: 0, netIn: 0, netOut: 0 }]}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" opacity={0.28} vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e2e8f0" }} />
              <Area type="monotone" dataKey="cpu" stroke="#67e8f9" strokeWidth={2.5} fillOpacity={1} fill="url(#cpuFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </MetricChartCard>

        <MetricChartCard title="Memory Usage" subtitle="Real memory pressure" icon={<Activity size={16} className="text-amber-300" />}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.length > 0 ? history : [{ time: "--:--", cpu: 0, ram: 0, netIn: 0, netOut: 0 }]}>
              <defs>
                <linearGradient id="ramFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" opacity={0.28} vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e2e8f0" }} />
              <Area type="monotone" dataKey="ram" stroke="#fbbf24" strokeWidth={2.5} fillOpacity={1} fill="url(#ramFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </MetricChartCard>

        <MetricChartCard title="Network Activity" subtitle="Traffic throughput" icon={<Waves size={16} className="text-emerald-300" />}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.length > 0 ? history : [{ time: "--:--", cpu: 0, ram: 0, netIn: 0, netOut: 0 }]}>
              <defs>
                <linearGradient id="netInFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="netOutFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb7185" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#334155" opacity={0.28} vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e2e8f0" }} />
              <Area type="monotone" dataKey="netIn" stroke="#34d399" strokeWidth={2.2} fillOpacity={1} fill="url(#netInFill)" name="Inbound" />
              <Area type="monotone" dataKey="netOut" stroke="#fb7185" strokeWidth={2.2} fillOpacity={1} fill="url(#netOutFill)" name="Outbound" />
            </AreaChart>
          </ResponsiveContainer>
        </MetricChartCard>

        <MetricChartCard title="Disk Usage" subtitle="Mounted storage snapshot" icon={<HardDrive size={16} className="text-violet-300" />}>
          {diskData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zinc-400">
              <RefreshCw size={20} />
              <div className="text-sm">No disk inventory yet. Refresh the node snapshot or wait for the next metrics cycle.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diskData} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" opacity={0.25} horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" width={64} tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e2e8f0" }} />
                <Bar dataKey="used" fill="#a78bfa" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </MetricChartCard>
      </div>
    </div>
  );
}

function MetricChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-2 dark:border-zinc-800/60 dark:bg-zinc-900/80">{icon}</div>
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.94)",
  borderColor: "rgba(148, 163, 184, 0.22)",
  borderRadius: "12px",
  color: "#f8fafc",
  boxShadow: "0 14px 40px rgba(2, 6, 23, 0.42)",
};
