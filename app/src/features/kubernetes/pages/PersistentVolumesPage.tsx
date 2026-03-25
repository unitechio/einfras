import { useEffect, useMemo, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useClusters, useNamespaces, usePersistentVolumeClaims, usePersistentVolumes } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";

export default function PersistentVolumesPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
            setSelectedClusterId(selectedEnvironment.id);
            return;
        }
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId, selectedEnvironment]);

    const { data: namespacesData = [] } = useNamespaces(selectedClusterId);
    const namespaces = namespacesData.map((item) => item.name);
    useEffect(() => {
        if (namespaces.length && !namespaces.includes(namespace)) {
            setNamespace(namespaces[0]);
        }
    }, [namespace, namespaces]);

    const { data: pvs = [], isLoading: isLoadingPVs, refetch: refetchPVs } = usePersistentVolumes(selectedClusterId);
    const { data: pvcs = [], isLoading: isLoadingPVCs, refetch: refetchPVCs } = usePersistentVolumeClaims(selectedClusterId, namespace);
    const filteredPVs = useMemo(() => pvs.filter((item) => [item.name, item.status, item.claim, item.storage_class].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))), [pvs, searchQuery]);
    const filteredPVCs = useMemo(() => pvcs.filter((item) => [item.name, item.status, item.volume, item.storage_class].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))), [pvcs, searchQuery]);

    return (
        <K8sExplorerLayout clusters={clusters} namespaces={namespaces.length ? namespaces : ["default"]} selectedCluster={selectedClusterId} selectedNamespace={namespace} onClusterChange={setSelectedClusterId} onNamespaceChange={setNamespace} activeResource="persistent-volumes" onResourceChange={(type) => navigate(`/${type}`)}>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex w-full max-w-xs">
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search PVs and PVCs..." />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { refetchPVs(); refetchPVCs(); }}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", (isLoadingPVs || isLoadingPVCs) && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: "persistentvolume",
                                    clusterId: selectedClusterId,
                                })
                            }
                        >
                            <Database className="mr-2 h-4 w-4" />
                            Add Storage
                        </Button>
                    </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h3 className="font-semibold">Persistent Volumes</h3></div>
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Capacity</TableHead><TableHead>Claim</TableHead></TableRow></TableHeader><TableBody>{filteredPVs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-32 text-center text-zinc-500 dark:text-zinc-400">No persistent volumes found.</TableCell></TableRow> : filteredPVs.map((item) => <TableRow key={item.name}><TableCell>{item.name}</TableCell><TableCell>{item.status}</TableCell><TableCell>{item.capacity}</TableCell><TableCell>{item.claim}</TableCell></TableRow>)}</TableBody></Table></div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800"><h3 className="font-semibold">Persistent Volume Claims</h3></div>
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Volume</TableHead><TableHead>Capacity</TableHead></TableRow></TableHeader><TableBody>{filteredPVCs.length === 0 ? <TableRow><TableCell colSpan={4} className="h-32 text-center text-zinc-500 dark:text-zinc-400">No PVCs found.</TableCell></TableRow> : filteredPVCs.map((item) => <TableRow key={`${item.namespace}/${item.name}`}><TableCell>{item.name}</TableCell><TableCell>{item.status}</TableCell><TableCell>{item.volume}</TableCell><TableCell>{item.capacity}</TableCell></TableRow>)}</TableBody></Table></div>
                    </div>
                </div>
            </div>
        </K8sExplorerLayout>
    );
}
