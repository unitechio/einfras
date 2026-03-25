import { useEffect, useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { useClusters, useIngresses, useNamespaces } from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";

export default function IngressesPage() {
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

    const { data: ingresses = [], isLoading, refetch } = useIngresses(selectedClusterId, namespace);
    const filteredIngresses = ingresses.filter((item) => [item.name, item.hosts, item.address, item.class_name].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="ingresses"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input type="text" placeholder="Search ingresses..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: "ingress",
                                    clusterId: selectedClusterId,
                                    namespace,
                                })
                            }
                        >
                            <Globe className="mr-2 h-4 w-4" />
                            Add Ingress
                        </Button>
                    </div>
                </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            <Globe className="h-5 w-5 text-emerald-500" />
                            Ingresses
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Hosts, entrypoints, class, and external exposure for the selected namespace.</p>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Upload or paste YAML to create a new ingress.</div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Hosts</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead>Ports</TableHead>
                                <TableHead>Age</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredIngresses.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No ingresses found.</TableCell></TableRow>
                            ) : filteredIngresses.map((item) => (
                                <TableRow key={`${item.namespace}/${item.name}`}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.class_name}</TableCell>
                                    <TableCell>{item.hosts}</TableCell>
                                    <TableCell>{item.address}</TableCell>
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
