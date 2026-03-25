import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Pause, Play, RefreshCw, Search, SearchCode, WrapText, X } from "lucide-react";

import { useContainerLogs, useLiveContainerLogs } from "../api/useDockerHooks";
import LogViewer from "./LogViewer";

interface ContainerLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    environmentId: string;
    containerId: string;
    containerName: string;
}

export default function ContainerLogsModal({
    isOpen,
    onClose,
    environmentId,
    containerId,
    containerName,
}: ContainerLogsModalProps) {
    const { data, isLoading, refetch, isFetching } = useContainerLogs(environmentId, containerId, 200);
    const [isPaused, setIsPaused] = useState(false);
    const [search, setSearch] = useState("");
    const { logs: liveLogs, status: liveStatus } = useLiveContainerLogs(environmentId, containerId, 200, isOpen && !isPaused);
    const [wrapLines, setWrapLines] = useState(false);
    const [viewerKey, setViewerKey] = useState(0);

    const effectiveLogs = useMemo(() => {
        if (liveLogs?.trim()) {
            return liveLogs;
        }
        return data?.logs || "";
    }, [data?.logs, liveLogs]);

    const filteredLogs = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) {
            return effectiveLogs;
        }
        return effectiveLogs
            .split("\n")
            .filter((line) => line.toLowerCase().includes(normalizedSearch))
            .join("\n");
    }, [effectiveLogs, search]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setIsPaused(false);
            setSearch("");
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex h-[78vh] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0d0d0d]">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <SearchCode size={16} className="text-blue-500" />
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={containerName}>{containerName}</div>
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={containerId}>{containerId}</div>
                </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative hidden sm:block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Filter logs..."
                                className="h-9 w-56 rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                            />
                        </div>
                        <button
                            onClick={() => setIsPaused((current) => !current)}
                            className={`rounded-md p-2 transition-colors ${isPaused ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}
                            title={isPaused ? "Resume live stream" : "Pause live stream"}
                        >
                            {isPaused ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                        <button
                            onClick={() => setWrapLines((current) => !current)}
                            className={`rounded-md p-2 transition-colors ${wrapLines ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}
                            title={wrapLines ? "Disable wrap" : "Enable wrap"}
                        >
                            <WrapText size={16} />
                        </button>
                        <button
                            onClick={() => setViewerKey((current) => current + 1)}
                            className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            title="Jump to latest"
                        >
                            <ArrowDown size={16} />
                        </button>
                        <button
                            onClick={() => refetch()}
                            className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
                <div className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 sm:hidden">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Filter logs..."
                            className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                        />
                    </div>
                </div>

                <div className="min-h-0 min-w-0 flex-1 flex flex-col">
                    {isLoading ? (
                        <div className="p-4 text-zinc-500">Loading container logs...</div>
                    ) : effectiveLogs.trim() ? (
                        <LogViewer
                            value={filteredLogs}
                            emptyMessage={search.trim() ? "No log lines match the current filter." : "No logs available for this container."}
                            className={`flex-1 ${wrapLines ? "[&>pre]:whitespace-pre-wrap [&>pre]:break-words" : ""}`}
                            autoScroll={!isPaused}
                            status={isPaused ? "paused" : liveStatus}
                            scrollToLatestSignal={viewerKey}
                        />
                    ) : (
                        <div className="p-4 text-zinc-500">No logs available for this container.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
