"use client";

import { useState } from "react";
import {
    Users,
    Activity,
    ShieldCheck,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Settings,
    Zap,
    LayoutGrid,
    ChevronRight,
    Clock,
    Search,
    Wifi,
    HardDrive,
    Globe,
    Database,
    Server,
    Cpu,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeView, setActiveView] = useState<"live" | "historical">("live");

    const stats = [
        { label: "Total Users", value: "1,248", icon: Users, change: "+12%", trend: "up", color: "blue", sub: "vs last month" },
        { label: "Active Nodes", value: "84", icon: Activity, change: "+3", trend: "up", color: "emerald", sub: "nodes online" },
        { label: "Security Score", value: "98%", icon: ShieldCheck, change: "-2%", trend: "down", color: "amber", sub: "threat level low" },
        { label: "Active Alerts", value: "12", icon: AlertCircle, change: "Stable", trend: "neutral", color: "red", sub: "no critical" },
    ];

    const environments = [
        { name: "Production-Cluster-01", type: "Kubernetes", status: "Healthy", cpu: "42%", ram: "64%", lastSync: "2 mins ago", region: "us-east-1" },
        { name: "Staging-AWS", type: "Docker", status: "Healthy", cpu: "12%", ram: "28%", lastSync: "15 mins ago", region: "ap-se-1" },
        { name: "Dev-Local-VM", type: "Linux", status: "Warning", cpu: "88%", ram: "92%", lastSync: "1 hour ago", region: "local" },
        { name: "Backup-Vault", type: "Cloud", status: "Healthy", cpu: "5%", ram: "12%", lastSync: "4 hours ago", region: "eu-west-1" },
    ];

    const upcomingTasks = [
        { id: "1", title: "Cluster Upgrade v1.28", time: "Tomorrow, 09:00", priority: "High", type: "Maintenance" },
        { id: "2", title: "Backup Verification", time: "Today, 23:00", priority: "Medium", type: "Security" },
        { id: "3", title: "SSL Certificate Renewal", time: "In 3 days", priority: "Critical", type: "Certificate" },
    ];

    const filteredEnvs = environments.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <LayoutGrid className="h-6 w-6 text-indigo-500" />
                        Infrastructure Overview
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Real-time visibility across your global infrastructure deployments.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        {(["live", "historical"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setActiveView(v)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize",
                                    activeView === v
                                        ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {v === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </button>
                        ))}
                    </div>
                    <Button variant="primary" size="md">
                        <Plus className="h-4 w-4 mr-2" />
                        Provision Node
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div
                        key={idx}
                        className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 group relative overflow-hidden"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn(
                                "p-2 rounded-lg transition-all",
                                stat.color === "blue" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                                stat.color === "emerald" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                                stat.color === "amber" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                            )}>
                                <stat.icon size={16} />
                            </div>
                            <div className={cn(
                                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold",
                                stat.trend === "up" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                stat.trend === "down" ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400" :
                                "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            )}>
                                {stat.trend === "up" ? <ArrowUpRight size={10} /> : stat.trend === "down" ? <ArrowDownRight size={10} /> : null}
                                {stat.change}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{stat.value}</p>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">{stat.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Environments */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-zinc-50/50 dark:bg-[#121212]">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                    <Globe size={14} className="text-indigo-500" />
                                    Environmental Map
                                </h2>
                                <p className="text-xs text-zinc-400 mt-0.5">Distribution across {environments.length} zones</p>
                            </div>
                            <div className="relative flex items-center w-full md:w-56 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 gap-2">
                                <Search size={13} className="text-zinc-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Filter environments..."
                                    className="bg-transparent outline-none text-xs text-zinc-700 dark:text-zinc-300 w-full placeholder:text-zinc-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {filteredEnvs.map((env, idx) => (
                                <div
                                    key={idx}
                                    className="group px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                            {env.type === "Kubernetes" ? <Zap size={14} className="text-blue-500" /> :
                                                env.type === "Docker" ? <Database size={14} className="text-indigo-500" /> :
                                                env.type === "Linux" ? <Server size={14} className="text-amber-500" /> :
                                                <HardDrive size={14} className="text-emerald-500" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{env.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">{env.type}</span>
                                                <span className="text-zinc-200 dark:text-zinc-700">·</span>
                                                <span className="text-[10px] text-zinc-400">{env.region}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                env.status === "Healthy" ? "bg-emerald-500" : "bg-amber-500"
                                            )} />
                                            <span className={cn(
                                                "text-xs font-medium",
                                                env.status === "Healthy" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                                            )}>{env.status}</span>
                                        </div>

                                        <div className="flex flex-col gap-1 w-24">
                                            <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                                                <span>CPU</span><span>{env.cpu}</span>
                                            </div>
                                            <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all", parseInt(env.cpu) > 80 ? "bg-red-500" : "bg-indigo-500")}
                                                    style={{ width: env.cpu }}
                                                />
                                            </div>
                                        </div>

                                        <div className="text-[10px] text-zinc-400 hidden sm:block">{env.lastSync}</div>

                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                                                <Settings size={12} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-zinc-400">
                                                <ChevronRight size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-3 bg-zinc-50/50 dark:bg-zinc-900/20 border-t border-zinc-100 dark:border-zinc-800 flex justify-center">
                            <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 transition-colors">
                                View Global Topology <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Throughput Card */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between gap-6 group hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Wifi size={12} className="text-emerald-500" />
                                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Live Throughput</p>
                            </div>
                            <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                1.2 <span className="text-base font-medium text-zinc-400">Gb/s</span>
                            </p>
                            <p className="text-xs text-zinc-400 mt-1">Aggregated across all public endpoints</p>
                        </div>
                        <div className="h-14 w-40 flex items-end gap-0.5 shrink-0">
                            {[35, 55, 40, 70, 50, 80, 60, 90, 65, 75, 85, 60, 70, 90, 80].map((h, i) => (
                                <div
                                    key={i}
                                    className="flex-1 rounded-sm bg-indigo-100 dark:bg-indigo-500/20 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-all"
                                    style={{ height: `${h}%`, transitionDelay: `${i * 20}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Task Queue */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                <Clock size={14} className="text-amber-500" />
                                Upcoming Tasks
                            </h2>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium">Next 48h</Badge>
                        </div>

                        <div className="space-y-4">
                            {upcomingTasks.map((task, i) => (
                                <div key={task.id}>
                                    <div className="group flex items-start gap-3 cursor-pointer">
                                        <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-all">
                                            <Cpu size={14} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate leading-none">{task.title}</p>
                                                <span className={cn(
                                                    "text-[10px] font-semibold shrink-0",
                                                    task.priority === "Critical" ? "text-red-500" :
                                                    task.priority === "High" ? "text-amber-500" : "text-zinc-400"
                                                )}>{task.priority}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-zinc-400">{task.time}</span>
                                                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{task.type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {i < upcomingTasks.length - 1 && <div className="h-px bg-zinc-100 dark:bg-zinc-800/50 mt-4" />}
                                </div>
                            ))}
                        </div>

                        <Button variant="outline" size="md" className="w-full mt-6 border-dashed text-zinc-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all text-xs">
                            Launch Incident Dashboard
                        </Button>
                    </div>

                    {/* Security Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl p-6 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <ShieldCheck size={100} />
                        </div>
                        <div className="relative">
                            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2 opacity-70">Security Protocol</p>
                            <p className="text-lg font-bold mb-4 leading-snug">Your infrastructure is <span className="text-blue-200">98.4%</span> shielded against current threats.</p>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <Zap size={12} className="text-white" />
                                </div>
                                <span className="text-xs font-medium opacity-90">Threat Intelligence enabled</span>
                            </div>
                            <button className="w-full py-2 bg-white text-indigo-600 font-semibold text-xs rounded-lg shadow-md hover:bg-indigo-50 active:scale-95 transition-all">
                                Audit Security
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
