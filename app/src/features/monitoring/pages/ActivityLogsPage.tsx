"use client";

import { useState, useMemo } from "react";
import { Download, Calendar, X, User as UserIcon, Search as InspectIcon, ChevronRight, Activity, Box, Info, Search } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { cn } from "@/lib/utils";

interface ActivityLog { id: string; time: string; user: string; environment: string; action: string; payload: any; }

const JsonTree = ({ data, level = 0 }: { data: any; level?: number }) => {
    if (typeof data !== "object" || data === null) {
        return (
            <span className={cn("text-xs font-mono", typeof data === "string" ? "text-emerald-500 dark:text-emerald-400" : "text-blue-500 dark:text-blue-400")}>
                {typeof data === "string" ? `"${data}"` : String(data)}
            </span>
        );
    }
    return (
        <div className={cn("space-y-1", level > 0 && "ml-4 border-l border-zinc-200 dark:border-zinc-800 pl-4")}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                    <div className="flex items-start gap-2 group">
                        <span className="text-zinc-500 dark:text-zinc-500 font-mono text-xs">{key}:</span>
                        <JsonTree data={value} level={level + 1} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function ActivityLogsPage() {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState("");
    const [inspectingLog, setInspectingLog] = useState<ActivityLog | null>(null);

    const handleExport = () => showNotification({ type: "info", message: "Exporting logs", description: "Preparing your CSV file for download..." });

    const logs: ActivityLog[] = [
        { id: "1", time: "2025-10-06 10:27:53", user: "admin", environment: "Portainer", action: "POST /endpoints", payload: { Name: "Production Cluster", URL: "tcp://10.0.0.1:2375", Type: 1, GroupId: 1, TLS: true, TLSConfig: { SkipVerify: false, CA: "----BEGIN CERTIFICATE----\n..." } } },
        { id: "2", time: "2025-10-06 10:27:52", user: "admin", environment: "Portainer", action: "POST /endpoints", payload: { Name: "Staging", URL: "tcp://10.0.0.2:2375" } },
        { id: "3", time: "2022-08-30 12:30:07", user: "admin", environment: "docker", action: "POST http://unixsocket/containers/create?name=ubuntu-utils", payload: { AttachStderr: false, AttachStdin: false, AttachStdout: false, Cmd: ["bash"], Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"], ExposedPorts: {}, Hostname: "7bfd22998e7d", Image: "registry.example.com/ubuntu-utils:latest", name: "ubuntu-utils" } }
    ];

    const filteredLogs = useMemo(() => {
        return logs.filter((l) => l.action.toLowerCase().includes(searchTerm.toLowerCase()) || l.user.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [logs, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Activity className="h-6 w-6 text-blue-500" />
                        User Activity Logs
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Track and audit all administrative actions across your environments.
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="md" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="w-full sm:max-w-xs">
                    <Input 
                        icon={<Search className="h-4 w-4 text-zinc-400" />} 
                        placeholder="Search logs..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:max-w-xs relative text-zinc-700 dark:text-zinc-300">
                    <div className="flex items-center justify-between bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 truncate opacity-70">
                            <Calendar size={14} /> <span>All Time</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50 rotate-90" />
                    </div>
                </div>
                <div className="sm:ml-auto flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1.5 rounded-full">
                    <Info size={12} className="text-blue-500" />
                    Retention period: 7 days
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead className="text-right">Payload</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                        <Activity size={32} className="mb-3 opacity-20" />
                                        <p className="text-[13px] font-medium">No activity logs found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => (
                                <TableRow key={log.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <TableCell>
                                        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{log.time}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <UserIcon size={14} className="text-zinc-400" />
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{log.user}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Box size={14} className="text-zinc-400" />
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{log.environment}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                            {log.action}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => setInspectingLog(log)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs gap-1.5 h-7">
                                            <InspectIcon size={12} /> Inspect
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {inspectingLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-4xl flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                <InspectIcon className="w-5 h-5 text-blue-500" />
                                Inspect Payload: <span className="text-sm font-mono text-zinc-500 ml-2">{inspectingLog.action}</span>
                            </h2>
                            <button onClick={() => setInspectingLog(null)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-zinc-50/50 dark:bg-black/20 custom-scrollbar">
                            <div className="bg-white dark:bg-[#0f0f0f] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                                <JsonTree data={inspectingLog.payload} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
