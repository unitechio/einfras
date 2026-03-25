import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Share2, Server, Plus, Trash2, Network, Pencil, AlertTriangle } from "lucide-react";
import { useDeleteNetwork, useNetworks, useSaveNetwork } from "../api/useDockerHooks";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

type NetworkDraft = {
    originalId?: string;
    name: string;
    driver: string;
    internal: boolean;
};

export default function NetworksPage() {
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
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [draftDriver, setDraftDriver] = useState("bridge");
    const [draftInternal, setDraftInternal] = useState(false);
    const [editingNetwork, setEditingNetwork] = useState<NetworkDraft | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string } | null>(null);

    const { data: networks, isLoading: isLoadingNetworks } = useNetworks(selectedServerId);
    const saveNetwork = useSaveNetwork(selectedServerId);
    const deleteNetwork = useDeleteNetwork(selectedServerId);

    const filteredNetworks = (networks || []).filter(n => 
        n.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.Driver.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const resetCreateDraft = () => {
        setDraftName("");
        setDraftDriver("bridge");
        setDraftInternal(false);
    };

    const submitNetwork = (payload: NetworkDraft, mode: "create" | "edit") => {
        const normalizedName = payload.name.trim();
        if (!normalizedName) {
            return;
        }
        const duplicate = (networks || []).some((item) => item.Name.toLowerCase() === normalizedName.toLowerCase() && item.Id !== payload.originalId);
        if (duplicate) {
            showNotification({ type: "error", message: "Network already exists", description: normalizedName });
            return;
        }
        saveNetwork.mutate(
            { originalId: payload.originalId, name: normalizedName, driver: payload.driver.trim(), internal: payload.internal },
            {
                onSuccess: () => {
                    showNotification({ type: "success", message: mode === "create" ? "Network created" : "Network updated", description: normalizedName });
                    if (mode === "create") {
                        setIsCreateOpen(false);
                        resetCreateDraft();
                        return;
                    }
                    setEditingNetwork(null);
                },
                onError: (error: any) => showNotification({ type: "error", message: `${mode === "create" ? "Create" : "Update"} network failed`, description: humanizeNetworkError(error?.message || "Unable to save network.") }),
            },
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Share2 className="h-6 w-6 text-orange-500" />
                        Networks
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage network isolation and connectivity for your containers.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Environment...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.url})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => setIsCreateOpen(true)}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Network
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search networks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            {isCreateOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create Network</h3>
                        <p className="mt-1 text-sm text-zinc-500">Create a named Docker network with driver and isolation settings.</p>
                        <div className="mt-4 space-y-4">
                            <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Network name" />
                            <select value={draftDriver} onChange={(event) => setDraftDriver(event.target.value)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="bridge">bridge</option>
                                <option value="overlay">overlay</option>
                                <option value="host">host</option>
                                <option value="macvlan">macvlan</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                <input type="checkbox" checked={draftInternal} onChange={(event) => setDraftInternal(event.target.checked)} />
                                Internal network
                            </label>
                            {draftDriver === "overlay" ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                    Overlay networks require this Docker environment to be a Swarm manager. Use <span className="font-mono">docker swarm init</span> or choose another driver.
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateDraft(); }}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={() => submitNetwork({ name: draftName, driver: draftDriver, internal: draftInternal }, "create")}
                                disabled={!draftName.trim()}
                            >
                                Create Network
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {editingNetwork ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit Network</h3>
                        <p className="mt-1 text-sm text-zinc-500">Update the Docker network name, driver, and isolation mode.</p>
                        <div className="mt-4 space-y-4">
                            <Input value={editingNetwork.name} onChange={(event) => setEditingNetwork((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Network name" />
                            <select value={editingNetwork.driver} onChange={(event) => setEditingNetwork((current) => current ? { ...current, driver: event.target.value } : current)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="bridge">bridge</option>
                                <option value="overlay">overlay</option>
                                <option value="host">host</option>
                                <option value="macvlan">macvlan</option>
                            </select>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                <input type="checkbox" checked={editingNetwork.internal} onChange={(event) => setEditingNetwork((current) => current ? { ...current, internal: event.target.checked } : current)} />
                                Internal network
                            </label>
                            {editingNetwork.driver === "overlay" ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                    Overlay updates only work on Swarm managers. If this host is standalone Docker, keep the driver as <span className="font-mono">bridge</span> or <span className="font-mono">host</span>.
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingNetwork(null)}>Cancel</Button>
                            <Button variant="primary" onClick={() => submitNetwork(editingNetwork, "edit")} disabled={!editingNetwork.name.trim()}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Internal</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingNetworks ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-10 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredNetworks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <Network size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No custom networks found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredNetworks.map((network) => (
                                    <TableRow key={network.Id} className="group">
                                        <TableCell>
                                            <Link to={`/networks/${network.Id}`} className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors cursor-pointer block truncate" title={network.Name}>
                                                {network.Name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={network.Driver === 'bridge' ? 'default' : 'outline'} className="text-xs uppercase">
                                                {network.Driver}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121212] px-2 py-0.5 rounded capitalize">
                                                {network.Scope}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                                {network.Internal ? 'Yes' : 'No'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {network.Created ? new Date(network.Created).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" size="icon"
                                                    onClick={() => setEditingNetwork({ originalId: network.Id, name: network.Name, driver: network.Driver, internal: network.Internal })}
                                                    className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20" title="Edit Network"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => setDeleteCandidate({ id: network.Id, name: network.Name })}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remove Network"
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
            <ConfirmActionDialog
                open={!!deleteCandidate}
                title="Remove network?"
                description={`This removes ${deleteCandidate?.name || "the selected network"} from the Docker host. Connected containers or stacks may lose connectivity immediately.`}
                confirmLabel={deleteNetwork.isPending ? "Removing..." : "Remove Network"}
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    deleteNetwork.mutate(deleteCandidate.id, {
                        onSuccess: () => {
                            showNotification({ type: "success", message: "Network removed", description: deleteCandidate.name });
                            setDeleteCandidate(null);
                        },
                        onError: (error: any) => showNotification({ type: "error", message: "Remove network failed", description: humanizeNetworkError(error?.message || `Unable to remove ${deleteCandidate.name}`) }),
                    });
                }}
                pending={deleteNetwork.isPending}
                tone="danger"
            />
        </div>
    );
}

function humanizeNetworkError(message: string) {
    if (message.includes("not a swarm manager")) {
        return "Overlay networks need Docker Swarm manager mode on this host. Run docker swarm init or switch to a non-overlay driver.";
    }
    if (message.includes("network") && message.includes("not found")) {
        return "The selected network no longer exists on the Docker host. Refresh the list and try the action again.";
    }
    return message;
}
