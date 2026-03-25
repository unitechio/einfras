import { Fragment, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Layers, Server, Plus, Trash2, Edit3, Play, Square, ChevronDown, ChevronUp } from "lucide-react";
import { useRestartStackService, useScaleStackService, useStackAction, useStacks, useStackServices } from "../api/useDockerHooks";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function StacksPage() {
    const navigate = useNavigate();
    const { data: inventory = [], isLoading: isLoadingServers } = useEnvironmentInventory();
    const { selectedEnvironment } = useEnvironment();
    const servers = inventory.filter((env) => env.type === "docker");

    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const { showNotification } = useNotification();
    useEffect(() => {
        if (selectedEnvironment?.type === "docker" && selectedEnvironment.id !== selectedServerId) {
            setSelectedServerId(selectedEnvironment.id);
            return;
        }
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId, selectedEnvironment]);

    const [searchQuery, setSearchQuery] = useState("");
    const [expandedStack, setExpandedStack] = useState<string | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

    const { data: stacks, isLoading: isLoadingStacks } = useStacks(selectedServerId);
    const stackAction = useStackAction(selectedServerId);
    const { data: services = [] } = useStackServices(selectedServerId, expandedStack || "");
    const scaleService = useScaleStackService(selectedServerId, expandedStack || "");
    const restartService = useRestartStackService(selectedServerId, expandedStack || "");

    const filteredStacks = (stacks || []).filter(s => 
        s.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Layers className="h-6 w-6 text-pink-500" />
                        Stacks
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Deploy and manage multi-container applications.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Environment...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.url})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => navigate(`/stacks/new?envId=${selectedServerId}`)}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Stack
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search stacks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Services</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingStacks ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredStacks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <Layers size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No stacks found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredStacks.map((stack) => (
                                    <Fragment key={stack.Name}>
                                    <TableRow key={stack.Name} className="group">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => setExpandedStack((current) => current === stack.Name ? null : stack.Name)} className="text-zinc-500">
                                                    {expandedStack === stack.Name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors cursor-pointer truncate" title={stack.Name}>
                                                    {stack.Name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={stack.Status === 'running' ? 'success' : 'outline'} className="text-xs uppercase">
                                                {stack.Status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                                                {stack.Services}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {stack.CreatedAt ? new Date(stack.CreatedAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => navigate(`/stacks/${encodeURIComponent(stack.Name)}/edit?envId=${selectedServerId}`)}
                                                    className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800" title="Edit Stack"
                                                >
                                                    <Edit3 size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => stackAction.mutate({ stackName: stack.Name, action: "start" }, {
                                                        onError: (error: any) => showNotification({ type: "error", message: "Start stack failed", description: error?.message || `Unable to start ${stack.Name}` }),
                                                        onSuccess: () => showNotification({ type: "success", message: "Stack started", description: stack.Name }),
                                                    })}
                                                    className="text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20" title="Start Stack"
                                                >
                                                    <Play size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => stackAction.mutate({ stackName: stack.Name, action: "stop" }, {
                                                        onError: (error: any) => showNotification({ type: "error", message: "Stop stack failed", description: error?.message || `Unable to stop ${stack.Name}` }),
                                                        onSuccess: () => showNotification({ type: "success", message: "Stack stopped", description: stack.Name }),
                                                    })}
                                                    className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-orange-900/20" title="Stop Stack"
                                                >
                                                    <Square size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => setDeleteCandidate(stack.Name)}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remove Stack"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {expandedStack === stack.Name && (
                                        <TableRow key={`${stack.Name}-services`}>
                                            <TableCell colSpan={5} className="bg-zinc-50/60 dark:bg-zinc-900/20">
                                                <div className="space-y-3 p-3">
                                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Services</div>
                                                    {services.length === 0 ? (
                                                        <div className="text-sm text-zinc-500">No services reported for this stack.</div>
                                                    ) : services.map((service) => (
                                                        <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[#121212]">
                                                            <div>
                                                                <button type="button" onClick={() => navigate(`/stacks/${encodeURIComponent(stack.Name)}/services/${encodeURIComponent(service.name)}`)} className="font-medium text-zinc-900 hover:text-pink-600 dark:text-zinc-100 dark:hover:text-pink-400">{service.name}</button>
                                                                <div className="text-xs text-zinc-500">{service.image}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline">{service.replicas}</Badge>
                                                                <Button variant="ghost" size="sm" onClick={() => restartService.mutate(service.name)}>Restart</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => scaleService.mutate({ serviceName: service.name, replicas: 0 })}>Stop</Button>
                                                                <Button variant="ghost" size="sm" onClick={() => {
                                                                    const next = prompt("Scale replicas to:", service.replicas.split("/")[0] || "1");
                                                                    const replicas = Number(next);
                                                                    if (!Number.isNaN(replicas) && replicas >= 0) {
                                                                        scaleService.mutate({ serviceName: service.name, replicas });
                                                                    }
                                                                }}>Scale</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    </Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <ConfirmActionDialog
                open={!!deleteCandidate}
                title="Remove stack?"
                description={`This will remove ${deleteCandidate || "the selected stack"} and purge the running compose services managed by it.`}
                confirmLabel={stackAction.isPending ? "Removing..." : "Remove Stack"}
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    stackAction.mutate(
                        { stackName: deleteCandidate, action: "delete", purge: true },
                        {
                            onError: (error: any) => showNotification({ type: "error", message: "Remove stack failed", description: error?.message || `Unable to remove ${deleteCandidate}` }),
                            onSuccess: () => {
                                showNotification({ type: "success", message: "Stack removed", description: deleteCandidate });
                                setDeleteCandidate(null);
                            },
                        },
                    );
                }}
                pending={stackAction.isPending}
                tone="danger"
            />
        </div>
    );
}
