"use client";

import {
    Search,
    RefreshCw,
    Download,
    MoreHorizontal,
    Settings,
    ChevronDown,
    Box,
    Cpu,
    Database,
    Link2,
    Unlink2,
    CheckCircle2,
    Activity,
    Layers,
    Monitor,
} from "lucide-react";
import { useEnvironment } from "@/core/EnvironmentContext";
import type { Environment } from "@/core/EnvironmentContext";

const mockEnvironments: Environment[] = [
    {
        id: "local-docker",
        name: "local",
        type: "docker",
        status: "up",
        url: "/var/run/docker.sock",
        stats: {
            stacks: 3,
            containers: 7,
            images: 6,
            volumes: 1,
        }
    }
];

import { useNavigate } from "react-router-dom";

export default function EnvironmentsPage() {
    const { selectedEnvironment, setSelectedEnvironment } = useEnvironment();
    const navigate = useNavigate();

    const handleConnect = (env: Environment) => {
        setSelectedEnvironment(env);
        navigate("/dashboard");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold dark:text-white">Home</h1>
                    <button className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
                        <RefreshCw size={16} className="text-zinc-500" />
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 font-bold" />
                        <input
                            type="text"
                            placeholder="Search by name, group, tag, status, URL..."
                            className="bg-[#18181b] border border-zinc-800 rounded-md pl-10 pr-4 py-1.5 text-xs text-white min-w-[320px] outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        />
                    </div>
                    <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                    <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-md text-xs font-bold transition-colors border border-zinc-700">
                        <Download size={14} />
                        Kubeconfig
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <FilterSelect label="Platform" />
                <FilterSelect label="Connection Type" />
                <FilterSelect label="Status" />
                <FilterSelect label="Tags" />
                <FilterSelect label="Groups" />
                <FilterSelect label="Agent Version" />
                <button className="text-xs font-bold text-white hover:underline">Clear all</button>

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-bold">Sort By</span>
                    <FilterSelect label="Name" />
                    <button className="p-1.5 bg-zinc-800 rounded-md">
                        <ChevronDown size={14} className="text-zinc-400" />
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {mockEnvironments.map((env) => (
                    <EnvironmentCard
                        key={env.id}
                        env={env}
                        isSelected={selectedEnvironment?.id === env.id}
                        onSelect={() => setSelectedEnvironment(env)}
                        onDisconnect={() => setSelectedEnvironment(null)}
                    />
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 text-xs font-bold text-zinc-400 pt-4 border-t border-zinc-800">
                <span>Items per page</span>
                <select className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 outline-none text-white">
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                </select>
            </div>
        </div>
    );
}

function FilterSelect({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 bg-[#18181b] border border-zinc-800 rounded-md px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-zinc-800 cursor-pointer transition-colors">
            <span>{label}</span>
            <ChevronDown size={12} />
        </div>
    )
}

function EnvironmentCard({
    env,
    isSelected,
    onSelect,
    onDisconnect
}: {
    env: Environment;
    isSelected: boolean;
    onSelect: () => void;
    onDisconnect: () => void;
}) {
    return (
        <div
            className={cn(
                "group bg-[#18181b] border rounded-lg p-5 transition-all duration-300 relative",
                isSelected
                    ? "border-blue-500 ring-1 ring-blue-500 shadow-lg shadow-blue-500/10"
                    : "border-zinc-800 hover:border-zinc-700"
            )}
        >
            <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Box className="w-7 h-7 text-blue-400" />
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-black text-white">{env.name}</h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-black text-green-400 uppercase tracking-wider">
                            <CheckCircle2 size={10} />
                            {env.status}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold">
                            <Activity size={10} />
                            <span>2026-01-07 15:17:37</span>
                            <span className="text-zinc-700">Standalone 29.1.3</span>
                            <span className="text-zinc-700">{env.url}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Layers size={12} className="text-blue-500" />
                            <span>{env.stats?.stacks} stacks</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Box size={12} className="text-blue-500" />
                            <span>{env.stats?.containers} containers</span>
                            <div className="flex items-center gap-1 ml-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-green-500">7</span>
                                <span className="w-2 h-2 rounded-full bg-red-500 ml-1"></span>
                                <span className="text-red-500">0</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Database size={12} className="text-blue-500" />
                            <span>{env.stats?.images} Images</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cpu size={12} className="text-blue-500" />
                            <span>1 CPU</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Monitor size={12} className="text-blue-500" />
                            <span>2.1 GB RAM</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold italic">
                        <span>Group: Unassigned</span>
                        <span>No tags</span>
                        <span>local</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {isSelected ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
                            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-red-500/10 hover:text-red-500 border border-zinc-700 hover:border-red-500/50 text-zinc-400 px-4 py-2 rounded-md text-xs font-black transition-all min-w-[120px]"
                        >
                            <Unlink2 size={14} />
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onSelect(); }}
                            className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white border border-zinc-700 hover:border-blue-500 px-4 py-2 rounded-md text-xs font-black transition-all min-w-[120px]"
                        >
                            <Link2 size={14} />
                            Connect
                        </button>
                    )}
                    <div
                        className={cn(
                            "flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-black border transition-all",
                            isSelected
                                ? "bg-green-500/10 border-green-500/50 text-green-400"
                                : "bg-zinc-900 border-zinc-800 text-zinc-600"
                        )}
                    >
                        <span className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-green-400 animate-pulse" : "bg-zinc-700")}></span>
                        {isSelected ? "Connected" : "Not connected"}
                    </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                    <button className="p-2 hover:bg-zinc-800 rounded-md transition-colors border border-transparent hover:border-zinc-700">
                        <MoreHorizontal size={16} className="text-zinc-500" />
                    </button>
                    <button className="p-2 hover:bg-zinc-800 rounded-md transition-colors border border-transparent hover:border-zinc-700">
                        <Settings size={16} className="text-zinc-500" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Utility to handle class switching
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
