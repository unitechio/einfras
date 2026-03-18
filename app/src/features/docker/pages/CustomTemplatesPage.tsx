import { useState, useEffect } from "react";
import { Search, Code, Server, Plus, Trash2, Edit3, Settings } from "lucide-react";
import { useServers } from "../../servers/api/useServers";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { useNotification } from "@/core/NotificationContext";

export default function CustomTemplatesPage() {
    const { data: serverData, isLoading: isLoadingServers } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data || [];
    
    // Auto-select first server if available
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    useEffect(() => {
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId]);

    const [searchQuery, setSearchQuery] = useState("");
    const { showNotification } = useNotification();

    const mockCustomTemplates = [
        { id: 1, name: "Production Web Stack", type: "Compose", lastUpdated: "2026-03-10", author: "Admin" },
        { id: 2, name: "Internal Tools (Metabase + Postgres)", type: "Compose", lastUpdated: "2026-02-28", author: "Admin" },
        { id: 3, name: "Redis Cache Cluster", type: "Container", lastUpdated: "2026-03-05", author: "Admin" }
    ];

    const filtered = mockCustomTemplates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Code className="h-6 w-6 text-indigo-500" />
                        Custom Templates
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Build and manage reusable container patterns for your organization.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                    
                    <Button 
                        variant="primary" size="md"
                        onClick={() => showNotification({ type: "info", message: "Build Template", description: "Modal to create new custom template would open here." })}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Template
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search custom templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Template Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                        <Code size={32} className="mb-3 opacity-20" />
                                        <p className="text-[13px] font-medium">No custom templates found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((t) => (
                                <TableRow key={t.id} className="group">
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer">
                                                {t.name}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded capitalize">
                                            {t.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {t.author}
                                    </TableCell>
                                    <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {t.lastUpdated}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                            <Button 
                                                variant="ghost" size="icon" 
                                                onClick={() => showNotification({ type: "info", message: "Edit Template", description: `Editing pattern ${t.name}` })}
                                                className="text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:text-white dark:hover:bg-zinc-800" title="Edit Template"
                                            >
                                                <Edit3 size={14} />
                                            </Button>
                                            <Button 
                                                variant="ghost" size="icon" 
                                                onClick={() => showNotification({ type: "info", message: "Template Settings", description: `Settings for ${t.name}` })}
                                                className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800" title="Settings"
                                            >
                                                <Settings size={14} />
                                            </Button>
                                            <Button 
                                                variant="ghost" size="icon" 
                                                onClick={() => {
                                                    if(confirm(`Are you sure you want to remove template ${t.name}?`)) {
                                                      showNotification({ type: "error", message: "Template Removed", description: `Removed custom template ${t.name}` });
                                                    }
                                                }}
                                                className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remove Template"
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
    );
}

// Need to import useEffect inside this file, missing in original draft.
