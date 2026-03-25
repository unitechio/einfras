"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, Info, Activity, Terminal, Code, Clock, ServerIcon, RefreshCw, Download, Trash2, Play,
} from "lucide-react";

import { apiFetch, buildApiWebSocketUrl } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";
import { K8sStatusBadge } from "./K8sStatusBadge";
import { K8sLogViewer } from "./K8sLogViewer";
import { K8sResourceMetrics } from "./K8sResourceMetrics";
import { K8sPodExecTerminal } from "./K8sPodExecTerminal";
import { useApplyManifest, usePodExec } from "../api/useKubernetesHooks";

interface ResourceDetailPanelProps {
  resource: any;
  isOpen: boolean;
  onClose: () => void;
  type: "pod" | "deployment" | "service" | "node";
  clusterId?: string;
}

const tabs = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "exec", label: "Exec", icon: Terminal },
  { id: "metrics", label: "Metrics", icon: Activity },
  { id: "yaml", label: "YAML", icon: Code },
  { id: "events", label: "Events", icon: Clock },
] as const;

type DetailTab = typeof tabs[number]["id"];

type LogLine = {
  id: string;
  timestamp: string;
  content: string;
  type: "info" | "warn" | "error" | "system";
};

export function K8sResourceDetailPanel({ resource, isOpen, onClose, type, clusterId }: ResourceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [execCommand, setExecCommand] = useState("printenv | head -n 20");
  const [execOutput, setExecOutput] = useState("");
  const [tailLines, setTailLines] = useState(200);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [yamlText, setYamlText] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isYamlLoading, setIsYamlLoading] = useState(false);
  const [isLogsConnecting, setIsLogsConnecting] = useState(false);
  const { showNotification } = useNotification();

  const runtimeClusterId = clusterId || resource?.cluster_id || "";
  const runtimeNamespace = resource?.namespace || "default";
  const runtimeName = resource?.name || "";
  const podExec = usePodExec(runtimeClusterId);
  const applyManifest = useApplyManifest(runtimeClusterId);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("overview");
      setExecOutput("");
      setLogLines([]);
      setYamlText("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !runtimeClusterId || !runtimeName) {
      return;
    }
    const shouldLoadYaml = activeTab === "yaml";
    if (!shouldLoadYaml) {
      return;
    }
    let cancelled = false;
    setIsYamlLoading(true);
    const kind = type === "pod" ? "pods" : type === "deployment" ? "deployments" : type === "service" ? "services" : "nodes";
    apiFetch<{ yaml: string }>(`/v1/environments/${runtimeClusterId}/kubernetes/resources/${kind}/${encodeURIComponent(runtimeName)}/yaml?namespace=${encodeURIComponent(runtimeNamespace)}`)
      .then((payload) => {
        if (!cancelled) {
          setYamlText(payload.yaml || "");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setYamlText(`# Unable to load YAML\n# ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsYamlLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, isOpen, runtimeClusterId, runtimeName, runtimeNamespace, type]);

  useEffect(() => {
    if (!isOpen || type !== "pod" || activeTab !== "logs" || !runtimeClusterId || !runtimeName) {
      return;
    }
    setLogLines([]);
    setIsLogsConnecting(true);
    const socket = new WebSocket(
      buildApiWebSocketUrl(`/v1/environments/${runtimeClusterId}/kubernetes/pods/${encodeURIComponent(runtimeName)}/logs/ws?namespace=${encodeURIComponent(runtimeNamespace)}&tail=${tailLines}`),
    );
    socket.binaryType = "arraybuffer";

    const appendLine = (content: string, explicitType?: LogLine["type"]) => {
      const rows = content.replace(/\r/g, "").split("\n").filter((line) => line.trim().length > 0);
      if (!rows.length) {
        return;
      }
      setLogLines((current) => {
        const next = [...current];
        rows.forEach((line, index) => {
          const lowered = line.toLowerCase();
          next.push({
            id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
            timestamp: new Date().toLocaleTimeString(),
            content: line,
            type: explicitType || (lowered.includes("error") ? "error" : lowered.includes("warn") ? "warn" : "info"),
          });
        });
        return next.slice(-2000);
      });
    };

    socket.onopen = () => {
      setIsLogsConnecting(false);
      appendLine("Live pod log stream connected.", "system");
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        void new Response(event.data).text().then((text) => appendLine(text));
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { type?: string; status?: string; message?: string };
        if (payload.type === "status" && payload.message) {
          appendLine(payload.message, "system");
          return;
        }
        if (payload.type === "error") {
          appendLine(payload.message || "Pod log stream failed.", "error");
          return;
        }
      } catch {
        appendLine(String(event.data));
      }
    };
    socket.onerror = () => {
      setIsLogsConnecting(false);
      appendLine("Unable to establish pod log websocket.", "error");
    };
    socket.onclose = () => {
      setIsLogsConnecting(false);
      appendLine("Pod log stream closed.", "system");
    };
    return () => socket.close();
  }, [activeTab, isOpen, runtimeClusterId, runtimeName, runtimeNamespace, tailLines, type]);

  const mockEvents = useMemo(() => ([
    { type: "Normal" as const, reason: "Scheduled", message: `Successfully assigned ${runtimeName} to node ${resource?.node || "node-01"}`, age: "12m" },
    { type: "Normal" as const, reason: "Started", message: "Resource is running and responding.", age: resource?.age || "11m" },
    { type: resource?.status === "Running" ? "Normal" as const : "Warning" as const, reason: resource?.status || "Unknown", message: `Current runtime status is ${resource?.status || "Unknown"}`, age: "now" },
  ]), [resource?.age, resource?.node, resource?.status, runtimeName]);

  if (!resource) return null;

  const handleExec = async () => {
    if (!runtimeClusterId || !runtimeName || !execCommand.trim()) {
      return;
    }
    try {
      const command = ["sh", "-lc", execCommand.trim()];
      const result = await podExec.mutateAsync({ namespace: runtimeNamespace, podName: runtimeName, command });
      setExecOutput(result.output || "Command completed without output.");
      showNotification({ type: "success", message: "Pod command executed", description: `${runtimeName} responded successfully.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pod exec failed";
      setExecOutput(message);
      showNotification({ type: "error", message: "Pod exec failed", description: message });
    }
  };

  const handleApplyYaml = async () => {
    if (!yamlText.trim()) {
      return;
    }
    try {
      await applyManifest.mutateAsync({ namespace: runtimeNamespace, manifest: yamlText });
      showNotification({ type: "success", message: "Manifest applied", description: `${runtimeName} has been updated.` });
    } catch (error) {
      showNotification({ type: "error", message: "Apply failed", description: error instanceof Error ? error.message : "Unable to apply manifest." });
    }
  };

  const handleDelete = async () => {
    const kind = type === "pod" ? "pods" : type === "deployment" ? "deployments" : type === "service" ? "services" : "nodes";
    try {
      await apiFetch(`/v1/environments/${runtimeClusterId}/kubernetes/resources/${kind}/${encodeURIComponent(runtimeName)}?namespace=${encodeURIComponent(runtimeNamespace)}`, { method: "DELETE" });
      showNotification({ type: "success", message: "Resource removed", description: `${runtimeName} was deleted.` });
      onClose();
    } catch (error) {
      showNotification({ type: "error", message: "Delete failed", description: error instanceof Error ? error.message : "Unable to delete resource." });
    }
  };

  return (
    <div className={cn(
      "fixed top-0 right-0 z-[100] h-full w-full border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 dark:border-zinc-800 dark:bg-[#0a0a0a] lg:w-[62%] xl:w-[54%]",
      isOpen ? "translate-x-0" : "translate-x-full",
    )}>
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/20">
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <ServerIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="mb-0.5 flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{runtimeName}</h2>
              <Badge variant="outline" className="border-zinc-200 px-1.5 text-[10px] font-bold uppercase text-zinc-500 dark:border-zinc-800">{type}</Badge>
            </div>
            <p className="text-xs font-medium text-zinc-500">
              Namespace: <span className="font-bold text-zinc-700 dark:text-zinc-300">{runtimeNamespace}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <K8sStatusBadge status={resource.status} />
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={18} />
          </Button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-zinc-100 px-6 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-2 border-b-2 py-4 text-sm font-semibold transition-all",
              activeTab === tab.id ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100",
            )}
          >
            <tab.icon size={14} className="opacity-70" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="h-[calc(100%-128px)] overflow-y-auto p-6">
        {activeTab === "overview" ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: "Cluster ID", value: runtimeClusterId || "local" },
                { label: "Restarts", value: String(resource.restarts || "0") },
                { label: "Node", value: resource.node || "N/A" },
                { label: "IP Address", value: resource.ip || "N/A" },
                { label: "Status", value: resource.status || "Unknown" },
                { label: "Age", value: resource.age || "Unknown" },
                { label: "Namespace", value: runtimeNamespace },
                { label: "Type", value: type },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{item.label}</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">Labels & Selectors</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">app: {runtimeName}</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">namespace: {runtimeNamespace}</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">status: {resource.status}</Badge>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                value={String(tailLines)}
                onChange={(event) => setTailLines(Number(event.target.value))}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="100">Last 100 lines</option>
                <option value="200">Last 200 lines</option>
                <option value="500">Last 500 lines</option>
              </select>
              <Badge variant="outline" className="text-[10px] uppercase">
                {isLogsConnecting ? "connecting" : "streaming"}
              </Badge>
            </div>
            <K8sLogViewer
              lines={logLines}
              isLoading={isLogsConnecting}
              onClear={() => setLogLines([])}
              onDownload={() => {
                const blob = new Blob([logLines.map((line) => `${line.timestamp} ${line.content}`).join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${runtimeName}-logs.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            />
            {execOutput ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Last Exec Output</div>
                <pre className="overflow-auto whitespace-pre-wrap text-xs text-zinc-800 dark:text-zinc-200">{execOutput}</pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "exec" ? (
          <div className="space-y-4">
            {type === "pod" ? (
              <>
                <K8sPodExecTerminal clusterId={runtimeClusterId} namespace={runtimeNamespace} podName={runtimeName} active={isOpen && activeTab === "exec"} />
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Quick Command</h4>
                    {podExec.isPending ? <RefreshCw size={14} className="animate-spin text-zinc-500" /> : null}
                  </div>
                  <div className="flex gap-3">
                    <Input value={execCommand} onChange={(event) => setExecCommand(event.target.value)} placeholder="kubectl-style shell command" className="h-10" />
                    <Button variant="primary" size="sm" onClick={handleExec} disabled={podExec.isPending || !runtimeClusterId}>
                      <Play className="mr-2 h-4 w-4" />
                      Run
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500 dark:border-zinc-700">
                Interactive exec is currently available for Pods.
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "metrics" ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h4 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">Resource Snapshot</h4>
              <K8sResourceMetrics cpu={42} memory={512} storage={120} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-32 rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
              <div className="h-32 rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
            </div>
          </div>
        ) : null}

        {activeTab === "yaml" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live YAML</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setYamlText("")}>
                  Clear
                </Button>
                <Button variant="primary" size="sm" onClick={handleApplyYaml} disabled={applyManifest.isPending || !yamlText.trim()}>
                  {applyManifest.isPending ? "Applying..." : "Apply YAML"}
                </Button>
              </div>
            </div>
            <textarea
              value={yamlText}
              onChange={(event) => setYamlText(event.target.value)}
              spellCheck={false}
              className="min-h-[420px] w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-[#1e1e1e] dark:text-zinc-200"
            />
            {isYamlLoading ? <div className="text-xs text-zinc-500">Loading current YAML...</div> : null}
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div className="space-y-4">
            {mockEvents.map((event, index) => (
              <div key={`${event.reason}-${index}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn("mt-1 h-2.5 w-2.5 rounded-full border-2", event.type === "Warning" ? "border-amber-500/50 bg-amber-500" : "border-emerald-500/50 bg-emerald-500")} />
                  {index < mockEvents.length - 1 ? <div className="mt-1 h-full w-0.5 bg-zinc-100 dark:bg-zinc-800" /> : null}
                </div>
                <div className="pb-6">
                  <div className="mb-1 flex items-center gap-3">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", event.type === "Warning" ? "text-amber-600" : "text-emerald-600")}>{event.reason}</span>
                    <span className="font-mono text-[10px] text-zinc-500">[{event.age} ago]</span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{event.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <Badge variant="outline" className="text-[10px] text-zinc-500">Resource: {runtimeName}</Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const blob = new Blob([yamlText || JSON.stringify(resource, null, 2)], { type: "text/yaml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${runtimeName}.yaml`;
            link.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="mr-2 h-4 w-4" />
            Download YAML
          </Button>
          {type !== "node" ? (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-500/10"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      <ConfirmActionDialog
        open={deleteConfirmOpen}
        title="Delete resource?"
        description={`This permanently deletes ${runtimeName} from ${runtimeNamespace}.`}
        confirmLabel="Delete Resource"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          void handleDelete().finally(() => setDeleteConfirmOpen(false));
        }}
        pending={false}
        tone="danger"
      />
    </div>
  );
}
