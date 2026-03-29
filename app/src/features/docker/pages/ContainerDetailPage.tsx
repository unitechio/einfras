import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
    Activity,
    ArrowLeft,
    Bell,
    ChevronDown,
    ChevronRight,
    Download,
    FileText,
    Folder,
    FolderOpen,
    RefreshCw,
    SquareTerminal,
    Upload,
} from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { buildApiUrl, buildAuthHeaders, queryClient } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import {
    useContainerConfig,
    useContainerFiles,
    useContainerLogs,
    useContainerStats,
    useLiveContainerLogs,
    useLiveContainerStats,
    useReadContainerFile,
    useRuntimeAudit,
    useSaveContainerFile,
} from "../api/useDockerHooks";
import type { DockerContainerConfig } from "../types";

import DockerTerminalWorkspaceModal, { type DockerTerminalWorkspaceSession } from "../components/DockerTerminalWorkspaceModal";
import LogViewer from "../components/LogViewer";

type HistoryPoint = {
    time: string;
    timestamp: number;
    cpu: number;
    memory: number;
    memoryTotal: number;
    netIn: number;
    netOut: number;
    blockRead: number;
    blockWrite: number;
};

type InspectSectionKey =
    | "platform"
    | "cmd"
    | "state"
    | "image"
    | "portBindings"
    | "runtime"
    | "mounts"
    | "volumes"
    | "env"
    | "labels"
    | "networks";

const INSPECT_SECTIONS: Array<{ key: InspectSectionKey; label: string }> = [
    { key: "platform", label: "Platform" },
    { key: "cmd", label: "Cmd" },
    { key: "state", label: "State" },
    { key: "image", label: "Image" },
    { key: "portBindings", label: "PortBindings" },
    { key: "runtime", label: "Runtime" },
    { key: "mounts", label: "Mounts" },
    { key: "volumes", label: "Volumes" },
    { key: "env", label: "Env" },
    { key: "labels", label: "Labels" },
    { key: "networks", label: "Networks" },
];

