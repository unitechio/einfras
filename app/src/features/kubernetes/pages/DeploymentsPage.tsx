import { useState, useEffect } from "react";
import { Search, Cuboid, RefreshCw, Layers, Edit } from "lucide-react";
import { useClusters, useDeployments } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function DeploymentsPage() {
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

    const { data: deployments, isLoading: isLoadingDeployments, refetch } = useDeployments(selectedClusterId, namespace);

    const filteredDeployments = (deployments || []).filter(dep => 
        dep.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Layers className="h-6 w-6 text-purple-500" />
                        Deployments
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage Kubernetes deployments and replicasets.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Cuboid className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedClusterId}
                            onChange={(e) => setSelectedClusterId(e.target.value)}
                            disabled={isLoadingClusters}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 min-w-[150px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
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
                        className="h-9 px-3 py-2 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-40 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    />

                    <Button variant="outline" size="md" onClick={() => refetch()}>
                        <RefreshCw className={cn("h-4 w-4", isLoadingDeployments && "animate-spin")} />
                    </Button>
                    
                    <Button variant="primary" size="md">
                        Create Deployment
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search deployments..."
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
                                <TableHead>Ready</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingDeployments ? (
                                [...Array(4)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto animate-pulse" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredDeployments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                            <Layers size={32} className="mb-3 opacity-20" />
                                            <p className="text-[13px] font-medium">No deployments found in namespace '{namespace}'.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredDeployments.map((dep) => (
                                    <TableRow key={dep.name} className="group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer">
                                                    {dep.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-zinc-600 dark:text-zinc-400 font-medium">
                                            <span className={cn(
                                                dep.ready_replicas === dep.desired_replicas ? "text-green-600 dark:text-green-500 font-bold" : "text-yellow-600 dark:text-yellow-500 font-bold"
                                            )}>
                                                {dep.ready_replicas}/{dep.desired_replicas}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                dep.status === 'Available' ? 'success' : 'warning'
                                            }>
                                                {dep.status === 'Available' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                                                {dep.status || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {dep.age}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Edit/Scale">
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
