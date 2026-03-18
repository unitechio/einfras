"use client";

import { useState, useEffect } from "react";
import { 
    Search, RefreshCw, Trash2, Terminal, Waves, 
    MoreVertical, Info, Activity, Clock, Zap, 
    Cuboid, MousePointer2, ChevronRight, HardDrive,
    Server, ShieldCheck, Database, LayoutGrid, Globe
} from "lucide-react";
import { useClusters, usePods } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { K8sStatusBadge } from "../components/K8sStatusBadge";
import { K8sResourceDetailPanel } from "../components/K8sResourceDetailPanel";

export default function PodsPage() {
    const { data: clusterData, isLoading: isLoadingClusters } = useClusters();
    const clusters = clusterData?.data || [];
    
    const [selectedClusterId, setSelectedClusterId] = useState<string>("");
    const [namespace, setNamespace] = useState<string>("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPod, setSelectedPod] = useState<any>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    useEffect(() => {
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId]);

    const { data: pods, isLoading: isLoadingPods, refetch } = usePods(selectedClusterId, namespace);

    const filteredPods = (pods || []).filter(pod => 
        pod.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePodClick = (pod: any) => {
        setSelectedPod(pod);
        setIsPanelOpen(true);
    };

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={["default", "kube-system", "monitoring", "ingress-nginx"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="pods"
            onResourceChange={(type) => console.log("Navigate to", type)}
        >
            <div className="flex flex-col gap-6 h-full">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800/80 sticky top-0 bg-[#fcfcfc] dark:bg-[#0a0a0a] z-[5] pt-1">
                    <div className="w-full sm:max-w-md relative group">
                        <Input
                            type="text"
                            placeholder="Find pods by name, status, or node..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            icon={<Search className="h-4 w-4 text-zinc-400 dark:text-zinc-600 transition-colors group-focus-within:text-indigo-500" />}
                            className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all rounded-xl pl-10"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            size="md" 
                            onClick={() => refetch()} 
                            className="rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                        >
                            <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingPods && "animate-spin")} />
                            Refresh
                        </Button>
                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
                        <Button variant="primary" size="md" className="rounded-xl shadow-lg shadow-blue-500/20 px-6 font-bold tracking-tight">
                            Create Pod
                        </Button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white dark:bg-[#0d0d0d] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden flex-1 flex flex-col min-h-0 mb-6">
                    <div className="overflow-x-auto flex-1 custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/30 sticky top-0 z-[1]">
                                <TableRow className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-transparent">
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest pl-8 py-5 w-[30%]">Pod Instance</TableHead>
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Status / Indicators</TableHead>
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Resources (CPU/RAM)</TableHead>
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Placement (Node)</TableHead>
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Restarts</TableHead>
                                    <TableHead className="font-bold text-[11px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Age</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingPods ? (
                                    [...Array(6)].map((_, i) => (
                                        <TableRow key={i} className="hover:bg-transparent">
                                            <TableCell className="pl-8 py-6"><div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                            <TableCell><div className="h-6 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-full animate-pulse" /></TableCell>
                                            <TableCell><div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                            <TableCell><div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                            <TableCell><div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                            <TableCell><div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                            <TableCell className="pr-8"><div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 rounded ml-auto animate-pulse" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredPods.length === 0 ? (
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableCell colSpan={7} className="h-96 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-4">
                                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 relative">
                                                    <Cuboid size={48} className="text-zinc-200 dark:text-zinc-800" />
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                                        <Search size={24} className="text-zinc-400 opacity-50" />
                                                    </div>
                                                </div>
                                                <div className="max-w-xs space-y-1">
                                                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">No Pods Found</p>
                                                    <p className="text-xs text-zinc-500 font-medium">We couldn't find any resources matching your search configuration in '{namespace}' namespace.</p>
                                                </div>
                                                <Button variant="outline" size="md" className="mt-2 rounded-xl" onClick={() => setSearchQuery("")}>Clear Filters</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPods.map((pod) => (
                                        <TableRow 
                                            key={pod.name} 
                                            className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 cursor-pointer transition-colors border-b border-zinc-100/50 dark:border-zinc-800/30"
                                            onClick={() => handlePodClick(pod)}
                                        >
                                            <TableCell className="pl-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/10 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
                                                        <Cuboid size={18} className="text-indigo-600 dark:text-indigo-400 shadow-sm" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {pod.name}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{pod.ip || "10.42.0.1"} — IPv4</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <K8sStatusBadge status={pod.status} className="shadow-sm" />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5 w-full max-w-[120px]">
                                                     <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold tracking-tighter uppercase leading-none">
                                                        <span>CPU usage</span>
                                                        <span className="text-zinc-900 dark:text-zinc-100">12%</span>
                                                     </div>
                                                     <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 w-[12%]" />
                                                     </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                                        <Server size={12} className="text-zinc-400" />
                                                    </div>
                                                    <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
                                                        {pod.node || "N/A"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    "text-[11px] font-bold px-2 py-0.5 border-none",
                                                    pod.restarts > 0 ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                )}>
                                                    {pod.restarts}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-[12px] font-bold text-zinc-500 font-mono tracking-tighter">
                                                    {pod.age}
                                                </span>
                                            </TableCell>
                                            <TableCell className="pr-8 text-right">
                                                <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto">
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-indigo-500 transition-colors" title="Quick Terminal">
                                                        <Terminal size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors" title="Delete Resource">
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Footer / Summary Row */}
                    {!isLoadingPods && filteredPods.length > 0 && (
                        <div className="px-8 py-4 bg-zinc-50/50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">
                                    Total Pods: <span className="text-zinc-900 dark:text-zinc-100">{filteredPods.length}</span>
                                </div>
                                <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
                                <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">
                                    Healthy: <span className="text-emerald-600">{filteredPods.filter(p=>p.status === 'Running').length}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">
                                Version Control: <span className="text-zinc-900 dark:text-zinc-100">v1.28.0</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Side Drawer Detail Panel */}
            <K8sResourceDetailPanel 
                resource={selectedPod}
                type="pod"
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
            />
        </K8sExplorerLayout>
    );
}
