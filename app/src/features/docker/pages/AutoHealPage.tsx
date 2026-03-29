import { useEffect, useState } from "react";
import { HeartPulse, Play, Plus, Server, Trash2, Pencil } from "lucide-react";

import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { useDeleteDockerAutoHealPolicy, useDockerAutoHealPolicies, useRunDockerAutoHeal, useSaveDockerAutoHealPolicy } from "../api/useDockerHooks";

export default function AutoHealPage() {
    const { data: inventory = [], isLoading: isLoadingServers } = useEnvironmentInventory();
    const { selectedEnvironment } = useEnvironment();
    const { showNotification } = useNotification();
    const servers = inventory.filter((env) => env.type === "docker");
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const [form, setForm] = useState({
        name: "",
        target_mode: "all",
        match_value: "",
        trigger: "unhealthy",
        interval_minutes: 5,
        enabled: true,
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (selectedEnvironment?.type === "docker" && selectedEnvironment.id !== selectedServerId) {
            setSelectedServerId(selectedEnvironment.id);
            return;
        }
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [selectedEnvironment, selectedServerId, servers]);

    const policiesQuery = useDockerAutoHealPolicies(selectedServerId);
    const savePolicy = useSaveDockerAutoHealPolicy(selectedServerId);
    const deletePolicy = useDeleteDockerAutoHealPolicy(selectedServerId);
    const runAutoHeal = useRunDockerAutoHeal(selectedServerId);

    const handleCreate = () => {
        savePolicy.mutate({
            ...form,
            id: editingId || undefined,
            action: "restart",
        }, {
            onSuccess: () => {
                showNotification({
                    type: "success",
                    message: editingId ? "Auto-heal policy updated" : "Auto-heal policy saved",
                    description: `${form.name} is now watching Docker runtime health.`,
                });
                setForm({
                    name: "",
                    target_mode: "all",
                    match_value: "",
                    trigger: "unhealthy",
                    interval_minutes: 5,
                    enabled: true,
                });
                setEditingId(null);
            },
            onError: (error: any) => {
                showNotification({
                    type: "error",
                    message: editingId ? "Unable to update policy" : "Unable to save policy",
                    description: error?.message || "Request failed.",
                });
            },
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <HeartPulse className="h-6 w-6 text-rose-500" />
                        Auto-Heal
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Configure runtime policies that restart containers automatically when they become unhealthy or exit unexpectedly.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <select
                            value={selectedServerId}
                            onChange={(event) => setSelectedServerId(event.target.value)}
                            disabled={isLoadingServers}
                            className="h-9 min-w-[220px] appearance-none rounded-md border border-zinc-200 bg-white pl-9 pr-8 text-[13px] font-medium text-zinc-900 shadow-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                        >
                            <option value="" disabled>Select Environment...</option>
                            {servers.map((server) => (
                                <option key={server.id} value={server.id}>{server.name} ({server.url})</option>
                            ))}
                        </select>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => runAutoHeal.mutate(undefined, {
                            onSuccess: () => showNotification({ type: "success", message: "Auto-heal executed", description: "All policies were evaluated against current Docker state." }),
                            onError: (error: any) => showNotification({ type: "error", message: "Auto-heal run failed", description: error?.message || "Request failed." }),
                        })}
                        className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-rose-600 dark:hover:bg-rose-500"
                    >
                        <Play className="mr-2 h-4 w-4" />
                        Run All Now
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="mb-4 flex items-center gap-2">
                        {editingId ? <Pencil className="h-5 w-5 text-rose-500" /> : <Plus className="h-5 w-5 text-rose-500" />}
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{editingId ? "Edit Policy" : "New Policy"}</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Policy name</label>
                            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Restart critical API containers" />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Target mode</label>
                            <select value={form.target_mode} onChange={(event) => setForm((current) => ({ ...current, target_mode: event.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <option value="all">All containers</option>
                                <option value="name">Container name contains</option>
                                <option value="label">Label equals</option>
                            </select>
                        </div>
                        {form.target_mode !== "all" ? (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Match value</label>
                                <Input value={form.match_value} onChange={(event) => setForm((current) => ({ ...current, match_value: event.target.value }))} placeholder={form.target_mode === "label" ? "app=api" : "api"} />
                            </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Trigger</label>
                                <select value={form.trigger} onChange={(event) => setForm((current) => ({ ...current, trigger: event.target.value }))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]">
                                    <option value="unhealthy">Unhealthy</option>
                                    <option value="exited">Exited</option>
                                    <option value="stopped">Stopped</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">Every N minutes</label>
                                <Input type="number" min={1} value={String(form.interval_minutes)} onChange={(event) => setForm((current) => ({ ...current, interval_minutes: Number(event.target.value || 1) }))} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {editingId ? (
                                <Button variant="outline" className="w-full" onClick={() => {
                                    setEditingId(null);
                                    setForm({ name: "", target_mode: "all", match_value: "", trigger: "unhealthy", interval_minutes: 5, enabled: true });
                                }}>
                                    Cancel
                                </Button>
                            ) : null}
                            <Button variant="primary" className="w-full" onClick={handleCreate} disabled={!selectedServerId || !form.name.trim() || savePolicy.isPending}>
                                {savePolicy.isPending ? "Saving..." : editingId ? "Update Policy" : "Create Policy"}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Configured Policies</h2>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Trigger</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Interval</TableHead>
                                <TableHead>Last Outcome</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(policiesQuery.data ?? []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-40 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                        No auto-heal policies configured for this environment.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (policiesQuery.data ?? []).map((policy) => (
                                    <TableRow key={policy.id}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-medium text-zinc-900 dark:text-zinc-100">{policy.name}</span>
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{policy.action}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="warning">{policy.trigger}</Badge></TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                            {policy.target_mode === "all" ? "All containers" : `${policy.target_mode}: ${policy.match_value || "-"}`}
                                        </TableCell>
                                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">{policy.interval_minutes} min</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${
                                                        policy.last_outcome === "restarted" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                                                        policy.last_outcome?.includes("failed") ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : 
                                                        "bg-zinc-400"
                                                    }`} />
                                                    <span className={`text-[13px] font-medium ${
                                                        policy.last_outcome === "restarted" ? "text-emerald-600 dark:text-emerald-400" :
                                                        policy.last_outcome?.includes("failed") ? "text-rose-600 dark:text-rose-400" :
                                                        "text-zinc-500 dark:text-zinc-500"
                                                    }`}>
                                                        {policy.last_outcome === "restarted" ? "Success" : 
                                                         policy.last_outcome?.includes("failed") ? "Failed" : 
                                                         policy.last_outcome === "no_match" ? "No action" :
                                                         policy.last_outcome || "Pending"}
                                                    </span>
                                                </div>
                                                {policy.last_run_at ? (
                                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-3">
                                                        {new Date(policy.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end opacity-100 gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Run policy now"
                                                    disabled={runAutoHeal.isPending}
                                                    onClick={() => runAutoHeal.mutate(policy.id, {
                                                        onSuccess: () => showNotification({ type: "success", message: "Policy check triggered", description: `Auto-heal check started for ${policy.name}.` }),
                                                        onError: (error: any) => showNotification({ type: "error", message: "Trigger failed", description: error?.message || "Request failed." }),
                                                    })}
                                                    className="text-zinc-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
                                                >
                                                    <Play size={14} className={runAutoHeal.isPending ? "animate-pulse" : ""} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        setEditingId(policy.id);
                                                        setForm({
                                                            name: policy.name,
                                                            target_mode: policy.target_mode,
                                                            match_value: policy.match_value || "",
                                                            trigger: policy.trigger,
                                                            interval_minutes: policy.interval_minutes,
                                                            enabled: policy.enabled !== false,
                                                        });
                                                    }}
                                                    className="text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => deletePolicy.mutate(policy.id, {
                                                        onSuccess: () => {
                                                            showNotification({ type: "success", message: "Policy deleted", description: `${policy.name} has been removed.` });
                                                            if (editingId === policy.id) {
                                                                setEditingId(null);
                                                                setForm({ name: "", target_mode: "all", match_value: "", trigger: "unhealthy", interval_minutes: 5, enabled: true });
                                                            }
                                                        },
                                                        onError: (error: any) => showNotification({ type: "error", message: "Delete failed", description: error?.message || "Request failed." }),
                                                    })}
                                                    className="text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                                >
                                                    <Trash2 size={14} />
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
