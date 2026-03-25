import { useEffect, useState } from "react";
import { Network, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useClusters, useLiveServices, useNamespaces, useServices } from "../api/useKubernetesHooks";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";

export default function ServicesPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [watchEnabled, setWatchEnabled] = useState(true);

    useEffect(() => {
        if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
            setSelectedClusterId(selectedEnvironment.id);
            return;
        }
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId, selectedEnvironment]);

    const { data: namespacesData = [] } = useNamespaces(selectedClusterId, { watch: watchEnabled });
    const namespaces = namespacesData.map((item) => item.name);
    useEffect(() => {
        if (namespaces.length && !namespaces.includes(namespace)) {
            setNamespace(namespaces[0]);
        }
    }, [namespace, namespaces]);

    const { data: services = [], isLoading, refetch } = useServices(selectedClusterId, namespace, { watch: watchEnabled });
    const liveServices = useLiveServices(selectedClusterId, namespace, watchEnabled);
    const serviceItems = liveServices.data ?? services;
    const filteredServices = serviceItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="services"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input type="text" placeholder="Search services..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant={watchEnabled ? "primary" : "outline"} onClick={() => setWatchEnabled((current) => !current)}>
                            {watchEnabled ? (liveServices.isConnected ? "Live" : "Watching") : "Watch"}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: "service",
                                    clusterId: selectedClusterId,
                                    namespace,
                                })
                            }
                        >
                            <Network className="mr-2 h-4 w-4" />
                            Add Service
                        </Button>
                    </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredServices.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No services found.</TableCell></TableRow>
                                ) : filteredServices.map((item) => (
                                    <TableRow key={`${item.namespace}/${item.name}`}>
                                        <TableCell className="font-semibold">{item.name}</TableCell>
                                        <TableCell>{item.type}</TableCell>
                                        <TableCell>{item.cluster_ip}</TableCell>
                                        <TableCell>{item.external_ip}</TableCell>
                                        <TableCell>{item.ports}</TableCell>
                                        <TableCell>{item.age}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </K8sExplorerLayout>
    );
}
