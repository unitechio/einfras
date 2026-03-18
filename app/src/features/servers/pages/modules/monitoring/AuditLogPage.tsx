import { useState } from "react";
import { List, Search, Filter, User, Calendar, Download } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function AuditLogPage() {
    const [searchTerm, setSearchTerm] = useState("");

    // Mock Audit Logs
    const [logs] = useState([
        { id: 1, action: "Authentication Success", user: "admin@company.com", target: "Server Console", ip: "192.168.1.5", time: "2024-01-09 10:45:22", status: "success" },
        { id: 2, action: "Sudo Command", user: "john.dev", target: "/usr/bin/apt install docker.io", ip: "10.0.0.50", time: "2024-01-09 10:30:15", status: "success" },
        { id: 3, action: "File Upload", user: "sarah.qa", target: "/var/www/html/config.php", ip: "10.0.0.51", time: "2024-01-09 09:12:00", status: "warning" },
        { id: 4, action: "Authentication Failed", user: "unknown", target: "SSH", ip: "45.2.1.99", time: "2024-01-09 03:45:11", status: "critical" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100/50 dark:border-blue-500/20">
                            <List className="text-blue-500" size={20} />
                        </div>
                        Security Audit Log
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Traceable history of all actions performed on this server.
                    </p>
                </div>
                <Button variant="outline" className="shadow-sm">
                    <Download size={16} className="mr-2" /> Export CSV
                </Button>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by User, IP, or Action..."
                        className="pl-10 h-10 w-full"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="h-10 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-[#121212] border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                        <Filter size={16} className="mr-2" /> Filters
                    </Button>
                    <Button variant="outline" className="h-10 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-[#121212] border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                        <Calendar size={16} className="mr-2" /> Date Range
                    </Button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 border-b border-zinc-200/60 dark:border-zinc-800/60">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Timestamp</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Actor</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Action</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Target / Details</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Origin IP</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                            {logs.map((log) => (
                                <tr key={log.id} className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-mono text-[13px] font-medium text-zinc-500">{log.time}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                                <User size={12} />
                                            </div>
                                            <span className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100">{log.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-[13px] text-zinc-700 dark:text-zinc-300">{log.action}</span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-[13px] text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={log.target}>
                                        {log.target}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-[13px] font-medium text-zinc-500">{log.ip}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase border shadow-sm ${
                                            log.status === "success" 
                                              ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400" 
                                              : log.status === "warning" 
                                                ? "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400" 
                                                : "bg-red-50 border-red-100 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                                            }`}>
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
