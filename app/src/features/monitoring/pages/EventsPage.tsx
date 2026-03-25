"use client";

import { useMemo, useState } from "react";
import { Activity, Clock, Filter, Search, ShieldAlert, Zap } from "lucide-react";

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useRuntimeAudit } from "@/features/docker/api/useDockerHooks";

export default function EventsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const { selectedEnvironment, isEnvironmentMode } = useEnvironment();
    const runtimeAuditQuery = useRuntimeAudit(selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "");
    const [platformView] = useState<"platform" | "docker">(selectedEnvironment?.type === "docker" ? "docker" : "platform");

    const platformEventsQuery = {
        data: [],
    } as { data: Array<{ id: string; type: string; user: string; description: string; time: string; severity: "info" | "warning" | "danger" }> };

    const events = useMemo(() => {
        if (isEnvironmentMode && selectedEnvironment?.type === "docker" && platformView === "docker") {
            return (runtimeAuditQuery.data ?? []).map((event) => ({
                id: event.id,
                type: event.action,
                user: event.actor || "runtime",
                description: event.details || `${event.resource_type} ${event.resource_id}`,
                time: new Date(event.created_at).toLocaleString(),
                severity: event.status === "failed" ? "danger" as const : event.action.includes("delete") || event.action.includes("kill") ? "warning" as const : "info" as const,
                resource: `${event.resource_type}:${event.resource_id}`,
            }));
        }
        return (platformEventsQuery.data ?? []).map((event) => ({
            ...event,
            resource: event.type,
        }));
    }, [isEnvironmentMode, platformView, platformEventsQuery.data, runtimeAuditQuery.data, selectedEnvironment]);

    const filteredEvents = events.filter((event) =>
        [event.description, event.user, event.type, event.resource]
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
                        {isEnvironmentMode && selectedEnvironment?.type === "docker"
                            ? `Track container, stack, registry, and image actions for ${selectedEnvironment.name}.`
                            : "Track system activities, alerts, and security logs in real-time."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="w-full sm:max-w-md">
                    <Input
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 text-zinc-500 dark:text-zinc-400">
                            <Activity size={32} className="mb-3 opacity-20" />
                            <p className="text-[13px] font-medium">No events found matching your criteria.</p>
                        </div>
                    ) : (
                        filteredEvents.map((event) => (
                            <div key={event.id} className="group flex items-start gap-4 p-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                <div className={cn(
                                    "mt-0.5 rounded-lg border p-2 transition-colors",
                                    event.severity === "danger"
                                        ? "border-red-100 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                                        : event.severity === "warning"
                                            ? "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
                                            : "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400",
                                )}>
                                    {event.severity === "danger" ? <ShieldAlert size={18} /> : <Zap size={18} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{event.type}</span>
                                            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] uppercase tracking-wider">
                                                {event.user}
                                            </Badge>
                                            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] uppercase tracking-wider">
                                                {event.resource}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                            <Clock size={12} className="opacity-70" /> {event.time}
                                        </div>
                                    </div>
                                    <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{event.description}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
