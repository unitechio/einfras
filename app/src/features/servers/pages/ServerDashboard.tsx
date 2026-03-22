import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart } from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import { useParams } from 'react-router-dom';
import { useServerMetrics } from '../api/useServerHooks';
import { useState, useEffect } from 'react';

export default function ServerDashboard() {
    const { serverId } = useParams();
    const { data: currentMetrics, isLoading, error } = useServerMetrics(serverId || "", { refetchInterval: 5000 });

    const [history, setHistory] = useState<{ time: string, cpu: number, ram: number, netIn: number, netOut: number }[]>([]);

    useEffect(() => {
        if (currentMetrics) {
            const time = new Date(currentMetrics.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setHistory(prev => {
                const newRecord = {
                    time,
                    cpu: Math.round(currentMetrics.cpu_usage || 0),
                    ram: Math.round(currentMetrics.memory_usage || 0),
                    netIn: parseFloat((currentMetrics.network_in_mbps || 0).toFixed(2)),
                    netOut: parseFloat((currentMetrics.network_out_mbps || 0).toFixed(2)),
                };
                const newHistory = [...prev, newRecord];
                if (newHistory.length > 15) return newHistory.slice(newHistory.length - 15);
                return newHistory;
            });
        }
    }, [currentMetrics]);

    if (isLoading && history.length === 0) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 h-[320px]" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3 bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-8">
                <div className="text-red-500 font-semibold text-base">Failed to connect to backend</div>
                <p className="text-sm text-zinc-500">Make sure the EINFRA backend is running on port 8080.</p>
                <code className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded">cd einfra && go run ./api/cmd</code>
            </div>
        );
    }

    // Build disk data from real API — falls back to empty if not yet available
    const diskData = ((currentMetrics as any)?.disk_mounts as Array<{ mount: string; used: number; total: number }>)?.map((d) => ({
        name: d.mount,
        used: Math.round(d.used / 1_073_741_824),
        total: Math.round(d.total / 1_073_741_824),
    })) ?? [{ name: '/', used: 0, total: 0 }];


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-sm group">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50">CPU Usage</h3>
                        <span className="text-xs font-medium px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Core i9</span>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history.length > 0 ? history : [{ time: '00:00', cpu: 0 }]}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#09090b" stopOpacity={0.2} className="dark:stopColor-[#fafafa]" />
                                        <stop offset="95%" stopColor="#09090b" stopOpacity={0} className="dark:stopColor-[#fafafa]" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                                <XAxis dataKey="time" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', color: '#09090b', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#09090b', fontWeight: 600 }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#09090b" className="dark:stroke-white" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* RAM Usage */}
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">Memory Usage</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history.length > 0 ? history : [{ time: '00:00', ram: 0 }]}>
                                <defs>
                                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#09090b" stopOpacity={0.2} className="dark:stopColor-[#fafafa]" />
                                        <stop offset="95%" stopColor="#09090b" stopOpacity={0} className="dark:stopColor-[#fafafa]" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                                <XAxis dataKey="time" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#09090b', fontWeight: 600 }}
                                />
                                <Area type="monotone" dataKey="ram" stroke="#09090b" className="dark:stroke-white" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Network Usage */}
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">Network I/O</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history.length > 0 ? history : [{ time: '00:00', netIn: 0, netOut: 0 }]}>
                                <defs>
                                    <linearGradient id="colorNetIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorNetOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                                <XAxis dataKey="time" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip
                                    cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#09090b', fontWeight: 600 }}
                                />
                                <Area type="monotone" dataKey="netIn" name="In (Mbps)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNetIn)" />
                                <Area type="monotone" dataKey="netOut" name="Out (Mbps)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorNetOut)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Disk Usage */}
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">Disk Usage</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={diskData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} horizontal={false} />
                                <XAxis type="number" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={10} />
                                <YAxis dataKey="name" type="category" width={50} fontSize={11} stroke="#888" tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#09090b', fontWeight: 600 }}
                                />
                                <Bar dataKey="used" fill="#09090b" className="dark:fill-white" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
