import { useState } from "react";
import { List, Search, Filter, User, Terminal, Calendar, ArrowUpRight, Download } from "lucide-react";

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
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <List className="text-blue-500" /> Security Audit Log
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Traceable history of all actions performed on this server.
                    </p>
                </div>
                <button className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-all">
                    <Download size={16} /> Export CSV
                </button>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by User, IP, or Action..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>
                <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors">
                    <Filter size={16} /> Filters
                </button>
                <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors">
                    <Calendar size={16} /> Date Range
                </button>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Timestamp</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Actor</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Action</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Target / Details</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Origin IP</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {logs.map((log) => (
                                <tr key={log.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                    <td className="px-6 py-4 font-mono text-xs text-zinc-500">{log.time}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-zinc-400" />
                                            <span className="font-medium text-zinc-900 dark:text-white">{log.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{log.action}</span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={log.target}>
                                        {log.target}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-zinc-500">{log.ip}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.status === "success" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                                                log.status === "warning" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
                                                    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                            }`}>
                                            {log.status === "success" && <div className="w-1 h-1 rounded-full bg-current" />}
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
