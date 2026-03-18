import { useState } from "react";
import { Play, Square, RotateCcw, Search, Activity, Box, Settings } from "lucide-react";

export default function ServiceManagerPage() {
    // Mock Services
    const [services] = useState([
        { name: "nginx", description: "High performance web server", status: "running", startup: "enabled" },
        { name: "docker", description: "Docker Application Container Engine", status: "running", startup: "enabled" },
        { name: "mysql", description: "MySQL Community Server", status: "stopped", startup: "disabled" },
        { name: "ssh", description: "OpenBSD Secure Shell server", status: "running", startup: "enabled" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Settings className="text-orange-500" /> Service Management
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Control system services (systemd / Windows Services).
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-sm flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        placeholder="Filter services..."
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-sm pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Service Name</th>
                            <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Description</th>
                            <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Status</th>
                            <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Startup</th>
                            <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {services.map((svc) => (
                            <tr key={svc.name} className="group hover:bg-orange-50/20 dark:hover:bg-orange-900/10 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white font-mono">{svc.name}</td>
                                <td className="px-6 py-4 text-zinc-500">{svc.description}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${svc.status === "running" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${svc.status === "running" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
                                        {svc.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`font-mono text-xs ${svc.startup === "enabled" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"}`}>
                                        {svc.startup}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        {svc.status === "running" ? (
                                            <button title="Stop" className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-500 hover:text-red-600 rounded transition-colors">
                                                <Square size={14} fill="currentColor" />
                                            </button>
                                        ) : (
                                            <button title="Start" className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 text-zinc-500 hover:text-green-600 rounded transition-colors">
                                                <Play size={14} fill="currentColor" />
                                            </button>
                                        )}
                                        <button title="Restart" className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-zinc-500 hover:text-blue-600 rounded transition-colors">
                                            <RotateCcw size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
