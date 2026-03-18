"use client";

import {
    Users,
    Activity,
    ShieldCheck,
    AlertCircle,
    MoreVertical,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Settings
} from "lucide-react";

export default function DashboardPage() {
    const stats = [
        { label: "Total Users", value: "1,248", icon: Users, change: "+12%", trend: "up", color: "blue" },
        { label: "Active Nodes", value: "84", icon: Activity, change: "+3", trend: "up", color: "green" },
        { label: "Security score", value: "98%", icon: ShieldCheck, change: "-2%", trend: "down", color: "amber" },
        { label: "Active Alerts", value: "12", icon: AlertCircle, change: "+0", trend: "neutral", color: "red" },
    ];

    const environments = [
        { name: "Production-Cluster-01", type: "Kubernetes", status: "Healthy", cpu: "42%", ram: "64%", lastSync: "2 mins ago" },
        { name: "Staging-AWS", type: "Docker", status: "Healthy", cpu: "12%", ram: "28%", lastSync: "15 mins ago" },
        { name: "Dev-Local-VM", type: "Linux", status: "Warning", cpu: "88%", ram: "92%", lastSync: "1 hour ago" },
        { name: "Backup-Vault", type: "Cloud", status: "Healthy", cpu: "5%", ram: "12%", lastSync: "4 hours ago" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold">Environments Overview</h1>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                        <Plus size={18} />
                        <span>Add Environment</span>
                    </button>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Monitor and manage your secure infrastructure deployments.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/30 text-${stat.color}-600 dark:text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                <stat.icon size={24} />
                            </div>
                            <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <MoreVertical size={20} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{stat.label}</h3>
                            <div className="flex items-end gap-3">
                                <span className="text-2xl font-black text-zinc-900 dark:text-white">{stat.value}</span>
                                <span className={`text-xs font-bold flex items-center mb-1 ${stat.trend === "up" ? "text-green-500" : stat.trend === "down" ? "text-red-500" : "text-zinc-400"
                                    }`}>
                                    {stat.trend === "up" ? <ArrowUpRight size={14} /> : stat.trend === "down" ? <ArrowDownRight size={14} /> : null}
                                    {stat.change}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                    <h2 className="font-bold text-lg text-zinc-900 dark:text-white">Active Environments</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Items per page:</span>
                        <select className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer">
                            <option>10</option>
                            <option>25</option>
                            <option>50</option>
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/10">
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">CPU / RAM</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Last Sync</th>
                                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {environments.map((env, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-500 transition-colors cursor-pointer">{env.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase border border-zinc-200 dark:border-zinc-700">
                                            {env.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${env.status === "Healthy" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}></div>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{env.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 w-24">
                                            <div className="flex justify-between text-[8px] font-black uppercase text-zinc-400">
                                                <span>CPU</span>
                                                <span>{env.cpu}</span>
                                            </div>
                                            <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: env.cpu }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{env.lastSync}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-zinc-400 hover:text-blue-500 transition-colors p-1">
                                            <Activity size={18} />
                                        </button>
                                        <button className="text-zinc-400 hover:text-blue-500 transition-colors p-1 ml-2">
                                            <Settings size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/5 text-center">
                    <button className="text-blue-500 hover:text-blue-600 text-xs font-bold uppercase tracking-widest">View all environments</button>
                </div>
            </div>
        </div>
    );
}
