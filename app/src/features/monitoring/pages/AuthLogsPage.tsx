"use client";

import { useState, useMemo } from "react";
import { Download, Calendar, User as UserIcon, Globe, Database, Search, ShieldAlert, CheckCircle2, XCircle, Info, ChevronRight } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

interface AuthEvent { id: string; time: string; origin: string; context: string; user: string; result: "success" | "failure"; }

export default function AuthLogsPage() {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState("");

    const handleExport = () => showNotification({ type: "info", message: "Exporting logs", description: "Preparing your CSV file for download..." });

    const events: AuthEvent[] = [
        { id: "1", time: "2024-03-19 11:59:40", origin: "192.168.18.131", context: "Internal", user: "admin", result: "success" },
        { id: "2", time: "2024-03-18 21:42:15", origin: "192.168.18.131", context: "Internal", user: "admin", result: "success" },
        { id: "3", time: "2024-03-18 12:36:32", origin: "192.168.18.131", context: "Internal", user: "admin", result: "success" },
        { id: "4", time: "2024-03-17 09:15:10", origin: "10.0.0.45", context: "LDAP", user: "j.doe", result: "failure" },
        { id: "5", time: "2024-03-17 08:30:22", origin: "192.168.1.102", context: "Internal", user: "guest_user", result: "failure" }
    ];

    const filteredEvents = useMemo(() => {
        return events.filter((e) => e.user.toLowerCase().includes(searchTerm.toLowerCase()) || e.origin.includes(searchTerm));
    }, [events, searchTerm]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-indigo-500" />
                        Authentication Logs
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Monitor login attempts, successes, and failures across all authentication contexts.
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
                        placeholder="Search IP or user..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:max-w-xs relative text-zinc-700 dark:text-zinc-300">
                    <div className="flex items-center justify-between bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 truncate opacity-70">
                            <Calendar size={14} /> <span>Last 7 days</span>
                        </div>
                        <ChevronRight size={14} className="opacity-50 rotate-90" />
                    </div>
                </div>
                <div className="sm:ml-auto flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-1.5 rounded-full">
                    <Info size={12} className="text-indigo-500" />
                    Maximum retention: 7 days
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Context</TableHead>
                            <TableHead>Origin IP</TableHead>
                            <TableHead className="text-right">Result</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEvents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                        <ShieldAlert size={32} className="mb-3 opacity-20" />
                                        <p className="text-[13px] font-medium">No authentication events found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredEvents.map((event) => (
                                <TableRow key={event.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <TableCell>
                                        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{event.time}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                                <UserIcon size={10} className="text-zinc-500" />
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{event.user}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Database size={12} className="text-zinc-400" />
                                            <span className="text-xs flex items-center gap-1 font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                {event.context}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                                            <Globe size={12} className="opacity-50" />
                                            {event.origin}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end pr-2">
                                            {event.result === "success" ? (
                                                <Badge variant="success" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-none shadow-none">
                                                    <CheckCircle2 size={12} className="mr-1" /> Success
                                                </Badge>
                                            ) : (
                                                <Badge variant="error" className="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-none shadow-none">
                                                    <XCircle size={12} className="mr-1" /> Failed
                                                </Badge>
                                            )}
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
