"use client";

import {
  Activity,
  Box,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  Download,
  Globe,
  Layers,
  Link2,
  Monitor,
  RefreshCw,
  Search,
  Server,
  Unlink2,
} from "lucide-react";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useEnvironment } from "@/core/EnvironmentContext";
import type { Environment } from "@/core/EnvironmentContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { useEnvironmentInventory } from "../api/useEnvironmentInventory";
import { useImportKubeconfig } from "../api/useKubernetesHooks";
import { useNotification } from "@/core/NotificationContext";

export default function EnvironmentsPage() {
  const { data: environments = [], isLoading, refetch, isFetching } = useEnvironmentInventory();
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironment();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "docker" | "kubernetes">("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importKubeconfig = useImportKubeconfig();
  const { showNotification } = useNotification();

  const filteredEnvironments = useMemo(() => {
    return environments.filter((env) => {
      const matchesPlatform = platformFilter === "all" || env.type === platformFilter;
      if (!matchesPlatform) {
        return false;
      }
      const needle = search.trim().toLowerCase();
      if (!needle) {
        return true;
      }
      return [
        env.name,
        env.url,
        env.os,
        env.arch,
        env.type,
        env.selfHost ? "self-host" : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [environments, platformFilter, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Box className="h-6 w-6 text-blue-500" />
            Environments
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Discovered Docker and Kubernetes runtimes, including the current self-host control plane.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            disabled={importKubeconfig.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {importKubeconfig.isPending ? "Importing..." : "Import Kubeconfig"}
          </Button>
          <Button variant="outline" size="md" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.conf,.config"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          try {
            const items = await importKubeconfig.mutateAsync({ file, name: file.name.replace(/\.[^.]+$/, "") });
            showNotification({
              type: "success",
              message: "Kubeconfig imported",
              description: `Imported ${items.length} Kubernetes context${items.length === 1 ? "" : "s"} from ${file.name}.`,
            });
          } catch (error) {
            showNotification({
              type: "error",
              message: "Kubeconfig import failed",
              description: error instanceof Error ? error.message : "Unable to import kubeconfig.",
            });
          } finally {
            event.target.value = "";
          }
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:max-w-md">
          <Input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by node, platform, OS, endpoint..."
            icon={<Search className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />}
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <FilterSelect
            label={platformFilter === "all" ? "Platform" : platformFilter}
            value={platformFilter}
            onChange={(value) => setPlatformFilter(value as "all" | "docker" | "kubernetes")}
            options={[
              { value: "all", label: "All" },
              { value: "docker", label: "Docker" },
              { value: "kubernetes", label: "Kubernetes" },
            ]}
          />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
            setSearch("");
            setPlatformFilter("all");
          }}>
            Clear all
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="p-5">
              <div className="space-y-3">
                <div className="h-5 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </Card>
          ))
        ) : filteredEnvironments.length === 0 ? (
          <Card className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No detected Docker or Kubernetes environments matched the current filters.
          </Card>
        ) : (
          filteredEnvironments.map((env) => (
            <EnvironmentCard
              key={env.id}
              env={env}
              isSelected={selectedEnvironment?.id === env.id}
              onSelect={() => {
                setSelectedEnvironment(env);
                navigate("/environments");
              }}
              onDisconnect={() => setSelectedEnvironment(null)}
            />
          ))
        )}
      </div>

      {selectedEnvironment ? <EnvironmentDashboardPanel env={selectedEnvironment} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-md border border-zinc-200 bg-white px-3 py-1.5 pr-8 text-[13px] font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-400 dark:hover:bg-zinc-800/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function EnvironmentCard({
  env,
  isSelected,
  onSelect,
  onDisconnect,
}: {
  env: Environment;
  isSelected: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  const isDocker = env.type === "docker";
  const lastSeen = env.lastSeen ? new Date(env.lastSeen).toLocaleString() : "Just now";

  return (
    <Card
      className={cn(
        "group p-5 transition-all duration-300",
        isSelected
          ? "border-blue-500/50 ring-1 ring-blue-500/50 shadow-sm"
          : "hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-300",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
          {isDocker ? (
            <Box className="h-6 w-6 text-blue-500" />
          ) : (
            <Server className="h-6 w-6 text-blue-500" />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {env.name}
            </h3>
            <Badge variant={env.status === "up" ? "success" : "error"} className="uppercase">
              {env.status}
            </Badge>
            <Badge variant="outline" className="uppercase">
              {env.type}
            </Badge>
            {env.selfHost ? <Badge variant="outline">self-host</Badge> : null}
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Activity size={12} />
              <span>Last seen: {lastSeen}</span>
              <span>•</span>
              <span>{env.url}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {isDocker ? (
              <>
                <Stat icon={<Layers size={14} />} label={`${env.stats?.stacks ?? 0} stacks`} />
                <Stat icon={<Box size={14} />} label={`${env.stats?.containers ?? 0} containers`} />
                <Stat icon={<Database size={14} />} label={`${env.stats?.images ?? 0} images`} />
                <Stat icon={<Database size={14} />} label={`${env.stats?.volumes ?? 0} volumes`} />
              </>
            ) : (
              <>
                <Stat icon={<Server size={14} />} label={`${env.stats?.nodes ?? 0} nodes`} />
                <Stat icon={<Layers size={14} />} label={`${env.stats?.readyNodes ?? 0} ready`} />
                <Stat icon={<Database size={14} />} label={`${env.stats?.namespaces ?? 0} namespaces`} />
                <Stat icon={<Box size={14} />} label={`${env.stats?.pods ?? 0} pods`} />
              </>
            )}
            <Stat icon={<Cpu size={14} />} label={`${env.cpuCores ?? 0} CPU`} />
            <Stat icon={<Monitor size={14} />} label={`${Number(env.memoryGB ?? 0).toFixed(1)} GB RAM`} />
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {env.os ? env.os : "unknown OS"}
            {env.arch ? ` • ${env.arch}` : ""}
            {env.serverId ? ` • node ${env.serverId}` : ""}
          </div>
        </div>

        <div className="flex min-w-[140px] flex-col gap-2">
          {isSelected ? (
            <Button
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onDisconnect();
              }}
              className="w-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Unlink2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
              className="w-full"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Connect
            </Button>
          )}
          <div
            className={cn(
              "mt-1 flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
              isSelected
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-400",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isSelected ? "bg-green-500 animate-pulse" : "bg-zinc-400 dark:bg-zinc-600",
              )}
            />
            {isSelected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-600 dark:text-zinc-400">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function EnvironmentDashboardPanel({ env }: { env: Environment }) {
  const navigate = useNavigate();
  const isDocker = env.type === "docker";
  const quickLinks = isDocker
    ? [
        { label: "Open Containers", path: "/containers" },
        { label: "Open Images", path: "/images" },
        { label: "Open Networks", path: "/networks" },
      ]
    : [
        { label: "Open Pods", path: "/pods" },
        { label: "Open Deployments", path: "/deployments" },
        { label: "Open Services", path: "/services" },
      ];

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <Globe size={12} />
            Environment Dashboard
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{env.name}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isDocker
              ? "Live runtime overview for the selected Docker environment."
              : "Live runtime overview for the selected Kubernetes environment."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isDocker ? (
            <>
              <MetricCard label="Containers" value={String(env.stats?.containers ?? 0)} />
              <MetricCard label="Stacks" value={String(env.stats?.stacks ?? 0)} />
              <MetricCard label="Images" value={String(env.stats?.images ?? 0)} />
              <MetricCard label="Volumes" value={String(env.stats?.volumes ?? 0)} />
            </>
          ) : (
            <>
              <MetricCard label="Nodes" value={String(env.stats?.nodes ?? 0)} />
              <MetricCard label="Ready Nodes" value={String(env.stats?.readyNodes ?? 0)} />
              <MetricCard label="Namespaces" value={String(env.stats?.namespaces ?? 0)} />
              <MetricCard label="Pods" value={String(env.stats?.pods ?? 0)} />
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Endpoint" value={env.url} />
            <InfoRow label="Platform" value={env.type} />
            <InfoRow label="OS" value={env.os || "unknown"} />
            <InfoRow label="Architecture" value={env.arch || "unknown"} />
            <InfoRow label="CPU Cores" value={String(env.cpuCores ?? 0)} />
            <InfoRow label="Memory" value={`${Number(env.memoryGB ?? 0).toFixed(1)} GB`} />
          </div>
        </div>

        <div className="space-y-2">
          {quickLinks.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
            >
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}
