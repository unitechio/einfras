"use client";

import { Cpu, Server, HardDrive, Wifi } from "lucide-react";

const metrics = [
    { id: 1, name: "CPU Load", value: "42%", status: "healthy", icon: Cpu, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { id: 2, name: "Memory Usage", value: "6.8 GB / 16 GB", status: "warning", icon: Server, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { id: 3, name: "Disk Space", value: "78%", status: "healthy", icon: HardDrive, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { id: 4, name: "Network TX/RX", value: "124 MB/s", status: "healthy", icon: Wifi, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
];

export const MetricsDashboard = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => {
                const Icon = m.icon;
                return (
                    <div key={m.id} className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col items-start gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                        <div className={`p-3 rounded-lg flex-shrink-0 ${m.bg} ${m.color}`}>
                            <Icon size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">{m.name}</p>
                            <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{m.value}</h3>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
