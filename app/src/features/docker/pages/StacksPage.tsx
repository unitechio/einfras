import { useState, useEffect } from "react";
import { Search, Layers, Server, Plus, Trash2, Edit3, Play, Square } from "lucide-react";
import { useStacks } from "../api/useDockerHooks";
import { useServers } from "../../servers/api/useServers";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function StacksPage() {
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

    const { data: stacks, isLoading: isLoadingStacks } = useStacks(selectedServerId);

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
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => showNotification({ type: "info", message: "Creating Stack", description: "Modal to create new compose stack would appear here." })}
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
                                    <TableRow key={stack.Name} className="group">
                                        <TableCell>
                                            <div className="flex flex-col">
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
                                                    onClick={() => showNotification({ type: "info", message: "Edit Stack", description: `Opening editor for ${stack.Name}` })}
                                                    className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800" title="Edit Stack"
                                                >
                                                    <Edit3 size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => showNotification({ type: "success", message: "Starting Stack", description: `Sending start signal to ${stack.Name}` })}
                                                    className="text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20" title="Start Stack"
                                                >
                                                    <Play size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => showNotification({ type: "warning", message: "Stopping Stack", description: `Halting services in ${stack.Name}` })}
                                                    className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-orange-900/20" title="Stop Stack"
                                                >
                                                    <Square size={14} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" size="icon" 
                                                    onClick={() => {
                                                        if(confirm(`Are you sure you want to remove stack ${stack.Name}?`)) {
                                                          showNotification({ type: "error", message: "Stack Removed", description: `Removed stack ${stack.Name}` });
                                                        }
                                                    }}
                                                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remove Stack"
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
