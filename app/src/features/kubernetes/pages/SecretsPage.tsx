import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { useClusters, useNamespaces, useSecrets } from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";

export default function SecretsPage() {
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

    const { data: secrets = [], isLoading, refetch } = useSecrets(selectedClusterId, namespace);
    const filteredSecrets = secrets.filter((item) => [item.name, item.namespace, item.type].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="secrets"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input type="text" placeholder="Search secrets..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
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
                                    resourceType: "secret",
                                    clusterId: selectedClusterId,
                                    namespace,
                                })
                            }
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Add Secret
                        </Button>
                    </div>
                </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            <ShieldCheck className="h-5 w-5 text-rose-500" />
                            Secrets
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Secret metadata only, with type and entry counts, so sensitive values stay protected.</p>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Secret values stay encoded in YAML so you can review before apply.</div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Namespace</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Entries</TableHead>
                                <TableHead>Age</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSecrets.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No secrets found.</TableCell></TableRow>
                            ) : filteredSecrets.map((item) => (
                                <TableRow key={`${item.namespace}/${item.name}`}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.namespace}</TableCell>
                                    <TableCell>{item.type}</TableCell>
                                    <TableCell>{item.data_count}</TableCell>
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
