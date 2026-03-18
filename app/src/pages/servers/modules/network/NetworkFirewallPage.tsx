import { useState } from "react";
import { Shield, Clock, Plus, Trash2, Power, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";

export default function NetworkFirewallPage() {
    const [activeTab, setActiveTab] = useState<"firewall" | "cron">("firewall");

    // Mock Firewall Rules
    const [rules] = useState([
        { id: 1, type: "ALLOW", port: "22/tcp", source: "10.0.0.0/8", comment: "SSH Internal", active: true },
        { id: 2, type: "ALLOW", port: "80/tcp", source: "0.0.0.0/0", comment: "HTTP Public", active: true },
        { id: 3, type: "ALLOW", port: "443/tcp", source: "0.0.0.0/0", comment: "HTTPS Public", active: true },
        { id: 4, type: "DENY", port: "ALL", source: "192.168.1.100", comment: "Block Suspicious IP", active: true },
    ]);

    // Mock Cron Jobs
    const [crons] = useState([
        { id: 1, schedule: "0 2 * * *", command: "/usr/bin/backup-db.sh", user: "root", comment: "Daily DB Backup", active: true },
        { id: 2, schedule: "*/15 * * * *", command: "php /var/www/html/artisan schedule:run", user: "www-data", comment: "Laravel Scheduler", active: true },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Shield className="text-red-500" /> Network & Scheduler
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage firewall rules and scheduled tasks.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm w-fit">
                <button
                    onClick={() => setActiveTab("firewall")}
                    className={`px-4 py-2 text-sm font-bold rounded-sm transition-all flex items-center gap-2 ${activeTab === "firewall"
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                >
                    <Shield size={16} /> Firewall
                </button>
                <button
                    onClick={() => setActiveTab("cron")}
                    className={`px-4 py-2 text-sm font-bold rounded-sm transition-all flex items-center gap-2 ${activeTab === "cron"
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                >
                    <Clock size={16} /> Scheduled Tasks
                </button>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden min-h-[400px]">
                {activeTab === "firewall" ? (
                    <div>
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase">
                                    <CheckCircle2 size={14} /> Active
                                </div>
                                <span className="text-sm text-zinc-500">UFW is enabled</span>
                            </div>
                            <button className="bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-2 transition-all">
                                <Plus size={14} /> Add Rule
                            </button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300 w-24">Action</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300">Port / Protocol</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300">Source</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300">Comment</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {rules.map((rule) => (
                                    <tr key={rule.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rule.type === "ALLOW" ? "bg-green-100/50 text-green-700" : "bg-red-100/50 text-red-700"
                                                }`}>
                                                {rule.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs">{rule.port}</td>
                                        <td className="px-6 py-3 font-mono text-xs">{rule.source}</td>
                                        <td className="px-6 py-3 text-zinc-500">{rule.comment}</td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button title="Toggle" className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 hover:text-blue-500">
                                                    <Power size={14} />
                                                </button>
                                                <button title="Delete" className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-500">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div>
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-zinc-500">System Crontab</span>
                            </div>
                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-2 transition-all">
                                <Plus size={14} /> New Job
                            </button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300 w-32">Schedule</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300">Command</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300 w-24">User</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300">Description</th>
                                    <th className="px-6 py-3 font-bold text-zinc-700 dark:text-zinc-300 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {crons.map((job) => (
                                    <tr key={job.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{job.schedule}</td>
                                        <td className="px-6 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{job.command}</td>
                                        <td className="px-6 py-3 text-zinc-900 dark:text-white font-medium">{job.user}</td>
                                        <td className="px-6 py-3 text-zinc-500 italic">{job.comment}</td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button title="Run Now" className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-zinc-500 hover:text-green-600">
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button title="Delete" className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-500">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
