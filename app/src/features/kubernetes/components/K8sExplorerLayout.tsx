"use client";

import { ChevronRight } from "lucide-react";

interface ExplorerLayoutProps {
    children: React.ReactNode;
    clusters: Array<{ id: string; name: string }>;
    namespaces: string[];
    selectedCluster: string;
    selectedNamespace: string;
    onClusterChange: (id: string) => void;
    onNamespaceChange: (ns: string) => void;
    activeResource: string;
    onResourceChange: (_type: string) => void;
    headerMode?: "default" | "hidden";
}

function formatResourceLabel(value: string) {
    return value
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function K8sExplorerLayout({
    children,
    clusters,
    namespaces,
    selectedCluster,
    selectedNamespace,
    onClusterChange,
    onNamespaceChange,
    activeResource,
    headerMode = "default",
}: ExplorerLayoutProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {headerMode !== "hidden" ? (
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                                <span>Kubernetes Explorer</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                                <span className="text-zinc-900 dark:text-zinc-50">{formatResourceLabel(activeResource)}</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {formatResourceLabel(activeResource)}
                                </h1>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[460px]">
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Cluster</span>
                                <select
                                    value={selectedCluster}
                                    onChange={(event) => onClusterChange(event.target.value)}
                                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                                >
                                    {clusters.map((cluster) => (
                                        <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Namespace</span>
                                <select
                                    value={selectedNamespace}
                                    onChange={(event) => onNamespaceChange(event.target.value)}
                                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                                >
                                    {namespaces.map((namespace) => (
                                        <option key={namespace} value={namespace}>{namespace}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                </div>
            ) : null}

            {children}
        </div>
    );
}
