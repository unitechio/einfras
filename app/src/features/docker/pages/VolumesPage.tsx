import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, HardDrive, Server, Plus, Trash2, Database, Pencil, FolderTree } from "lucide-react";
import { useDeleteVolume, useDockerTopology, useSaveVolume, useVolumes } from "../api/useDockerHooks";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

type VolumeDraft = {
    originalName?: string;
    name: string;
    driver: string;
    server: string;
    share: string;
    version: string;
    targetPath: string;
};

export default function VolumesPage() {
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
    const [draftDriver, setDraftDriver] = useState("local");
    const [draftServer, setDraftServer] = useState("");
    const [draftShare, setDraftShare] = useState("");
    const [draftVersion, setDraftVersion] = useState("4");
    const [draftTargetPath, setDraftTargetPath] = useState("/data");
    const [editingVolume, setEditingVolume] = useState<VolumeDraft | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<{ name: string; containers: string[] } | null>(null);

    const { data: volumes, isLoading: isLoadingVolumes } = useVolumes(selectedServerId);
    const { data: topology } = useDockerTopology(selectedServerId);
    const saveVolume = useSaveVolume(selectedServerId);
    const deleteVolume = useDeleteVolume(selectedServerId);

    const filteredVolumes = (volumes || []).filter(v => 
        v.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const resetCreateDraft = () => {
        setDraftName("");
        setDraftDriver("local");
        setDraftServer("");
        setDraftShare("");
        setDraftVersion("4");
        setDraftTargetPath("/data");
    };

    const submitVolume = (payload: VolumeDraft, mode: "create" | "edit") => {
        const normalizedName = payload.name.trim();
        if (!normalizedName) {
            return;
        }
        const duplicate = (volumes || []).some((item) => item.Name.toLowerCase() === normalizedName.toLowerCase() && item.Name !== payload.originalName);
        if (duplicate) {
            showNotification({ type: "error", message: "Volume already exists", description: normalizedName });
            return;
        }
        const options: Record<string, string> | undefined = payload.driver === "nfs"
            ? {
                type: "nfs",
                o: `addr=${payload.server},nfsvers=${payload.version},rw`,
                device: payload.share.startsWith(":/") ? payload.share : `:${payload.share}`,
            }
            : undefined;
        saveVolume.mutate(
            { originalName: payload.originalName, name: normalizedName, driver: payload.driver.trim(), options },
            {
                onSuccess: () => {
                    showNotification({ type: "success", message: mode === "create" ? "Volume created" : "Volume updated", description: normalizedName });
                    if (mode === "create") {
                        setIsCreateOpen(false);
                        resetCreateDraft();
                        return;
                    }
                    setEditingVolume(null);
                },
                onError: (error: any) => showNotification({ type: "error", message: `${mode === "create" ? "Create" : "Update"} volume failed`, description: error?.message || "Unable to save volume." }),
            },
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <HardDrive className="h-6 w-6 text-purple-500" />
                        Volumes
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage persistent data volumes for your containers.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
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
                        Create Volume
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search volumes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            {isCreateOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create Volume</h3>
                        <p className="mt-1 text-sm text-zinc-500">Create a persistent Docker volume with a named driver.</p>
                        <div className="mt-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Name</label>
                                <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Volume name" />
                            </div>
                            <select value={draftDriver} onChange={(event) => setDraftDriver(event.target.value)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="local">local</option>
                                <option value="nfs">nfs</option>
                            </select>
                            {draftDriver === "nfs" ? (
                                <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">NFS Mount Settings</div>
                                    <Input value={draftServer} onChange={(event) => setDraftServer(event.target.value)} placeholder="NFS server e.g. 10.0.0.20" />
                                    <Input value={draftShare} onChange={(event) => setDraftShare(event.target.value)} placeholder="Export path e.g. /exports/app-data" />
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Input value={draftVersion} onChange={(event) => setDraftVersion(event.target.value)} placeholder="NFS version" />
                                        <Input value={draftTargetPath} onChange={(event) => setDraftTargetPath(event.target.value)} placeholder="Suggested target path in container" />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateDraft(); }}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={() => submitVolume({ name: draftName, driver: draftDriver, server: draftServer, share: draftShare, version: draftVersion, targetPath: draftTargetPath }, "create")}
                                disabled={!draftName.trim() || (draftDriver === "nfs" && (!draftServer.trim() || !draftShare.trim()))}
                            >
                                Create Volume
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {editingVolume ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Edit Volume</h3>
                        <p className="mt-1 text-sm text-zinc-500">Update the Docker volume name or driver without leaving the list view.</p>
                        <div className="mt-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Name</label>
                                <Input value={editingVolume.name} onChange={(event) => setEditingVolume((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Volume name" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Driver</label>
                            <select value={editingVolume.driver} onChange={(event) => setEditingVolume((current) => current ? { ...current, driver: event.target.value } : current)} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="local">local</option>
                                <option value="nfs">nfs</option>
                            </select>
                            </div>
                            {editingVolume.driver === "nfs" ? (
                                <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                                    <Input value={editingVolume.server} onChange={(event) => setEditingVolume((current) => current ? { ...current, server: event.target.value } : current)} placeholder="NFS server" />
                                    <Input value={editingVolume.share} onChange={(event) => setEditingVolume((current) => current ? { ...current, share: event.target.value } : current)} placeholder="Export path" />
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Input value={editingVolume.version} onChange={(event) => setEditingVolume((current) => current ? { ...current, version: event.target.value } : current)} placeholder="Version" />
                                        <Input value={editingVolume.targetPath} onChange={(event) => setEditingVolume((current) => current ? { ...current, targetPath: event.target.value } : current)} placeholder="Suggested container target" />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingVolume(null)}>Cancel</Button>
                            <Button variant="primary" onClick={() => submitVolume(editingVolume, "edit")} disabled={!editingVolume.name.trim() || (editingVolume.driver === "nfs" && (!editingVolume.server.trim() || !editingVolume.share.trim()))}>
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
                                <TableHead>Status</TableHead>
                                <TableHead>Driver</TableHead>
                                <TableHead>In Use</TableHead>
                                <TableHead>Target / Data</TableHead>
                                <TableHead>Mountpoint</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingVolumes ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredVolumes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <Database size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No storage volumes found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredVolumes.map((volume) => (
                                    <TableRow key={volume.Name} className="group">
                                        <TableCell>
                                            <Link to={`/volumes/${encodeURIComponent(volume.Name)}`} className="font-semibold font-mono text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors cursor-pointer truncate block max-w-[280px]" title={volume.Name}>
                                                {volume.Name.length > 30 ? volume.Name.substring(0, 30) + "..." : volume.Name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const inUse = getVolumeUsage(topology, volume.Name).containers.length > 0;
                                                return (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`h-2 w-2 rounded-full ${inUse ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                                                        <span className={`text-[12px] font-medium ${inUse ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                                            {inUse ? 'In Use' : 'Idle'}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs tracking-wide">
                                                {volume.Driver}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {getVolumeUsage(topology, volume.Name).containers.length ? `${getVolumeUsage(topology, volume.Name).containers.length} container(s)` : "Unused"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[220px] space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                                                <div className="truncate" title={getVolumeUsage(topology, volume.Name).targets.join(", ") || "No known mount target"}>
                                                    Target: {getVolumeUsage(topology, volume.Name).targets[0] || "-"}
                                                </div>
                                                <div className="truncate" title={volume.Mountpoint}>
                                                    Data: {volume.Driver === "nfs" ? "Remote NFS mount" : "Local Docker volume"}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[11px] truncate block max-w-[300px]" title={volume.Mountpoint}>
                                                {volume.Mountpoint}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {volume.CreatedAt ? new Date(volume.CreatedAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" size="icon"
                                                    onClick={() => setEditingVolume({ originalName: volume.Name, name: volume.Name, driver: volume.Driver, server: "", share: "", version: "4", targetPath: getVolumeUsage(topology, volume.Name).targets[0] || "/data" })}
                                                    className="text-zinc-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20" title="Edit Volume"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => setDeleteCandidate({ name: volume.Name, containers: getVolumeUsage(topology, volume.Name).containers })}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remove Volume"
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
                title="Force remove volume?"
                description={`This force-removes ${deleteCandidate?.name || "the selected volume"} from the Docker host.`}
                confirmLabel={deleteVolume.isPending ? "Removing..." : "Force Remove Volume"}
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    deleteVolume.mutate(
                        { volumeName: deleteCandidate.name, force: true },
                        {
                            onSuccess: () => {
                                showNotification({ type: "success", message: "Volume removed", description: deleteCandidate.name });
                                setDeleteCandidate(null);
                            },
                            onError: (error: any) => showNotification({ type: "error", message: "Remove volume failed", description: error?.message || `Unable to remove ${deleteCandidate.name}` }),
                        },
                    );
                }}
                pending={deleteVolume.isPending}
                tone="danger"
            >
                <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {deleteCandidate?.containers?.length
                        ? `This volume is currently associated with: ${deleteCandidate.containers.join(", ")}.`
                        : "Any data stored only inside this volume can be lost immediately."}
                </div>
            </ConfirmActionDialog>
        </div>
    );
}

function getVolumeUsage(topology: any, volumeName: string) {
    const edges = topology?.edges || [];
    const nodes = topology?.nodes || [];
    const volumeNode = nodes.find((node: any) => node.kind === "volume" && node.label === volumeName);
    if (!volumeNode) {
        return { containers: [] as string[], targets: [] as string[] };
    }
    const attachments = edges.filter((edge: any) => edge.source === volumeNode.id || edge.target === volumeNode.id);
    const containers = attachments.map((edge: any) => nodes.find((node: any) => node.id === (edge.source === volumeNode.id ? edge.target : edge.source))?.label).filter(Boolean);
    const targets = attachments.map((edge: any) => edge.label).filter(Boolean);
    return { containers, targets };
}
