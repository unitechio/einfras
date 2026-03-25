import { useEffect, useState } from "react";
import { Layers, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "@/core/api-client";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
import { useClusters, useNamespaces } from "../api/useKubernetesHooks";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { cn } from "@/lib/utils";
import { openCreateResourcePage } from "../createResourceConfig";
import { Pencil, Trash2 } from "lucide-react";

export default function NamespacesPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

    useEffect(() => {
        if (selectedEnvironment?.type === "kubernetes" && selectedEnvironment.id !== selectedClusterId) {
            setSelectedClusterId(selectedEnvironment.id);
            return;
        }
        if (!selectedClusterId && clusters.length > 0) {
            setSelectedClusterId(clusters[0].id);
        }
    }, [clusters, selectedClusterId, selectedEnvironment]);

    const { data: namespaces = [], isLoading, refetch } = useNamespaces(selectedClusterId);
    const filteredNamespaces = namespaces.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    useEffect(() => {
        if (namespaces.length && !namespaces.some((item) => item.name === namespace)) {
            setNamespace(namespaces[0].name);
        }
    }, [namespace, namespaces]);

    const editNamespace = async (name: string) => {
        try {
            const payload = await apiFetch<{ yaml: string }>(
                `/v1/environments/${selectedClusterId}/kubernetes/resources/namespaces/${encodeURIComponent(name)}/yaml?namespaced=false`,
            );
            openCreateResourcePage(navigate, {
                resourceType: "namespace",
                clusterId: selectedClusterId,
                title: "Edit Namespace",
                activeResource: "namespaces",
                kind: "Namespace",
                addLabel: "Update Namespace",
                namespaced: false,
                starterManifest: payload.yaml,
            });
        } catch (error) {
            showNotification({
                type: "error",
                message: "Unable to open namespace",
                description: error instanceof Error ? error.message : "Failed to load namespace YAML.",
            });
        }
    };

    const deleteNamespace = async (name: string) => {
        try {
            await apiFetch(`/v1/environments/${selectedClusterId}/kubernetes/resources/namespaces/${encodeURIComponent(name)}?namespaced=false`, {
                method: "DELETE",
            });
            showNotification({
                type: "success",
                message: "Namespace deleted",
                description: name,
            });
            await refetch();
        } catch (error) {
            showNotification({
                type: "error",
                message: "Delete namespace failed",
                description: error instanceof Error ? error.message : "Unable to delete namespace.",
            });
        }
    };

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces.map((item) => item.name) : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="namespaces"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input type="text" placeholder="Search namespaces..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
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
                                    resourceType: "namespace",
                                    clusterId: selectedClusterId,
                                })
                            }
                        >
                            <Layers className="mr-2 h-4 w-4" />
                            Add Namespace
                        </Button>
                    </div>
                </div>
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            <Layers className="h-5 w-5 text-blue-500" />
                            Namespaces
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Lifecycle and status overview for cluster namespaces.</p>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Namespaces can be created from YAML or uploaded manifest files.</div>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredNamespaces.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No namespaces found.</TableCell></TableRow>
                            ) : filteredNamespaces.map((item) => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell><Badge variant={item.status?.toLowerCase() === "active" ? "success" : "outline"}>{item.status}</Badge></TableCell>
                                    <TableCell>{item.age}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => void editNamespace(item.name)} title="Edit namespace">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteCandidate(item.name)} title="Delete namespace" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                                                <Trash2 className="h-4 w-4" />
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
            <ConfirmActionDialog
                open={!!deleteCandidate}
                title="Delete namespace?"
                description={deleteCandidate ? `This permanently deletes the namespace ${deleteCandidate} and the resources inside it.` : ""}
                confirmLabel="Delete Namespace"
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    void deleteNamespace(deleteCandidate).finally(() => setDeleteCandidate(null));
                }}
                pending={false}
                tone="danger"
            />
        </K8sExplorerLayout>
    );
}