export default function ContainerDetailPage() {
    const navigate = useNavigate();
    const { containerId = "" } = useParams();
    const { selectedEnvironment } = useEnvironment();
    const environmentId = selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "";
    const { showNotification } = useNotification();

    const [activeTab, setActiveTab] = useState("stats");
    const [inspectSection, setInspectSection] = useState<InspectSectionKey>("platform");
    const [showRawInspect, setShowRawInspect] = useState(false);

    const [terminalSessions, setTerminalSessions] = useState<DockerTerminalWorkspaceSession[]>([]);
    const [activeTerminalTabId, setActiveTerminalTabId] = useState("");
    const [activeDirectory, setActiveDirectory] = useState("/");
    const [selectedFile, setSelectedFile] = useState("");
    const [editorContent, setEditorContent] = useState("");
    const [timeWindow, setTimeWindow] = useState<"15m" | "1h">("15m");
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [expandedDirectories, setExpandedDirectories] = useState<string[]>(["/"]);

    const { data } = useContainerConfig(environmentId, containerId);
    const fallbackLogsQuery = useContainerLogs(environmentId, containerId, 400);
    const fallbackStatsQuery = useContainerStats(environmentId, containerId);
    const liveLogs = useLiveContainerLogs(environmentId, containerId, 400, activeTab === "logs");
    const liveStats = useLiveContainerStats(environmentId, containerId, activeTab === "stats");
    const { data: audit = [] } = useRuntimeAudit(environmentId, 200);
    const saveFile = useSaveContainerFile(environmentId, containerId);
    const { data: fileContent } = useReadContainerFile(environmentId, containerId, selectedFile);

    const stats = liveStats.stats ?? fallbackStatsQuery.data ?? null;
    const logs = liveLogs.logs || fallbackLogsQuery.data?.logs || "";
    const inspectPayload = data?.inspect ?? {};
    const bindMounts = useMemo(() => getBindMounts(data), [data]);
    const inspectSections = useMemo(() => buildInspectSections(data), [data]);
    const containerAudit = useMemo(() => audit.filter((item) => item.resource_id === containerId), [audit, containerId]);
    const currentInspect = inspectSections[inspectSection];

    useEffect(() => {
        if (!environmentId || !containerId || !data?.name) {
            return;
        }
        const storageKey = `einfra.docker.terminals.detail.${environmentId}.${containerId}`;
        const raw = window.sessionStorage.getItem(storageKey);
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw) as { sessions: DockerTerminalWorkspaceSession[]; activeTabId?: string };
            const restored = (parsed.sessions || []).filter((item) => item.environmentId === environmentId && item.containerId === containerId);
            setTerminalSessions(restored);
            setActiveTerminalTabId(parsed.activeTabId && restored.some((item) => item.tabId === parsed.activeTabId) ? parsed.activeTabId : (restored[0]?.tabId || ""));
        } catch {
            window.sessionStorage.removeItem(storageKey);
        }
    }, [containerId, data?.name, environmentId]);

    useEffect(() => {
        if (!environmentId || !containerId) {
            return;
        }
        const storageKey = `einfra.docker.terminals.detail.${environmentId}.${containerId}`;
        if (terminalSessions.length === 0) {
            window.sessionStorage.removeItem(storageKey);
            return;
        }
        window.sessionStorage.setItem(storageKey, JSON.stringify({ sessions: terminalSessions, activeTabId: activeTerminalTabId }));
    }, [activeTerminalTabId, containerId, environmentId, terminalSessions]);

    const openTerminalWorkspace = () => {
        const existing = terminalSessions[0];
        if (existing) {
            setActiveTerminalTabId(existing.tabId);
            return;
        }
        const nextSession: DockerTerminalWorkspaceSession = {
            tabId: `detail-${Date.now()}`,
            containerId,
            containerName: data?.name || containerId,
            environmentId,
        };
        setTerminalSessions([nextSession]);
        setActiveTerminalTabId(nextSession.tabId);
    };

    useEffect(() => {
        setEditorContent(fileContent?.content || "");
    }, [fileContent?.content, selectedFile]);

    useEffect(() => {
        if (!stats) return;
        const nextPoint: HistoryPoint = {
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            timestamp: Date.now(),
            cpu: parsePercent(stats.cpu_perc),
            memory: parseUsagePart(stats.mem_usage, 0),
            memoryTotal: parseUsagePart(stats.mem_usage, 1),
            netIn: parseDualMetric(stats.net_io, 0),
            netOut: parseDualMetric(stats.net_io, 1),
            blockRead: parseDualMetric(stats.block_io, 0),
            blockWrite: parseDualMetric(stats.block_io, 1),
        };
        setHistory((current) => [...current, nextPoint].slice(-720));
    }, [stats]);

    const filteredHistory = useMemo(() => {
        const cutoff = timeWindow === "15m" ? 15 * 60_000 : 60 * 60_000;
        const now = Date.now();
        return history.filter((item) => now - item.timestamp <= cutoff);
    }, [history, timeWindow]);

    const handleBinaryDownload = async (endpoint: string, fallbackName: string) => {
        const response = await fetch(buildApiUrl(endpoint), { headers: buildAuthHeaders() });
        if (!response.ok) {
            throw new Error("Download failed");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fallbackName;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const refreshFiles = async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => Array.isArray(query.queryKey) &&
                query.queryKey[0] === "docker" &&
                query.queryKey[1] === "containers" &&
                query.queryKey[2] === environmentId &&
                query.queryKey[3] === containerId &&
                query.queryKey[4] === "files",
        });
    };

    const handleUpload = async (file: File, endpoint: string) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", activeDirectory);
        const response = await fetch(buildApiUrl(endpoint), {
            method: "POST",
            headers: buildAuthHeaders(),
            body: formData,
        });
        if (!response.ok) {
            throw new Error("Upload failed");
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => navigate("/containers")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={openTerminalWorkspace}>
                        <SquareTerminal className="mr-2 h-4 w-4" /> Open Terminal
                    </Button>
                    <Button variant="primary" onClick={() => navigate(`/containers/${containerId}/edit?envId=${environmentId}`)}>Edit Container</Button>
                </div>
            </div>

            <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-semibold truncate">{data?.name || containerId}</h1>
                        <div className="mt-1 text-sm text-zinc-500 font-mono truncate">{data?.image}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                            {(() => {
                                const inspect = data?.inspect as Record<string, any> | undefined;
                                const config = inspect?.Config as Record<string, any> | undefined;
                                const entrypoint: string[] = config?.Entrypoint || [];
                                const cmd: string[] = config?.Cmd || inspect?.Args || [];
                                const fullCmd = [...entrypoint, ...cmd].join(' ');
                                return fullCmd ? (
                                    <span className="flex items-center gap-1.5 font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] max-w-sm truncate" title={fullCmd}>
                                        <span className="text-zinc-400">$</span>
                                        {fullCmd.length > 60 ? fullCmd.slice(0, 60) + '…' : fullCmd}
                                    </span>
                                ) : null;
                            })()}
                            {(() => {
                                const inspect = data?.inspect as Record<string, any> | undefined;
                                const created = inspect?.Created as string | undefined;
                                if (!created) return null;
                                const d = new Date(created);
                                const diff = Math.floor((Date.now() - d.getTime()) / 1000);
                                let ago = '';
                                if (diff < 60) ago = `${diff}s ago`;
                                else if (diff < 3600) ago = `${Math.floor(diff / 60)}m ago`;
                                else if (diff < 86400) ago = `${Math.floor(diff / 3600)}h ago`;
                                else ago = `${Math.floor(diff / 86400)}d ago`;
                                return <span title={d.toLocaleString()}>Created {ago}</span>;
                            })()}
                            {(() => {
                                const inspect = data?.inspect as Record<string, any> | undefined;
                                const hostConfig = inspect?.HostConfig as Record<string, any> | undefined;
                                const portBindings = hostConfig?.PortBindings as Record<string, Array<{ HostIp?: string; HostPort?: string }>> | undefined;
                                if (!portBindings) return null;
                                const ports = Object.entries(portBindings).flatMap(([containerPort, bindings]) =>
                                    (bindings || []).map(b => {
                                        const ip = b.HostIp || '0.0.0.0';
                                        const hostPort = b.HostPort;
                                        return hostPort ? `${ip}:${hostPort}->${containerPort}` : containerPort;
                                    })
                                ).slice(0, 4);
                                if (ports.length === 0) return null;
                                return (
                                    <div className="flex flex-wrap gap-1">
                                        {ports.map((p, i) => (
                                            <span key={i} className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">{p}</span>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-start">
                        <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${data?.state === 'running' ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-zinc-400'}`} />
                            <span className={`text-sm font-medium capitalize ${data?.state === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>{data?.state || 'unknown'}</span>
                        </div>
                        {data?.health_status ? <Badge variant={data.health_status === 'healthy' ? 'success' : 'warning'}>{data.health_status}</Badge> : null}
                        <Badge variant="outline">logs {liveLogs.status}</Badge>
                        <Badge variant="outline">stats {liveStats.status}</Badge>
                    </div>
                </div>
                {(data?.alerts || []).length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                            <Bell size={16} /> Active Alerts
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                            {data?.alerts?.map((alert) => <div key={alert}>• {alert}</div>)}
                        </div>
                    </div>
                )}
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="inspect">Inspect</TabsTrigger>
                    <TabsTrigger value="bind-mounts">Bind Mounts</TabsTrigger>
                    <TabsTrigger value="exec">Exec</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                </TabsList>
                <TabsContent value="stats">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex gap-2">
                            {(["15m", "1h"] as const).map((window) => (
                                <Button key={window} variant={timeWindow === window ? "primary" : "outline"} size="sm" onClick={() => setTimeWindow(window)}>
                                    {window}
                                </Button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{liveStats.status}</Badge>
                            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["docker", "containers", environmentId, containerId, "stats"] })}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <ChartCard title={`CPU usage: ${stats?.cpu_perc || "-"}`} color="#3b82f6" data={filteredHistory} dataKey="cpu" />
                        <ChartCard title={`Memory usage: ${stats?.mem_usage || "-"}`} color="#2563eb" data={filteredHistory} dataKey="memory" yAxisFormatter={formatBytesShort} />
                        <ChartCard title={`Disk read/write: ${stats?.block_io || "-"}`} color="#f59e0b" data={filteredHistory} dataKey="blockWrite" secondaryKey="blockRead" yAxisFormatter={formatBytesShort} />
                        <ChartCard title={`Network I/O: ${stats?.net_io || "-"}`} color="#f97316" data={filteredHistory} dataKey="netOut" secondaryKey="netIn" yAxisFormatter={formatBytesShort} />
                    </div>
                </TabsContent>

                <TabsContent value="logs">
                    <Card className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Live container stdout/stderr stream
                            </div>
                            <Badge variant="outline">{liveLogs.status}</Badge>
                        </div>
                        <LogViewer value={logs} emptyMessage="No container logs available." className="h-[560px]" />
                    </Card>
                </TabsContent>

                <TabsContent value="inspect">
                    <Card className="p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                {INSPECT_SECTIONS.map((section) => (
                                    <Button
                                        key={section.key}
                                        variant={!showRawInspect && inspectSection === section.key ? "primary" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setShowRawInspect(false);
                                            setInspectSection(section.key);
                                        }}
                                    >
                                        {section.label}
                                    </Button>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"
                                onClick={() => setShowRawInspect((current) => !current)}
                            >
                                <span>Raw JSON</span>
                                <span className={`h-5 w-9 rounded-full transition-colors ${showRawInspect ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                                    <span className={`mt-0.5 block h-4 w-4 rounded-full bg-white transition-transform ${showRawInspect ? "translate-x-4" : "translate-x-0.5"}`} />
                                </span>
                            </button>
                        </div>
                        <pre className="overflow-auto rounded-xl bg-black p-4 font-mono text-xs text-zinc-200">
                            {JSON.stringify(showRawInspect ? inspectPayload : currentInspect, null, 2)}
                        </pre>
                    </Card>
                </TabsContent>

                <TabsContent value="bind-mounts">
                    <Card className="p-6">
                        <div className="space-y-3">
                            {bindMounts.length === 0 ? (
                                <div className="text-sm text-zinc-500">No bind mounts or named volumes attached.</div>
                            ) : bindMounts.map((mount) => (
                                <div key={`${mount.source}-${mount.destination}`} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="font-mono text-sm">{mount.destination}</div>
                                        <Badge variant="outline">{mount.type || "mount"}</Badge>
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-500">Source: {mount.source || "-"}</div>
                                    {mount.name ? <div className="mt-1 text-xs text-zinc-500">Name: {mount.name}</div> : null}
                                    <div className="mt-1 text-xs text-zinc-500">Mode: {mount.mode || "-"}</div>
                                    <div className="mt-1 text-xs text-zinc-500">RW: {String(mount.rw ?? false)}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="exec">
                    <Card className="p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Interactive Exec Terminal</div>
                                <div className="text-xs text-zinc-500">Open a live shell session for this container.</div>
                            </div>
                            <Button variant="primary" onClick={openTerminalWorkspace}>Open Exec</Button>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="files">
                    <Card className="p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-zinc-500">Current directory: <span className="font-mono">{activeDirectory}</span></div>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload
                                    <input type="file" className="hidden" onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            await handleUpload(file, `/v1/environments/${environmentId}/docker/containers/${containerId}/files/upload`);
                                            await refreshFiles();
                                        } catch {
                                            showNotification({ type: "error", message: "Upload failed", description: "Unable to copy file into container." });
                                        }
                                        event.target.value = "";
                                    }} />
                                </label>
                                <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                                    Extract
                                    <input type="file" className="hidden" accept=".tar,.tar.gz,.tgz" onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            await handleUpload(file, `/v1/environments/${environmentId}/docker/containers/${containerId}/files/extract`);
                                            await refreshFiles();
                                        } catch {
                                            showNotification({ type: "error", message: "Extract failed", description: "Unable to extract archive into container." });
                                        }
                                        event.target.value = "";
                                    }} />
                                </label>
                                <Button variant="outline" size="sm" onClick={() => void refreshFiles()}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                                <div className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                                    File System
                                </div>
                                <div className="max-h-[560px] overflow-auto p-2">
                                    <ContainerFileTree
                                        environmentId={environmentId}
                                        containerId={containerId}
                                        path="/"
                                        depth={0}
                                        expandedDirectories={expandedDirectories}
                                        onToggleDirectory={(path) => setExpandedDirectories((current) =>
                                            current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
                                        )}
                                        onSelectDirectory={setActiveDirectory}
                                        onSelectFile={setSelectedFile}
                                        selectedFile={selectedFile}
                                        activeDirectory={activeDirectory}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                                    <span className="truncate">{selectedFile || "Select a file to inspect"}</span>
                                    {selectedFile ? (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => void handleBinaryDownload(`/v1/environments/${environmentId}/docker/containers/${containerId}/files/download?path=${encodeURIComponent(selectedFile)}`, selectedFile.split("/").pop() || "download.bin")}>
                                                <Download className="mr-2 h-4 w-4" /> Download
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => void handleBinaryDownload(`/v1/environments/${environmentId}/docker/containers/${containerId}/files/archive?path=${encodeURIComponent(selectedFile)}`, `${selectedFile.split("/").pop() || "archive"}.tar.gz`)}>
                                                Archive
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                                <textarea value={editorContent} onChange={(event) => setEditorContent(event.target.value)} className="min-h-[500px] w-full rounded-xl bg-black p-4 font-mono text-xs text-zinc-200 outline-none" />
                                {selectedFile ? (
                                    <div className="mt-3 flex justify-end">
                                        <Button variant="primary" size="sm" onClick={() => saveFile.mutate({ path: selectedFile, content: editorContent }, {
                                            onSuccess: async () => {
                                                showNotification({ type: "success", message: "File saved", description: selectedFile });
                                                await refreshFiles();
                                            },
                                        })}>
                                            Save File
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="p-6">
                <div className="font-semibold">Alert History / Audit</div>
                <div className="mt-4 space-y-3">
                    {containerAudit.length === 0 ? <div className="text-sm text-zinc-500">No audit entries for this container yet.</div> : containerAudit.map((item) => (
                        <div key={item.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <div className="font-medium">{item.action}</div>
                                <Badge variant={item.status === "success" ? "success" : "warning"}>{item.status}</Badge>
                            </div>
                            <div className="mt-1 text-sm text-zinc-500">{item.details || "-"}</div>
                        </div>
                    ))}
                </div>
            </Card>


            <DockerTerminalWorkspaceModal
                isOpen={terminalSessions.length > 0}
                onClose={() => {
                    setTerminalSessions([]);
                    setActiveTerminalTabId("");
                }}
                sessions={terminalSessions}
                activeTabId={activeTerminalTabId}
                onActivateTab={setActiveTerminalTabId}
                onCloseTab={(tabId) => {
                    setTerminalSessions((current) => {
                        const filtered = current.filter((item) => item.tabId !== tabId);
                        if (activeTerminalTabId === tabId) {
                            setActiveTerminalTabId(filtered[0]?.tabId || "");
                        }
                        return filtered;
                    });
                }}
                onUpdateSession={(tabId, patch) => {
                    setTerminalSessions((current) =>
                        current.map((item) => (item.tabId === tabId ? { ...item, ...patch } : item)),
                    );
                }}
                onAddTab={(cId, cName, envId) => {
                    const next: DockerTerminalWorkspaceSession = {
                        tabId: `detail-${Date.now()}`,
                        containerId: cId,
                        containerName: cName,
                        environmentId: envId,
                    };
                    setTerminalSessions((current) => [...current, next]);
                    setActiveTerminalTabId(next.tabId);
                }}
            />
        </div>
    );
}

function ContainerFileTree({
    environmentId,
    containerId,
    path,
    depth,
    expandedDirectories,
    onToggleDirectory,
    onSelectDirectory,
    onSelectFile,
    selectedFile,
    activeDirectory,
}: {
    environmentId: string;
    containerId: string;
    path: string;
    depth: number;
    expandedDirectories: string[];
    onToggleDirectory: (path: string) => void;
    onSelectDirectory: (path: string) => void;
    onSelectFile: (path: string) => void;
    selectedFile: string;
    activeDirectory: string;
}) {
    const { data } = useContainerFiles(environmentId, containerId, path);
    const items = useMemo(() => {
        const source = data?.items ?? [];
        return [...source].sort((left, right) => {
            if (left.is_dir !== right.is_dir) {
                return left.is_dir ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
        });
    }, [data?.items]);

    return (
        <div className="space-y-1">
            {items.map((item) => {
                const isExpanded = expandedDirectories.includes(item.path);
                const isSelected = selectedFile === item.path;
                const isActiveDirectory = activeDirectory === item.path;
                return (
                    <div key={item.path}>
                        <button
                            type="button"
                            onClick={() => {
                                if (item.is_dir) {
                                    onSelectDirectory(item.path);
                                    onToggleDirectory(item.path);
                                    return;
                                }
                                onSelectDirectory(parentDirectory(item.path));
                                onSelectFile(item.path);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                                isSelected || isActiveDirectory
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            }`}
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        >
                            {item.is_dir ? (
                                isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                            ) : (
                                <span className="w-4 shrink-0" />
                            )}
                            {item.is_dir ? (
                                isExpanded ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : (
                                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="truncate">{item.name}</div>
                                <div className="text-xs text-zinc-500">
                                    {item.is_dir ? "directory" : `${item.size} B`} • {item.mode}
                                </div>
                            </div>
                        </button>
                        {item.is_dir && isExpanded ? (
                            <ContainerFileTree
                                environmentId={environmentId}
                                containerId={containerId}
                                path={item.path}
                                depth={depth + 1}
                                expandedDirectories={expandedDirectories}
                                onToggleDirectory={onToggleDirectory}
                                onSelectDirectory={onSelectDirectory}
                                onSelectFile={onSelectFile}
                                selectedFile={selectedFile}
                                activeDirectory={activeDirectory}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

function ChartCard({
    title,
    color,
    data,
    dataKey,
    secondaryKey,
    yAxisFormatter,
}: {
    title: string;
    color: string;
    data: HistoryPoint[];
    dataKey: keyof HistoryPoint;
    secondaryKey?: keyof HistoryPoint;
    yAxisFormatter?: (value: number) => string;
}) {
    return (
        <Card className="p-4">
            <div className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFormatter} />
                        <Tooltip formatter={(value) => {
                            const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                            return yAxisFormatter ? yAxisFormatter(numericValue) : numericValue.toFixed(2);
                        }} />
                        <Area type="monotone" dataKey={String(dataKey)} stroke={color} fill={color} fillOpacity={0.18} />
                        {secondaryKey ? <Area type="monotone" dataKey={String(secondaryKey)} stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.1} /> : null}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

function getBindMounts(data?: DockerContainerConfig | null) {
    const mounts = (((data?.inspect as Record<string, any> | undefined)?.Mounts) as Array<Record<string, any>> | undefined) ?? [];
    return mounts.map((mount) => ({
        source: String(mount.Source || mount.Name || ""),
        destination: String(mount.Destination || ""),
        type: String(mount.Type || ""),
        name: String(mount.Name || ""),
        mode: String(mount.Mode || ""),
        rw: mount.RW,
    }));
}

function buildInspectSections(data?: DockerContainerConfig | null): Record<InspectSectionKey, unknown> {
    const inspect = (data?.inspect as Record<string, any> | undefined) ?? {};
    const config = asRecord(inspect.Config);
    const hostConfig = asRecord(inspect.HostConfig);
    const networkSettings = asRecord(inspect.NetworkSettings);
    return {
        platform: {
            id: inspect.Id,
            name: inspect.Name,
            created: inspect.Created,
            platform: inspect.Platform,
            driver: inspect.Driver,
            os: inspect.Os,
            resolv_conf_path: inspect.ResolvConfPath,
            hostname_path: inspect.HostnamePath,
            hosts_path: inspect.HostsPath,
        },
        cmd: {
            path: inspect.Path,
            args: inspect.Args,
            entrypoint: config.Entrypoint,
            cmd: config.Cmd,
            working_dir: config.WorkingDir,
        },
        state: inspect.State,
        image: {
            image: config.Image,
            image_id: inspect.Image,
            container_id: inspect.Id,
            labels: config.Labels,
        },
        portBindings: hostConfig.PortBindings ?? {},
        runtime: {
            restart_policy: hostConfig.RestartPolicy,
            log_config: hostConfig.LogConfig,
            runtime: hostConfig.Runtime,
            privileged: hostConfig.Privileged,
            cpu_shares: hostConfig.CpuShares,
            memory: hostConfig.Memory,
            nano_cpus: hostConfig.NanoCpus,
        },
        mounts: inspect.Mounts ?? [],
        volumes: {
            mounts: inspect.Mounts ?? [],
            binds: hostConfig.Binds ?? [],
            declared_volumes: config.Volumes ?? {},
        },
        env: config.Env ?? [],
        labels: config.Labels ?? {},
        networks: networkSettings.Networks ?? {},
    };
}

function asRecord(value: unknown): Record<string, any> {
    return typeof value === "object" && value !== null ? value as Record<string, any> : {};
}

function parentDirectory(path: string) {
    const normalized = path.replace(/\/+$/, "");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) {
        return "/";
    }
    return `/${parts.slice(0, -1).join("/")}`;
}

function parsePercent(value?: string) {
    return Number(String(value || "0").replace("%", "").trim()) || 0;
}

function parseUsagePart(value?: string, index: 0 | 1 = 0) {
    const parts = String(value || "").split("/").map((item) => item.trim());
    return parseByteValue(parts[index] || "0B");
}

function parseDualMetric(value?: string, index: 0 | 1 = 0) {
    const parts = String(value || "").split("/").map((item) => item.trim());
    return parseByteValue(parts[index] || "0B");
}

function parseByteValue(raw: string) {
    const match = String(raw).trim().match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
    if (!match) return 0;
    const amount = Number(match[1] || 0);
    const unit = (match[2] || "B").toUpperCase();
    const multipliers: Record<string, number> = {
        B: 1,
        KB: 1024,
        KIB: 1024,
        MB: 1024 ** 2,
        MIB: 1024 ** 2,
        GB: 1024 ** 3,
        GIB: 1024 ** 3,
        TB: 1024 ** 4,
        TIB: 1024 ** 4,
    };
    return amount * (multipliers[unit] || 1);
}

function formatBytesShort(value: number) {
    if (!value) return "0B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let current = value;
    let index = 0;
    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }
    return `${current.toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}
