import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { HardDrive, RefreshCw, Server, TerminalSquare, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { apiFetch } from "@/core/api-client";
import { serversApi } from "@/shared/api/client";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { useServers } from "@/features/servers/api/useServers";
import { cn } from "@/lib/utils";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { K8sPodExecTerminal } from "../components/K8sPodExecTerminal";
import { useClusters, useKubernetesNodeAction, useKubernetesNodeDetail, useLiveNodes, useNamespaces, useNodes, useStartKubernetesNodeDebugSession } from "../api/useKubernetesHooks";
import type { K8sNodeDetail } from "../types";

export default function NodesPage() {
    const { selectedEnvironment } = useEnvironment();

    if (selectedEnvironment?.type === "docker") {
        return <DockerNodesPage />;
    }

    return <KubernetesNodesPage />;
}

function DockerNodesPage() {
    const { data: serverData, refetch } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data ?? [];
    const queries = useQueries({
        queries: servers.map((server) => ({
            queryKey: ["docker-nodes", server.id],
            queryFn: async () => ({
                server,
                agent: await serversApi.agentStatus(server.id).catch(() => null),
            }),
            staleTime: 15_000,
            refetchInterval: 20_000,
        })),
    });

    const nodes = useMemo(() => {
        return queries
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
                cpu: Number(item.agent?.cpu_percent ?? 0),
                memory: Number(item.agent?.mem_percent ?? 0),
                disk: Number(item.agent?.disk_percent ?? 0),
            }));
    }, [queries]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Server className="h-6 w-6 text-blue-500" />
                        Docker Nodes / Agents
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Agent nodes, labels, availability, and resource pressure across Docker-capable infrastructure.
                    </p>
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Node</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Environment</TableHead>
                                <TableHead>Labels</TableHead>
                                <TableHead>CPU</TableHead>
                                <TableHead>RAM</TableHead>
                                <TableHead>Disk</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center text-zinc-500 dark:text-zinc-400">
                                        No Docker-capable agent nodes detected.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                nodes.map((node) => (
                                    <TableRow key={node.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{node.name}</span>
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{node.ip}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={node.online ? "success" : "error"}>{node.online ? "online" : "offline"}</Badge>
                                        </TableCell>
                                        <TableCell className="capitalize text-zinc-600 dark:text-zinc-400">{node.environment}</TableCell>
                                        <TableCell className="text-xs text-zinc-500 dark:text-zinc-400">{node.tags.join(", ") || "-"}</TableCell>
                                        <TableCell><UsageBar value={node.cpu} /></TableCell>
                                        <TableCell><UsageBar value={node.memory} /></TableCell>
                                        <TableCell><UsageBar value={node.disk} /></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

function KubernetesNodesPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];

    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [watchEnabled, setWatchEnabled] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNodeName, setSelectedNodeName] = useState("");
    const [nodeDescribe, setNodeDescribe] = useState("");
    const [debugSession, setDebugSession] = useState<{ nodeName: string; namespace: string; podName: string; image: string } | null>(null);

    useEffect(() => {
        if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
            setSelectedClusterId(selectedEnvironment.id);
            return;
        }
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId, selectedEnvironment]);

    const { data: nodes = [], isLoading, refetch } = useNodes(selectedClusterId, { watch: watchEnabled });
    const liveNodes = useLiveNodes(selectedClusterId, watchEnabled);
    const cordonNode = useKubernetesNodeAction(selectedClusterId, "cordon");
    const uncordonNode = useKubernetesNodeAction(selectedClusterId, "uncordon");
    const drainNode = useKubernetesNodeAction(selectedClusterId, "drain");
    const startNodeDebug = useStartKubernetesNodeDebugSession(selectedClusterId);
    const { data: namespacesData = [] } = useNamespaces(selectedClusterId, { watch: watchEnabled });
    const { data: selectedNode, isLoading: isNodeDetailLoading, refetch: refetchNodeDetail } = useKubernetesNodeDetail(
        selectedClusterId,
        selectedNodeName,
        { enabled: !!selectedNodeName, watch: watchEnabled },
    );
    const namespaces = namespacesData.map((item) => item.name);

    useEffect(() => {
        if (namespaces.length && !namespaces.includes(namespace)) {
            setNamespace(namespaces[0]);
        }
    }, [namespace, namespaces]);

    useEffect(() => {
        if (!selectedClusterId || !selectedNodeName) {
            setNodeDescribe("");
            return;
        }
        let cancelled = false;
        apiFetch<{ output: string }>(`/v1/environments/${selectedClusterId}/kubernetes/nodes/${encodeURIComponent(selectedNodeName)}/describe`)
            .then((payload) => {
                if (!cancelled) {
                    setNodeDescribe(payload.output || "");
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setNodeDescribe("");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [selectedClusterId, selectedNodeName]);

    useEffect(() => {
        if (!debugSession || !selectedNodeName || debugSession.nodeName === selectedNodeName) {
            return;
        }
        setDebugSession(null);
    }, [debugSession, selectedNodeName]);

    const nodeItems = liveNodes.data ?? nodes;
    const filteredNodes = nodeItems.filter((node) =>
        [node.name, node.role, node.status, node.internal_ip, node.labels]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchQuery.toLowerCase())),
    );

    const runNodeAction = async (nodeName: string, action: "cordon" | "uncordon" | "drain") => {
        try {
            if (action === "cordon") {
                await cordonNode.mutateAsync({ nodeName });
            } else if (action === "uncordon") {
                await uncordonNode.mutateAsync({ nodeName });
            } else {
                await drainNode.mutateAsync({ nodeName });
            }
            showNotification({
                type: "success",
                message: `Node ${action} completed`,
                description: `${nodeName} updated successfully.`,
            });
            void refetch();
        } catch (error) {
            showNotification({
                type: "error",
                message: `Node ${action} failed`,
                description: error instanceof Error ? error.message : "Unable to update node.",
            });
        }
    };

    const launchNodeDebug = async (nodeName: string) => {
        try {
            const payload = await startNodeDebug.mutateAsync({ nodeName, namespace });
            setDebugSession({
                nodeName,
                namespace: payload.namespace,
                podName: payload.pod_name,
                image: payload.image,
            });
            showNotification({
                type: "success",
                message: "Node debug pod ready",
                description: `${payload.pod_name} created in ${payload.namespace}.`,
            });
        } catch (error) {
            showNotification({
                type: "error",
                message: "Node debug failed",
                description: error instanceof Error ? error.message : "Unable to create debug pod.",
            });
        }
    };

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="nodes"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="flex h-full flex-col gap-6">
                <div className="sticky top-0 z-[5] flex items-center justify-between border-b border-zinc-100 bg-[#fcfcfc] pb-6 pt-1 dark:border-zinc-800/80 dark:bg-[#0a0a0a]">
                    <div className="flex-1">
                        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            <HardDrive className="h-5 w-5 text-indigo-500" />
                            Cluster Nodes
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Live node inventory, readiness, role, and capacity for the selected environment.
                        </p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                        <div className="w-64">
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search nodes, roles, labels..."
                            />
                        </div>
                        <Button
                            variant={watchEnabled ? "primary" : "outline"}
                            size="sm"
                            onClick={() => setWatchEnabled((current) => !current)}
                        >
                            {watchEnabled ? (liveNodes.isConnected ? "Live" : "Watching") : "Watch"}
                        </Button>
                        <Button variant="outline" size="md" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="mb-6 grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#0d0d0d]">
                    <div className="custom-scrollbar flex-1 overflow-x-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-[1] bg-zinc-50/50 dark:bg-zinc-900/30">
                                <TableRow className="border-b border-zinc-100 hover:bg-transparent dark:border-zinc-800">
                                    <TableHead>Node</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Internal IP</TableHead>
                                    <TableHead>Capacity</TableHead>
                                    <TableHead>Age</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 4 }).map((_, index) => (
                                    <TableRow key={index}>
                                            <TableCell><div className="h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-4 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-4 w-14 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                            <TableCell><div className="h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredNodes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-48 text-center text-zinc-500 dark:text-zinc-400">
                                            No Kubernetes nodes detected for this environment.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredNodes.map((node) => (
                                        <TableRow
                                            key={node.name}
                                            className="cursor-pointer"
                                            onClick={() => setSelectedNodeName(node.name)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 dark:border-indigo-500/10 dark:bg-indigo-500/10">
                                                        <Server size={16} className="text-indigo-500" />
                                                    </div>
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{node.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={node.status === "Ready" ? "success" : "warning"}>{node.status}</Badge>
                                            </TableCell>
                                            <TableCell className="capitalize text-zinc-600 dark:text-zinc-400">{node.role}</TableCell>
                                            <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{node.version || "-"}</TableCell>
                                            <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{node.internal_ip || "-"}</TableCell>
                                            <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                CPU {node.cpu_capacity || "-"} / RAM {node.memory_capacity || "-"}
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">{node.age}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!node.schedulable || cordonNode.isPending}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void runNodeAction(node.name, "cordon");
                                                        }}
                                                    >
                                                        Cordon
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={Boolean(node.schedulable) || uncordonNode.isPending}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void runNodeAction(node.name, "uncordon");
                                                        }}
                                                    >
                                                        Uncordon
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300"
                                                        disabled={drainNode.isPending}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void runNodeAction(node.name, "drain");
                                                        }}
                                                    >
                                                        Drain
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <div className="min-h-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#0d0d0d]">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Node Detail</div>
                            <div className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                {selectedNodeName || "Select a node"}
                            </div>
                        </div>
                        {selectedNodeName ? (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => refetchNodeDetail()}>
                                    <RefreshCw className={cn("mr-2 h-4 w-4", isNodeDetailLoading && "animate-spin")} />
                                    Refresh
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={startNodeDebug.isPending}
                                    onClick={() => void launchNodeDebug(selectedNodeName)}
                                >
                                    <TerminalSquare className="mr-2 h-4 w-4" />
                                    {startNodeDebug.isPending ? "Starting..." : "Node Debug"}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedNodeName("")}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : null}
                    </div>
                    <div className="custom-scrollbar h-full overflow-y-auto p-5">
                        {!selectedNodeName ? (
                            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 dark:border-zinc-700">
                                Pick a node from the table to inspect conditions, taints, scheduled pods, and recent events.
                            </div>
                        ) : isNodeDetailLoading && !selectedNode ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <div key={index} className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
                                ))}
                            </div>
                        ) : selectedNode ? (
                            <NodeDetailPanel
                                detail={selectedNode}
                                describeOutput={nodeDescribe}
                                debugSession={debugSession && debugSession.nodeName === selectedNodeName ? debugSession : null}
                                clusterId={selectedClusterId}
                                onStartDebug={() => void launchNodeDebug(selectedNodeName)}
                                isDebugStarting={startNodeDebug.isPending}
                            />
                        ) : (
                            <div className="rounded-2xl border border-dashed border-red-200 p-8 text-sm text-red-600 dark:border-red-900/40 dark:text-red-300">
                                Unable to load node detail.
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </div>
        </K8sExplorerLayout>
    );
}

