import { useEffect, useState } from "react";
import { Edit, Layers, RefreshCw, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useClusters, useDeployments, useLiveDeployments, useNamespaces, useRestartDeployment, useScaleDeployment } from "../api/useKubernetesHooks";
import { openCreateResourcePage } from "../createResourceConfig";

export default function DeploymentsPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const { showNotification } = useNotification();
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

    const { data: deployments = [], isLoading, refetch } = useDeployments(selectedClusterId, namespace, { watch: watchEnabled });
    const liveDeployments = useLiveDeployments(selectedClusterId, namespace, watchEnabled);
    const scaleDeployment = useScaleDeployment(selectedClusterId);
    const restartDeployment = useRestartDeployment(selectedClusterId);

    const deploymentItems = liveDeployments.data ?? deployments;
    const filteredDeployments = deploymentItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="deployments"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input
                            type="text"
                            placeholder="Search deployments..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant={watchEnabled ? "primary" : "outline"} onClick={() => setWatchEnabled((current) => !current)}>
                            {watchEnabled ? (liveDeployments.isConnected ? "Live" : "Watching") : "Watch"}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: "deployment",
                                    clusterId: selectedClusterId,
                                    namespace,
                                })
                            }
                        >
                            <Layers className="mr-2 h-4 w-4" />
                            Add Deployment
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
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
                                {filteredDeployments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No deployments found.</TableCell>
                                    </TableRow>
                                ) : filteredDeployments.map((item) => (
                                    <TableRow key={`${item.namespace}/${item.name}`}>
                                        <TableCell className="font-semibold">{item.name}</TableCell>
                                        <TableCell>{item.ready_replicas}/{item.desired_replicas}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === "Available" ? "success" : "warning"}>{item.status}</Badge>
                                        </TableCell>
                                        <TableCell>{item.age}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={async () => {
                                                        const next = window.prompt(`Scale ${item.name} to how many replicas?`, String(item.desired_replicas));
                                                        if (next === null) return;
                                                        const replicas = Number(next);
                                                        if (!Number.isFinite(replicas) || replicas < 0) return;
                                                        await scaleDeployment.mutateAsync({ namespace, deploymentName: item.name, replicas });
                                                        showNotification({ type: "success", message: "Deployment scaled", description: `${item.name} -> ${replicas} replicas.` });
                                                        refetch();
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={async () => {
                                                        await restartDeployment.mutateAsync({ namespace, deploymentName: item.name });
                                                        showNotification({ type: "success", message: "Deployment restarted", description: item.name });
                                                        refetch();
                                                    }}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
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
