"use client";

import { useState } from "react";
import {
  X, Info, Activity, Terminal, Code, Clock, Layers, ExternalLink, ShieldAlert,
  ServerIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Badge } from "@/shared/ui/Badge";
import { K8sStatusBadge } from "./K8sStatusBadge";
import { K8sLogViewer } from "./K8sLogViewer";
import { K8sResourceMetrics } from "./K8sResourceMetrics";

interface ResourceDetailPanelProps {
  resource: any;
  isOpen: boolean;
  onClose: () => void;
  type: "pod" | "deployment" | "service" | "node";
}

export function K8sResourceDetailPanel({ resource, isOpen, onClose, type }: ResourceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "metrics" | "yaml" | "events">("overview");

  if (!resource) return null;

  const mockLogs = [
    { id: "1", timestamp: "12:00:01", content: "Starting container my-web-app...", type: "system" as const },
    { id: "2", timestamp: "12:00:05", content: "Listening on port 8080", type: "info" as const },
    { id: "3", timestamp: "12:05:12", content: "Incoming GET /api/v1/health", type: "info" as const },
    { id: "4", timestamp: "12:08:34", content: "Database connection transient failure, retrying...", type: "warn" as const },
    { id: "5", timestamp: "12:08:40", content: "Worker pool reached capacity: scaling up...", type: "system" as const },
    { id: "6", timestamp: "12:15:22", content: "Critical: Memory threshold exceeded (90%)", type: "error" as const }
  ];

  const mockEvents = [
    { type: "Normal" as const, reason: "Scheduled", message: `Successfully assigned ${resource.name} to node node-01`, age: "12m" },
    { type: "Normal" as const, reason: "Pulled", message: "Container image already present on machine", age: "11m" },
    { type: "Normal" as const, reason: "Started", message: "Started container", age: "11m" },
    { type: "Warning" as const, reason: "Unhealthy", message: "Liveness probe failed", age: "2m" }
  ];

  return (
    <div className={cn(
      "fixed top-0 right-0 h-full w-full lg:w-[60%] xl:w-[50%] bg-white dark:bg-[#0a0a0a] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-[100] transition-transform duration-300 transform",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <ServerIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{resource.name}</h2>
              <Badge variant="outline" className="text-[10px] px-1.5 font-bold border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase">{type}</Badge>
            </div>
            <p className="text-xs text-zinc-500 font-medium">Namespace: <span className="text-zinc-700 dark:text-zinc-300 font-bold">{resource.namespace || "default"}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <K8sStatusBadge status={resource.status} />
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-800">
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-6 gap-6">
        {[
          { id: "overview", label: "Overview", icon: Info },
          { id: "logs", label: "Logs", icon: Terminal },
          { id: "metrics", label: "Metrics", icon: Activity },
          { id: "yaml", label: "YAML", icon: Code },
          { id: "events", label: "Events", icon: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 py-4 text-sm font-semibold transition-all relative border-b-2",
              activeTab === tab.id
                ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
                : "text-zinc-500 dark:text-zinc-500 border-transparent hover:text-zinc-800 dark:hover:text-zinc-700 dark:text-zinc-300"
            )}
          >
            <tab.icon size={14} className="opacity-70" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 h-[calc(100%-120px)] overflow-y-auto custom-scrollbar p-6">

        {activeTab === "overview" && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: "Cluster ID", value: resource.cluster_id || "prod-k8s-01" },
                { label: "Restarts", value: resource.restarts || "0" },
                { label: "Node", value: resource.node || "N/A" },
                { label: "IP Address", value: resource.ip || "N/A" },
                { label: "QoS Class", value: "Guaranteed" },
                { label: "Service Account", value: "default" },
                { label: "Created At", value: resource.age || "Unknown" },
                { label: "Controlled By", value: "ReplicaSet", isLink: true },
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{item.label}</span>
                  <span className={cn(
                    "text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5",
                    item.isLink && "text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/30 cursor-pointer"
                  )}>
                    {item.value} {item.isLink && <ExternalLink size={10} />}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                <Layers size={16} className="text-zinc-600 dark:text-zinc-400" />
                Labels & Selectors
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 font-mono text-[10px] border-zinc-200 dark:border-zinc-800 text-zinc-500 px-2 py-0.5">app: {resource.name}</Badge>
                <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 font-mono text-[10px] border-zinc-200 dark:border-zinc-800 text-zinc-500 px-2 py-0.5">env: prod</Badge>
                <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 font-mono text-[10px] border-zinc-200 dark:border-zinc-800 text-zinc-500 px-2 py-0.5">tier: frontend</Badge>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                <ShieldAlert size={16} className="text-zinc-600 dark:text-zinc-400" />
                Resource Quotas
              </h3>
              <K8sResourceMetrics cpu={42} memory={512} storage={120} />
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="h-full animate-in fade-in zoom-in-95 duration-300">
            <K8sLogViewer lines={mockLogs} onClear={() => console.log('Clear console')} />
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center">
              <Activity size={40} className="text-indigo-500 mb-4 animate-pulse" />
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">Advanced Performance Analysis</h4>
              <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">Connecting to Prometheus metrics server for high-resolution resource tracking...</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-32 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800" />
              <div className="h-32 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800" />
            </div>
          </div>
        )}

        {activeTab === "yaml" && (
          <div className="animate-in fade-in duration-300 h-full bg-zinc-50 dark:bg-[#1e1e1e] rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-auto selection:bg-indigo-500/40">
            <pre className="leading-relaxed">
              {`apiVersion: v1
kind: Pod
metadata:
  name: ${resource.name}
  namespace: ${resource.namespace || "default"}
  labels:
    app: ${resource.name}
    env: production
    managed-by: infra-controller
spec:
  containers:
  - name: main
    image: company/web-app:v2.4.1
    ports:
    - containerPort: 8080
    resources:
      limits:
        cpu: "1"
        memory: 1Gi
      requests:
        cpu: 100m
        memory: 256Mi
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 20
  nodeSelector:
    kubernetes.io/os: linux
status:
  phase: Running
  podIP: ${resource.ip || "10.0.0.1"}
  hostIP: 192.168.1.10
`}
            </pre>
          </div>
        )}

        {activeTab === "events" && (
          <div className="animate-in fade-in duration-300 space-y-4">
            {mockEvents.map((event, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full mt-1 border-2",
                    event.type === "Warning" ? "bg-amber-500 border-amber-500/50" : "bg-emerald-500 border-emerald-500/50"
                  )} />
                  {i < mockEvents.length - 1 && <div className="w-0.5 h-full bg-zinc-100 dark:bg-zinc-800 mt-1" />}
                </div>
                <div className="pb-8">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      event.type === "Warning" ? "text-amber-600" : "text-emerald-600"
                    )}>{event.reason}</span>
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium font-mono">[{event.age} ago]</span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{event.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Footer */}
      <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <Badge variant="outline" className="text-[10px] bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-zinc-500">
          Resource UID: {Math.random().toString(36).substr(2, 9)}
        </Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Download YAML</Button>
          <Button variant="outline" size="sm" className="text-red-600 border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors bg-white dark:bg-[#121212]">
            Destroy Pod
          </Button>
        </div>
      </div>
    </div>
  );
}
