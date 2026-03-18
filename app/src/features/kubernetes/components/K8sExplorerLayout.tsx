"use client";

import { useState, useMemo } from "react";
import { 
  X, Search, LayoutGrid, Database, Activity, 
  Terminal, ShieldCheck, ChevronRight, HardDrive, 
  ChevronLeft, Layout, Cuboid, Server, ShieldIcon,
  Globe, Zap, MousePointer2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";

interface ExplorerLayoutProps {
    children: React.ReactNode;
    clusters: any[];
    namespaces: string[];
    selectedCluster: string;
    selectedNamespace: string;
    onClusterChange: (id: string) => void;
    onNamespaceChange: (ns: string) => void;
    activeResource: string;
    onResourceChange: (type: string) => void;
}

export function K8sExplorerLayout({
    children,
    clusters,
    namespaces,
    selectedCluster,
    selectedNamespace,
    onClusterChange,
    onNamespaceChange,
    activeResource,
    onResourceChange
}: ExplorerLayoutProps) {
    const [collapsed, setCollapsed] = useState(false);

    const menuItems = [
        { id: "workloads", label: "Workloads", type: "header", icon: Layout },
        { id: "pods", label: "Pods", icon: Cuboid },
        { id: "deployments", label: "Deployments", icon: Zap },
        { id: "network", label: "Network", type: "header", icon: Globe },
        { id: "services", label: "Services", icon: Activity },
        { id: "ingress", label: "Ingresses", icon: Globe },
        { id: "config", label: "Configuration", type: "header", icon: ShieldCheck },
        { id: "configmaps", label: "ConfigMaps", icon: Database },
        { id: "secrets", label: "Secrets", icon: ShieldIcon },
        { id: "cluster", label: "Cluster", type: "header", icon: Server },
        { id: "nodes", label: "Nodes", icon: HardDrive },
        { id: "namespaces_list", label: "Namespaces", icon: LayoutGrid },
    ];

    return (
        <div className="flex h-screen bg-[#fcfcfc] dark:bg-[#0a0a0a] overflow-hidden">
            {/* Sidebar */}
            <aside className={cn(
                "h-full bg-white dark:bg-[#0d0d0d] border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 flex flex-col relative z-50",
                collapsed ? "w-20" : "w-64"
            )}>
                {/* Cluster Selector Header */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                     <div className="mb-4">
                        <label className={cn("text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2", collapsed && "text-center")}>
                            {collapsed ? "Clstr" : "Selected Cluster"}
                        </label>
                        <select 
                            value={selectedCluster}
                            onChange={(e) => onClusterChange(e.target.value)}
                            className={cn(
                                "w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none",
                                collapsed && "px-1 text-center"
                            )}
                        >
                            {clusters.map(c => (
                                <option key={c.id} value={c.id}>{collapsed ? c.name.substring(0,2) : c.name}</option>
                            ))}
                        </select>
                     </div>

                     <div>
                        <label className={cn("text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2", collapsed && "text-center")}>
                            {collapsed ? "Ns" : "Namespace"}
                        </label>
                        <select 
                            value={selectedNamespace}
                            onChange={(e) => onNamespaceChange(e.target.value)}
                            className={cn(
                                "w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-semibold px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none",
                                collapsed && "px-1 text-center"
                            )}
                        >
                            {namespaces.map(ns => (
                                <option key={ns} value={ns}>{collapsed ? ns.substring(0,2) : ns}</option>
                            ))}
                        </select>
                     </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
                    {menuItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (item.type === "header") {
                            return !collapsed && (
                                <div key={item.id} className="mt-6 mb-2 first:mt-0 px-3">
                                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em]">{item.label}</span>
                                </div>
                            );
                        }
                        
                        const isActive = activeResource === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onResourceChange(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative mb-0.5",
                                    isActive 
                                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-500/20 shadow-sm shadow-indigo-500/5" 
                                        : "text-zinc-500 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-300 font-medium"
                                )}
                            >
                                <Icon size={isActive ? 18 : 16} className={cn("transition-transform group-hover:scale-110", isActive && "text-indigo-500")} />
                                {!collapsed && <span className="text-[13px]">{item.label}</span>}
                                {isActive && !collapsed && (
                                     <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                                )}
                                {collapsed && isActive && (
                                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r-md" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Sidebar Collapse Toggle */}
                <button 
                   onClick={() => setCollapsed(!collapsed)}
                   className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-zinc-400 group"
                >
                    {collapsed ? <ChevronRight size={18} className="group-hover:text-zinc-900" /> : <ChevronLeft size={18} className="group-hover:text-zinc-900" />}
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full bg-[#fcfcfc] dark:bg-[#0a0a0a] min-w-0">
                {/* Main Header / Breadcrumb */}
                <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-[#0d0d0d] relative z-10 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-zinc-950 dark:bg-white rounded-lg flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                            <Activity size={16} className="text-white dark:text-zinc-950" />
                        </div>
                        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
                        <div className="flex flex-col">
                             <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                                <span>Kubernetes Explorer</span>
                                <ChevronRight size={12} />
                                <span className="text-zinc-900 dark:text-zinc-100">{activeResource}</span>
                             </div>
                             <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
                                {activeResource.charAt(0).toUpperCase() + activeResource.slice(1)}
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-100 dark:border-blue-500/20 text-[10px] font-black uppercase tracking-widest">Live</div>
                             </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                         <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-500">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                             Synchronized (0.5s)
                         </div>
                         <Button variant="primary" size="md">
                            Deploy Resource
                         </Button>
                    </div>
                </header>

                {/* Breadcrumb / Filter row */}
                <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col pt-6 px-8">
                     {children}
                </div>
                
                {/* Floating "K8s Assist" or Status */}
                <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-4">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl shadow-2xl shadow-indigo-600/40 flex items-center justify-center group transform hover:scale-105 active:scale-95 transition-all outline-none">
                        <Terminal size={20} className="group-hover:rotate-12 transition-transform" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                    </button>
                </div>
            </main>
        </div>
    );
}
