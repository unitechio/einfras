"use client";

import { useMemo, useState } from "react";
import {
    Activity,
    Clock,
    Filter,
    Search,
    ShieldAlert,
    Zap,
    Box,
    Package,
    Terminal,
    ChevronDown,
    ChevronUp,
    Trash2,
    PlusCircle,
    RotateCw,
    Globe,
    ExternalLink
} from "lucide-react";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useRuntimeAudit } from "@/features/docker/api/useDockerHooks";

interface FormattedEvent {
    id: string;
    type: string;
    user: string;
    description: string;
    time: string;
    severity: "info" | "warning" | "danger" | "success";
    resource: string;
    rawDetails: string;
    ip?: string;
    mainMessage: string;
    technicalDetails: string;
    icon: any;
}

export default function EventsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const { selectedEnvironment, isEnvironmentMode } = useEnvironment();
    const runtimeAuditQuery = useRuntimeAudit(selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "");
    const [platformView] = useState<"platform" | "docker">(selectedEnvironment?.type === "docker" ? "docker" : "platform");

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getEventIcon = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes("exec")) return Terminal;
        if (a.includes("container")) return Box;
        if (a.includes("image")) return Package;
        if (a.includes("delete") || a.includes("remove") || a.includes("kill")) return Trash2;
        if (a.includes("create") || a.includes("add")) return PlusCircle;
        if (a.includes("restart") || a.includes("update")) return RotateCw;
        return Activity;
    };

    const parseDetails = (details: string, type: string) => {
        if (!details) return { main: type, sub: "", ip: "" };

        const lines = details.split("\n");
        let ip = "";
        let mainMessage = "";
        const technicalLines: string[] = [];

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // Detect IP address with port
            if (trimmed.match(/^\[.*\]:\d+$/) || trimmed.match(/^\d+\.\d+\.\d+\.\d+:\d+$/)) {
                ip = trimmed;
            } else if (
                trimmed.toLowerCase().includes("successfully") ||
                trimmed.toLowerCase().includes("removed") ||
                trimmed.toLowerCase().includes("executed") ||
                trimmed.toLowerCase().includes("deleted") ||
                trimmed.toLowerCase().includes("started") ||
                trimmed.toLowerCase().includes("stopped")
            ) {
                mainMessage = trimmed;
            } else {
                technicalLines.push(trimmed);
            }
        });

        if (!mainMessage) {
            // Find first line that isn't the IP
            mainMessage = technicalLines.shift() || type;
        }

        return {
            main: mainMessage,
            sub: technicalLines.join("\n"),
            ip
        };
    };

    const events = useMemo(() => {
        if (isEnvironmentMode && selectedEnvironment?.type === "docker" && platformView === "docker") {
            return (runtimeAuditQuery.data ?? []).map((event) => {
                const { main, sub, ip } = parseDetails(event.details, event.action);
                return {
                    id: event.id,
                    type: event.action,
                    user: event.actor || "runtime",
                    description: event.details || `${event.resource_type} ${event.resource_id}`,
                    time: new Date(event.created_at).toLocaleString(),
                    severity: event.status === "failed" ? ("danger" as const) : event.action.includes("delete") || event.action.includes("kill") ? ("warning" as const) : ("info" as const),
                    resource: `${event.resource_type}:${event.resource_id}`,
                    rawDetails: event.details,
                    ip,
                    mainMessage: main,
                    technicalDetails: sub,
                    icon: getEventIcon(event.action)
                };
            });
        }
        return [];
    }, [isEnvironmentMode, platformView, runtimeAuditQuery.data, selectedEnvironment]);

    const filteredEvents = events.filter((event) =>
        [event.description, event.user, event.type, event.resource, event.ip, event.mainMessage]
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Activity className="h-6 w-6 text-indigo-500" />
                        {isEnvironmentMode && selectedEnvironment?.type === "docker" ? "Runtime Audit Trail" : "Platform Events"}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Track container, image, and system events across your clusters.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-9">
                        <Filter className="mr-2 h-3.5 w-3.5" />
                        Quick Filters
                    </Button>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => runtimeAuditQuery.refetch()}>
                        <RotateCw className={cn("mr-2 h-3.5 w-3.5", runtimeAuditQuery.isFetching && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="w-full sm:max-w-md">
                    <Input
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                        placeholder="Filter by action, user, or IP..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white dark:bg-[#121212]"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-zinc-500 dark:text-zinc-400">
                            <Activity size={32} className="mb-3 opacity-20" />
                            <p className="text-sm font-medium">No events captured in this timeline.</p>
                        </div>
                    ) : (
                        filteredEvents.map((event) => {
                            const isExpanded = expandedIds.has(event.id);
                            const Icon = event.icon;
                            
                            return (
                                <div key={event.id} className="group border-l-2 border-transparent transition-all hover:border-indigo-500 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                    <div className="flex items-start gap-4 p-5">
                                        <div className={cn(
                                            "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border p-2 transition-all",
                                            event.severity === "danger"
                                                ? "border-red-100 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                                                : event.severity === "warning"
                                                    ? "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                                                    : "border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400",
                                        )}>
                                            <Icon size={18} />
                                        </div>
                                        
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{event.type}</span>
                                                    <span className="px-1.5 text-zinc-300 dark:text-zinc-700">/</span>
                                                    <Badge variant="outline" className="h-5 rounded-md px-2 py-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                                        {event.user}
                                                    </Badge>
                                                    {event.ip && (
                                                        <Badge variant="outline" className="h-5 flex items-center gap-1 rounded-md px-2 py-0 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                                            <Globe size={10} className="opacity-70" /> {event.ip}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                                                        <Clock size={12} className="opacity-70" /> {event.time}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-200">
                                                            {event.mainMessage}
                                                        </p>
                                                        {event.resource && (
                                                           <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                                                               <Box size={10} /> {event.resource}
                                                           </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {event.technicalDetails && (
                                                    <button 
                                                        onClick={() => toggleExpand(event.id)}
                                                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-600 transition-all hover:bg-zinc-100 hover:text-indigo-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                                                    >
                                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        {isExpanded ? "Hide Logs" : "View Logs"}
                                                    </button>
                                                )}
                                            </div>

                                            {isExpanded && event.technicalDetails && (
                                                <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Raw Technical Logs</span>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-6 px-2 text-[10px] text-zinc-400"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(event.rawDetails);
                                                                }}
                                                            >
                                                                Copy JSON
                                                            </Button>
                                                        </div>
                                                        <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 custom-scrollbar">
                                                            {event.technicalDetails}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
