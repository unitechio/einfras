import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Globe,
  HardDrive,
  Info,
  Save,
  Server,
  Shield,
} from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { serversApi, type AgentStatusDTO } from "@/shared/api/client";
import { useServerMetrics } from "@/features/servers/api/useServerHooks";

type EditableState = {
  name: string;
  hostname: string;
  description: string;
  environment: string;
  tags: string;
  ssh_user: string;
  ssh_port: string;
};

export default function ServerGeneralSettings() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const { data: metrics } = useServerMetrics(serverId, { refetchInterval: 15_000 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [server, setServer] = useState<any>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusDTO | null>(null);
  const [form, setForm] = useState<EditableState>({
    name: "",
    hostname: "",
    description: "",
    environment: "production",
    tags: "",
    ssh_user: "",
    ssh_port: "22",
  });

  useEffect(() => {
    const loadServer = async () => {
      if (!serverId) return;
      setLoading(true);
      try {
        const [data, liveStatus] = await Promise.all([
          serversApi.get(serverId),
          serversApi.agentStatus(serverId).catch(() => null),
        ]);
        setServer(data);
        setAgentStatus(liveStatus);
        setForm({
          name: data.name ?? "",
          hostname: data.hostname ?? "",
          description: data.description ?? "",
          environment: data.environment ?? "production",
          tags: (data.tags ?? []).join(", "),
          ssh_user: data.ssh_user ?? "",
          ssh_port: String(data.ssh_port ?? 22),
        });
      } finally {
        setLoading(false);
      }
    };

    void loadServer();
  }, [serverId]);

  const handleSave = async () => {
    if (!serverId) return;
    setSaving(true);
    try {
      const updated = await serversApi.update(serverId, {
        name: form.name.trim(),
        hostname: form.hostname.trim(),
        description: form.description.trim(),
        environment: form.environment,
        ssh_user: form.ssh_user.trim(),
        ssh_port: Number.parseInt(form.ssh_port, 10) || 22,
        tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setServer(updated);
      showNotification({
        type: "success",
        message: "Server updated",
        description: `${updated.name} settings have been saved.`,
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Update failed",
        description: error instanceof Error ? error.message : "Unable to save server settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const hardware = {
    cpuCores: agentStatus?.cpu_cores ?? server?.cpu_cores ?? 0,
    memoryGB: agentStatus?.memory_gb ?? server?.memory_gb ?? 0,
    diskGB: agentStatus?.disk_gb ?? server?.disk_gb ?? 0,
    agentVersion: agentStatus?.version || server?.agent_version || "pending",
    onboarding: agentStatus?.online ? "completed" : server?.onboarding_status || "pending",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm">Loading server details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100/50 bg-blue-50/50 text-blue-600 shadow-inner dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400">
              <Server size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {server?.hostname ?? server?.name}
                <span className="flex items-center gap-1.5 rounded-md border border-emerald-200/50 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {server?.status ?? "unknown"}
                </span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] font-medium text-zinc-500">
                <div className="flex items-center gap-1.5 rounded-md border border-zinc-200/50 bg-zinc-50 px-2 py-0.5 dark:border-zinc-700/50 dark:bg-zinc-800/50">
                  <Globe size={14} className="text-zinc-400" />
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{server?.ip_address}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-zinc-200/50 bg-zinc-50 px-2 py-0.5 dark:border-zinc-700/50 dark:bg-zinc-800/50">
                  <Activity size={14} className="text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">{hardware.agentVersion || "agent pending"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right text-[12px] font-medium text-zinc-400">
            <div>Last updated</div>
            <div className="text-zinc-700 dark:text-zinc-300">
              {server?.updated_at ? new Date(server.updated_at).toLocaleString() : "Never"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard icon={Activity} title="CPU Load" value={`${metrics?.cpu_usage?.toFixed?.(1) ?? 0}%`} note="Live usage from backend metrics" tone="emerald" />
        <StatCard icon={Shield} title="OS Info" value={`${server?.os ?? "unknown"} ${server?.os_version ?? ""}`.trim()} note={server?.connection_mode ?? "unknown"} tone="orange" />
        <StatCard icon={Cpu} title="Memory Usage" value={`${metrics?.memory_usage?.toFixed?.(1) ?? 0}%`} note={`${server?.cpu_cores ?? 0} cores available`} tone="purple" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-6 flex items-center gap-2.5 border-b border-zinc-100 pb-4 dark:border-zinc-800/60">
              <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-500/10">
                <Info size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white">General Configuration</h3>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6">
                <LabeledInput label="Display Name">
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </LabeledInput>
                <LabeledInput label="Hostname">
                  <Input value={form.hostname} onChange={(event) => setForm((current) => ({ ...current, hostname: event.target.value }))} className="font-mono text-sm" />
                </LabeledInput>
                <LabeledInput label="Description">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="min-h-[100px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-all placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
                    placeholder="Describe the purpose of this server..."
                  />
                </LabeledInput>
                <div className="grid gap-6 md:grid-cols-2">
                  <LabeledInput label="Environment">
                    <select
                      value={form.environment}
                      onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value }))}
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <option value="production">Production</option>
                      <option value="staging">Staging</option>
                      <option value="development">Development</option>
                    </select>
                  </LabeledInput>
                  <LabeledInput label="Tags">
                    <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="production, database, critical" />
                  </LabeledInput>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <LabeledInput label="SSH User">
                    <Input value={form.ssh_user} onChange={(event) => setForm((current) => ({ ...current, ssh_user: event.target.value }))} />
                  </LabeledInput>
                  <LabeledInput label="SSH Port">
                    <Input value={form.ssh_port} onChange={(event) => setForm((current) => ({ ...current, ssh_port: event.target.value }))} />
                  </LabeledInput>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end border-t border-zinc-100 pt-5 dark:border-zinc-800/60">
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving} className="shadow-sm">
                {saving ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <Save size={16} className="mr-2" />}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-6 flex items-center gap-2.5 border-b border-zinc-100 pb-4 dark:border-zinc-800/60">
              <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-500/10">
                <HardDrive size={18} className="text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-[16px] font-bold tracking-tight text-zinc-900 dark:text-white">Hardware Snapshot</h3>
            </div>

            <div className="space-y-5">
              <HardwareRow label="CPU Cores" value={formatHardwareValue(hardware.cpuCores, agentStatus?.online, "")} />
              <HardwareRow label="Memory" value={formatHardwareValue(hardware.memoryGB, agentStatus?.online, " GB")} />
              <HardwareRow label="Disk" value={formatHardwareValue(hardware.diskGB, agentStatus?.online, " GB")} />
              <HardwareRow label="Agent Version" value={hardware.agentVersion} />
              <HardwareRow label="Onboarding" value={hardware.onboarding} />
              <div className="rounded-lg border border-emerald-100/60 bg-emerald-50 p-3 text-[12px] font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
                <div className="mb-1 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={13} />
                  Live metrics enabled
                </div>
                Monitoring data is now coming from the real backend metrics API.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  note,
  tone,
}: {
  icon: typeof Activity;
  title: string;
  value: string;
  note: string;
  tone: "emerald" | "orange" | "purple";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    orange: "bg-orange-50 text-orange-600 border-orange-100/50 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
    purple: "bg-purple-50 text-purple-600 border-purple-100/50 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  };

  return (
    <div className="flex items-start gap-4 rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800/60 dark:bg-[#121212] dark:hover:border-zinc-700">
      <div className={`rounded-xl border p-3.5 shadow-inner ${tones[tone]}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">{title}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</div>
        <div className="mt-1.5 text-[12px] font-medium text-zinc-500">{note}</div>
      </div>
    </div>
  );
}

function LabeledInput({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{label}</label>
      {children}
    </div>
  );
}

function HardwareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-50 py-2.5 dark:border-zinc-800/30">
      <span className="text-[13px] font-medium text-zinc-500">{label}</span>
      <span className="rounded-md border border-zinc-200/50 bg-zinc-100 px-2 py-0.5 font-mono text-[12px] font-bold text-zinc-700 dark:border-zinc-800/50 dark:bg-[#1A1A1A] dark:text-zinc-300">
        {value}
      </span>
    </div>
  );
}

function formatHardwareValue(value?: number, online?: boolean, suffix = "") {
  if (typeof value === "number" && value > 0) {
    return `${value}${suffix}`;
  }
  return online ? "syncing" : `pending${suffix ? "" : ""}`;
}
