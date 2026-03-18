import { useState, useEffect } from "react";
import { Search, Cuboid, RefreshCw, Network, Edit } from "lucide-react";
import { useClusters, useServices } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

export default function ServicesPage() {
    const { data: clusterData, isLoading: isLoadingClusters } = useClusters();
    const clusters = clusterData?.data || [];
    
    const [selectedClusterId, setSelectedClusterId] = useState<string>("");
    const [namespace, setNamespace] = useState<string>("default");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId]);

    const { data: services, isLoading: isLoadingServices, refetch } = useServices(selectedClusterId, namespace);

    const filteredServices = (services || []).filter(svc => 
        svc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Network className="h-6 w-6 text-emerald-500" />
                        Services
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage Kubernetes services, networking, and ingresses.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Cuboid className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedClusterId}
                            onChange={(e) => setSelectedClusterId(e.target.value)}
                            disabled={isLoadingClusters}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-w-[150px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Cluster...</option>
                            {clusters.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <input
                        type="text"
                        placeholder="Namespace"
                        value={namespace}
                        onChange={(e) => setNamespace(e.target.value)}
                        className="h-9 px-3 py-2 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-40 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    />

                    <Button variant="outline" size="md" onClick={() => refetch()}>
                        <RefreshCw className={cn("h-4 w-4", isLoadingServices && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Cluster IP</TableHead>
                                <TableHead>External IP</TableHead>
                                <TableHead>Ports</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingServices ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-sm animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto animate-pulse" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredServices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <Network size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No services found in namespace '{namespace}'.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredServices.map((svc) => (
                                    <TableRow key={svc.name} className="group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors cursor-pointer">
                                                    {svc.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="px-2 py-1 text-[11px] font-semibold tracking-wide uppercase rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                {svc.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                                            {svc.cluster_ip}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                                            {svc.external_ip || '<none>'}
                                        </TableCell>
                                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 font-mono max-w-[200px] truncate" title={svc.ports}>
                                            {svc.ports}
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {svc.age}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Edit Service">
                                                    <Edit size={14} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
