import { useEffect, useMemo, useState } from "react";
import { Box, Download, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useApplyManifest, useClusters, useHelmReleases, useInstallHelmRelease, useNamespaces, useUninstallHelmRelease, useKubeAgentBootstrap } from "../api/useKubernetesHooks";

export default function HelmReleasesPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [showInstall, setShowInstall] = useState(false);
    const [showAgent, setShowAgent] = useState(false);
    const [releaseName, setReleaseName] = useState("");
    const [chartRef, setChartRef] = useState("");
    const [valuesYaml, setValuesYaml] = useState("");
    const [agentToken, setAgentToken] = useState("");
    const [agentImage, setAgentImage] = useState("");

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

    const { data: releases = [], isLoading, refetch } = useHelmReleases(selectedClusterId);
    const installRelease = useInstallHelmRelease(selectedClusterId);
    const uninstallRelease = useUninstallHelmRelease(selectedClusterId);
    const bootstrapQuery = useKubeAgentBootstrap(selectedClusterId, agentToken, agentImage, showAgent && !!agentToken);
    const applyManifest = useApplyManifest(selectedClusterId);

    const filtered = useMemo(
        () => releases.filter((item) =>
            [item.name, item.namespace, item.chart, item.status].some((value) => value.toLowerCase().includes(searchQuery.toLowerCase())),
        ),
        [releases, searchQuery],
    );

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="helm"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="w-full xl:max-w-sm">
                        <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search Helm releases..." />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant="outline" onClick={() => setShowAgent(true)}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Kube Agent
                        </Button>
                        <Button variant="primary" onClick={() => setShowInstall(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Install Helm Release
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Namespace</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Chart</TableHead>
                                    <TableHead>Revision</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center text-zinc-500 dark:text-zinc-400">No Helm releases found.</TableCell>
                                    </TableRow>
                                ) : filtered.map((item) => (
                                    <TableRow key={`${item.namespace}/${item.name}`}>
                                        <TableCell className="font-semibold">{item.name}</TableCell>
                                        <TableCell>{item.namespace}</TableCell>
                                        <TableCell>{item.status}</TableCell>
                                        <TableCell>{item.chart}</TableCell>
                                        <TableCell>{item.revision}</TableCell>
                                        <TableCell>{item.updated}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => uninstallRelease.mutate(
                                                    { namespace: item.namespace, name: item.name },
                                                    {
                                                        onSuccess: () => {
                                                            showNotification({ type: "success", message: "Helm release removed", description: item.name });
                                                            refetch();
                                                        },
                                                        onError: (error: any) => showNotification({ type: "error", message: "Release remove failed", description: error?.message || "helm uninstall failed" }),
                                                    },
                                                )}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {showInstall && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Install Helm Release</h3>
                                <p className="text-sm text-zinc-500">Install or upgrade a chart into namespace {namespace}.</p>
                            </div>
                            <Button variant="outline" onClick={() => setShowInstall(false)}>Close</Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input value={releaseName} onChange={(event) => setReleaseName(event.target.value)} placeholder="Release name" />
                            <Input value={chartRef} onChange={(event) => setChartRef(event.target.value)} placeholder="oci://repo/chart or bitnami/nginx" />
                        </div>
                        <textarea value={valuesYaml} onChange={(event) => setValuesYaml(event.target.value)} spellCheck={false} className="mt-4 min-h-[260px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="replicaCount: 2" />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowInstall(false)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={() => installRelease.mutate(
                                    { namespace, name: releaseName, chart: chartRef, valuesYaml },
                                    {
                                        onSuccess: () => {
                                            showNotification({ type: "success", message: "Helm release installed", description: releaseName });
                                            setShowInstall(false);
                                            refetch();
                                        },
                                        onError: (error: any) => showNotification({ type: "error", message: "Helm install failed", description: error?.message || "helm upgrade --install failed" }),
                                    },
                                )}
                                disabled={installRelease.isPending || !releaseName.trim() || !chartRef.trim()}
                            >
                                {installRelease.isPending ? "Installing..." : "Install Release"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                                <Box className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Kube-Agent Bootstrap</h3>
                                <p className="text-sm text-zinc-500">Generate a bootstrap manifest for remote cluster onboarding.</p>
                            </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input value={agentToken} onChange={(event) => setAgentToken(event.target.value)} placeholder="Agent token" />
                            <Input value={agentImage} onChange={(event) => setAgentImage(event.target.value)} placeholder="ghcr.io/einfra/kube-agent:latest" />
                        </div>
                        <textarea readOnly value={bootstrapQuery.data?.manifest || ""} className="mt-4 min-h-[280px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="Enter an agent token to generate bootstrap YAML..." />
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowAgent(false)}>Close</Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const blob = new Blob([bootstrapQuery.data?.manifest || ""], { type: "text/yaml" });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `kube-agent-${selectedClusterId || "cluster"}.yaml`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}
                                disabled={!bootstrapQuery.data?.manifest}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download YAML
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => applyManifest.mutate(
                                    { manifest: bootstrapQuery.data?.manifest || "" },
                                    {
                                        onSuccess: () => showNotification({ type: "success", message: "Bootstrap manifest applied", description: "Kube-agent resources have been created." }),
                                        onError: (error: any) => showNotification({ type: "error", message: "Bootstrap apply failed", description: error?.message || "kubectl apply failed" }),
                                    },
                                )}
                                disabled={!bootstrapQuery.data?.manifest || applyManifest.isPending}
                            >
                                {applyManifest.isPending ? "Applying..." : "Apply To Cluster"}
                            </Button>
                            <Button variant="primary" onClick={() => navigator.clipboard.writeText(bootstrapQuery.data?.manifest || "")} disabled={!bootstrapQuery.data?.manifest}>
                                Copy Manifest
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </K8sExplorerLayout>
    );
}
