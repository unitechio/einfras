import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ArrowRight, Save, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import { useClusters, useKubernetesSearch, useNamespaces } from "../api/useKubernetesHooks";

export default function SearchPage() {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [savedPresets, setSavedPresets] = useState<Array<{ name: string; query: string; namespace: string; kind: string; status: string }>>([]);

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
    const namespaces = useMemo(() => ["all", ...namespacesData.map((item) => item.name)], [namespacesData]);

    const search = useKubernetesSearch(selectedClusterId, namespace, searchQuery);
    const filteredResults = useMemo(() => {
        const items = search.data || [];
        return items.filter((item) => {
            const matchesKind = kindFilter === "all" || item.kind.toLowerCase() === kindFilter.toLowerCase();
            const matchesStatus = statusFilter === "all" || String(item.status || "").toLowerCase().includes(statusFilter.toLowerCase());
            return matchesKind && matchesStatus;
        });
    }, [kindFilter, search.data, statusFilter]);

    const kindOptions = useMemo(() => ["all", ...Array.from(new Set((search.data || []).map((item) => item.kind.toLowerCase())))], [search.data]);
    const statusOptions = useMemo(() => ["all", ...Array.from(new Set((search.data || []).map((item) => String(item.status || "").toLowerCase()).filter(Boolean)))], [search.data]);

    useEffect(() => {
        const raw = window.localStorage.getItem("k8s-search-presets");
        if (!raw) {
            return;
        }
        try {
            setSavedPresets(JSON.parse(raw));
        } catch {
            setSavedPresets([]);
        }
    }, []);

    const savePreset = () => {
        const name = window.prompt("Preset name", searchQuery.trim() || "Search preset");
        if (!name) {
            return;
        }
        const next = [
            { name: name.trim(), query: searchQuery, namespace, kind: kindFilter, status: statusFilter },
            ...savedPresets.filter((preset) => preset.name !== name.trim()),
        ].slice(0, 10);
        setSavedPresets(next);
        window.localStorage.setItem("k8s-search-presets", JSON.stringify(next));
    };

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["all"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource="search"
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="grid w-full gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_180px]">
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search pods, workloads, services, RBAC, storage, CRDs..."
                            />
                            <select
                                value={kindFilter}
                                onChange={(event) => setKindFilter(event.target.value)}
                                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                            >
                                {kindOptions.map((item) => (
                                    <option key={item} value={item}>{item === "all" ? "All Kinds" : item}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                            >
                                {statusOptions.map((item) => (
                                    <option key={item} value={item}>{item === "all" ? "All Statuses" : item}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => search.refetch()}>
                                <RefreshCw className={cn("mr-2 h-4 w-4", search.isFetching && "animate-spin")} />
                                Refresh
                            </Button>
                            <Button variant="outline" onClick={savePreset}>
                                <Save className="mr-2 h-4 w-4" />
                                Save Preset
                            </Button>
                        </div>
                    </div>
                    <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                        Search runs across core Kubernetes resources in the selected cluster{namespace !== "all" ? ` and namespace ${namespace}` : ""}.
                    </div>
                    {savedPresets.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {savedPresets.map((preset) => (
                                <Button
                                    key={preset.name}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchQuery(preset.query);
                                        setKindFilter(preset.kind);
                                        setStatusFilter(preset.status);
                                        setNamespace(preset.namespace);
                                    }}
                                >
                                    <Star className="mr-2 h-4 w-4" />
                                    {preset.name}
                                </Button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            <Search className="h-5 w-5 text-blue-500" />
                            Search Results
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kind</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Namespace</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Detail</TableHead>
                                    <TableHead>Age</TableHead>
                                    <TableHead className="text-right">Open</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {searchQuery.trim().length < 2 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center text-zinc-500 dark:text-zinc-400">
                                            Type at least 2 characters to start searching.
                                        </TableCell>
                                    </TableRow>
                                ) : filteredResults.length ? (
                                    filteredResults.map((item) => (
                                        <TableRow key={`${item.kind}:${item.namespace || "_cluster"}:${item.name}`}>
                                            <TableCell>
                                                <Badge variant="outline">{item.kind}</Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold">{item.name}</TableCell>
                                            <TableCell>{item.namespace || "-"}</TableCell>
                                            <TableCell>{item.status || "-"}</TableCell>
                                            <TableCell>{item.detail || item.secondary_detail || "-"}</TableCell>
                                            <TableCell>{item.age || "-"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        navigate(
                                                            item.kind === "customresourcedefinition"
                                                                ? "/crds"
                                                                : `/${routeForKind(item.kind)}`,
                                                        )
                                                    }
                                                >
                                                    <ArrowRight className="mr-2 h-4 w-4" />
                                                    Open
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-40 text-center text-zinc-500 dark:text-zinc-400">
                                            No resources matched this query.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </K8sExplorerLayout>
    );
}

function routeForKind(kind: string): string {
    const normalized = kind.toLowerCase();
    const map: Record<string, string> = {
        pod: "pods",
        deployment: "deployments",
        statefulset: "statefulsets",
        daemonset: "daemonsets",
        replicaset: "replicasets",
        service: "services",
        ingress: "ingresses",
        configmap: "configmaps",
        secret: "secrets",
        namespace: "namespaces",
        node: "nodes",
        persistentvolume: "persistent-volumes",
        persistentvolumeclaim: "persistent-volumes",
        job: "jobs",
        cronjob: "jobs",
        role: "roles-k8s",
        rolebinding: "rolebindings",
        clusterrole: "clusterroles",
        clusterrolebinding: "clusterrolebindings",
        serviceaccount: "serviceaccounts",
        horizontalpodautoscaler: "hpa",
        verticalpodautoscaler: "vpa",
        customresourcedefinition: "crds",
        storageclass: "storageclasses",
    };
    return map[normalized] || `${normalized}s`;
}
