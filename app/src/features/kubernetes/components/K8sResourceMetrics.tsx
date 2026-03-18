"use client";

import { cn } from "@/lib/utils";
import { Cpu, MemoryStick, Activity, Layers, Activity as MetricIcon, RefreshCw, Info, Database, Signal } from "lucide-react";
import { Badge } from "@/shared/ui/Badge";

interface MetricsCardProps {
  label: string;
  value: string;
  percentage: number;
  icon: any;
  color: string;
  trend?: string;
}

function MetricCard({ label, value, percentage, icon: Icon, color, trend }: MetricsCardProps) {
  return (
    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group overflow-hidden relative">
      {/* Background Accent */}
      <div className={cn("absolute -right-8 -bottom-8 w-32 h-32 opacity-5 blur-2xl rounded-full", color.replace('text-', 'bg-'))} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className={cn("p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-100 dark:border-zinc-700 group-hover:scale-110 transition-transform", color)}>
          <Icon size={18} />
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 tracking-tighter uppercase opacity-80">
            {trend || "+2.4% ↗"}
          </Badge>
        </div>
      </div>
      
      <div className="mt-4 relative z-10">
        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-bold tracking-tighter text-zinc-900 dark:text-zinc-50 my-1">{value}</h3>
      </div>
      
      <div className="mt-4 relative z-10">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5 font-bold uppercase tracking-tight">
          <span>Usage</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-800">
          <div 
            className={cn("h-full rounded-full transition-all duration-1000", color.replace('text-', 'bg-'))} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function K8sResourceMetrics({ cpu, memory, storage, ephemeral }: { cpu: number, memory: number, storage?: number, ephemeral?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <MetricCard 
        label="CPU Usage" 
        value={`${cpu}m`} 
        percentage={Math.min(100, (cpu / 2000) * 100)} 
        icon={Cpu} 
        color="text-blue-500 font-bold"
      />
      <MetricCard 
        label="Memory usage" 
        value={`${memory} MiB`} 
        percentage={Math.min(100, (memory / 1024) * 100)} 
        icon={MemoryStick} 
        color="text-indigo-500"
        trend="+142 MiB ↗"
      />
      <MetricCard 
        label="Storage I/O" 
        value={storage ? `${storage} MB/s` : "12.4 MB/s"} 
        percentage={64} 
        icon={Database} 
        color="text-emerald-500"
      />
      <MetricCard 
        label="Network TX/RX" 
        value={ephemeral ? `${ephemeral} p/s` : "842 KB/s"} 
        percentage={42} 
        icon={Signal} 
        color="text-amber-500"
      />
    </div>
  );
}
