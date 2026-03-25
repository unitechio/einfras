"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Network,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Terminal,
  Zap,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";
import { settingsApi } from "@/features/settings/api";
import { useRuntimeFeatureFlags } from "@/features/settings/useRuntimeFeatureFlags";

type EdgeSettings = {
  autoSync: boolean;
  distributedTracing: boolean;
  pollingInterval: string;
  maxNodes: string;
  edgeCacheTTL: string;
  offlineMode: boolean;
};

const defaults: EdgeSettings = {
  autoSync: true,
  distributedTracing: false,
  pollingInterval: "30",
  maxNodes: "100",
  edgeCacheTTL: "3600",
  offlineMode: true,
};

export default function EdgeComputeSettingsPage() {
  const { showNotification } = useNotification();
  const featureFlags = useRuntimeFeatureFlags();
  const [settings, setSettings] = useState<EdgeSettings>(defaults);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const items = await settingsApi.listSystem("edge");
        const map = items.reduce<Record<string, string>>((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, {});
        setSettings({
          autoSync: map.edge_auto_sync ? map.edge_auto_sync === "true" : defaults.autoSync,
          distributedTracing: map.edge_distributed_tracing ? map.edge_distributed_tracing === "true" : defaults.distributedTracing,
          pollingInterval: map.edge_polling_interval || defaults.pollingInterval,
          maxNodes: map.edge_max_nodes || defaults.maxNodes,
          edgeCacheTTL: map.edge_cache_ttl || defaults.edgeCacheTTL,
          offlineMode: map.edge_offline_mode ? map.edge_offline_mode === "true" : defaults.offlineMode,
        });
      } catch (err) {
        showNotification({
          type: "error",
          message: "Unable to load edge settings",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [showNotification]);

  const handleToggle = (key: keyof Pick<EdgeSettings, "autoSync" | "distributedTracing" | "offlineMode">) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.saveSystem([
        { key: "edge_auto_sync", category: "edge", value: String(settings.autoSync), description: "Auto-sync configurations to edge nodes" },
        { key: "edge_distributed_tracing", category: "edge", value: String(settings.distributedTracing), description: "Enable distributed tracing on edge nodes" },
        { key: "edge_polling_interval", category: "edge", value: settings.pollingInterval, description: "Polling interval in seconds" },
        { key: "edge_max_nodes", category: "edge", value: settings.maxNodes, description: "Maximum allowed edge nodes" },
        { key: "edge_cache_ttl", category: "edge", value: settings.edgeCacheTTL, description: "Edge cache TTL in seconds" },
        { key: "edge_offline_mode", category: "edge", value: String(settings.offlineMode), description: "Offline tolerance mode" },
      ]);
      await settingsApi.saveUserSettings({
        edge_last_saved_at: new Date().toISOString(),
        edge_preferences: settings,
      });
      showNotification({
        type: "success",
        message: "Edge settings saved",
        description: "Edge compute configuration is now persisted to backend settings.",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save edge settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {!featureFlags.isLoading && !featureFlags.isEnabled("edge_compute", true) ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500">
          Edge Compute is currently disabled by runtime feature flag. Re-enable it from the Feature Flags page to manage edge polling, sync, and offline runtime controls.
        </div>
      ) : null}
      {!featureFlags.isLoading && !featureFlags.isEnabled("edge_compute", true) ? null : (
      <>
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Terminal className="h-6 w-6 text-indigo-500" />
            Edge Compute
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Distributed runtime and edge-sync controls backed by persisted settings.
          </p>
        </div>
        <Button variant="primary" onClick={() => void handleSave()} isLoading={isSaving}>
          {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-sm text-zinc-500">
          Loading edge settings...
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/20">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="h-4 w-4 text-zinc-500" />
                General Configuration
              </h2>
            </div>
            <div className="grid gap-6 p-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Agent Polling Interval (seconds)</label>
                <Input name="pollingInterval" value={settings.pollingInterval} onChange={handleChange} type="number" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Max Nodes Per Cluster</label>
                <Input name="maxNodes" value={settings.maxNodes} onChange={handleChange} type="number" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">Edge Cache TTL (seconds)</label>
                <Input name="edgeCacheTTL" value={settings.edgeCacheTTL} onChange={handleChange} type="number" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/20">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-zinc-500" />
                Runtime Features
              </h2>
            </div>
            <ToggleRow
              title="Auto-Sync Configurations"
              description="Automatically push configuration changes to connected edge nodes."
              active={settings.autoSync}
              onClick={() => handleToggle("autoSync")}
            />
            <ToggleRow
              title="Distributed Tracing"
              description="Emit tracing signals from edge workloads for runtime inspection."
              active={settings.distributedTracing}
              onClick={() => handleToggle("distributedTracing")}
            />
            <ToggleRow
              title="Offline Tolerance Mode"
              description="Allow cached or local workflows to continue when control plane connectivity is degraded."
              active={settings.offlineMode}
              onClick={() => handleToggle("offlineMode")}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Network className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">Edge Network</h3>
            </div>
            <p className="text-sm leading-relaxed text-indigo-800/80 dark:text-indigo-300/80">
              Persisted edge settings can now be shared across sessions and environments instead of staying local in the UI.
            </p>
            <Button variant="outline" className="mt-4 w-full">
              View Network Map <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Quick Stats</h4>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-500"><Server className="h-3.5 w-3.5" /> Active Edge Nodes</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">24 / {settings.maxNodes}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-1.5 w-[24%] rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-500"><Activity className="h-3.5 w-3.5" /> Network Health</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Good</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-8 border-t border-zinc-100 p-6 first:border-t-0 dark:border-zinc-800">
      <div className="flex-1">
        <h3 className="mb-1.5 text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
          active ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform",
            active ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
