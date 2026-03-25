import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
    Download,
    History,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Settings2,
    Trash2,
    X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { apiFetch } from "@/core/api-client";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { K8sExplorerLayout } from "../components/K8sExplorerLayout";
import {
    useApplyManifest,
    useClusters,
    useGenericKubernetesResources,
    useLiveGenericKubernetesResources,
    useKubernetesResourceHistory,
    useNamespaces,
    useRollbackKubernetesResource,
} from "../api/useKubernetesHooks";
import type { K8sGenericResource, K8sManifestHistoryEntry } from "../types";
import { openCreateResourcePage } from "../createResourceConfig";

type GenericK8sResourcePageProps = {
    activeResource: string;
    title: string;
    icon: ReactNode;
    kind: string;
    namespaced?: boolean;
    searchPlaceholder: string;
    addLabel: string;
    emptyLabel: string;
    starterManifest: (namespace: string) => string;
};

type ColumnKey = "name" | "namespace" | "status" | "detail" | "secondary_detail" | "age";
type EditorRow = { key: string; value: string };

const DEFAULT_COLUMNS: ColumnKey[] = ["name", "namespace", "status", "detail", "secondary_detail", "age"];
const COLUMN_LABELS: Record<ColumnKey, string> = {
    name: "Name",
    namespace: "Namespace",
    status: "Status",
    detail: "Detail",
    secondary_detail: "More",
    age: "Age",
};

