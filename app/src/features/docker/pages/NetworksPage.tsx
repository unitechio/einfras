import { useState, useEffect } from "react";
import { Search, Share2, Server, Plus, Trash2, Network } from "lucide-react";
import { useNetworks } from "../api/useDockerHooks";
import { useServers } from "../../servers/api/useServers";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function NetworksPage() {
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

    const { data: networks, isLoading: isLoadingNetworks } = useNetworks(selectedServerId);

    const filteredNetworks = (networks || []).filter(n => 
        n.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.Driver.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => showNotification({ type: "info", message: "Create Network", description: "Modal to create new network would appear here." })}
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
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors cursor-pointer block truncate" title={network.Name}>
                                                {network.Name}
                                            </span>
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
                                                    onClick={() => {
                                                        if(confirm(`Are you sure you want to remove network ${network.Name}?`)) {
                                                          showNotification({ type: "error", message: "Network Removed", description: `Removed network ${network.Name}` });
                                                        }
                                                    }}
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
        </div>
    );
}
