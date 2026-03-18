import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useServerMetrics } from '@/features/servers/api/useServerHooks';
import { useParams } from 'react-router-dom';

function formatTime(isoString: string) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export default function ServerDashboard() {
    const { id } = useParams<{ id: string }>();
    
    // Default to 'server-1' if ID is not in URL
    const serverId = id || 'server-1';

    const { data: metrics, isLoading, isError } = useServerMetrics(serverId, { refetchInterval: 5000 });

    const chartData = useMemo(() => {
        if (!metrics) return [];
        // Keep a simple single point for now. In a real app we would accumulate points in a context or state
        return [{
            name: formatTime(metrics.timestamp),
            cpu: Number(metrics.cpu_usage.toFixed(2)),
            ram: Number(metrics.memory_usage.toFixed(2)),
            netIn: Number(metrics.network_in_mbps.toFixed(2)),
            netOut: Number(metrics.network_out_mbps.toFixed(2)),
            netTotal: Number((metrics.network_in_mbps + metrics.network_out_mbps).toFixed(2))
        }];
    }, [metrics]);

    const diskData = useMemo(() => {
        if (!metrics?.disk_usage) return [];
        // For simple representation, assuming disk_usage is the main / mount percentage 
        // In full impl, this might come from another array in metrics
        return [
            { name: '/', used: Number(metrics.disk_usage.toFixed(2)), total: 100 }
        ];
    }, [metrics]);

    if (isLoading && chartData.length === 0) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm h-[320px]">
                            <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-6"></div>
                            <div className="h-[230px] w-full bg-zinc-100 dark:bg-zinc-800/50 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-md border border-red-200 dark:border-red-800/30 font-medium">
                Failed to load server metrics. Please check if the backend API is running.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all hover:shadow-md">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> CPU Usage
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" fontSize={12} stroke="#888" tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} stroke="#888" tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RAM Usage */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all hover:shadow-md">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500"></div> Memory Usage
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" fontSize={12} stroke="#888" tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} stroke="#888" tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                />
                                <Area type="monotone" dataKey="ram" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Network Usage */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all hover:shadow-md">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Network I/O
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" fontSize={12} stroke="#888" tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} stroke="#888" tickLine={false} axisLine={false} tickFormatter={(val) => `${val}Mb/s`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                />
                                <Area type="monotone" dataKey="netTotal" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Disk Usage */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 transition-all hover:shadow-md">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div> Disk Usage
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={diskData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.1} horizontal={false} />
                                <XAxis type="number" fontSize={12} stroke="#888" tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                <YAxis dataKey="name" type="category" width={50} fontSize={12} stroke="#888" tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                />
                                <Bar dataKey="used" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