export function GenericK8sResourcePage({
    activeResource,
    title,
    icon,
    kind,
    namespaced = true,
    searchPlaceholder,
    addLabel,
    emptyLabel,
    starterManifest,
}: GenericK8sResourcePageProps) {
    const { data: clusterData } = useClusters();
    const { selectedEnvironment } = useEnvironment();
    const navigate = useNavigate();
    const clusters = clusterData?.data || [];
    const [selectedClusterId, setSelectedClusterId] = useState("");
    const [namespace, setNamespace] = useState("default");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedResource, setSelectedResource] = useState<K8sGenericResource | null>(null);
    const [selectedYaml, setSelectedYaml] = useState("");
    const [isYamlLoading, setIsYamlLoading] = useState(false);
    const [selectedRevisionId, setSelectedRevisionId] = useState("");
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [columnPickerOpen, setColumnPickerOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => loadColumns(kind, namespaced));
    const [formRows, setFormRows] = useState<EditorRow[]>([]);
    const [watchEnabled, setWatchEnabled] = useState(true);
    const [deleteCandidate, setDeleteCandidate] = useState<K8sGenericResource | null>(null);
    const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState<K8sGenericResource[]>([]);
    const [rollbackCandidate, setRollbackCandidate] = useState<K8sManifestHistoryEntry | null>(null);
    const { showNotification } = useNotification();
    const applyManifest = useApplyManifest(selectedClusterId);
    const rollbackResource = useRollbackKubernetesResource(selectedClusterId);
    const storageKey = `k8s-generic-columns:${kind}:${namespaced ? "ns" : "cluster"}`;
    const keyValueEditorEnabled = useMemo(
        () => ["configmaps", "configmap", "secrets", "secret"].includes(kind.toLowerCase()),
        [kind],
    );
    const customResourceDescriptor = useMemo(
        () => (kind.toLowerCase() === "customresourcedefinitions" ? extractCRDDescriptor(selectedYaml) : null),
        [kind, selectedYaml],
    );

    useEffect(() => {
        setVisibleColumns(loadColumns(kind, namespaced));
        setSelectedKeys([]);
    }, [kind, namespaced]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
        }
    }, [storageKey, visibleColumns]);

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
        if (!namespaced) {
            return;
        }
        if (namespaces.length && !namespaces.includes(namespace)) {
            setNamespace(namespaces[0]);
        }
    }, [namespace, namespaces, namespaced]);

    const { data: resources = [], isLoading, refetch } = useGenericKubernetesResources(
        selectedClusterId,
        kind,
        namespace,
        namespaced,
        { watch: watchEnabled },
    );
    const liveResources = useLiveGenericKubernetesResources(selectedClusterId, kind, namespace, namespaced, watchEnabled);
    const { data: history = [] } = useKubernetesResourceHistory(
        selectedClusterId,
        kind,
        selectedResource?.namespace || namespace,
        selectedResource?.name || "",
        namespaced,
    );
    const resourceItems = liveResources.data ?? resources;

    const statusOptions = useMemo(() => {
        const values = new Set<string>();
        resourceItems.forEach((item) => {
            if (item.status?.trim()) {
                values.add(item.status.trim());
            }
        });
        return ["all", ...Array.from(values)];
    }, [resourceItems]);

    const filteredResources = useMemo(
        () =>
            resourceItems.filter((item) => {
                const matchesSearch = [item.name, item.namespace, item.status, item.detail, item.secondary_detail]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(searchQuery.toLowerCase()));
                const matchesStatus =
                    statusFilter === "all" ||
                    String(item.status || "")
                        .toLowerCase()
                        .includes(statusFilter.toLowerCase());
                return matchesSearch && matchesStatus;
            }),
        [resourceItems, searchQuery, statusFilter],
    );

    const allVisibleSelected = filteredResources.length > 0 && filteredResources.every((item) => selectedKeys.includes(resourceKey(item)));

    const openDetail = async (item: K8sGenericResource) => {
        setSelectedResource(item);
        setSelectedYaml("");
        setFormRows([]);
        setIsYamlLoading(true);
        setSelectedRevisionId("");
        try {
            const query = item.namespace ? `?namespace=${encodeURIComponent(item.namespace)}` : namespaced ? "" : "?namespaced=false";
            const payload = await apiFetch<{ yaml: string }>(
                `/v1/environments/${selectedClusterId}/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(item.name)}/yaml${query}`,
            );
            setSelectedYaml(payload.yaml || "");
            if (keyValueEditorEnabled) {
                setFormRows(extractEditorRows(payload.yaml || "", kind));
            }
        } catch (error) {
            setSelectedYaml(`# Unable to load YAML\n# ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsYamlLoading(false);
        }
    };

    const saveYaml = async () => {
        if (!selectedYaml.trim()) {
            return;
        }
        try {
            await applyManifest.mutateAsync({ namespace: selectedResource?.namespace || namespace, manifest: selectedYaml });
            showNotification({ type: "success", message: `${title} updated`, description: "Manifest applied successfully." });
            void refetch();
        } catch (error) {
            showNotification({ type: "error", message: "Update failed", description: error instanceof Error ? error.message : "Unable to apply YAML." });
        }
    };

    const rollbackSelected = async (revision: K8sManifestHistoryEntry) => {
        try {
            await rollbackResource.mutateAsync({
                kind,
                namespace: revision.namespace || namespace,
                name: revision.name,
                revisionId: revision.id,
                namespaced,
            });
            setSelectedRevisionId(revision.id);
            showNotification({ type: "success", message: "Rollback completed", description: `${revision.name} restored from history.` });
            void openDetail(selectedResource as K8sGenericResource);
            void refetch();
        } catch (error) {
            showNotification({ type: "error", message: "Rollback failed", description: error instanceof Error ? error.message : "Unable to rollback resource." });
        }
    };

    const deleteResource = async (resource: K8sGenericResource) => {
        try {
            const query = resource.namespace ? `?namespace=${encodeURIComponent(resource.namespace)}` : namespaced ? "" : "?namespaced=false";
            await apiFetch(`/v1/environments/${selectedClusterId}/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(resource.name)}${query}`, { method: "DELETE" });
            showNotification({ type: "success", message: `${title} deleted`, description: resource.name });
            if (selectedResource && resourceKey(selectedResource) === resourceKey(resource)) {
                setSelectedResource(null);
                setSelectedYaml("");
                setFormRows([]);
            }
            void refetch();
        } catch (error) {
            showNotification({ type: "error", message: "Delete failed", description: error instanceof Error ? error.message : "Unable to delete resource." });
        }
    };

    const deleteSelected = async () => {
        const targets = filteredResources.filter((item) => selectedKeys.includes(resourceKey(item)));
        if (targets.length === 0) {
            return;
        }
        try {
            for (const item of targets) {
                const query = item.namespace ? `?namespace=${encodeURIComponent(item.namespace)}` : namespaced ? "" : "?namespaced=false";
                await apiFetch(`/v1/environments/${selectedClusterId}/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(item.name)}${query}`, {
                    method: "DELETE",
                });
            }
            showNotification({
                type: "success",
                message: "Bulk delete completed",
                description: `${targets.length} ${title.toLowerCase()} removed.`,
            });
            setSelectedKeys([]);
            if (selectedResource && selectedKeys.includes(resourceKey(selectedResource))) {
                setSelectedResource(null);
                setSelectedYaml("");
                setFormRows([]);
            }
            void refetch();
        } catch (error) {
            showNotification({
                type: "error",
                message: "Bulk delete failed",
                description: error instanceof Error ? error.message : "Unable to delete selected resources.",
            });
        }
    };

    const toggleAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedKeys((prev) => prev.filter((key) => !filteredResources.some((item) => resourceKey(item) === key)));
            return;
        }
        setSelectedKeys((prev) => Array.from(new Set([...prev, ...filteredResources.map((item) => resourceKey(item))])));
    };

    const toggleRow = (item: K8sGenericResource) => {
        const key = resourceKey(item);
        setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
    };

    const syncFormToYaml = () => {
        const nextYaml = updateEditorSection(selectedYaml, kind, formRows);
        setSelectedYaml(nextYaml);
    };

    return (
        <K8sExplorerLayout
            clusters={clusters}
            namespaces={namespaces.length ? namespaces : ["default"]}
            selectedCluster={selectedClusterId}
            selectedNamespace={namespace}
            onClusterChange={setSelectedClusterId}
            onNamespaceChange={setNamespace}
            activeResource={activeResource}
            onResourceChange={(type) => navigate(`/${type}`)}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 flex-col gap-3 md:flex-row">
                        <div className="w-full md:max-w-xs">
                            <Input type="text" placeholder={searchPlaceholder} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        >
                            {statusOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option === "all" ? "All statuses" : option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <Button variant="outline" onClick={() => setColumnPickerOpen((prev) => !prev)}>
                                <Settings2 className="mr-2 h-4 w-4" />
                                Columns
                            </Button>
                            {columnPickerOpen ? (
                                <div className="absolute right-0 z-20 mt-2 min-w-[200px] rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Visible Columns</div>
                                    <div className="space-y-2">
                                        {DEFAULT_COLUMNS.filter((column) => namespaced || column !== "namespace").map((column) => (
                                            <label key={column} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns.includes(column)}
                                                    onChange={() =>
                                                        setVisibleColumns((prev) => {
                                                            if (prev.includes(column)) {
                                                                const next = prev.filter((entry) => entry !== column);
                                                                return next.length > 0 ? next : prev;
                                                            }
                                                            return [...prev, column];
                                                        })
                                                    }
                                                />
                                                {COLUMN_LABELS[column]}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                        <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant={watchEnabled ? "primary" : "outline"} onClick={() => setWatchEnabled((current) => !current)}>
                            {watchEnabled ? (liveResources.isConnected ? "Live" : "Watching") : "Watch"}
                        </Button>
                        {selectedKeys.length > 0 ? (
                            <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-500/10"
                                onClick={() => setBulkDeleteCandidate(filteredResources.filter((item) => selectedKeys.includes(resourceKey(item))))}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedKeys.length})
                            </Button>
                        ) : null}
                        <Button
                            variant="primary"
                            onClick={() =>
                                openCreateResourcePage(navigate, {
                                    resourceType: kind.toLowerCase(),
                                    clusterId: selectedClusterId,
                                    namespace: namespaced ? namespace : undefined,
                                    title: addLabel,
                                    activeResource,
                                    kind,
                                    addLabel,
                                    namespaced,
                                    starterManifest: starterManifest(namespace),
                                })
                            }
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {addLabel}
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                        <div>
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                                {icon}
                                {title}
                            </h2>
                        </div>
                        <Badge variant="outline">{filteredResources.length} visible</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                                    </TableHead>
                                    {visibleColumns.includes("name") ? <TableHead>Name</TableHead> : null}
                                    {namespaced && visibleColumns.includes("namespace") ? <TableHead>Namespace</TableHead> : null}
                                    {visibleColumns.includes("status") ? <TableHead>Status</TableHead> : null}
                                    {visibleColumns.includes("detail") ? <TableHead>Detail</TableHead> : null}
                                    {visibleColumns.includes("secondary_detail") ? <TableHead>More</TableHead> : null}
                                    {visibleColumns.includes("age") ? <TableHead>Age</TableHead> : null}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResources.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={visibleColumnCount(visibleColumns, namespaced) + 1} className="h-40 text-center text-zinc-500 dark:text-zinc-400">
                                            {emptyLabel}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredResources.map((item) => (
                                        <TableRow key={resourceKey(item)} className="cursor-pointer" onClick={() => void openDetail(item)}>
                                            <TableCell onClick={(event) => event.stopPropagation()}>
                                                <input type="checkbox" checked={selectedKeys.includes(resourceKey(item))} onChange={() => toggleRow(item)} />
                                            </TableCell>
                                            {visibleColumns.includes("name") ? <TableCell className="font-semibold">{item.name}</TableCell> : null}
                                            {namespaced && visibleColumns.includes("namespace") ? <TableCell>{item.namespace}</TableCell> : null}
                                            {visibleColumns.includes("status") ? (
                                                <TableCell>
                                                    <Badge variant={statusVariant(item.status)}>{item.status || "-"}</Badge>
                                                </TableCell>
                                            ) : null}
                                            {visibleColumns.includes("detail") ? <TableCell>{item.detail || "-"}</TableCell> : null}
                                            {visibleColumns.includes("secondary_detail") ? <TableCell>{item.secondary_detail || "-"}</TableCell> : null}
                                            {visibleColumns.includes("age") ? <TableCell>{item.age}</TableCell> : null}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {selectedResource ? (
                <div className="fixed inset-4 left-auto z-[90] w-[min(860px,calc(100vw-2rem))] rounded-[28px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0a0a0a]">
                    <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                        <div>
                            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{selectedResource.name}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                                <Badge variant="outline">{selectedResource.kind}</Badge>
                                {selectedResource.namespace ? <span>{selectedResource.namespace}</span> : null}
                                <span>{selectedResource.status || "Unknown"}</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedResource(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid h-[calc(100vh-2rem-82px)] grid-rows-[auto,1fr,auto] gap-4 p-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Primary Detail</div>
                                <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedResource.detail || "-"}</div>
                            </div>
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Secondary Detail</div>
                                <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedResource.secondary_detail || "-"}</div>
                            </div>
                        </div>
                        <div className="grid min-h-0 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                            <div className="flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">YAML Editor</div>
                                        <div className="text-xs text-zinc-500">Edit directly, then save or roll back from history if needed.</div>
                                    </div>
                                    {isYamlLoading ? <div className="text-xs text-zinc-500">Loading YAML...</div> : null}
                                </div>
                                {keyValueEditorEnabled ? (
                                    <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121212]">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                    {kind.toLowerCase().startsWith("secret") ? "Decoded Secret Data" : "Config Data"}
                                                </div>
                                                <div className="text-xs text-zinc-500">Use the compact helper for quick key-value edits, then sync back into YAML.</div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={syncFormToYaml}>
                                                <Save className="mr-2 h-4 w-4" />
                                                Sync To YAML
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {formRows.map((row, index) => (
                                                <div key={`${row.key}-${index}`} className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
                                                    <Input
                                                        value={row.key}
                                                        onChange={(event) =>
                                                            setFormRows((prev) =>
                                                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)),
                                                            )
                                                        }
                                                        placeholder="key"
                                                    />
                                                    <Input
                                                        value={row.value}
                                                        onChange={(event) =>
                                                            setFormRows((prev) =>
                                                                prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)),
                                                            )
                                                        }
                                                        placeholder="value"
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setFormRows((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => setFormRows((prev) => [...prev, { key: "", value: "" }])}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Row
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                                <textarea
                                    value={selectedYaml}
                                    onChange={(event) => setSelectedYaml(event.target.value)}
                                    spellCheck={false}
                                    className="min-h-[320px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-6 dark:border-zinc-800 dark:bg-[#121212]"
                                />
                            </div>
                            <div className="flex min-h-0 flex-col gap-4">
                                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-50">
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Resource Usage Notes</div>
                                    <div className="mt-3 space-y-2">
                                        <p>Keep metadata names, selectors, labels, and namespace aligned before saving.</p>
                                        <p>For risky changes, export the YAML first, then apply the update from this drawer.</p>
                                        <p>Use rollback when a revision timestamp clearly matches the last known-good state.</p>
                                    </div>
                                </div>
                                <div className="min-h-0 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        <History className="h-4 w-4" />
                                        Revision History
                                    </div>
                                    <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                                        {history.length === 0 ? (
                                            <div className="text-sm text-zinc-500">No saved revisions yet.</div>
                                        ) : (
                                            history.slice(0, 8).map((entry) => (
                                                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-[#121212]">
                                                    <div>
                                                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{entry.name}</div>
                                                        <div className="text-xs text-zinc-500">{new Date(entry.created_at).toLocaleString()}</div>
                                                    </div>
                                                    <Button
                                                        variant={selectedRevisionId === entry.id ? "primary" : "outline"}
                                                        size="sm"
                                                        onClick={() => setRollbackCandidate(entry)}
                                                        disabled={rollbackResource.isPending}
                                                    >
                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                        Rollback
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                            {customResourceDescriptor ? (
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        navigate(
                                            `/custom-resources?kind=${encodeURIComponent(customResourceDescriptor.plural)}&title=${encodeURIComponent(
                                                customResourceDescriptor.title,
                                            )}&namespaced=${customResourceDescriptor.namespaced ? "true" : "false"}&resourceKind=${encodeURIComponent(
                                                customResourceDescriptor.kind,
                                            )}&apiVersion=${encodeURIComponent(customResourceDescriptor.apiVersion)}`,
                                        )
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Browse Instances
                                </Button>
                            ) : null}
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const blob = new Blob([selectedYaml], { type: "text/yaml" });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `${selectedResource.name}.yaml`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download YAML
                            </Button>
                            <Button variant="primary" onClick={() => void saveYaml()} disabled={applyManifest.isPending || !selectedYaml.trim()}>
                                <Save className="mr-2 h-4 w-4" />
                                {applyManifest.isPending ? "Applying..." : "Save YAML"}
                            </Button>
                            <Button
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-500/10"
                                onClick={() => selectedResource && setDeleteCandidate(selectedResource)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
            <ConfirmActionDialog
                open={!!deleteCandidate}
                title={`Delete ${title.toLowerCase()}?`}
                description={
                    deleteCandidate
                        ? `This permanently deletes ${deleteCandidate.name}${deleteCandidate.namespace ? ` from ${deleteCandidate.namespace}` : ""}.`
                        : ""
                }
                confirmLabel="Delete Resource"
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    void deleteResource(deleteCandidate).finally(() => setDeleteCandidate(null));
                }}
                pending={false}
                tone="danger"
            />
            <ConfirmActionDialog
                open={bulkDeleteCandidate.length > 0}
                title={`Delete ${bulkDeleteCandidate.length} selected ${title.toLowerCase()}?`}
                description="This removes all selected resources. This action cannot be undone."
                confirmLabel="Delete Selected"
                onClose={() => setBulkDeleteCandidate([])}
                onConfirm={() => {
                    void deleteSelected().finally(() => setBulkDeleteCandidate([]));
                }}
                pending={false}
                tone="danger"
            >
                {bulkDeleteCandidate.length > 0 ? (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-red-200/70 bg-red-50/70 p-3 text-sm text-red-950 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
                        {bulkDeleteCandidate.map((item) => (
                            <div key={resourceKey(item)} className="truncate">
                                {item.name}
                                {item.namespace ? ` - ${item.namespace}` : ""}
                            </div>
                        ))}
                    </div>
                ) : null}
            </ConfirmActionDialog>
            <ConfirmActionDialog
                open={!!rollbackCandidate}
                title="Rollback resource revision?"
                description={
                    rollbackCandidate
                        ? `This restores ${rollbackCandidate.name} to the revision saved at ${new Date(rollbackCandidate.created_at).toLocaleString()}.`
                        : ""
                }
                confirmLabel={rollbackResource.isPending ? "Rolling back..." : "Rollback Revision"}
                onClose={() => setRollbackCandidate(null)}
                onConfirm={() => {
                    if (!rollbackCandidate) {
                        return;
                    }
                    void rollbackSelected(rollbackCandidate).finally(() => setRollbackCandidate(null));
                }}
                pending={rollbackResource.isPending}
                tone="warning"
            />
        </K8sExplorerLayout>
    );
}

function loadColumns(kind: string, namespaced: boolean): ColumnKey[] {
    if (typeof window === "undefined") {
        return namespaced ? DEFAULT_COLUMNS : DEFAULT_COLUMNS.filter((column) => column !== "namespace");
    }
    try {
        const raw = window.localStorage.getItem(`k8s-generic-columns:${kind}:${namespaced ? "ns" : "cluster"}`);
        if (!raw) {
            return namespaced ? DEFAULT_COLUMNS : DEFAULT_COLUMNS.filter((column) => column !== "namespace");
        }
        const parsed = JSON.parse(raw) as ColumnKey[];
        const filtered = parsed.filter((column) => DEFAULT_COLUMNS.includes(column) && (namespaced || column !== "namespace"));
        return filtered.length > 0 ? filtered : namespaced ? DEFAULT_COLUMNS : DEFAULT_COLUMNS.filter((column) => column !== "namespace");
    } catch {
        return namespaced ? DEFAULT_COLUMNS : DEFAULT_COLUMNS.filter((column) => column !== "namespace");
    }
}

function resourceKey(item: K8sGenericResource): string {
    return `${item.namespace || "_cluster"}:${item.name}`;
}

function visibleColumnCount(columns: ColumnKey[], namespaced: boolean): number {
    return columns.filter((column) => namespaced || column !== "namespace").length;
}

function statusVariant(status?: string): "success" | "warning" | "error" | "outline" {
    const value = String(status || "").toLowerCase();
    if (value.includes("ready") || value.includes("running") || value.includes("active") || value.includes("bound")) {
        return "success";
    }
    if (value.includes("fail") || value.includes("error") || value.includes("crash") || value.includes("notready")) {
        return "error";
    }
    if (value.includes("pending") || value.includes("progress") || value.includes("terminating")) {
        return "warning";
    }
    return "outline";
}

function extractEditorRows(yamlText: string, kind: string): EditorRow[] {
    const sectionName = kind.toLowerCase().startsWith("secret") ? "stringData" : "data";
    const primary = parseYamlSection(yamlText, sectionName, kind.toLowerCase().startsWith("secret"));
    if (primary.length > 0) {
        return primary;
    }
    if (kind.toLowerCase().startsWith("secret")) {
        return parseYamlSection(yamlText, "data", true);
    }
    return [];
}

function parseYamlSection(yamlText: string, sectionName: string, decodeBase64: boolean): EditorRow[] {
    const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
    const sectionPattern = new RegExp(`^(\\s*)${sectionName}:\\s*$`);
    let sectionIndex = -1;
    let sectionIndent = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const match = lines[index].match(sectionPattern);
        if (match) {
            sectionIndex = index;
            sectionIndent = match[1].length;
            break;
        }
    }
    if (sectionIndex === -1) {
        return [];
    }

    const items: EditorRow[] = [];
    for (let index = sectionIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) {
            continue;
        }
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (indent <= sectionIndent) {
            break;
        }
        if (indent !== sectionIndent + 2) {
            continue;
        }
        const separatorIndex = line.indexOf(":");
        if (separatorIndex <= sectionIndent + 1) {
            continue;
        }
        const key = line.slice(sectionIndent + 2, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        value = value.replace(/^['"]|['"]$/g, "");
        if (decodeBase64 && sectionName === "data") {
            try {
                value = atob(value);
            } catch {
                // keep original value if decode fails
            }
        }
        items.push({ key, value });
    }
    return items;
}

function updateEditorSection(yamlText: string, kind: string, rows: EditorRow[]): string {
    const normalizedRows = rows
        .map((row) => ({ key: row.key.trim(), value: row.value }))
        .filter((row) => row.key);
    const secret = kind.toLowerCase().startsWith("secret");
    const sectionName = secret ? "stringData" : "data";
    const filteredLines = removeYamlSection(removeYamlSection(yamlText, "stringData"), "data");
    const nextSection = [`${sectionName}:`].concat(
        normalizedRows.map((row) => `  ${row.key}: ${quoteYamlScalar(row.value)}`),
    );
    const base = filteredLines.trimEnd();
    return `${base}\n${nextSection.join("\n")}\n`;
}

function removeYamlSection(yamlText: string, sectionName: string): string {
    const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
    const sectionPattern = new RegExp(`^(\\s*)${sectionName}:\\s*$`);
    const next: string[] = [];
    let skipping = false;
    let sectionIndent = 0;

    for (const line of lines) {
        const match = line.match(sectionPattern);
        if (match) {
            skipping = true;
            sectionIndent = match[1].length;
            continue;
        }
        if (skipping) {
            const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
            if (line.trim() && indent <= sectionIndent) {
                skipping = false;
            } else {
                continue;
            }
        }
        next.push(line);
    }
    return next.join("\n").replace(/\n{3,}/g, "\n\n");
}

function quoteYamlScalar(value: string): string {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function extractCRDDescriptor(yamlText: string): { plural: string; kind: string; apiVersion: string; namespaced: boolean; title: string } | null {
    const group = matchYamlValue(yamlText, ["spec", "group"]);
    const plural = matchYamlValue(yamlText, ["spec", "names", "plural"]);
    const resourceKind = matchYamlValue(yamlText, ["spec", "names", "kind"]);
    const scope = matchYamlValue(yamlText, ["spec", "scope"]);
    const version = matchYamlValue(yamlText, ["spec", "versions", "0", "name"]) || matchYamlListFirstName(yamlText, "versions");
    if (!group || !plural || !resourceKind) {
        return null;
    }
    const apiVersion = version ? `${group}/${version}` : group;
    const namespaced = !/^cluster$/i.test(scope || "Namespaced");
    return {
        plural,
        kind: resourceKind,
        apiVersion,
        namespaced,
        title: `${resourceKind} Instances`,
    };
}

function matchYamlValue(yamlText: string, path: string[]): string {
    const normalized = yamlText.replace(/\r\n/g, "\n");
    if (path.join(".") === "spec.group") {
        return firstMatch(normalized, /^\s{2}group:\s*(.+)\s*$/m);
    }
    if (path.join(".") === "spec.scope") {
        return firstMatch(normalized, /^\s{2}scope:\s*(.+)\s*$/m);
    }
    if (path.join(".") === "spec.names.plural") {
        return firstMatch(normalized, /^\s{4}plural:\s*(.+)\s*$/m);
    }
    if (path.join(".") === "spec.names.kind") {
        return firstMatch(normalized, /^\s{4}kind:\s*(.+)\s*$/m);
    }
    if (path.join(".") === "spec.versions.0.name") {
        return firstMatch(normalized, /^\s{4}-\s*name:\s*(.+)\s*$/m);
    }
    return "";
}

function matchYamlListFirstName(yamlText: string, sectionName: string): string {
    const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
    const sectionIndex = lines.findIndex((line) => line.trim() === `${sectionName}:`);
    if (sectionIndex === -1) {
        return "";
    }
    for (let index = sectionIndex + 1; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (line.startsWith("- name:")) {
            return line.replace("- name:", "").trim();
        }
        if (line && !line.startsWith("-") && !line.startsWith("name:")) {
            break;
        }
    }
    return "";
}

function firstMatch(input: string, pattern: RegExp): string {
    const match = input.match(pattern);
    return match?.[1]?.replace(/^['"]|['"]$/g, "").trim() || "";
}
