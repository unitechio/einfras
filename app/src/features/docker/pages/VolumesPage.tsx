import { useState, useEffect } from "react";
import { Search, HardDrive, Server, Plus, Trash2, Database } from "lucide-react";
import { useVolumes } from "../api/useDockerHooks";
import { useServers } from "../../servers/api/useServers";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function VolumesPage() {
    const { data: serverData, isLoading: isLoadingServers } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data || [];
    
    // Auto-select first server if available
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const { showNotification } = useNotification();
    useEffect(() => {
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId]);

    const [searchQuery, setSearchQuery] = useState("");

    const { data: volumes, isLoading: isLoadingVolumes } = useVolumes(selectedServerId);

    const filteredVolumes = (volumes || []).filter(v => 
        v.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => showNotification({ type: "info", message: "Create Volume", description: "Modal to create new volume would appear here." })}
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

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Name</TableHead>
                                <TableHead>Driver</TableHead>
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
                                        <TableCell><div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredVolumes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center">
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
                                            <span className="font-semibold font-mono text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors cursor-pointer truncate block max-w-[280px]" title={volume.Name}>
                                                {volume.Name.length > 30 ? volume.Name.substring(0, 30) + "..." : volume.Name}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs tracking-wide">
                                                {volume.Driver}
                                            </Badge>
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
                                                    onClick={() => {
                                                        if(confirm(`Are you sure you want to remove volume ${volume.Name}?`)) {
                                                          showNotification({ type: "error", message: "Volume Removed", description: `Removed volume ${volume.Name}` });
                                                        }
                                                    }}
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
        </div>
    );
}
