import { Activity, Cpu, HardDrive, Network, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ServerHealthPage() {
    // Mock Metric Data
    const data = [
        { time: "10:00", cpu: 45, ram: 60, network: 20 },
        { time: "10:05", cpu: 55, ram: 62, network: 35 },
        { time: "10:10", cpu: 40, ram: 65, network: 25 },
        { time: "10:15", cpu: 70, ram: 63, network: 45 },
        { time: "10:20", cpu: 65, ram: 65, network: 30 },
        { time: "10:25", cpu: 50, ram: 60, network: 22 },
        { time: "10:30", cpu: 45, ram: 58, network: 15 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Activity className="text-green-500" /> Health & Monitoring
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Real-time resource usage and system performance metrics.
                    </p>
                </div>
                <div className="flex gap-2">
                    <span className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full uppercase">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Live
                    </span>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard icon={Cpu} title="CPU Usage" value="45%" subtext="12 Cores Active" color="text-blue-500" />
                <MetricCard icon={Activity} title="Memory" value="12.4 GB" subtext="of 32 GB (38%)" color="text-purple-500" />
                <MetricCard icon={HardDrive} title="Disk I/O" value="45 MB/s" subtext="Read / Write" color="text-orange-500" />
                <MetricCard icon={Network} title="Network" value="1.2 Gbps" subtext="Inbound Traffic" color="text-green-500" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <Cpu size={16} className="text-blue-500" /> Processor Load
                    </h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                                <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#18181b", border: "none", borderRadius: "4px", color: "#fff" }}
                                    itemStyle={{ color: "#fff" }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <Activity size={16} className="text-purple-500" /> Memory Usage
                    </h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                                <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#18181b", border: "none", borderRadius: "4px", color: "#fff" }}
                                    itemStyle={{ color: "#fff" }}
                                />
                                <Area type="monotone" dataKey="ram" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, title, value, subtext, color }: any) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-zinc-500">{title}</p>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{value}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{subtext}</p>
                </div>
                <div className={`p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg ${color}`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
}
