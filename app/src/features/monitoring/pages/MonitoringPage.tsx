"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Info, Server } from "lucide-react";

import { MetricsDashboard } from "../components/MetricsDashboard";
import { Button } from "@/shared/ui/Button";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useEnvironmentInventory } from "@/features/kubernetes/api/useEnvironmentInventory";
import { monitoringApi } from "@/shared/api/client";
import { Badge } from "@/shared/ui/Badge";

export const MonitoringPage = () => {
    const { selectedEnvironment } = useEnvironment();
    const { data: inventory = [] } = useEnvironmentInventory();
    const environment = selectedEnvironment ?? inventory[0] ?? null;

    const alertsQuery = useQuery({
        queryKey: ["environment-alerts", environment?.serverId],
        queryFn: async () => monitoringApi.listAlerts(environment?.serverId ?? ""),
        enabled: !!environment?.serverId,
        refetchInterval: 15000,
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Activity className="h-6 w-6 text-indigo-500" />
                        System Monitoring
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Real-time observability and resource metrics across your infrastructure.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {environment ? (
                        <Badge variant="outline" className="px-3 py-1 text-xs">
                            <Server className="mr-1 h-3.5 w-3.5" />
                            {environment.name}
                        </Badge>
                    ) : null}
                    <Button variant="outline" size="md">
                        Configure Alerts
                    </Button>
                </div>
            </div>

            <MetricsDashboard />

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Active Alerts</h2>
                </div>
                <div className="space-y-3">
                    {(alertsQuery.data ?? []).map((alert) => (
                        <div key={alert.id} className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                            <div className="mb-1 flex items-center gap-2">
                                <Badge variant={alert.severity === "critical" ? "error" : alert.severity === "warning" ? "warning" : "outline"}>
                                    {alert.severity}
                                </Badge>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{alert.title}</span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{alert.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800/30">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    Detailed charts and historical metrics are temporarily unavailable while the new visualization engine is deployed. Stay tuned for advanced PromQL queries and Grafana integrations.
                </p>
            </div>
        </div>
    );
};
