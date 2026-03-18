"use client";

import { useState } from "react";
import { Terminal, Network, Settings2, Save, Server, Activity, ArrowRight, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { useNotification } from "@/core/NotificationContext";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";

export default function EdgeComputeSettingsPage() {
    const { showNotification } = useNotification();
    const [isSaving, setIsSaving] = useState(false);
    
    // Form States
    const [settings, setSettings] = useState({
        autoSync: true,
        distributedTracing: false,
        pollingInterval: "30",
        maxNodes: "100",
        edgeCacheTTL: "3600",
        offlineMode: true,
    });

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            showNotification({
                type: "success",
                message: "Settings saved",
                description: "Edge compute configurations have been applied globally."
            });
        }, 800);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-indigo-500" />
                        Edge Compute
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1.5">Configure edge agents, distributed runtime features, and synchronization protocols.</p>
                </div>
                <Button variant="primary" size="md" onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                    {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Settings Column */}
                <div className="md:col-span-2 space-y-6">
                    
                    {/* General Settings */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
                            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-zinc-500" />
                                General Configuration
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Agent Polling Interval (seconds)</label>
                                    <Input 
                                        name="pollingInterval"
                                        value={settings.pollingInterval}
                                        onChange={handleChange}
                                        type="number" 
                                        placeholder="e.g. 30" 
                                        className="h-10 text-[13px]" 
                                    />
                                    <p className="text-[12px] text-zinc-500 mt-1">How often edge nodes fetch new tasks.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Max Nodes Per Cluster</label>
                                    <Input 
                                        name="maxNodes"
                                        value={settings.maxNodes}
                                        onChange={handleChange}
                                        type="number" 
                                        placeholder="100" 
                                        className="h-10 text-[13px]" 
                                    />
                                    <p className="text-[12px] text-zinc-500 mt-1">Hard limit for auto-scaling.</p>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Edge Cache TTL (seconds)</label>
                                <Input 
                                    name="edgeCacheTTL"
                                    value={settings.edgeCacheTTL}
                                    onChange={handleChange}
                                    type="number" 
                                    placeholder="3600" 
                                    className="h-10 text-[13px]" 
                                />
                                <p className="text-[12px] text-zinc-500 mt-1">Time to live for local edge caching of API responses.</p>
                            </div>
                        </div>
                    </div>

                    {/* Feature Toggles */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
                            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Zap className="w-4 h-4 text-zinc-500" />
                                Advanced Features
                            </h2>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            <ToggleRow 
                                title="Auto-Sync Configurations" 
                                description="Automatically push configuration changes to all connected edge nodes without manual deployment."
                                active={settings.autoSync}
                                onClick={() => handleToggle("autoSync")}
                            />
                            <ToggleRow 
                                title="Distributed Tracing" 
                                description="Enable telemetry generation at the edge for detailed request tracing across nodes."
                                active={settings.distributedTracing}
                                onClick={() => handleToggle("distributedTracing")}
                            />
                            <ToggleRow 
                                title="Offline Tolerance Mode" 
                                description="Allow nodes to keep functioning and serving cached responses if the core platform goes offline."
                                active={settings.offlineMode}
                                onClick={() => handleToggle("offlineMode")}
                            />
                        </div>
                    </div>

                </div>

                {/* Sidebar Info & Actions */}
                <div className="space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <Network className="w-4 h-4" />
                            </div>
                            <h3 className="text-[14px] font-semibold text-indigo-900 dark:text-indigo-300">Edge Network</h3>
                        </div>
                        <p className="text-[13px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed mb-4">
                            Your environment is currently configured to support edge compute extensions. Note that some settings may require restarting the agent to take full effect.
                        </p>
                        <Button variant="outline" className="w-full bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 text-[13px]">
                            View Network Map <ArrowRight className="w-3.5 h-3.5 ml-2" />
                        </Button>
                    </div>

                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <h4 className="text-[13px] font-semibold text-zinc-900 dark:text-white uppercase tracking-wider mb-4">Quick Stats</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center text-[12px] mb-1.5">
                                    <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Active Edge Nodes</span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">24 / 100</span>
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-1.5 rounded-full w-[24%]" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center text-[12px] mb-1.5">
                                    <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Network Health</span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">Good</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleRow({ title, description, active, onClick }: { title: string, description: string, active: boolean, onClick: () => void }) {
    return (
        <div className="p-6 flex items-start justify-between gap-8 group">
            <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-white mb-1.5">{title}</h3>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">{description}</p>
            </div>
            <button 
                onClick={onClick}
                className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                    active ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
                )}
            >
                <span 
                    className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        active ? "translate-x-4" : "translate-x-0"
                    )}
                />
            </button>
        </div>
    );
}
