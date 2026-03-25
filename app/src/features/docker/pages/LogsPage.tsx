import { useEffect, useMemo, useState } from "react";
import { Activity, FileCode2, SearchCode, ShieldCheck } from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { useContainers, useContainerLogs, useDockerSystemLogs, useLiveContainerLogs, useRuntimeAudit } from "../api/useDockerHooks";
import LogViewer from "../components/LogViewer";

export default function LogsPage() {
    const { selectedEnvironment } = useEnvironment();
    const environmentId = selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "";

    const { data: containers = [] } = useContainers(environmentId, true);
    const [selectedContainerId, setSelectedContainerId] = useState("");
    const [search, setSearch] = useState("");
    const [auditSearch, setAuditSearch] = useState("");
    const [auditStatus, setAuditStatus] = useState("");
    const [auditAction, setAuditAction] = useState("");
    const [auditActor, setAuditActor] = useState("");
    const [auditResourceType, setAuditResourceType] = useState("");
    const [auditTag, setAuditTag] = useState("");
    const [auditFrom, setAuditFrom] = useState("");
    const [auditTo, setAuditTo] = useState("");

    useEffect(() => {
        if (!selectedContainerId && containers.length > 0) {
            setSelectedContainerId(containers[0].Id);
        }
    }, [containers, selectedContainerId]);

    const selectedContainer = containers.find((item) => item.Id === selectedContainerId);
    const { data: containerLogs } = useContainerLogs(environmentId, selectedContainerId, 200);
    const { logs: liveContainerLogs, status: liveContainerLogStatus } = useLiveContainerLogs(environmentId, selectedContainerId, 200, !!selectedContainerId);
    const { data: systemLogs } = useDockerSystemLogs(environmentId, 200);
    const auditQuery = useRuntimeAudit(environmentId, 100, {
        search: auditSearch,
        status: auditStatus,
        action: auditAction,
        actor: auditActor,
        resource_type: auditResourceType,
        tag: auditTag,
        from: auditFrom,
        to: auditTo,
    });

    const filteredContainers = useMemo(() => {
        return containers.filter((item) => item.Names[0]?.toLowerCase().includes(search.toLowerCase()));
    }, [containers, search]);

    const auditActions = useMemo(() => Array.from(new Set((auditQuery.data ?? []).map((item) => item.action).filter(Boolean))).sort(), [auditQuery.data]);
    const auditActors = useMemo(() => Array.from(new Set((auditQuery.data ?? []).map((item) => item.actor).filter(Boolean))).sort(), [auditQuery.data]);
    const auditResourceTypes = useMemo(() => Array.from(new Set((auditQuery.data ?? []).map((item) => item.resource_type).filter(Boolean))).sort(), [auditQuery.data]);
    const auditTags = useMemo(() => Array.from(new Set((auditQuery.data ?? []).flatMap((item) => extractAuditTags(item.metadata)))).sort(), [auditQuery.data]);
    const filteredAuditLogs = auditQuery.data ?? [];

    if (selectedEnvironment?.type !== "docker") {
        return (
            <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Select a Docker environment to inspect container, system, and audit logs.
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    <SearchCode className="h-6 w-6 text-blue-500" />
                    Logs
                </h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Explicit separation between container stdout/stderr, Docker system logs, and audit activity.
                </p>
            </div>

            <Tabs defaultValue="containers">
                <TabsList>
                    <TabsTrigger value="containers" icon={Activity}>Container Logs</TabsTrigger>
                    <TabsTrigger value="system" icon={FileCode2}>System Logs</TabsTrigger>
                    <TabsTrigger value="audit" icon={ShieldCheck}>Audit Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="containers">
                    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                        <Card className="min-w-0 p-4">
                            <Input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search containers..."
                            />
                            <div className="mt-4 space-y-2">
                                {filteredContainers.map((container) => (
                                    <button
                                        key={container.Id}
                                        onClick={() => setSelectedContainerId(container.Id)}
                                        className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                                            selectedContainerId === container.Id
                                                ? "border-blue-500 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10"
                                                : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                                        }`}
                                    >
                                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {container.Names[0]?.replace(/^\//, "")}
                                        </div>
                                        <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400" title={container.Image}>{container.Image}</div>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card className="min-w-0 overflow-hidden flex flex-col">
                            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={selectedContainer?.Names[0]?.replace(/^\//, "") || "Select a container"}>
                                            {selectedContainer?.Names[0]?.replace(/^\//, "") || "Select a container"}
                                        </div>
                                        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={selectedContainer?.Id || ""}>{selectedContainer?.Id || ""}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedContainer ? <Badge variant="outline">{selectedContainer.State}</Badge> : null}
                                        {selectedContainer ? <Badge variant="outline">{liveContainerLogStatus}</Badge> : null}
                                    </div>
                                </div>
                            </div>
                            <LogViewer
                                value={liveContainerLogs || containerLogs?.logs}
                                emptyMessage="No container logs available."
                                className="h-[calc(100vh-16rem)] min-h-[400px] max-h-[1200px] flex-1"
                                autoScroll={false}
                                status={liveContainerLogStatus}
                            />
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="system">
                    <Card className="overflow-hidden flex flex-col">
                        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">docker.service</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">System logs from the host service manager.</div>
                        </div>
                        <LogViewer value={systemLogs?.raw_output} emptyMessage="System logs are not available on this host yet." className="h-[calc(100vh-16rem)] min-h-[400px] max-h-[1200px] flex-1" autoScroll={false} />
                    </Card>
                </TabsContent>

                <TabsContent value="audit">
                    <Card className="p-4">
                        <div className="mb-4 grid gap-3 lg:grid-cols-6">
                            <Input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search audit trail..." />
                            <input type="date" value={auditFrom} onChange={(event) => setAuditFrom(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" />
                            <input type="date" value={auditTo} onChange={(event) => setAuditTo(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" />
                            <select value={auditStatus} onChange={(event) => setAuditStatus(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="">All statuses</option>
                                <option value="success">Success</option>
                                <option value="warning">Warning</option>
                                <option value="error">Error</option>
                                <option value="failed">Failed</option>
                            </select>
                            <select value={auditAction} onChange={(event) => setAuditAction(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="">All actions</option>
                                {auditActions.map((action) => <option key={action} value={action}>{action}</option>)}
                            </select>
                            <select value={auditActor} onChange={(event) => setAuditActor(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="">All actors</option>
                                {auditActors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
                            </select>
                        </div>
                        <div className="mb-4 grid gap-3 lg:grid-cols-3">
                            <select value={auditResourceType} onChange={(event) => setAuditResourceType(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="">All resource types</option>
                                {auditResourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                            <select value={auditTag} onChange={(event) => setAuditTag(event.target.value)} className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="">All tags</option>
                                {auditTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                            </select>
                            <div className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                                Matching records: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{filteredAuditLogs.length}</span>
                            </div>
                            <div className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                                Time range: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{auditFrom || "Any"} {"->"} {auditTo || "Any"}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {filteredAuditLogs.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                    No audit log entries were returned for this node.
                                </div>
                            ) : (
                                filteredAuditLogs.map((log) => (
                                    <div key={log.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{log.action}</div>
                                            {log.status ? <Badge variant={log.status === "success" ? "success" : "warning"}>{log.status}</Badge> : null}
                                        </div>
                                        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{log.details || "-"}</div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            {log.resource_type ? <Badge variant="outline">{log.resource_type}</Badge> : null}
                                            {log.resource_id ? <Badge variant="outline">{log.resource_id}</Badge> : null}
                                            {extractAuditTags(log.metadata).map((tag) => <Badge key={`${log.id}-${tag}`} variant="outline">{tag}</Badge>)}
                                        </div>
                                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            {log.actor || "system"} • {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function extractAuditTags(metadata?: Record<string, unknown>) {
    const raw = metadata?.tags;
    if (Array.isArray(raw)) {
        return raw.map((item) => normalizeAuditValue(item)).filter(Boolean);
    }
    if (typeof raw === "string") {
        return raw.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function normalizeAuditValue(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map((item) => normalizeAuditValue(item)).filter(Boolean).join(", ");
    if (typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .slice(0, 3)
            .map(([key, nested]) => `${key}:${normalizeAuditValue(nested)}`)
            .join(", ");
    }
    return String(value);
}
