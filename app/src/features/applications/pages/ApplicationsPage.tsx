"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";
import { applicationsApi, type ApplicationItem } from "@/features/catalog/api";

type FilterTab = "all" | "active" | "incidents";

const emptyDraft = {
  name: "",
  platform: "Docker",
  environment: "Production",
  status: "Healthy",
  uptime: "99.9%",
  services: 1,
  instances: 1,
  cpu: "0.5 Core",
  ram: "512 MB",
  public_url: "",
  tags: "",
  cpu_pct: 10,
};

export default function ApplicationsPage() {
  const { showNotification } = useNotification();
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<ApplicationItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      setItems(await applicationsApi.list());
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load applications",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  const filteredApps = useMemo(() => {
    return items.filter((app) => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (activeTab === "active") return matchesSearch && app.status === "Healthy";
      if (activeTab === "incidents") return matchesSearch && app.status !== "Healthy";
      return matchesSearch;
    });
  }, [activeTab, items, searchQuery]);

  const healthyCount = items.filter((app) => app.status === "Healthy").length;
  const degradedCount = items.filter((app) => app.status !== "Healthy").length;

  const startCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
  };

  const startEdit = (item: ApplicationItem) => {
    setEditing(item);
    setDraft({
      name: item.name,
      platform: item.platform,
      environment: item.environment,
      status: item.status,
      uptime: item.uptime,
      services: item.services,
      instances: item.instances,
      cpu: item.cpu,
      ram: item.ram,
      public_url: item.public_url || "",
      tags: item.tags.join(", "),
      cpu_pct: item.cpu_pct,
    });
  };

  const saveApplication = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        tags: draft.tags.split(",").map((item) => item.trim()).filter(Boolean),
        last_deploy: new Date().toISOString(),
      };
      if (editing) {
        await applicationsApi.update(editing.id, payload);
      } else {
        await applicationsApi.create(payload);
      }
      showNotification({
        type: "success",
        message: editing ? "Application updated" : "Application created",
      });
      startCreate();
      await loadApplications();
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save application",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteApplication = async (item: ApplicationItem) => {
    try {
      await applicationsApi.remove(item.id);
      setItems((current) => current.filter((app) => app.id !== item.id));
      showNotification({
        type: "success",
        message: "Application deleted",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete application",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <LayoutGrid className="h-6 w-6 text-indigo-500" />
            Applications
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Real application inventory with persisted runtime metadata and tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadApplications()} isLoading={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4 text-zinc-400" />
            Refresh
          </Button>
          <Button variant="primary" onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Applications", value: items.length, icon: Box, color: "indigo" },
          { label: "Healthy", value: healthyCount, icon: CheckCircle2, color: "emerald" },
          { label: "Incidents", value: degradedCount, icon: AlertTriangle, color: "amber" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className={cn("rounded-lg p-2.5", stat.color === "indigo" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" : stat.color === "emerald" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400")}>
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800/80 dark:bg-[#121212] md:flex-row md:justify-between">
            <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
              {(["all", "active", "incidents"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all",
                    activeTab === tab
                      ? "border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-700",
                  )}
                >
                  {tab === "all" ? "All Apps" : tab === "active" ? "Active" : "Incidents"}
                </button>
              ))}
            </div>
            <div className="w-full md:w-72">
              <Input placeholder="Filter applications..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4 text-zinc-400" />} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Application</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Resources</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Health & SLIs</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">CPU Usage</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Last Deploy</th>
                  <th className="px-6 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-sm text-zinc-500">Loading applications...</td></tr>
                ) : filteredApps.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-sm text-zinc-500">No applications found.</td></tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} className="group cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                            <Box size={16} className="text-zinc-400 group-hover:text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{app.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-zinc-400">{app.platform}</span>
                              <span className="text-zinc-300">·</span>
                              <Badge variant="outline" className="border-0 bg-indigo-50 px-1.5 py-0 text-[9px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">{app.environment}</Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs">
                          <div><span className="text-zinc-400">Services:</span> <span className="font-semibold text-zinc-900 dark:text-zinc-100">{app.services}</span></div>
                          <div><span className="text-zinc-400">Pods:</span> <span className="font-semibold text-zinc-900 dark:text-zinc-100">{app.instances}</span></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("h-1.5 w-1.5 rounded-full", app.status === "Healthy" ? "bg-emerald-500" : "bg-amber-500")} />
                            <span className={cn("text-xs font-semibold", app.status === "Healthy" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{app.status}</span>
                          </div>
                          <div className="text-xs text-zinc-400">Uptime: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{app.uptime}</span></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-28 space-y-1.5">
                          <div className="flex justify-between text-[10px] font-medium text-zinc-400">
                            <span>{app.cpu}</span>
                            <span>{app.cpu_pct}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className={cn("h-full rounded-full", app.cpu_pct > 80 ? "bg-amber-500" : "bg-indigo-500")} style={{ width: `${app.cpu_pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Clock size={11} />{app.last_deploy_at ? new Date(app.last_deploy_at).toLocaleString() : "No deploy data"}</div>
                          <div className="flex flex-wrap gap-1">
                            {app.tags.map((tag) => <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">#{tag}</span>)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                          {app.public_url ? <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-emerald-50 hover:text-emerald-500 dark:hover:bg-emerald-500/10" onClick={() => window.open(app.public_url, "_blank", "noopener,noreferrer")}><ExternalLink size={14} /></Button> : null}
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-500/10" onClick={() => startEdit(app)}><Settings size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" onClick={() => void deleteApplication(app)}><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-xs font-medium text-zinc-400">Showing <span className="font-semibold text-zinc-600 dark:text-zinc-300">{filteredApps.length}</span> of {items.length} applications</p>
            <button className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400">View all <ChevronRight size={12} /></button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{editing ? "Edit Application" : "New Application"}</p>
              <p className="text-sm text-zinc-500">Persist grouped application metadata and tags.</p>
            </div>
            {editing ? <Button variant="ghost" size="icon" onClick={startCreate}><X className="h-4 w-4" /></Button> : null}
          </div>
          <div className="space-y-3">
            <Input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Application name" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={draft.platform} onChange={(e) => setDraft((current) => ({ ...current, platform: e.target.value }))} placeholder="Platform" />
              <Input value={draft.environment} onChange={(e) => setDraft((current) => ({ ...current, environment: e.target.value }))} placeholder="Environment" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={draft.status} onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value }))} placeholder="Status" />
              <Input value={draft.uptime} onChange={(e) => setDraft((current) => ({ ...current, uptime: e.target.value }))} placeholder="Uptime" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" value={String(draft.services)} onChange={(e) => setDraft((current) => ({ ...current, services: Number(e.target.value || 0) }))} placeholder="Services" />
              <Input type="number" value={String(draft.instances)} onChange={(e) => setDraft((current) => ({ ...current, instances: Number(e.target.value || 0) }))} placeholder="Instances" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input value={draft.cpu} onChange={(e) => setDraft((current) => ({ ...current, cpu: e.target.value }))} placeholder="CPU" />
              <Input value={draft.ram} onChange={(e) => setDraft((current) => ({ ...current, ram: e.target.value }))} placeholder="RAM" />
            </div>
            <Input value={draft.public_url} onChange={(e) => setDraft((current) => ({ ...current, public_url: e.target.value }))} placeholder="Public URL" />
            <Input value={draft.tags} onChange={(e) => setDraft((current) => ({ ...current, tags: e.target.value }))} placeholder="Tags, comma separated" />
            <Input type="number" value={String(draft.cpu_pct)} onChange={(e) => setDraft((current) => ({ ...current, cpu_pct: Number(e.target.value || 0) }))} placeholder="CPU %" />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => void saveApplication()} isLoading={isSaving}>{editing ? "Save Application" : "Create Application"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
