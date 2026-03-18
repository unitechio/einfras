import { useState } from "react";
import { Shield, Clock, Plus, Trash2, Power, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100/50 dark:border-red-500/20">
                            <Shield className="text-red-500" size={20} />
                        </div>
                        Network & Scheduler
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Manage firewall rules and scheduled tasks.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "firewall" | "cron")}>
                <TabsList>
                    <TabsTrigger value="firewall" icon={Shield}>
                        Firewall
                    </TabsTrigger>
                    <TabsTrigger value="cron" icon={Clock}>
                        Scheduled Tasks
                    </TabsTrigger>
                </TabsList>

                {/* Content */}
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden min-h-[400px] transition-all">
                    <TabsContent value="firewall" className="mt-0">
                        <div>
                            <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-[11px] font-bold tracking-wider uppercase">
                                    <CheckCircle2 size={12} /> Active
                                </div>
                                <span className="text-[13px] font-medium text-zinc-500">UFW is enabled</span>
                            </div>
                            <Button variant="primary" size="sm" className="shadow-sm">
                                <Plus size={14} className="mr-1.5" /> Add Rule
                            </Button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider w-24">Action</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Port / Protocol</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Source</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Comment</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                                {rules.map((rule) => (
                                    <tr key={rule.id} className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase border shadow-sm ${rule.type === "ALLOW" ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400" : "bg-red-50 border-red-100 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                                                }`}>
                                                {rule.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{rule.port}</td>
                                        <td className="px-6 py-4 font-mono text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{rule.source}</td>
                                        <td className="px-6 py-4 text-[13px] text-zinc-500">{rule.comment}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" title="Toggle" className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20">
                                                    <Power size={14} />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Delete" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20">
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </TabsContent>

                    <TabsContent value="cron" className="mt-0">
                    <div>
                        <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
                            <div className="flex items-center gap-3">
                                <span className="text-[13px] font-medium text-zinc-500">System Crontab</span>
                            </div>
                            <Button variant="primary" size="sm" className="shadow-sm">
                                <Plus size={14} className="mr-1.5" /> New Job
                            </Button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 border-b border-zinc-200/60 dark:border-zinc-800/60">
                                <tr>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider w-32">Schedule</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Command</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider w-24">User</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                                {crons.map((job) => (
                                    <tr key={job.id} className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 font-mono text-[13px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/5">{job.schedule}</td>
                                        <td className="px-6 py-4 font-mono text-[13px] text-zinc-600 dark:text-zinc-400">{job.command}</td>
                                        <td className="px-6 py-4 text-[13px] text-zinc-900 dark:text-white font-medium">{job.user}</td>
                                        <td className="px-6 py-4 text-[13px] text-zinc-500 italic">{job.comment}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" title="Run Now" className="text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20">
                                                    <RotateCcw size={14} />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Delete" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20">
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
