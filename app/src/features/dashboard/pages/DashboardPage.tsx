"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import {
    Activity,
    ArrowRight,
    Bell,
    Box,
    Cpu,
    Database,
    FolderKanban,
    Globe,
    HardDrive,
    KeyRound,
    Layers,
    Monitor,
    SearchCode,
    Server,
    Share2,
    ShieldCheck,
    Sparkles,
    Terminal,
} from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { apiFetch } from "@/core/api-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { monitoringApi, serversApi } from "@/shared/api/client";
import { useContainers, useDockerTopology, useImages, useNetworks, useRuntimeAudit, useStacks, useVolumes } from "@/features/docker/api/useDockerHooks";
import { useServers } from "@/features/servers/api/useServers";
import { useEnvironmentInventory } from "@/features/kubernetes/api/useEnvironmentInventory";
import { useDeployments, useNamespaces, useNodes, usePersistentVolumes, usePods } from "@/features/kubernetes/api/useKubernetesHooks";
import { applicationsApi } from "@/features/catalog/api";
import { dashboardApi } from "@/features/dashboard/api";
import { notificationsApi } from "@/features/notifications/api";
import { settingsApi } from "@/features/settings/api";
import { usersTeamsApi } from "@/features/users_teams/api";

export default function DashboardPage() {
    const { selectedEnvironment } = useEnvironment();

    if (!selectedEnvironment) {
        return <AdminOverview />;
    }

    if (selectedEnvironment.type === "docker") {
        return <DockerDashboard environmentId={selectedEnvironment.id} />;
    }

    return <KubernetesOverview environmentId={selectedEnvironment.id} />;
}

