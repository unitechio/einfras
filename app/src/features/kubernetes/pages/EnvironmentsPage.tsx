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
    Activity,
    Layers,
    Monitor,
    Plus,
} from "lucide-react";
import { useEnvironment } from "@/core/EnvironmentContext";
import type { Environment } from "@/core/EnvironmentContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { Card } from "@/shared/ui/Card";

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


export default function EnvironmentsPage() {
    const { selectedEnvironment, setSelectedEnvironment } = useEnvironment();

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Box className="h-6 w-6 text-blue-500" />
                        Environments
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Connect and manage your Kubernetes and Docker environments.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button variant="outline" size="md">
                        <Download className="mr-2 h-4 w-4" />
                        Kubeconfig
                    </Button>
                    <Button variant="outline" size="md">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="primary" size="md">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Environment
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-md">
                    <Input
                        type="text"
                        placeholder="Search by name, group, tag, status, URL..."
                        icon={<Search className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />}
                    />
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                    <FilterSelect label="Platform" />
                    <FilterSelect label="Status" />
                    <Button variant="ghost" size="sm" className="text-xs">
                        Clear all
                    </Button>
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

            <div className="flex items-center justify-end gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <span>Items per page</span>
                <select className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 outline-none text-zinc-900 dark:text-white">
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
        <div className="flex items-center gap-2 bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors shadow-sm">
            <span>{label}</span>
            <ChevronDown size={14} />
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
        <Card
            className={cn(
                "group p-5 transition-all duration-300 relative",
                isSelected
                    ? "border-blue-500/50 ring-1 ring-blue-500/50 shadow-sm"
                    : "hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700"
            )}
        >
            <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Box className="w-6 h-6 text-blue-500" />
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{env.name}</h3>
                        <Badge variant={env.status === 'up' ? 'success' : 'error'} className="uppercase">
                            {env.status === 'up' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                            {env.status}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <Activity size={12} />
                            <span>Last seen: Just now</span>
                            <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">•</span>
                            <span>{env.url}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-zinc-600 dark:text-zinc-400" />
                            <span>{env.stats?.stacks} stacks</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Box size={14} className="text-zinc-600 dark:text-zinc-400" />
                            <span>{env.stats?.containers} containers</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Database size={14} className="text-zinc-600 dark:text-zinc-400" />
                            <span>{env.stats?.images} images</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Cpu size={14} className="text-zinc-600 dark:text-zinc-400" />
                            <span>1 CPU</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Monitor size={14} className="text-zinc-600 dark:text-zinc-400" />
                            <span>2.1 GB RAM</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[140px]">
                    {isSelected ? (
                        <Button
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onDisconnect(); }}
                            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-900/20 dark:hover:border-red-900"
                        >
                            <Unlink2 className="mr-2 h-4 w-4" />
                            Disconnect
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={(e) => { e.stopPropagation(); onSelect(); }}
                            className="w-full"
                        >
                            <Link2 className="mr-2 h-4 w-4" />
                            Connect
                        </Button>
                    )}
                    <div
                        className={cn(
                            "flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all mt-1",
                            isSelected
                                ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400"
                                : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-[#121212] dark:border-zinc-800 dark:text-zinc-400"
                        )}
                    >
                        <span className={cn("w-2 h-2 rounded-full", isSelected ? "bg-green-500 animate-pulse" : "bg-zinc-400 dark:bg-zinc-600")}></span>
                        {isSelected ? "Connected" : "Disconnected"}
                    </div>
                </div>

                <div className="flex flex-col gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 dark:text-zinc-400">
                        <Settings size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 dark:text-zinc-400">
                        <MoreHorizontal size={16} />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