function UsageBar({ value }: { value: number }) {
    const safe = Math.max(0, Math.min(100, value));
    return (
        <div className="min-w-[96px]">
            <div className="mb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{Math.round(safe)}%</div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                    className={cn(
                        "h-1.5 rounded-full",
                        safe >= 85 ? "bg-red-500" : safe >= 65 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${safe}%` }}
                />
            </div>
        </div>
    );
}

function NodeDetailPanel({
    detail,
    describeOutput,
    debugSession,
    clusterId,
    onStartDebug,
    isDebugStarting,
}: {
    detail: K8sNodeDetail;
    describeOutput: string;
    debugSession: { nodeName: string; namespace: string; podName: string; image: string } | null;
    clusterId: string;
    onStartDebug: () => void;
    isDebugStarting: boolean;
}) {
    const labelEntries = Object.entries(detail.labels || {});
    const annotationEntries = Object.entries(detail.annotations || {});

    return (
        <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
                {[
                    ["Status", detail.status],
                    ["Role", detail.role],
                    ["Version", detail.version],
                    ["Internal IP", detail.internal_ip || "-"],
                    ["OS", detail.os_image || "-"],
                    ["Kernel", detail.kernel_version || "-"],
                    ["Runtime", detail.container_runtime || "-"],
                    ["Architecture", detail.architecture || "-"],
                    ["CPU", detail.cpu_capacity || "-"],
                    ["Memory", detail.memory_capacity || "-"],
                    ["Pod CIDR", detail.pod_cidr || "-"],
                    ["Age", detail.age],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
                    </div>
                ))}
            </div>

            <Section title="Conditions">
                <div className="space-y-3">
                    {(detail.conditions || []).map((condition) => (
                        <div key={condition.type} className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="flex items-center justify-between gap-4">
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{condition.type}</div>
                                <Badge variant={String(condition.status).toLowerCase() === "true" ? "success" : "warning"}>
                                    {condition.status}
                                </Badge>
                            </div>
                            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{condition.reason || condition.message || "No detail"}</div>
                            {condition.last_transition_time ? (
                                <div className="mt-2 text-xs text-zinc-500">Last transition: {condition.last_transition_time}</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Taints">
                {(detail.taints || []).length === 0 ? (
                    <EmptyMini label="No taints configured." />
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {(detail.taints || []).map((taint) => (
                            <Badge key={`${taint.key}:${taint.effect}`} variant="outline" className="font-mono text-[11px]">
                                {taint.key}{taint.value ? `=${taint.value}` : ""}:{taint.effect || "NoSchedule"}
                            </Badge>
                        ))}
                    </div>
                )}
            </Section>

            <Section title={`Pods On Node (${detail.pods?.length || 0})`}>
                {(detail.pods || []).length === 0 ? (
                    <EmptyMini label="No pods scheduled on this node." />
                ) : (
                    <div className="space-y-2">
                        {detail.pods?.map((pod) => (
                            <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                                <div>
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{pod.name}</div>
                                    <div className="text-xs text-zinc-500">{pod.namespace} {pod.ip ? `• ${pod.ip}` : ""}</div>
                                </div>
                                <div className="text-right">
                                    <Badge variant={pod.status === "Running" ? "success" : "warning"}>{pod.status}</Badge>
                                    <div className="mt-1 text-xs text-zinc-500">{pod.age || "-"}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section title={`Events (${detail.events?.length || 0})`}>
                {(detail.events || []).length === 0 ? (
                    <EmptyMini label="No recent node events." />
                ) : (
                    <div className="space-y-2">
                        {detail.events?.map((event, index) => (
                            <div key={`${event.reason}-${index}`} className="rounded-2xl border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{event.reason}</div>
                                    <Badge variant={event.type === "Warning" ? "warning" : "outline"}>{event.type || "Normal"}</Badge>
                                </div>
                                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{event.message}</div>
                                <div className="mt-2 text-xs text-zinc-500">
                                    {event.namespace ? `${event.namespace} • ` : ""}{event.age || "-"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section title={`Labels (${labelEntries.length})`}>
                {labelEntries.length === 0 ? <EmptyMini label="No labels." /> : (
                    <div className="flex flex-wrap gap-2">
                        {labelEntries.map(([key, value]) => (
                            <Badge key={key} variant="outline" className="font-mono text-[11px]">{key}={value}</Badge>
                        ))}
                    </div>
                )}
            </Section>

            <Section title={`Annotations (${annotationEntries.length})`}>
                {annotationEntries.length === 0 ? <EmptyMini label="No annotations." /> : (
                    <div className="space-y-2">
                        {annotationEntries.map(([key, value]) => (
                            <div key={key} className="rounded-2xl border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="font-mono text-xs text-zinc-500">{key}</div>
                                <div className="mt-1 break-all text-sm text-zinc-800 dark:text-zinc-200">{value}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            <Section title="Diagnostics">
                {!describeOutput ? (
                    <EmptyMini label="No describe output captured yet." />
                ) : (
                    <pre className="max-h-[360px] overflow-auto rounded-2xl border border-zinc-100 bg-zinc-950 p-4 text-xs text-zinc-200 dark:border-zinc-800">
                        {describeOutput}
                    </pre>
                )}
            </Section>

            <Section title="Node Debug Shell">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Privileged debug pod on this node</div>
                            <div className="mt-1 text-xs text-zinc-500">
                                Launch a disposable toolbox pod pinned to this node and open an interactive shell through the existing pod exec workflow.
                            </div>
                            {debugSession ? (
                                <div className="mt-2 text-xs text-zinc-500">
                                    Pod: <span className="font-mono">{debugSession.namespace}/{debugSession.podName}</span> • Image:{" "}
                                    <span className="font-mono">{debugSession.image}</span>
                                </div>
                            ) : null}
                        </div>
                        <Button variant="outline" size="sm" onClick={onStartDebug} disabled={isDebugStarting}>
                            <TerminalSquare className="mr-2 h-4 w-4" />
                            {isDebugStarting ? "Starting..." : debugSession ? "Recreate Debug Pod" : "Start Debug Pod"}
                        </Button>
                    </div>
                </div>
                {debugSession ? (
                    <K8sPodExecTerminal
                        clusterId={clusterId}
                        namespace={debugSession.namespace}
                        podName={debugSession.podName}
                        active
                    />
                ) : (
                    <EmptyMini label="Start a node debug pod to open a shell pinned to this node." />
                )}
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{title}</div>
            {children}
        </section>
    );
}

function EmptyMini({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
            {label}
        </div>
    );
}