function DockerDashboard({ environmentId }: { environmentId: string }) {
    const navigate = useNavigate();
    const { data: inventory = [] } = useEnvironmentInventory();
    const { data: serverData } = useServers({ page: 1, page_size: 100 });
    const environment = inventory.find((item) => item.id === environmentId);
    const servers = serverData?.data ?? [];
    const containersQuery = useContainers(environmentId, true);
    const imagesQuery = useImages(environmentId);
    const networksQuery = useNetworks(environmentId);
    const volumesQuery = useVolumes(environmentId);
    const stacksQuery = useStacks(environmentId);
    const topologyQuery = useDockerTopology(environmentId);
    const auditQuery = useRuntimeAudit(environmentId, 10);
    const applicationsQuery = useQuery({
        queryKey: ["dashboard", "applications"],
        queryFn: () => applicationsApi.list(),
        staleTime: 30_000,
    });
    const notificationsQuery = useQuery({
        queryKey: ["dashboard", "notifications"],
        queryFn: () => notificationsApi.list(),
        staleTime: 15_000,
    });
    const licenseQuery = useQuery({
        queryKey: ["dashboard", "license"],
        queryFn: () => settingsApi.getLicense(),
        staleTime: 60_000,
    });
    const capacityHistoryQuery = useQuery({
        queryKey: ["dashboard", "docker-capacity-history", environment?.serverId],
        queryFn: () => environment?.serverId ? monitoringApi.getMetricsHistory(environment.serverId, 12) : Promise.resolve([]),
        enabled: !!environment?.serverId,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });

    const nodeQueries = useQueries({
        queries: servers.map((server) => ({
            queryKey: ["dashboard", "docker-node", server.id],
            queryFn: async () => {
                const [agent, metrics] = await Promise.all([
                    serversApi.agentStatus(server.id).catch(() => null),
                    monitoringApi.getMetrics(server.id).catch(() => null),
                ]);
                return { server, agent, metrics };
            },
            staleTime: 15_000,
            refetchInterval: 20_000,
        })),
    });

    const dockerNodes = useMemo(() => {
        return nodeQueries
            .map((query) => query.data)
            .filter((item): item is NonNullable<typeof item> => !!item)
            .filter((item) => item.agent?.has_docker || item.server.provider === "local-control-plane")
            .map((item) => ({
                id: item.server.id,
                name: item.server.name,
                ip: item.server.ip_address,
                environment: item.server.environment ?? "unknown",
                tags: item.server.tags ?? [],
                online: Boolean(item.agent?.online),
                cpu: Number(item.agent?.cpu_percent ?? item.metrics?.cpuUsage ?? 0),
                memory: Number(item.agent?.mem_percent ?? item.metrics?.memPercent ?? 0),
                disk: Number(item.agent?.disk_percent ?? 0),
                hasDocker: Boolean(item.agent?.has_docker),
            }));
    }, [nodeQueries]);

    const runningContainers = (containersQuery.data ?? []).filter((item) => item.State === "running");
    const topContainerStatQueries = useQueries({
        queries: runningContainers.slice(0, 5).map((container) => ({
            queryKey: ["dashboard", "docker-container-stats", environmentId, container.Id],
            queryFn: () => apiFetch(`/v1/environments/${environmentId}/docker/containers/${container.Id}/stats`).catch(() => null),
            enabled: !!environmentId,
            staleTime: 15_000,
            refetchInterval: 15_000,
        })),
    });

    if (!environment) {
        return (
            <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Environment is no longer available in the current inventory.
            </Card>
        );
    }

    const containers = containersQuery.data ?? [];
    const images = imagesQuery.data ?? [];
    const networks = networksQuery.data ?? [];
    const volumes = volumesQuery.data ?? [];
    const stacks = stacksQuery.data ?? [];
    const topology = topologyQuery.data;
    const auditTrail = auditQuery.data ?? [];
    const containerStateDistribution = buildDistribution(containers.map((item) => normalizeContainerState(item.State)));
    const containerStateChart = distributionToChart(containerStateDistribution);
    const containerCapacityTrend = buildCapacityTrend([capacityHistoryQuery.data ?? []], Number(environment.cpuPercent ?? 0), Number(environment.memPercent ?? 0));
    const topContainerUsage = runningContainers.slice(0, 5).map((container, index) => {
        const stats = topContainerStatQueries[index]?.data as { cpu_perc?: string; mem_perc?: string } | null | undefined;
        return {
            name: cleanContainerName(container.Names?.[0] || container.Id),
            cpu: parsePercentString(stats?.cpu_perc),
            memory: parsePercentString(stats?.mem_perc),
        };
    });
    const idleContainers = containers.filter((item) => item.State !== "running").length;
    const usedStoragePercent = Math.max(0, Math.min(100, Number(environment.diskPercent ?? 0)));
    const networkEdges = topology?.edges?.length ?? 0;
    const networkNodes = topology?.nodes?.length ?? 0;
    const topImages = [...images]
        .sort((left, right) => Number(right.Size ?? 0) - Number(left.Size ?? 0))
        .slice(0, 5)
        .map((image) => ({
            name: image.RepoTags?.[0] ?? image.Id.slice(0, 12),
            size: Math.round(Number(image.Size ?? 0) / (1024 * 1024)),
        }));

    const infoCards = [
        { label: "Containers", value: String(containers.length), icon: Box, tone: "blue" },
        { label: "Running vs Stopped", value: `${runningContainers.length} / ${containers.length - runningContainers.length}`, icon: Monitor, tone: "emerald" },
        { label: "Images / Volumes", value: `${images.length} / ${volumes.length}`, icon: HardDrive, tone: "amber" },
        { label: "Networks / Stacks", value: `${networks.length} / ${stacks.length}`, icon: Share2, tone: "indigo" },
    ] as const;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Box className="h-6 w-6 text-blue-500" />
                        Docker Platform Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Host health, Docker daemon details, node inventory, and runtime actions for {environment.name}.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="md" onClick={() => navigate("/nodes")}>
                        <Server className="mr-2 h-4 w-4" />
                        Nodes
                    </Button>
                    <Button variant="outline" size="md" onClick={() => navigate("/logs")}>
                        <SearchCode className="mr-2 h-4 w-4" />
                        Logs
                    </Button>
                    <Button variant="primary" size="md" onClick={() => navigate("/containers")}>
                        <Terminal className="mr-2 h-4 w-4" />
                        Open Containers
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {infoCards.map((card) => (
                    <Card key={card.label} className="p-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.label}</div>
                                <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{card.value}</div>
                            </div>
                            <div className={cn(
                                "rounded-xl p-2",
                                card.tone === "blue" && "bg-blue-50 text-blue-500 dark:bg-blue-500/10",
                                card.tone === "emerald" && "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10",
                                card.tone === "amber" && "bg-amber-50 text-amber-500 dark:bg-amber-500/10",
                                card.tone === "indigo" && "bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10",
                            )}>
                                <card.icon size={18} />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Container State Distribution</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Running, exited, paused, and unhealthy containers at a glance.</p>
                        </div>
                        <Badge variant="outline">{containers.length} total</Badge>
                    </div>
                    <DonutLegendChart data={containerStateChart} />
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cluster CPU / Memory Trend</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Recent host pressure behind this Docker environment.</p>
                        </div>
                        <Badge variant="outline">{environment.stats?.serverVersion ?? "docker"}</Badge>
                    </div>
                    <TrendAreaChart data={containerCapacityTrend} firstKey="cpu" secondKey="memory" firstColor="#2563eb" secondColor="#0f766e" />
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">System / Host Info</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">The host information Portainer usually highlights in its dashboard.</p>
                        </div>
                        <Badge variant="outline">{environment.status}</Badge>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <InfoTile label="Endpoint" value={environment.url} />
                        <InfoTile label="Context" value={environment.stats?.currentContext || "default"} />
                        <InfoTile label="Storage Driver" value={environment.stats?.storageDriver || "unknown"} />
                        <InfoTile label="Docker Root" value={environment.stats?.dockerRootDir || "unknown"} />
                        <InfoTile label="Kernel / OS" value={[environment.stats?.kernelVersion, environment.stats?.operatingSystem || environment.os].filter(Boolean).join(" • ") || "unknown"} />
                        <InfoTile label="Capacity" value={`${environment.cpuCores ?? 0} CPU • ${Number(environment.memoryGB ?? 0).toFixed(1)} GB RAM • ${environment.diskGB ?? 0} GB disk`} />
                    </div>
                    <div className="mt-6 space-y-3">
                        <UsageBar label="CPU" value={Number(environment.cpuPercent ?? 0)} />
                        <UsageBar label="RAM" value={Number(environment.memPercent ?? 0)} />
                        <UsageBar label="Disk" value={Number(environment.diskPercent ?? 0)} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Docker Runtime</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Core workload objects and lifecycle entry points.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <MetricChip label="Containers" value={containers.length} />
                        <MetricChip label="Stacks" value={stacks.length} />
                        <MetricChip label="Images" value={images.length} />
                        <MetricChip label="Volumes" value={volumes.length} />
                    </div>
                    <div className="mt-6 space-y-2">
                        {[
                            { label: "Manage Containers", path: "/containers" },
                            { label: "Manage Stacks", path: "/stacks" },
                            { label: "Manage Networks", path: "/networks" },
                            { label: "Inspect Logs", path: "/logs" },
                        ].map((item) => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                            >
                                <span>{item.label}</span>
                                <ArrowRight size={16} className="text-zinc-400" />
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6 xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Container Insights</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Top running containers by live CPU and memory pressure.</p>
                        </div>
                        <Badge variant="outline">{topContainerUsage.length} sampled</Badge>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topContainerUsage} margin={{ left: 12, right: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.12} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#71717a" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#71717a" />
                                <Tooltip />
                                <Bar dataKey="cpu" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="memory" fill="#0f766e" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <MetricChip label="Restart Risk" value={containers.filter((item) => /restarting/i.test(item.Status)).length} />
                        <MetricChip label="Idle / Stopped" value={idleContainers} />
                        <MetricChip label="Dangling Images" value={images.filter((item) => !item.RepoTags?.length || item.RepoTags.includes("<none>:<none>")).length} />
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-xl bg-amber-50 p-2 text-amber-500 dark:bg-amber-500/10">
                            <KeyRound className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Control Plane Status</div>
                            <div className="text-xs text-zinc-500">License and alerts at a glance.</div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <InfoTile label="License Tier" value={licenseQuery.data?.tier ?? "unknown"} />
                        <InfoTile label="License Status" value={licenseQuery.data?.status ?? "unknown"} />
                        <InfoTile label="Open Notifications" value={String((notificationsQuery.data ?? []).filter((item) => item.status === "open").length)} />
                        <InfoTile label="Applications Tracked" value={String(applicationsQuery.data?.length ?? 0)} />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Resource Efficiency</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Used vs idle containers and disk posture.</p>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MetricChip label="Used" value={runningContainers.length} />
                        <MetricChip label="Idle" value={idleContainers} />
                    </div>
                    <div className="mt-4 space-y-3">
                        <UsageBar label="Disk Utilization" value={usedStoragePercent} />
                        <UsageBar label="Memory Utilization" value={Number(environment.memPercent ?? 0)} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Image & Storage</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Largest images and storage attachments.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {topImages.map((image) => (
                            <div key={image.name} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{image.name}</div>
                                <div className="mt-1 text-xs text-zinc-500">{image.size} MB</div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Network Graph Summary</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Container and network connectivity density.</p>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MetricChip label="Topology Nodes" value={networkNodes} />
                        <MetricChip label="Topology Edges" value={networkEdges} />
                        <MetricChip label="Networks" value={networks.length} />
                        <MetricChip label="Stacks" value={stacks.length} />
                    </div>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nodes / Agents</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Online status, labels, and resource usage across Docker-capable nodes.</p>
                    </div>
                    <Badge variant="outline">{dockerNodes.length} nodes</Badge>
                </div>
                <div className="space-y-3">
                    {dockerNodes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                            No Docker-capable nodes detected yet.
                        </div>
                    ) : (
                        dockerNodes.map((node) => (
                            <div key={node.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{node.name}</div>
                                            <Badge variant={node.online ? "success" : "error"}>{node.online ? "online" : "offline"}</Badge>
                                            <Badge variant="outline">{node.environment}</Badge>
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            {node.ip} {node.tags.length ? `• ${node.tags.join(", ")}` : ""}
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                                        <UsageMini label="CPU" value={node.cpu} />
                                        <UsageMini label="RAM" value={node.memory} />
                                        <UsageMini label="Disk" value={node.disk} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Events & Alerts</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Recent runtime actions, deploys, and operational anomalies for this Docker environment.</p>
                    </div>
                    <Badge variant="outline">{auditTrail.length} entries</Badge>
                </div>
                <div className="space-y-3">
                    {auditTrail.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                            No recent Docker runtime events captured yet.
                        </div>
                    ) : (
                        auditTrail.map((item) => (
                            <div key={item.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.action} {item.resource_type}</div>
                                    <Badge variant={item.status === "success" ? "success" : "warning"}>{item.status}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{item.resource_id} • {formatRelativeTimestamp(item.created_at)}</div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}

function KubernetesOverview({ environmentId }: { environmentId: string }) {
    const navigate = useNavigate();
    const { data: inventory = [] } = useEnvironmentInventory();
    const environment = inventory.find((item) => item.id === environmentId);
    const [selectedNode, setSelectedNode] = useState("");
    const nodesQuery = useNodes(environmentId, { watch: true });
    const podsQuery = usePods(environmentId, "default", { watch: true });
    const deploymentsQuery = useDeployments(environmentId, "default", { watch: true });
    const namespacesQuery = useNamespaces(environmentId, { watch: true });
    const storageQuery = usePersistentVolumes(environmentId);
    const notificationsQuery = useQuery({
        queryKey: ["dashboard", "notifications"],
        queryFn: () => notificationsApi.list(),
        staleTime: 15_000,
    });
    const applicationsQuery = useQuery({
        queryKey: ["dashboard", "applications"],
        queryFn: () => applicationsApi.list(),
        staleTime: 30_000,
    });
    const clusterHistoryQuery = useQuery({
        queryKey: ["dashboard", "k8s-capacity-history", environment?.serverId],
        queryFn: () => environment?.serverId ? monitoringApi.getMetricsHistory(environment.serverId, 12) : Promise.resolve([]),
        enabled: !!environment?.serverId,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });

    if (!environment) {
        return null;
    }

    const nodes = nodesQuery.data ?? [];
    const pods = podsQuery.data ?? [];
    const deployments = deploymentsQuery.data ?? [];
    const namespaces = namespacesQuery.data ?? [];
    const storage = storageQuery.data ?? [];
    const readyNodes = nodes.filter((item) => item.status === "Ready").length;
    const podStatusDistribution = buildDistribution(pods.map((item) => normalizePodStatus(item.status)));
    const podStatusChart = distributionToChart(podStatusDistribution);
    const clusterHealthScore = calculateClusterHealthScore({
        readyNodes,
        totalNodes: Math.max(nodes.length, environment.stats?.nodes ?? 0),
        runningPods: podStatusDistribution.running ?? 0,
        totalPods: Math.max(pods.length, environment.stats?.pods ?? 0),
        healthyDeployments: deployments.filter((item) => item.ready_replicas >= item.desired_replicas).length,
        totalDeployments: deployments.length || 1,
    });
    const clusterCapacityTrend = buildCapacityTrend([clusterHistoryQuery.data ?? []], Number(environment.cpuPercent ?? 0), Number(environment.memPercent ?? 0));
    const deploymentMismatch = deployments.filter((item) => item.ready_replicas !== item.desired_replicas);
    const totalRestarts = pods.reduce((total, item) => total + Number(item.restarts ?? 0), 0);
    const namespaceWorkload = namespaces.slice(0, 6).map((namespace) => ({
        name: namespace.name,
        primary: pods.filter((pod) => pod.namespace === namespace.name).length,
        secondary: deployments.filter((deployment) => deployment.namespace === namespace.name).length,
        tertiary: storage.filter((volume) => volume.claim.startsWith(`${namespace.name}/`)).length,
    }));
    const nodeStatusChart = distributionToChart({
        ready: readyNodes,
        notReady: Math.max(0, nodes.length - readyNodes),
    });
    const selectedNodeName = selectedNode || nodes[0]?.name || "";
    const selectedNodePods = pods.filter((item) => item.node === selectedNodeName);
    const selectedNodePressure = buildNodePressure(nodes.find((item) => item.name === selectedNodeName));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Globe className="h-6 w-6 text-blue-500" />
                        Kubernetes Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Cluster summary and workload navigation for {environment.name}.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate("/nodes")}>Nodes</Button>
                    <Button variant="outline" onClick={() => navigate("/pods")}>Pods</Button>
                    <Button variant="primary" onClick={() => navigate("/deployments")}>Deployments</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCardSimple label="Health Score" value={clusterHealthScore} icon={ShieldCheck} />
                <MetricCardSimple label="Nodes Ready" value={readyNodes} icon={Server} />
                <MetricCardSimple label="Pods Running" value={podStatusDistribution.running ?? 0} icon={Layers} />
                <MetricCardSimple label="Namespaces" value={namespaces.length || (environment.stats?.namespaces ?? 0)} icon={Database} />
                <MetricCardSimple label="Healthy Deployments" value={deployments.filter((item) => item.ready_replicas >= item.desired_replicas).length} icon={FolderKanban} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cluster Overview</div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">Pod distribution and whole-cluster usage trends.</div>
                        </div>
                        <Badge variant="outline">{environment.name}</Badge>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <DonutLegendChart data={podStatusChart} />
                        <div className="space-y-3">
                            <UsageBar label="CPU Usage" value={Number(environment.cpuPercent ?? 0)} />
                            <UsageBar label="Memory Usage" value={Number(environment.memPercent ?? 0)} />
                            <UsageBar label="Storage Usage" value={Number(environment.diskPercent ?? 0)} />
                        </div>
                    </div>
                    <div className="mt-6">
                        <TrendAreaChart data={clusterCapacityTrend} firstKey="cpu" secondKey="memory" firstColor="#2563eb" secondColor="#7c3aed" />
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Node Monitoring</div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">Ready state, node pressure, and workload placement.</div>
                        </div>
                        <Badge variant="outline">{nodes.length} nodes</Badge>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                        <DonutLegendChart data={nodeStatusChart} />
                        <div className="space-y-3">
                            {nodes.slice(0, 5).map((node) => (
                                <button
                                    key={node.name}
                                    type="button"
                                    onClick={() => setSelectedNode(node.name)}
                                    className={cn(
                                        "w-full rounded-xl border px-4 py-3 text-left transition-all",
                                        selectedNodeName === node.name
                                            ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200 dark:border-blue-500/30 dark:bg-blue-500/8 dark:ring-blue-500/20"
                                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{node.name}</div>
                                            {selectedNodeName === node.name ? <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Focused</span> : null}
                                        </div>
                                        <Badge variant={node.status === "Ready" ? "success" : "warning"}>{node.status}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-500">{node.role} • {node.internal_ip}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <MetricChip label="Pods on node" value={selectedNodePods.length} />
                        <MetricChip label="Memory Pressure" value={selectedNodePressure.memoryPressure ? 1 : 0} />
                        <MetricChip label="Disk Pressure" value={selectedNodePressure.diskPressure ? 1 : 0} />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6 xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Workload Insights</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Replica drift, restart pressure, and tracked applications.</p>
                        </div>
                        <Badge variant="outline">{deployments.length} deployments</Badge>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <MetricChip label="Replica Mismatch" value={deploymentMismatch.length} />
                        <MetricChip label="Restart Count" value={totalRestarts} />
                        <MetricChip label="Failed Pods" value={podStatusDistribution.failed ?? 0} />
                    </div>
                    <div className="mt-5 space-y-3">
                        {deploymentMismatch.slice(0, 5).map((deployment) => (
                            <div key={`${deployment.namespace}:${deployment.name}`} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{deployment.name}</div>
                                    <Badge variant="warning">{deployment.ready_replicas}/{deployment.desired_replicas}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{deployment.namespace} • {deployment.status}</div>
                            </div>
                        ))}
                        {deploymentMismatch.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                No replica mismatch detected right now.
                            </div>
                        ) : null}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Notification Posture</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Open issues and unread alerts across the workspace.</p>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MetricChip label="Open" value={(notificationsQuery.data ?? []).filter((item) => item.status === "open").length} />
                        <MetricChip label="Unread" value={(notificationsQuery.data ?? []).filter((item) => !item.read).length} />
                        <MetricChip label="Tracked Apps" value={applicationsQuery.data?.length ?? 0} />
                        <MetricChip label="PVC / PV" value={storage.length} />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Storage Monitoring</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Persistent volumes and storage usage posture.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <UsageBar label="Cluster Storage" value={Number(environment.diskPercent ?? 0)} />
                        <MetricChip label="Persistent Volumes" value={storage.length} />
                        <MetricChip label="Namespaces" value={namespaces.length} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Namespace Analytics</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Pod and deployment spread by namespace.</p>
                        </div>
                    </div>
                    <EnvironmentRankingChart
                        data={namespaceWorkload}
                        primaryLabel="Pods"
                        secondaryLabel="Deployments"
                        tertiaryLabel="Claims"
                    />
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Event & Alert Focus</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cluster-facing notifications and drift signals.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {(notificationsQuery.data ?? []).slice(0, 5).map((item) => (
                            <div key={item.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>
                                    <Badge variant={item.priority === "high" ? "warning" : "outline"}>{item.priority}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{item.channel} • {formatRelativeTimestamp(item.created_at)}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function AdminOverview() {
    const navigate = useNavigate();
    const inventoryQuery = useEnvironmentInventory();
    const { data: serverData } = useServers({ page: 1, page_size: 200 });
    const applicationsQuery = useQuery({
        queryKey: ["dashboard", "applications"],
        queryFn: () => applicationsApi.list(),
        staleTime: 30_000,
    });
    const notificationsQuery = useQuery({
        queryKey: ["dashboard", "notifications"],
        queryFn: () => notificationsApi.list(),
        staleTime: 15_000,
    });
    const licenseQuery = useQuery({
        queryKey: ["dashboard", "license"],
        queryFn: () => settingsApi.getLicense(),
        staleTime: 60_000,
    });
    const flagsQuery = useQuery({
        queryKey: ["dashboard", "feature-flags"],
        queryFn: () => settingsApi.listFeatureFlags(),
        staleTime: 60_000,
    });
    const usersQuery = useQuery({
        queryKey: ["dashboard", "users"],
        queryFn: () => usersTeamsApi.listUsers({ page: 1, page_size: 200 }),
        staleTime: 60_000,
    });
    const teamsQuery = useQuery({
        queryKey: ["dashboard", "teams"],
        queryFn: () => usersTeamsApi.listTeams({ page: 1, page_size: 200 }),
        staleTime: 60_000,
    });
    const rolesQuery = useQuery({
        queryKey: ["dashboard", "roles"],
        queryFn: () => usersTeamsApi.listRoles({ page: 1, page_size: 200 }),
        staleTime: 60_000,
    });
    const presenceQuery = useQuery({
        queryKey: ["dashboard", "presence"],
        queryFn: () => dashboardApi.getPresence(),
        staleTime: 20_000,
        refetchInterval: 20_000,
    });
    const auditTimelineQuery = useQuery({
        queryKey: ["dashboard", "audit-timeline"],
        queryFn: () => dashboardApi.listAuditTimeline(12),
        staleTime: 20_000,
        refetchInterval: 20_000,
    });

    const inventory = inventoryQuery.data ?? [];
    const servers = serverData?.data ?? [];
    const applications = applicationsQuery.data ?? [];
    const notifications = notificationsQuery.data ?? [];
    const flags = flagsQuery.data ?? [];
    const users = usersQuery.data?.items ?? [];
    const teams = teamsQuery.data?.items ?? [];
    const roles = rolesQuery.data?.items ?? [];
    const presence = presenceQuery.data;
    const auditTimeline = auditTimelineQuery.data ?? [];

    const dockerEnvironments = inventory.filter((item) => item.type === "docker");
    const kubernetesEnvironments = inventory.filter((item) => item.type === "kubernetes");
    const onlineServers = servers.filter((item) => item.status === "online");
    const offlineServers = servers.filter((item) => item.status !== "online");
    const activeUsers = users.filter((item) => item.is_active);
    const adminUsers = users.filter((item) => item.roles.some((role) => role.toLowerCase() === "admin"));
    const healthyApplications = applications.filter((item) => item.status.toLowerCase() === "healthy");
    const issueApplications = applications.filter((item) => item.status.toLowerCase() !== "healthy");
    const openNotifications = notifications.filter((item) => item.status === "open");
    const unreadNotifications = notifications.filter((item) => !item.read);
    const criticalNotifications = notifications.filter((item) => item.priority === "high");
    const downEnvironments = inventory.filter((item) => item.status !== "up");
    const averageCpu = inventory.length
        ? Math.round(inventory.reduce((total, item) => total + Number(item.cpuPercent ?? 0), 0) / inventory.length)
        : 0;
    const averageMemory = inventory.length
        ? Math.round(inventory.reduce((total, item) => total + Number(item.memPercent ?? 0), 0) / inventory.length)
        : 0;
    const totalCpuCores = servers.reduce((total, item) => total + Number(item.cpu_cores ?? 0), 0);
    const totalMemoryGb = servers.reduce((total, item) => total + Number(item.memory_gb ?? 0), 0);
    const totalDiskGb = servers.reduce((total, item) => total + Number(item.disk_gb ?? 0), 0);
    const riskServers = servers
        .filter((item) => item.status !== "online")
        .slice(0, 5);
    const busiestEnvironments = [...inventory]
        .sort((left, right) => Number(right.cpuPercent ?? 0) - Number(left.cpuPercent ?? 0))
        .slice(0, 5);
    const topCapacityServers = [...onlineServers]
        .sort((left, right) => Number(right.cpu_cores ?? 0) - Number(left.cpu_cores ?? 0))
        .slice(0, 8);

    const capacityHistoryQueries = useQueries({
        queries: topCapacityServers.map((server) => ({
            queryKey: ["dashboard", "capacity-history", server.id],
            queryFn: () => monitoringApi.getMetricsHistory(server.id, 12).catch(() => []),
            staleTime: 30_000,
            refetchInterval: 30_000,
        })),
    });

    const alertTrend = useMemo(() => buildAlertTrend(notifications), [notifications]);
    const capacityTrend = useMemo(() => {
        const histories = capacityHistoryQueries
            .map((query) => query.data ?? [])
            .filter((items) => items.length > 0);
        return buildCapacityTrend(histories, averageCpu, averageMemory);
    }, [capacityHistoryQueries, averageCpu, averageMemory]);
    const topDockerEnvironments = useMemo(
        () => [...dockerEnvironments]
            .sort((left, right) => scoreDockerEnvironment(right) - scoreDockerEnvironment(left))
            .slice(0, 5),
        [dockerEnvironments],
    );
    const topKubernetesEnvironments = useMemo(
        () => [...kubernetesEnvironments]
            .sort((left, right) => scoreKubernetesEnvironment(right) - scoreKubernetesEnvironment(left))
            .slice(0, 5),
        [kubernetesEnvironments],
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <Card className="overflow-hidden p-8">
                <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl bg-blue-50 p-3 text-blue-500 dark:bg-blue-500/10">
                                <Server size={22} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Administration Overview</h1>
                                <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                                    A control-plane dashboard for environments, tracked applications, notifications, entitlements, and feature posture.
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCardSimple label="Servers" value={servers.length} icon={Server} />
                            <MetricCardSimple label="Environments" value={inventory.length} icon={Globe} />
                            <MetricCardSimple label="Applications" value={applications.length} icon={FolderKanban} />
                            <MetricCardSimple label="Open Alerts" value={openNotifications.length} icon={Bell} />
                        </div>
                    </div>
                    <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-950/30">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Workspace License</div>
                        <div className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{licenseQuery.data?.tier?.toUpperCase() ?? "UNKNOWN"}</div>
                        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{licenseQuery.data?.status ?? "unknown"}</div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <MetricChip label="Enabled Flags" value={flags.filter((item) => item.enabled).length} />
                            <MetricChip label="Critical Alerts" value={criticalNotifications.length} />
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => navigate("/settings/license")}>Manage License</Button>
                            <Button variant="primary" onClick={() => navigate("/settings/feature-flags")}>Feature Flags</Button>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
                <MetricCardSimple label="Server On" value={onlineServers.length} icon={ShieldCheck} />
                <MetricCardSimple label="Server Off" value={offlineServers.length} icon={Server} />
                <MetricCardSimple label="Docker Env" value={dockerEnvironments.length} icon={Box} />
                <MetricCardSimple label="K8s Env" value={kubernetesEnvironments.length} icon={Globe} />
                <MetricCardSimple label="Online Users (5m)" value={presence?.online_users_5m ?? 0} icon={Activity} />
                <MetricCardSimple label="Online Users (15m)" value={presence?.online_users_15m ?? 0} icon={Activity} />
                <MetricCardSimple label="Active Sessions" value={presence?.active_sessions ?? 0} icon={Monitor} />
                <MetricCardSimple label="Admins" value={adminUsers.length} icon={Sparkles} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Alert Trend</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Seven-day alert posture across open and critical notifications.</p>
                        </div>
                        <Badge variant="outline">{notifications.length} total alerts</Badge>
                    </div>
                    <TrendAreaChart
                        data={alertTrend}
                        firstKey="open"
                        secondKey="critical"
                        firstColor="#2563eb"
                        secondColor="#dc2626"
                    />
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Fleet Capacity Trend</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Recent CPU and memory history sampled from the strongest online nodes in the fleet.</p>
                        </div>
                        <Badge variant="outline">{topCapacityServers.length} nodes sampled</Badge>
                    </div>
                    <TrendAreaChart
                        data={capacityTrend}
                        firstKey="cpu"
                        secondKey="memory"
                        firstColor="#0f766e"
                        secondColor="#7c3aed"
                    />
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Environment Inventory</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Switching into an environment turns the dashboard into Docker or Kubernetes runtime mode.</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate("/environments")}>Open Environments</Button>
                    </div>
                    <div className="space-y-3">
                        {(inventoryQuery.data ?? []).slice(0, 5).map((environment) => (
                            <div key={environment.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div>
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{environment.name}</div>
                                    <div className="mt-1 text-xs text-zinc-500">{environment.type} • {environment.url}</div>
                                </div>
                                <Badge variant={environment.status === "up" ? "success" : "outline"}>{environment.status}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Operational Inbox</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Recent notifications and routing-sensitive operational events.</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate("/notifications")}>Open Inbox</Button>
                    </div>
                    <div className="space-y-3">
                        {(notificationsQuery.data ?? []).slice(0, 5).map((item) => (
                            <div key={item.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</div>
                                    <Badge variant={item.status === "open" ? "warning" : "success"}>{item.status}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">{item.channel} • {item.priority}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Infrastructure Capacity</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Total estate footprint and average control-plane utilization.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <InfoTile label="Total CPU" value={`${totalCpuCores} cores`} />
                        <InfoTile label="Total Memory" value={`${totalMemoryGb.toFixed(1)} GB`} />
                        <InfoTile label="Total Disk" value={`${totalDiskGb.toFixed(1)} GB`} />
                    </div>
                    <div className="mt-5 space-y-3">
                        <UsageBar label="Average CPU Utilization" value={averageCpu} />
                        <UsageBar label="Average Memory Utilization" value={averageMemory} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Workspace Health</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Application health, unread alerts, and environment availability.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <MetricChip label="Healthy Apps" value={healthyApplications.length} />
                        <MetricChip label="Issue Apps" value={issueApplications.length} />
                        <MetricChip label="Unread Alerts" value={unreadNotifications.length} />
                        <MetricChip label="Env Down" value={downEnvironments.length} />
                    </div>
                    <div className="mt-4 rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                        {teams.length} teams and {roles.length} roles are configured. {activeUsers.length} enabled users exist, while {presence?.online_users_5m ?? 0} users are currently active in the last 5 minutes.
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform Split</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">How the managed estate is distributed across runtime types.</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <UsageBar label="Docker Share" value={inventory.length ? (dockerEnvironments.length / inventory.length) * 100 : 0} />
                        <UsageBar label="Kubernetes Share" value={inventory.length ? (kubernetesEnvironments.length / inventory.length) * 100 : 0} />
                    </div>
                    <div className="mt-5 space-y-3">
                        <InfoTile label="Docker Workspaces" value={`${dockerEnvironments.length} environments`} />
                        <InfoTile label="Kubernetes Workspaces" value={`${kubernetesEnvironments.length} environments`} />
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Servers Requiring Attention</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Offline or degraded servers that should be checked first.</p>
                        </div>
                        <Badge variant="outline">{riskServers.length} flagged</Badge>
                    </div>
                    <div className="space-y-3">
                        {riskServers.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                No high-risk servers detected right now.
                            </div>
                        ) : (
                            riskServers.map((server) => (
                                <div key={server.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{server.name}</div>
                                        <div className="mt-1 text-xs text-zinc-500">{server.ip_address} • {server.environment ?? "unknown"}</div>
                                    </div>
                                    <Badge variant={server.status === "error" ? "error" : "warning"}>{server.status}</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Busiest Environments</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Highest CPU pressure across Docker and Kubernetes environments.</p>
                        </div>
                        <Badge variant="outline">{busiestEnvironments.length} shown</Badge>
                    </div>
                    <div className="space-y-3">
                        {busiestEnvironments.map((environment) => (
                            <div key={environment.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{environment.name}</div>
                                        <div className="mt-1 text-xs text-zinc-500">{environment.type} • {environment.url}</div>
                                    </div>
                                    <Badge variant="outline">{Math.round(environment.cpuPercent ?? 0)}%</Badge>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <UsageMini label="CPU" value={Number(environment.cpuPercent ?? 0)} />
                                    <UsageMini label="RAM" value={Number(environment.memPercent ?? 0)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
                <Card className="p-6 xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Docker Environments</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Highest-density Docker estates by containers, stacks, and images.</p>
                        </div>
                        <Badge variant="outline">{topDockerEnvironments.length} shown</Badge>
                    </div>
                    <EnvironmentRankingChart
                        data={topDockerEnvironments.map((environment) => ({
                            name: environment.name,
                            primary: Number(environment.stats?.containers ?? 0),
                            secondary: Number(environment.stats?.stacks ?? 0),
                            tertiary: Number(environment.stats?.images ?? 0),
                        }))}
                        primaryLabel="Containers"
                        secondaryLabel="Stacks"
                        tertiaryLabel="Images"
                    />
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Online Operators</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Real session presence from authenticated requests.</p>
                        </div>
                        <Badge variant="outline">{presence?.users.length ?? 0} users</Badge>
                    </div>
                    <div className="space-y-3">
                        {(presence?.users ?? []).slice(0, 6).map((user) => (
                            <div key={user.user_id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.full_name || user.email}</div>
                                        <div className="mt-1 text-xs text-zinc-500">{user.email}</div>
                                    </div>
                                    <Badge variant="success">{user.active_sessions} sessions</Badge>
                                </div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    Last seen {formatRelativeTimestamp(user.last_seen_at)} • windows {user.online_windows.join(", ")}
                                </div>
                            </div>
                        ))}
                        {(presence?.users.length ?? 0) === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                No live session presence detected yet.
                            </div>
                        ) : null}
                    </div>
                </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.1fr]">
                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Kubernetes Environments</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Clusters ranked by nodes, pods, and namespaces.</p>
                        </div>
                        <Badge variant="outline">{topKubernetesEnvironments.length} shown</Badge>
                    </div>
                    <EnvironmentRankingChart
                        data={topKubernetesEnvironments.map((environment) => ({
                            name: environment.name,
                            primary: Number(environment.stats?.nodes ?? 0),
                            secondary: Number(environment.stats?.pods ?? 0),
                            tertiary: Number(environment.stats?.namespaces ?? 0),
                        }))}
                        primaryLabel="Nodes"
                        secondaryLabel="Pods"
                        tertiaryLabel="Namespaces"
                    />
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Capacity Pressure</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Current estate pressure by platform and utilization class.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <MetricChip label="Avg CPU" value={averageCpu} />
                        <MetricChip label="Avg Memory" value={averageMemory} />
                        <MetricChip label="Critical Alerts" value={criticalNotifications.length} />
                        <MetricChip label="Unread Alerts" value={unreadNotifications.length} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Activity Timeline</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Latest IAM and control-plane actions for ops review.</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate("/logs")}>Open Audit</Button>
                    </div>
                    <div className="space-y-3">
                        {auditTimeline.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                No recent audit activity available.
                            </div>
                        ) : (
                            auditTimeline.map((item) => (
                                <div key={item.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {item.action} {item.resource}
                                        </div>
                                        <Badge variant={item.status === "success" ? "success" : "warning"}>{item.status}</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                        {item.user_email || item.user_id} • {item.environment || "workspace"} • {formatRelativeTimestamp(item.timestamp)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function TrendAreaChart({
    data,
    firstKey,
    secondKey,
    firstColor,
    secondColor,
}: {
    data: Array<Record<string, number | string>>;
    firstKey: string;
    secondKey: string;
    firstColor: string;
    secondColor: string;
}) {
    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`gradient-${firstKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={firstColor} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={firstColor} stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id={`gradient-${secondKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={secondColor} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={secondColor} stopOpacity={0.03} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#71717a" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#71717a" />
                    <Tooltip />
                    <Area type="monotone" dataKey={firstKey} stroke={firstColor} fill={`url(#gradient-${firstKey})`} strokeWidth={2} />
                    <Area type="monotone" dataKey={secondKey} stroke={secondColor} fill={`url(#gradient-${secondKey})`} strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function EnvironmentRankingChart({
    data,
    primaryLabel,
    secondaryLabel,
    tertiaryLabel,
}: {
    data: Array<{ name: string; primary: number; secondary: number; tertiary: number }>;
    primaryLabel: string;
    secondaryLabel: string;
    tertiaryLabel: string;
}) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No environment metrics available yet.
            </div>
        );
    }
    return (
        <div className="space-y-4">
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 24, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.12} />
                        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#71717a" />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} stroke="#71717a" />
                        <Tooltip />
                        <Bar dataKey="primary" fill="#2563eb" radius={[0, 6, 6, 0]} />
                        <Bar dataKey="secondary" fill="#0f766e" radius={[0, 6, 6, 0]} />
                        <Bar dataKey="tertiary" fill="#a16207" radius={[0, 6, 6, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                <Badge variant="outline">{primaryLabel}</Badge>
                <Badge variant="outline">{secondaryLabel}</Badge>
                <Badge variant="outline">{tertiaryLabel}</Badge>
            </div>
        </div>
    );
}

function buildAlertTrend(notifications: Array<{ created_at: string; status: string; priority: string }>) {
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return {
            key: date.toISOString().slice(0, 10),
            label,
            open: 0,
            critical: 0,
        };
    });
    const byDay = new Map(days.map((item) => [item.key, item]));
    notifications.forEach((notification) => {
        const key = notification.created_at?.slice(0, 10);
        if (!key || !byDay.has(key)) return;
        const bucket = byDay.get(key)!;
        if (notification.status === "open") {
            bucket.open += 1;
        }
        if (notification.priority === "high") {
            bucket.critical += 1;
        }
    });
    return days;
}

function buildDistribution(values: string[]) {
    return values.reduce<Record<string, number>>((accumulator, value) => {
        const key = value || "unknown";
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
    }, {});
}

function distributionToChart(distribution: Record<string, number>) {
    const palette = ["#2563eb", "#0f766e", "#d97706", "#dc2626", "#7c3aed", "#475569"];
    return Object.entries(distribution).map(([name, value], index) => ({
        name,
        value,
        color: palette[index % palette.length],
    }));
}

function buildCapacityTrend(histories: Array<Array<{ cpu_usage?: number; memory_usage?: number; recorded_at?: string }>>, fallbackCpu: number, fallbackMemory: number) {
    if (histories.length === 0) {
        return [{ label: "now", cpu: fallbackCpu, memory: fallbackMemory }];
    }
    const buckets = new Map<string, { label: string; cpuTotal: number; memoryTotal: number; count: number }>();
    histories.forEach((history) => {
        history.forEach((item) => {
            if (!item.recorded_at) return;
            const key = item.recorded_at.slice(0, 16);
            const label = new Date(item.recorded_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            const bucket = buckets.get(key) ?? { label, cpuTotal: 0, memoryTotal: 0, count: 0 };
            bucket.cpuTotal += Number(item.cpu_usage ?? 0);
            bucket.memoryTotal += Number(item.memory_usage ?? 0);
            bucket.count += 1;
            buckets.set(key, bucket);
        });
    });
    return [...buckets.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-12)
        .map(([, item]) => ({
            label: item.label,
            cpu: item.count ? Math.round(item.cpuTotal / item.count) : fallbackCpu,
            memory: item.count ? Math.round(item.memoryTotal / item.count) : fallbackMemory,
        }));
}

function DonutLegendChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
    if (data.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No chart data available yet.
            </div>
        );
    }
    return (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChartWrapper data={data} />
                </ResponsiveContainer>
            </div>
            <div className="space-y-3">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PieChartWrapper({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
    return (
        <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                ))}
            </Pie>
            <Tooltip />
        </PieChart>
    );
}

function normalizeContainerState(state?: string) {
    const value = String(state ?? "").trim().toLowerCase();
    if (!value) return "unknown";
    if (value.includes("running")) return "running";
    if (value.includes("paused")) return "paused";
    if (value.includes("restarting")) return "restarting";
    if (value.includes("exited")) return "exited";
    return value;
}

function normalizePodStatus(status?: string) {
    const value = String(status ?? "").trim().toLowerCase();
    if (!value) return "unknown";
    if (value.includes("running")) return "running";
    if (value.includes("pending")) return "pending";
    if (value.includes("failed") || value.includes("crash") || value.includes("error")) return "failed";
    if (value.includes("succeeded")) return "succeeded";
    return value;
}

function cleanContainerName(name: string) {
    return name.replace(/^\//, "");
}

function parsePercentString(value?: string) {
    const match = String(value ?? "").match(/[\d.]+/);
    return match ? Math.round(Number(match[0])) : 0;
}

function calculateClusterHealthScore({
    readyNodes,
    totalNodes,
    runningPods,
    totalPods,
    healthyDeployments,
    totalDeployments,
}: {
    readyNodes: number;
    totalNodes: number;
    runningPods: number;
    totalPods: number;
    healthyDeployments: number;
    totalDeployments: number;
}) {
    const nodeScore = totalNodes > 0 ? (readyNodes / totalNodes) * 35 : 35;
    const podScore = totalPods > 0 ? (runningPods / totalPods) * 35 : 35;
    const deploymentScore = totalDeployments > 0 ? (healthyDeployments / totalDeployments) * 30 : 30;
    return Math.round(nodeScore + podScore + deploymentScore);
}

function buildNodePressure(node?: { status?: string }) {
    const status = String(node?.status ?? "").toLowerCase();
    return {
        memoryPressure: status.includes("memorypressure"),
        diskPressure: status.includes("diskpressure"),
    };
}

function scoreDockerEnvironment(environment: any) {
    return Number(environment.stats?.containers ?? 0) * 5
        + Number(environment.stats?.stacks ?? 0) * 3
        + Number(environment.stats?.images ?? 0);
}

function scoreKubernetesEnvironment(environment: any) {
    return Number(environment.stats?.nodes ?? 0) * 5
        + Number(environment.stats?.pods ?? 0)
        + Number(environment.stats?.namespaces ?? 0) * 2;
}

function formatRelativeTimestamp(value?: string) {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
}

function MetricCardSimple({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Server }) {
    return (
        <Card className="p-5">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
                </div>
                <div className="rounded-xl bg-blue-50 p-2 text-blue-500 dark:bg-blue-500/10">
                    <Icon size={18} />
                </div>
            </div>
        </Card>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className="mt-1 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}

function UsageBar({ label, value }: { label: string; value: number }) {
    const safe = Math.max(0, Math.min(100, value));
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>{label}</span>
                <span>{Math.round(safe)}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className={cn(
                    "h-2 rounded-full transition-all",
                    safe >= 85 ? "bg-red-500" : safe >= 65 ? "bg-amber-500" : "bg-blue-500",
                )} style={{ width: `${safe}%` }} />
            </div>
        </div>
    );
}

function UsageMini({ label, value }: { label: string; value: number }) {
    const safe = Math.max(0, Math.min(100, value));
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>{label}</span>
                <span>{Math.round(safe)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className={cn(
                    "h-1.5 rounded-full transition-all",
                    safe >= 85 ? "bg-red-500" : safe >= 65 ? "bg-amber-500" : "bg-emerald-500",
                )} style={{ width: `${safe}%` }} />
            </div>
        </div>
    );
}

function MetricChip({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
        </div>
    );
}
