import { useState, useEffect } from "react";
import { Search, Play, Square, Terminal, SearchCode, Server, ListFilter, Plus, Trash2 } from "lucide-react";
import { useContainers, useContainerAction } from "../api/useDockerHooks";
import { useServers } from "../../servers/api/useServers";
import { useNotification } from "@/core/NotificationContext";
import TerminalModal from "../components/TerminalModal";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
export default function ContainersPage() {
    const { data: serverData, isLoading: isLoadingServers } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data || [];

    // Auto-select first server if available
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    useEffect(() => {
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId]);

    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTerminal, setActiveTerminal] = useState<{ name: string, id: string } | null>(null);

    const { showNotification } = useNotification();
    const { data: containers, isLoading: isLoadingContainers } = useContainers(selectedServerId, filter === "all");
    const { mutate: performAction, isPending: isActionPending } = useContainerAction(selectedServerId);

    const filteredContainers = (containers || []).filter(c => {
        if (!c.Names[0].toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filter === "running" && c.State !== "running") return false;
        if (filter === "exited" && c.State !== "exited") return false;
        return true;
    });

    const formatImage = (img: string) => img.replace(/^sha256:/, '').substring(0, 12) + (img.startsWith('sha256:') ? '' : img);

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
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>

                    <Button variant="primary" size="md">
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
            </div>

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
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer">
                                                    {container.Names[0]?.replace(/^\//, '')}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={container.State === 'running' ? 'success' : 'error'}>
                                                {container.State === 'running' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                                                {container.State}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                {formatImage(container.Image)}
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
                                                    onClick={() => setActiveTerminal({ name: container.Names[0]?.replace(/^\//, ''), id: container.Id })}
                                                    className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    title="Open Terminal"
                                                >
                                                    <Terminal size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => showNotification({ type: "info", message: "Viewing Logs", description: "Log viewer modal would open here." })}
                                                    className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800"
                                                    title="View Logs"
                                                >
                                                    <SearchCode size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => {
                                                        if (confirm("Are you sure you want to remove this container?")) {
                                                            showNotification({ type: "error", message: "Container Removed", description: `Removed container ${container.Names[0]}` });
                                                        }
                                                    }}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    title="Remove Container"
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

            {activeTerminal && (
                <TerminalModal
                    isOpen={!!activeTerminal}
                    onClose={() => setActiveTerminal(null)}
                    containerName={activeTerminal.name}
                    containerId={activeTerminal.id}
                />
            )}
        </div>
    );
}
