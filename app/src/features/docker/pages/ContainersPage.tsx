import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AlertTriangle, Search, Play, Square, Terminal, SearchCode, Server, ListFilter, Plus, Trash2, RotateCcw, Pause, Pencil, Save, Rows3, FolderTree, ChevronRight, X } from "lucide-react";
import { useContainers, useContainerAction } from "../api/useDockerHooks";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import DockerTerminalWorkspaceModal, { type DockerTerminalWorkspaceSession } from "../components/DockerTerminalWorkspaceModal";
import ContainerLogsModal from "../components/ContainerLogsModal";
import CommitContainerModal from "../components/CommitContainerModal";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
import { tagsApi } from "@/features/catalog/api";
export default function ContainersPage() {
    const navigate = useNavigate();
    const { data: inventory = [], isLoading: isLoadingServers } = useEnvironmentInventory();
    const { selectedEnvironment } = useEnvironment();
    const servers = inventory.filter((env) => env.type === "docker");

    const [selectedServerId, setSelectedServerId] = useState<string>("");
    useEffect(() => {
        if (selectedEnvironment?.type === "docker" && selectedEnvironment.id !== selectedServerId) {
            setSelectedServerId(selectedEnvironment.id);
            return;
        }
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId, selectedEnvironment]);

    const [filter, setFilter] = useState("all");
    const [viewMode, setViewMode] = useState<"table" | "tree">("table");
    const [searchQuery, setSearchQuery] = useState("");
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [activeTag, setActiveTag] = useState("");
    const [terminalSessions, setTerminalSessions] = useState<DockerTerminalWorkspaceSession[]>([]);
    const [activeTerminalTabId, setActiveTerminalTabId] = useState("");
    const [activeLogs, setActiveLogs] = useState<{ name: string, id: string } | null>(null);
    const [activeCommit, setActiveCommit] = useState<{ name: string, id: string } | null>(null);
    const [activeKill, setActiveKill] = useState<{ name: string, id: string } | null>(null);
    const { showNotification } = useNotification();
    const { data: containers, isLoading: isLoadingContainers } = useContainers(selectedServerId, filter === "all");
    const { mutate: performAction, isPending: isActionPending } = useContainerAction(selectedServerId);

    useEffect(() => {
        tagsApi.list()
            .then((items) => setAvailableTags(items.map((item) => item.name).sort((left, right) => left.localeCompare(right))))
            .catch(() => setAvailableTags([]));
    }, []);

    useEffect(() => {
        if (!selectedServerId) {
            return;
        }
        const raw = window.sessionStorage.getItem(`einfra.docker.terminals.${selectedServerId}`);
        if (!raw) {
            setTerminalSessions([]);
            setActiveTerminalTabId("");
            return;
        }
        try {
            const parsed = JSON.parse(raw) as { sessions: DockerTerminalWorkspaceSession[]; activeTabId?: string };
            const restoredSessions = (parsed.sessions || []).filter((item) => item.environmentId === selectedServerId);
            setTerminalSessions(restoredSessions);
            setActiveTerminalTabId(parsed.activeTabId && restoredSessions.some((item) => item.tabId === parsed.activeTabId) ? parsed.activeTabId : (restoredSessions[0]?.tabId || ""));
        } catch {
            setTerminalSessions([]);
            setActiveTerminalTabId("");
        }
    }, [selectedServerId]);

    useEffect(() => {
        if (!selectedServerId) {
            return;
        }
        if (terminalSessions.length === 0) {
            window.sessionStorage.removeItem(`einfra.docker.terminals.${selectedServerId}`);
            return;
        }
        window.sessionStorage.setItem(
            `einfra.docker.terminals.${selectedServerId}`,
            JSON.stringify({ sessions: terminalSessions, activeTabId: activeTerminalTabId }),
        );
    }, [activeTerminalTabId, selectedServerId, terminalSessions]);

    const openTerminal = (container: { id: string; name: string }) => {
        const existing = terminalSessions.find((item) => item.containerId === container.id && item.environmentId === selectedServerId);
        if (existing) {
            setActiveTerminalTabId(existing.tabId);
            return;
        }
        const nextSession: DockerTerminalWorkspaceSession = {
            tabId: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            containerId: container.id,
            containerName: container.name,
            environmentId: selectedServerId,
        };
        setTerminalSessions((current) => [...current, nextSession]);
        setActiveTerminalTabId(nextSession.tabId);
    };

    const filteredContainers = (containers || []).filter(c => {
        if (!c.Names[0].toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filter === "running" && c.State !== "running") return false;
        if (filter === "exited" && c.State !== "exited") return false;
        if (activeTag) {
            const tagLabel = c.Labels?.[`einfra.tag.${activeTag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`];
            const tagList = c.Labels?.["einfra.tags"] || "";
            if (tagLabel !== "true" && !tagList.split(",").map((item) => item.trim()).includes(activeTag)) return false;
        }
        return true;
    });

    const normalizedName = (rawName: string) => rawName.replace(/^\//, "");
    const resolveTreeGroup = (rawName: string) => {
        const clean = normalizedName(rawName);
        const tokens = clean.split(/[-_]/).filter(Boolean);
        if (tokens.length <= 1) {
            return clean;
        }
        if (/^\d+$/.test(tokens[tokens.length - 1]) || /^(svc|service|task|container)$/i.test(tokens[tokens.length - 1])) {
            return tokens.slice(0, -1).join("-") || clean;
        }
        return tokens.slice(0, 2).join("-");
    };

    const groupedContainers = filteredContainers.reduce<Record<string, typeof filteredContainers>>((acc, container) => {
        const key = resolveTreeGroup(container.Names[0] || container.Id);
        acc[key] = [...(acc[key] ?? []), container];
        return acc;
    }, {});

const formatImage = (img: string) => {
  if (!img) return '-';
  if (img.startsWith('sha256:')) return img.replace(/^sha256:/, '').slice(0, 12);
  return img;
};

const truncateText = (value: string, maxLength = 42) => {
  if (!value) return '-';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
};

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-blue-500" />
                        Containers
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage Docker containers across your infrastructure.
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Environment...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.url})</option>
                            ))}
                        </select>
                    </div>

                    <Button variant="primary" size="md" onClick={() => navigate("/containers/deploy")} disabled={!selectedServerId}>
                        <Plus className="mr-2 h-4 w-4" />
                        Deploy Container
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search containers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
                <div className="flex items-center gap-1 sm:ml-auto p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    {['all', 'running', 'exited'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-all",
                                filter === f
                                    ? "bg-white dark:bg-[#121212] shadow-sm text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <button
                        onClick={() => setViewMode("table")}
                        className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", viewMode === "table" ? "bg-white dark:bg-[#121212] shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500")}
                    >
                        <Rows3 size={14} />
                        List
                    </button>
                    <button
                        onClick={() => setViewMode("tree")}
                        className={cn("flex items-center gap-2 rounded-md px-3 py-1.5 text-sm", viewMode === "tree" ? "bg-white dark:bg-[#121212] shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500")}
                    >
                        <FolderTree size={14} />
                        Tree
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveTag("")} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeTag === "" ? "border-blue-500 bg-blue-500 text-white" : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300"}`}>All tags</button>
                {availableTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => setActiveTag((current) => current === tag ? "" : tag)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeTag === tag ? "border-blue-500 bg-blue-500 text-white" : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300"}`}>
                        {tag}
                    </button>
                ))}
            </div>

            {viewMode === "table" ? (
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[280px]">Name</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>Image</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Ports</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingContainers ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredContainers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <ListFilter size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No containers found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredContainers.map((container) => (
                                    <TableRow key={container.Id} className="group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <Link to={`/containers/${container.Id}`} className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer">
                                                    {container.Names[0]?.replace(/^\//, '')}
                                                </Link>
                                                {container.Labels?.["einfra.tags"] ? <div className="mt-1 flex flex-wrap gap-1">{container.Labels["einfra.tags"].split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div> : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={container.State === 'running' ? 'success' : 'error'}>
                                                {container.State === 'running' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                                                {container.State}
                                            </Badge>
                                        </TableCell>
                        <TableCell>
                          <span
                            title={container.Image}
                            className="inline-block max-w-[280px] truncate align-middle rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            {truncateText(formatImage(container.Image), 48)}
                          </span>
                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {new Date(container.Created * 1000).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                {container.Ports?.slice(0, 2).map((p, idx) => (
                                                    <span key={idx} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                        {p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`}
                                                    </span>
                                                ))}
                                                {container.Ports && container.Ports.length > 2 && (
                                                    <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">+{container.Ports.length - 2}</span>
                                                )}
                                                {(!container.Ports || container.Ports.length === 0) && '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {container.State === 'running' ? (
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        onClick={() => performAction({ containerId: container.Id, action: 'stop' })}
                                                        disabled={isActionPending}
                                                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        title="Stop Container"
                                                    >
                                                        <Square size={14} className="fill-current" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        onClick={() => {
                                                            performAction({ containerId: container.Id, action: 'start' });
                                                            showNotification({ type: "info", message: "Starting Container", description: `Sent start signal to ${container.Names[0]}` });
                                                        }}
                                                        disabled={isActionPending}
                                                        className="text-zinc-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                        title="Start Container"
                                                    >
                                                        <Play size={14} className="fill-current" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => performAction({ containerId: container.Id, action: 'restart' })}
                                                    disabled={isActionPending}
                                                    className="text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                    title="Restart Container"
                                                >
                                                    <RotateCcw size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => performAction({ containerId: container.Id, action: container.State === 'paused' ? 'unpause' : 'pause' })}
                                                    disabled={isActionPending}
                                                    className="text-zinc-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                                    title={container.State === 'paused' ? "Unpause Container" : "Pause Container"}
                                                >
                                                    <Pause size={14} />
                                                </Button>

                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => openTerminal({ name: container.Names[0]?.replace(/^\//, ''), id: container.Id })}
                                                    className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    title="Open Terminal"
                                                >
                                                    <Terminal size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => setActiveLogs({ name: container.Names[0]?.replace(/^\//, ''), id: container.Id })}
                                                    className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800"
                                                    title="View Logs"
                                                >
                                                    <SearchCode size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => navigate(`/containers/${container.Id}/edit?envId=${selectedServerId}`)}
                                                    className="text-zinc-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                                                    title="Edit Container"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => setActiveCommit({ name: container.Names[0]?.replace(/^\//, ''), id: container.Id })}
                                                    className="text-zinc-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                                                    title="Commit to Image"
                                                >
                                                    <Save size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => setActiveKill({ name: normalizedName(container.Names[0] || container.Id), id: container.Id })}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="Kill Container"
                                                >
                                                    <Trash2 size={14} />
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
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedContainers).length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-400">
                            No grouped containers available for the current filters.
                        </div>
                    ) : (
                        Object.entries(groupedContainers)
                            .sort(([left], [right]) => left.localeCompare(right))
                            .map(([groupName, items]) => (
                                <div key={groupName} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                <FolderTree className="h-4 w-4 text-blue-500" />
                                                {groupName}
                                            </div>
                                            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                {items.length} container(s) sharing the same runtime prefix
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline">{items.filter((item) => item.State === "running").length} running</Badge>
                                            <Badge variant="outline">{items.filter((item) => item.State !== "running").length} inactive</Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {items.map((container) => (
                                            <div key={container.Id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
                                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div className="min-w-0">
                                                        <Link to={`/containers/${container.Id}`} className="flex items-center gap-2 font-semibold text-zinc-900 transition-colors hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400">
                                                            <ChevronRight size={14} className="text-zinc-400" />
                                                            {normalizedName(container.Names[0] || container.Id)}
                                                        </Link>
                              <div className="mt-1 flex min-w-0 flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                <span title={container.Image} className="max-w-[360px] truncate font-mono">
                                  {truncateText(container.Image, 64)}
                                </span>
                                                            <span>•</span>
                                                            <span>{new Date(container.Created * 1000).toLocaleString()}</span>
                                                            <span>•</span>
                                                            <span>{container.Ports?.length || 0} port mapping(s)</span>
                                                            {container.Labels?.["einfra.tags"] ? <>
                                                                <span>•</span>
                                                                <span>{container.Labels["einfra.tags"]}</span>
                                                            </> : null}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant={container.State === 'running' ? 'success' : 'error'}>{container.State}</Badge>
                                                        <Button variant="outline" size="sm" onClick={() => setActiveLogs({ name: normalizedName(container.Names[0] || container.Id), id: container.Id })}>
                                                            Logs
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => openTerminal({ name: normalizedName(container.Names[0] || container.Id), id: container.Id })}>
                                                            Terminal
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => navigate(`/containers/${container.Id}/edit?envId=${selectedServerId}`)}>
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            )}

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
            />
            {activeLogs && (
                <ContainerLogsModal
                    isOpen={!!activeLogs}
                    onClose={() => setActiveLogs(null)}
                    environmentId={selectedServerId}
                    containerId={activeLogs.id}
                    containerName={activeLogs.name}
                />
            )}
            {activeCommit && (
                <CommitContainerModal
                    isOpen={!!activeCommit}
                    onClose={() => setActiveCommit(null)}
                    containerName={activeCommit.name}
                    isSaving={isActionPending}
                    onSubmit={(payload) => {
                        performAction(
                            { containerId: activeCommit.id, action: "commit", payload },
                            {
                                onSuccess: () => {
                                    showNotification({ type: "success", message: "Container committed", description: `${activeCommit.name} -> ${payload.image}` });
                                    setActiveCommit(null);
                                },
                                onError: (error: any) => {
                                    showNotification({ type: "error", message: "Commit failed", description: error?.message || "Unable to create image snapshot." });
                                },
                            } as any,
                        );
                    }}
                />
            )}
            {activeKill && (
                <ConfirmActionDialog
                    open={!!activeKill}
                    title="Force kill container?"
                    description={`This will immediately terminate ${activeKill.name} without waiting for graceful shutdown. Use this only when stop or restart is not enough.`}
                    confirmLabel={isActionPending ? "Killing..." : "Kill Container"}
                    onClose={() => setActiveKill(null)}
                    onConfirm={() => {
                        performAction(
                            { containerId: activeKill.id, action: "kill" },
                            {
                                onSuccess: () => {
                                    showNotification({ type: "success", message: "Container killed", description: activeKill.name });
                                    setActiveKill(null);
                                },
                                onError: (error: any) => {
                                    showNotification({ type: "error", message: "Kill failed", description: error?.message || "Unable to force kill container." });
                                },
                            } as any,
                        );
                    }}
                    pending={isActionPending}
                    tone="danger"
                >
                    <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        Unsaved work inside the container process can be lost immediately.
                    </div>
                </ConfirmActionDialog>
            )}
        </div>
    );
}
