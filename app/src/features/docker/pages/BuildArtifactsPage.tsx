import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Copy, Hammer, History, RotateCcw, Server, Upload } from "lucide-react";
import { apiFetch, buildApiUrl, buildAuthHeaders, downloadApiFile } from "@/core/api-client";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { dockerKeys, useBuildHistory, useRuntimeAudit } from "../api/useDockerHooks";
import type {
  DockerBuildHistoryRecord,
  DockerImageImportResult,
  DockerRuntimeOperation,
} from "../types";

const STREAM_RESULT_PREFIX = "__EINFRA_STREAM_RESULT__ ";
const STREAM_META_PREFIX = "__EINFRA_STREAM_META__ ";
const ACTIVE_OPERATION_STORAGE_KEY = "einfra-docker-build-active-operation";

type LogLevel = "info" | "success" | "warning" | "error";
type ActiveOperationKind = "build" | "import" | "rebuild";
type LogEntry = { text: string; level: LogLevel; timestamp: number };

export default function BuildArtifactsPage() {
  const { data: inventory = [], isLoading: isLoadingServers } =
    useEnvironmentInventory();
  const { selectedEnvironment } = useEnvironment();
  const servers = inventory.filter((env) => env.type === "docker");
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [buildContextFile, setBuildContextFile] = useState<File | null>(null);
  const [importArchiveFile, setImportArchiveFile] = useState<File | null>(null);
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [tags, setTags] = useState("local/app:latest");
  const [buildOutput, setBuildOutput] = useState("");
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [severityFilter, setSeverityFilter] = useState<LogLevel | "all">("all");
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [rebuildTagOverride, setRebuildTagOverride] = useState("");
  const [isBuildRunning, setIsBuildRunning] = useState(false);
  const [isImportRunning, setIsImportRunning] = useState(false);
  const [isRebuildRunning, setIsRebuildRunning] = useState(false);
  const buildAbortRef = useRef<AbortController | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const rebuildAbortRef = useRef<AbortController | null>(null);
  const historyQuery = useBuildHistory(selectedServerId, 20);
  const operationsQuery = useQuery({
    queryKey: [...dockerKeys.all, "operation-history", selectedServerId],
    queryFn: async (): Promise<DockerRuntimeOperation[]> =>
      apiFetch<DockerRuntimeOperation[]>(
        `/v1/environments/${selectedServerId}/docker/operations/history?limit=50`,
      ).catch(() => []),
    enabled: !!selectedServerId,
    refetchInterval: 5000,
  });
  const auditQuery = useRuntimeAudit(selectedServerId, 120, { search: "build" });
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const history = historyQuery.data ?? [];
  const operationHistory = operationsQuery.data ?? [];
  const selectedHistory =
    history.find((item) => item.id === selectedHistoryId) ?? history[0] ?? null;

  useEffect(() => {
    if (
      selectedEnvironment?.type === "docker" &&
      selectedEnvironment.id !== selectedServerId
    ) {
      setSelectedServerId(selectedEnvironment.id);
      return;
    }
    if (!selectedServerId && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId, selectedEnvironment]);

  useEffect(() => {
    setRebuildTagOverride(
      selectedHistory?.tags?.join(", ") || selectedHistory?.target || "",
    );
  }, [selectedHistory?.id, selectedHistory?.tags, selectedHistory?.target]);

  useEffect(() => {
    if (!selectedServerId) {
      return;
    }
    const stored = readStoredOperations().filter(
      (item) => item.environmentId === selectedServerId,
    );
    if (!stored.length) {
      return;
    }
    stored.forEach((item) => {
      if (item.kind === "build") {
        setIsBuildRunning(true);
      }
      if (item.kind === "import") {
        setIsImportRunning(true);
      }
      if (item.kind === "rebuild") {
        setIsRebuildRunning(true);
      }
      void reconnectToOperation(item.operationId, item.kind);
    });
  }, [selectedServerId]);

  const auditBuilds = useMemo(
    () =>
      (auditQuery.data || []).filter(
        (item) =>
          /build|image/i.test(item.action || "") ||
          /build/i.test(item.details || ""),
      ),
    [auditQuery.data],
  );

  const visibleActivityLog = useMemo(
    () =>
      severityFilter === "all"
        ? activityLog
        : activityLog.filter((entry) => entry.level === severityFilter),
    [activityLog, severityFilter],
  );

  const rebuildDiff = useMemo(() => {
    if (!selectedHistory) {
      return [] as Array<{ label: string; current: string; previous: string }>;
    }
    const historyTags =
      selectedHistory.tags?.join(", ") || selectedHistory.target || "";
    const diffItems: Array<{ label: string; current: string; previous: string }> =
      [];
    if (
      (dockerfilePath.trim() || "Dockerfile") !==
      (selectedHistory.dockerfile || "Dockerfile")
    ) {
      diffItems.push({
        label: "Dockerfile",
        current: dockerfilePath.trim() || "Dockerfile",
        previous: selectedHistory.dockerfile || "Dockerfile",
      });
    }
    if ((rebuildTagOverride.trim() || historyTags) !== historyTags) {
      diffItems.push({
        label: "Tags",
        current: rebuildTagOverride.trim() || historyTags,
        previous: historyTags,
      });
    }
    if (buildContextFile?.name) {
      diffItems.push({
        label: "Context source",
        current: `Pending upload: ${buildContextFile.name}`,
        previous:
          selectedHistory.archive_name ||
          selectedHistory.context_name ||
          "Stored context",
      });
    }
    return diffItems;
  }, [selectedHistory, dockerfilePath, rebuildTagOverride, buildContextFile]);

  const appendActivityLine = (message: string) => {
    setActivityLog((current) => [...current, createLogEntry(message)]);
  };

  const appendStreamLine = (line: string) => {
    const normalized = line.trimEnd();
    if (!normalized) {
      return;
    }
    setActivityLog((current) => [...current, createLogEntry(normalized)]);
    setBuildOutput((current) => `${current}${current ? "\n" : ""}${normalized}`);
  };

  const runBuild = async () => {
    if (!buildContextFile) {
      showNotification({
        type: "error",
        message: "Build context required",
        description: "Upload a tar / tar.gz build context first.",
      });
      return;
    }
    const parsedTags = tags.split(",").map((item) => item.trim()).filter(Boolean);
    setBuildOutput("");
    setActivityLog([
      createLogEntry("Uploading build context archive..."),
      createLogEntry(
        `Preparing Dockerfile ${dockerfilePath || "Dockerfile"}...`,
      ),
      createLogEntry("Waiting for runtime host to start docker build..."),
    ]);
    setIsBuildRunning(true);
    try {
      buildAbortRef.current = new AbortController();
      const body = new FormData();
      body.append("file", buildContextFile);
      body.append("dockerfile", dockerfilePath.trim() || "Dockerfile");
      parsedTags.forEach((tag) => body.append("tags", tag));
      const result = await streamDockerOperation<{
        ok?: boolean;
        message?: string;
        history?: DockerBuildHistoryRecord;
        operation_id?: string;
      }>({
        endpoint: `/v1/environments/${selectedServerId}/docker/images/build/stream`,
        body,
        signal: buildAbortRef.current.signal,
        kind: "build",
        environmentId: selectedServerId,
        onLine: appendStreamLine,
      });
      if (result.history?.id) {
        setSelectedHistoryId(result.history.id);
      }
      setBuildContextFile(null);
      await invalidateBuildQueries(queryClient, selectedServerId);
      showNotification({
        type: "success",
        message: "Build completed",
        description: result.history?.target || parsedTags.join(", "),
      });
    } catch (error) {
      const message = describeStreamError(error, "Unable to build image.");
      if (isAbortError(error)) {
        appendActivityLine("Build stream disconnected.");
      } else {
        appendActivityLine(`Build failed: ${message}`);
        showNotification({
          type: "error",
          message: "Build failed",
          description: message,
        });
      }
    } finally {
      buildAbortRef.current = null;
      setIsBuildRunning(false);
    }
  };

  const importArchive = async () => {
    if (!importArchiveFile) {
      showNotification({
        type: "error",
        message: "Archive required",
        description: "Choose a docker save archive first.",
      });
      return;
    }
    setBuildOutput("");
    setActivityLog([
      createLogEntry("Uploading docker save archive..."),
      createLogEntry("Passing archive to docker load..."),
    ]);
    setIsImportRunning(true);
    try {
      importAbortRef.current = new AbortController();
      const body = new FormData();
      body.append("archive", importArchiveFile);
      const result = await streamDockerOperation<{
        ok?: boolean;
        message?: string;
        import?: DockerImageImportResult;
        operation_id?: string;
      }>({
        endpoint: `/v1/environments/${selectedServerId}/docker/images/import/stream`,
        body,
        signal: importAbortRef.current.signal,
        kind: "import",
        environmentId: selectedServerId,
        onLine: appendStreamLine,
      });
      const importResult = result.import ?? { loaded_images: [], output: "" };
      setImportArchiveFile(null);
      await invalidateBuildQueries(queryClient, selectedServerId);
      showNotification({
        type: "success",
        message: "Archive imported",
        description: importResult.loaded_images.length
          ? importResult.loaded_images.join(", ")
          : "Docker loaded the archive successfully.",
      });
    } catch (error) {
      const message = describeStreamError(error, "Unable to import archive.");
      if (isAbortError(error)) {
        appendActivityLine("Import stream disconnected.");
      } else {
        appendActivityLine(`Import failed: ${message}`);
        showNotification({
          type: "error",
          message: "Import failed",
          description: message,
        });
      }
    } finally {
      importAbortRef.current = null;
      setIsImportRunning(false);
    }
  };

  const prefillFromHistory = () => {
    if (!selectedHistory) {
      return;
    }
    setDockerfilePath(selectedHistory.dockerfile || "Dockerfile");
    setTags(selectedHistory.tags?.join(", ") || selectedHistory.target || "");
    showNotification({
      type: "info",
      message: "Build config loaded",
      description: selectedHistory.context_id
        ? "Stored build context is ready. You can rebuild in one click."
        : "Upload a fresh context archive, then run rebuild.",
    });
  };

  const rebuildFromHistory = async () => {
    if (!selectedHistory?.id) {
      return;
    }
    setBuildOutput("");
    setActivityLog([
      createLogEntry("Restoring stored build context..."),
      createLogEntry("Replaying docker build on runtime host..."),
    ]);
    setIsRebuildRunning(true);
    try {
      rebuildAbortRef.current = new AbortController();
      const result = await streamDockerOperation<{
        ok?: boolean;
        message?: string;
        history?: DockerBuildHistoryRecord;
        operation_id?: string;
      }>({
        endpoint: `/v1/environments/${selectedServerId}/docker/build-history/${selectedHistory.id}/rebuild/stream`,
        method: "POST",
        body: JSON.stringify({
          tags: rebuildTagOverride
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        signal: rebuildAbortRef.current.signal,
        kind: "rebuild",
        environmentId: selectedServerId,
        onLine: appendStreamLine,
      });
      if (result.history?.id) {
        setSelectedHistoryId(result.history.id);
        setDockerfilePath(
          result.history.dockerfile ||
            selectedHistory.dockerfile ||
            "Dockerfile",
        );
        setTags(
          result.history.tags?.join(", ") ||
            result.history.target ||
            selectedHistory.target ||
            "",
        );
      }
      await invalidateBuildQueries(queryClient, selectedServerId);
      showNotification({
        type: "success",
        message: "Rebuild completed",
        description: result.history?.target || selectedHistory.target,
      });
    } catch (error) {
      const message = describeStreamError(error, "Unable to rebuild image.");
      if (isAbortError(error)) {
        appendActivityLine("Rebuild stream disconnected.");
      } else {
        appendActivityLine(`Rebuild failed: ${message}`);
        showNotification({
          type: "error",
          message: "Rebuild failed",
          description: message,
        });
      }
    } finally {
      rebuildAbortRef.current = null;
      setIsRebuildRunning(false);
    }
  };

  const reconnectToOperation = async (
    operationId: string,
    kind: ActiveOperationKind,
  ) => {
    try {
      await streamDockerOperation<{
        ok?: boolean;
        message?: string;
        history?: DockerBuildHistoryRecord;
        import?: DockerImageImportResult;
        operation_id?: string;
      }>({
        endpoint: `/v1/environments/${selectedServerId}/docker/operations/${operationId}/stream`,
        method: "GET",
        kind,
        environmentId: selectedServerId,
        onLine: appendStreamLine,
      });
      await invalidateBuildQueries(queryClient, selectedServerId);
    } catch (error) {
      clearStoredOperation(operationId);
      appendActivityLine(
        `Reconnect failed: ${describeStreamError(
          error,
          "Unable to reconnect to runtime operation.",
        )}`,
      );
    } finally {
      if (kind === "build") setIsBuildRunning(false);
      if (kind === "import") setIsImportRunning(false);
      if (kind === "rebuild") setIsRebuildRunning(false);
    }
  };

  const cancelOperation = async (kind: ActiveOperationKind) => {
    const stored = readStoredOperations().find(
      (item) => item.environmentId === selectedServerId && item.kind === kind,
    );
    if (
      !stored?.operationId ||
      stored.environmentId !== selectedServerId ||
      stored.kind !== kind
    ) {
      if (kind === "build") buildAbortRef.current?.abort();
      if (kind === "import") importAbortRef.current?.abort();
      if (kind === "rebuild") rebuildAbortRef.current?.abort();
      appendActivityLine(`${capitalize(kind)} cancellation requested.`);
      return;
    }
    try {
      await apiFetch(
        `/v1/environments/${selectedServerId}/docker/operations/${stored.operationId}/cancel`,
        { method: "POST" },
      );
      buildAbortRef.current?.abort();
      importAbortRef.current?.abort();
      rebuildAbortRef.current?.abort();
      appendActivityLine(`${capitalize(kind)} cancellation requested.`);
      showNotification({
        type: "info",
        message: `${capitalize(kind)} cancellation requested`,
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: `Unable to cancel ${kind}`,
        description:
          error instanceof Error ? error.message : "Cancellation failed.",
      });
    }
  };

  const downloadStoredContext = async () => {
    if (!selectedHistory?.id) {
      return;
    }
    try {
      await downloadApiFile(
        `/v1/environments/${selectedServerId}/docker/build-history/${selectedHistory.id}/context/download`,
        selectedHistory.archive_name ||
          selectedHistory.context_name ||
          "build-context.tar",
      );
      showNotification({
        type: "success",
        message: "Context download started",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to download context",
        description: error instanceof Error ? error.message : "Download failed.",
      });
    }
  };

  const exportLogStream = () => {
    const lines = (visibleActivityLog.length ? visibleActivityLog : activityLog).map(
      (entry) => `[${formatLogTime(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.text}`,
    );
    const blob = new Blob([lines.join("\n") || "No log entries available."], {
      type: "text/plain;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `docker-runtime-log-${selectedServerId || "environment"}-${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Hammer className="h-6 w-6 text-orange-500" />
            Build Images & Artifacts
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Build from source bundles, reconnect to running operations after
            refresh, and compare rebuild changes before you apply them.
          </p>
        </div>
        <div className="relative">
          <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            disabled={isLoadingServers}
            className="h-9 min-w-[220px] rounded-md border border-zinc-200 bg-white pl-9 pr-8 text-[13px] font-medium dark:border-zinc-800 dark:bg-[#121212]"
          >
            <option value="" disabled>
              Select Environment...
            </option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.url})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-4">
            <Field
              label="Build Context Archive"
              helper="Upload a tar or tar.gz build context containing your Dockerfile and source."
            >
              <label className="flex min-h-[128px] cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <input
                  type="file"
                  accept=".tar,.tar.gz,.tgz"
                  className="hidden"
                  onChange={(event) =>
                    setBuildContextFile(event.target.files?.[0] || null)
                  }
                />
                <div>
                  <Upload className="mx-auto h-6 w-6 text-zinc-400" />
                  <div className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {buildContextFile
                      ? buildContextFile.name
                      : "Choose build context archive"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Click to upload source bundle
                  </div>
                </div>
              </label>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dockerfile Path">
                <Input
                  value={dockerfilePath}
                  onChange={(event) => setDockerfilePath(event.target.value)}
                  placeholder="Dockerfile"
                />
              </Field>
              <Field label="Image Tags">
                <Input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="team/app:latest,team/app:sha"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => void runBuild()}
                disabled={!selectedServerId || !buildContextFile}
                isLoading={isBuildRunning}
              >
                Start Build
              </Button>
              {isBuildRunning ? (
                <Button variant="outline" onClick={() => void cancelOperation("build")}>
                  Cancel Build
                </Button>
              ) : null}
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Build Output
              </div>
              <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-700 dark:text-zinc-200">
                {buildOutput || "Live runtime logs will appear here."}
              </pre>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Progress Feed
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={severityFilter}
                    onChange={(event) =>
                      setSeverityFilter(event.target.value as LogLevel | "all")
                    }
                    className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-[#121212]"
                  >
                    <option value="all">All Levels</option>
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                  <Button variant="outline" onClick={exportLogStream}>
                    Export Logs
                  </Button>
                  {(isBuildRunning || isImportRunning || isRebuildRunning) && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      Streaming
                    </span>
                  )}
                </div>
              </div>
              <div className="max-h-[220px] space-y-1 overflow-auto rounded-lg bg-black/5 p-2 dark:bg-white/5">
                {visibleActivityLog.length ? (
                  visibleActivityLog.map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className={`font-mono text-xs ${logLevelClassName(entry.level)}`}
                    >
                      [{formatLogTime(entry.timestamp)}] {entry.text}
                    </div>
                  ))
                ) : (
                  <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    Runtime progress entries will appear here while build or import is running.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Import Docker Save Archive
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <Field
                  label="Archive File"
                  helper="Upload a tar, tar.gz, or tgz archive created with docker save."
                >
                  <label className="flex min-h-[96px] cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white px-4 py-5 text-center dark:border-zinc-700 dark:bg-[#121212]">
                    <input
                      type="file"
                      accept=".tar,.tar.gz,.tgz,.gz"
                      className="hidden"
                      onChange={(event) =>
                        setImportArchiveFile(event.target.files?.[0] || null)
                      }
                    />
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">
                      {importArchiveFile
                        ? importArchiveFile.name
                        : "Choose docker save archive"}
                    </div>
                  </label>
                </Field>
                <Button
                  variant="outline"
                  onClick={() => void importArchive()}
                  disabled={!selectedServerId || !importArchiveFile}
                  isLoading={isImportRunning}
                >
                  Import Archive
                </Button>
                {isImportRunning ? (
                  <Button variant="outline" onClick={() => void cancelOperation("import")}>
                    Cancel Import
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <History className="h-4 w-4 text-blue-500" />
              Build History
            </div>
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No recent builds recorded yet.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedHistoryId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedHistoryId(item.id);
                      }
                    }}
                    className={`rounded-xl border px-3 py-3 transition-colors dark:border-zinc-800 ${
                      selectedHistory?.id === item.id
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {item.target}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.status === "success"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : item.status === "cancelled"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                              : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.dockerfile} • {new Date(item.created_at).toLocaleString()}
                    </div>
                    {item.context_id ? (
                      <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Rebuild ready • {item.archive_name || item.context_name}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Hammer className="h-4 w-4 text-orange-500" />
              Operation History
            </div>
            <div className="space-y-3">
              {operationHistory.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No runtime operations recorded yet.
                </div>
              ) : (
                operationHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
                        {item.kind}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.status === "success"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : item.status === "running"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                              : item.status === "cancelled"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Started {new Date(item.started_at).toLocaleString()}
                      {item.completed_at
                        ? ` • Completed ${new Date(item.completed_at).toLocaleString()}`
                        : ""}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Log size: {formatBytes(item.log_size)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <RotateCcw className="h-4 w-4 text-emerald-500" />
              Build Detail
            </div>
            {selectedHistory ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedHistory.target || "Untitled build target"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedHistory.dockerfile} •{" "}
                    {new Date(selectedHistory.created_at).toLocaleString()}
                  </div>
                  {selectedHistory.context_name ? (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Context: {selectedHistory.context_name}
                    </div>
                  ) : null}
                  {selectedHistory.context_size ? (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Archive: {selectedHistory.archive_name || "context archive"} •{" "}
                      {formatBytes(selectedHistory.context_size)}
                    </div>
                  ) : null}
                </div>

                <Field
                  label="Rebuild Tag Override"
                  helper="Leave as-is to reuse stored tags, or override with a comma-separated list."
                >
                  <Input
                    value={rebuildTagOverride}
                    onChange={(event) => setRebuildTagOverride(event.target.value)}
                    placeholder="team/app:latest,team/app:canary"
                  />
                </Field>

                {rebuildDiff.length ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                      Pending Diff
                    </div>
                    <div className="space-y-2">
                      {rebuildDiff.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg bg-white/80 p-3 text-xs dark:bg-black/10"
                        >
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.label}
                          </div>
                          <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                            Current: {item.current}
                          </div>
                          <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                            History: {item.previous}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    No diff detected. Rebuild will reuse the stored Dockerfile,
                    tags, and context metadata.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={prefillFromHistory}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Prefill Rebuild
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void downloadStoredContext()}
                    disabled={!selectedHistory.context_id}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Download Context
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void rebuildFromHistory()}
                    disabled={!selectedHistory.context_id}
                    isLoading={isRebuildRunning}
                  >
                    <Hammer className="mr-2 h-4 w-4" />
                    Rebuild Now
                  </Button>
                  {isRebuildRunning ? (
                    <Button variant="outline" onClick={() => void cancelOperation("rebuild")}>
                      Cancel Rebuild
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(selectedHistory.output || "");
                      showNotification({
                        type: "success",
                        message: "Build output copied",
                      });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Output
                  </Button>
                </div>

                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {selectedHistory.output || "No output stored for this build record."}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">
                Select a history row to inspect output and reuse its build settings.
              </div>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Box className="h-4 w-4 text-indigo-500" />
              Runtime Audit Signals
            </div>
            <div className="space-y-3">
              {auditBuilds.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No build-related audit events returned for this environment yet.
                </div>
              ) : (
                auditBuilds.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-800"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.action}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.details || "-"} • {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>
      {children}
      {helper ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

async function streamDockerOperation<
  TPayload extends { message?: string; ok?: boolean },
>({
  endpoint,
  body,
  method = "POST",
  headers,
  signal,
  kind,
  environmentId,
  onLine,
}: {
  endpoint: string;
  body?: BodyInit;
  method?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  kind: ActiveOperationKind;
  environmentId: string;
  onLine: (line: string) => void;
}) {
  const response = await fetch(buildApiUrl(endpoint), {
    method,
    body,
    signal,
    headers: {
      Accept: "text/plain",
      ...buildAuthHeaders(),
      ...headers,
    } as HeadersInit,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error?.message ||
          errorData?.message ||
          `API Error: ${response.status}`,
      );
    }
    throw new Error(
      (await response.text().catch(() => "")) || `API Error: ${response.status}`,
    );
  }

  if (!response.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let result: TPayload | null = null;
  let operationId: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    pending += decoder.decode(value, { stream: true }).replace(/\r/g, "\n");
    let lineBreakIndex = pending.indexOf("\n");
    while (lineBreakIndex >= 0) {
      const line = pending.slice(0, lineBreakIndex).trimEnd();
      pending = pending.slice(lineBreakIndex + 1);
      if (line.startsWith(STREAM_META_PREFIX)) {
        const meta = JSON.parse(line.slice(STREAM_META_PREFIX.length)) as {
          operation_id?: string;
        };
        if (meta.operation_id) {
          operationId = meta.operation_id;
          writeStoredOperation({ operationId, kind, environmentId });
        }
      } else if (line.startsWith(STREAM_RESULT_PREFIX)) {
        result = JSON.parse(line.slice(STREAM_RESULT_PREFIX.length)) as TPayload;
      } else if (line.trim()) {
        onLine(line);
      }
      lineBreakIndex = pending.indexOf("\n");
    }
  }

  const tail = pending.trim();
  if (tail) {
    if (tail.startsWith(STREAM_META_PREFIX)) {
      const meta = JSON.parse(tail.slice(STREAM_META_PREFIX.length)) as {
        operation_id?: string;
      };
      if (meta.operation_id) {
        operationId = meta.operation_id;
        writeStoredOperation({ operationId, kind, environmentId });
      }
    } else if (tail.startsWith(STREAM_RESULT_PREFIX)) {
      result = JSON.parse(tail.slice(STREAM_RESULT_PREFIX.length)) as TPayload;
    } else {
      onLine(tail);
    }
  }

  if (!result) {
    throw new Error("Runtime stream ended without a result payload.");
  }
  clearStoredOperation(operationId);
  if (result.ok === false) {
    throw new Error(result.message || "Runtime operation failed.");
  }
  return result;
}

async function invalidateBuildQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  environmentId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) }),
    queryClient.invalidateQueries({
      queryKey: dockerKeys.buildHistory(environmentId),
    }),
    queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) }),
  ]);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(amount >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

function createLogEntry(text: string): LogEntry {
  return {
    text,
    level: detectLogLevel(text),
    timestamp: Date.now(),
  };
}

function detectLogLevel(text: string): LogLevel {
  const value = text.toLowerCase();
  if (/(error|failed|denied|unauthorized|panic|exception)/.test(value)) {
    return "error";
  }
  if (/(warn|warning|pending|cancel|deprecated|retry)/.test(value)) {
    return "warning";
  }
  if (/(done|success|completed|loaded image|writing image sha)/.test(value)) {
    return "success";
  }
  return "info";
}

function logLevelClassName(level: LogLevel) {
  switch (level) {
    case "success":
      return "text-emerald-700 dark:text-emerald-300";
    case "warning":
      return "text-amber-700 dark:text-amber-300";
    case "error":
      return "text-red-700 dark:text-red-300";
    default:
      return "text-zinc-700 dark:text-zinc-300";
  }
}

function formatLogTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString();
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function describeStreamError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function writeStoredOperation(value: {
  operationId: string;
  kind: ActiveOperationKind;
  environmentId: string;
}) {
  if (typeof window === "undefined") return;
  const current = readStoredOperations().filter(
    (item) => item.operationId !== value.operationId,
  );
  current.push(value);
  window.sessionStorage.setItem(ACTIVE_OPERATION_STORAGE_KEY, JSON.stringify(current));
}

function readStoredOperations(): Array<{
  operationId: string;
  kind: ActiveOperationKind;
  environmentId: string;
}> {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(ACTIVE_OPERATION_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{
      operationId: string;
      kind: ActiveOperationKind;
      environmentId: string;
    }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearStoredOperation(operationId?: string | null) {
  if (typeof window === "undefined") return;
  const current = readStoredOperations();
  if (!current.length) return;
  const next = operationId
    ? current.filter((item) => item.operationId !== operationId)
    : [];
  if (!next.length) {
    window.sessionStorage.removeItem(ACTIVE_OPERATION_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(ACTIVE_OPERATION_STORAGE_KEY, JSON.stringify(next));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
