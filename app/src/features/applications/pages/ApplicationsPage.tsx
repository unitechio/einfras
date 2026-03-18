"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Search,
  RefreshCw,
  Plus,
  Box,
  Activity,
  Settings,
  Trash2,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";

const mockApplications = [
  {
    id: "app-1",
    name: "EINFRA Dashboard",
    platform: "Kubernetes",
    environment: "Production",
    status: "Healthy",
    uptime: "99.9%",
    services: 12,
    instances: 24,
    cpu: "1.2 Core",
    ram: "2.4 GB",
    lastDeploy: "2 hours ago",
    tags: ["frontend", "core"],
    publicUrl: "https://app.einfra.io",
    cpuPct: 22,
  },
  {
    id: "app-2",
    name: "Auth Service",
    platform: "Docker",
    environment: "Staging",
    status: "Healthy",
    uptime: "98.5%",
    services: 4,
    instances: 6,
    cpu: "0.5 Core",
    ram: "1.1 GB",
    lastDeploy: "1 day ago",
    tags: ["backend", "auth"],
    publicUrl: "https://auth-stg.einfra.io",
    cpuPct: 15,
  },
  {
    id: "app-3",
    name: "PostgreSQL Cluster",
    platform: "Kubernetes",
    environment: "Production",
    status: "Degraded",
    uptime: "94.2%",
    services: 3,
    instances: 3,
    cpu: "4.0 Core",
    ram: "16.0 GB",
    lastDeploy: "5 days ago",
    tags: ["database", "critical"],
    publicUrl: null,
    cpuPct: 85,
  },
];

type FilterTab = "all" | "active" | "incidents";

export default function ApplicationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filteredApps = mockApplications.filter((app) => {
    const matchSearch = app.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeTab === "active") return matchSearch && app.status === "Healthy";
    if (activeTab === "incidents")
      return matchSearch && app.status !== "Healthy";
    return matchSearch;
  });

  const healthyCount = mockApplications.filter(
    (a) => a.status === "Healthy",
  ).length;
  const degradedCount = mockApplications.filter(
    (a) => a.status !== "Healthy",
  ).length;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-indigo-500" />
            Applications
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            High-level application management and service grouping.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <RefreshCw className="h-4 w-4 mr-2 text-zinc-400" />
            Refresh
          </Button>
          <Button variant="primary" size="md">
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Applications",
            value: mockApplications.length,
            icon: Box,
            color: "indigo",
          },
          {
            label: "Healthy",
            value: healthyCount,
            icon: CheckCircle2,
            color: "emerald",
          },
          {
            label: "Incidents",
            value: degradedCount,
            icon: AlertTriangle,
            color: "amber",
          },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex items-center gap-4"
          >
            <div
              className={cn(
                "p-2.5 rounded-lg",
                s.color === "indigo"
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : s.color === "emerald"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
              )}
            >
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {s.label}
              </p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col md:flex-row justify-between gap-3 bg-zinc-50/50 dark:bg-[#121212]">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit">
            {(["all", "active", "incidents"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all",
                  activeTab === tab
                    ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                )}
              >
                {tab === "all"
                  ? "All Apps"
                  : tab === "active"
                    ? "Active"
                    : "Incidents"}
              </button>
            ))}
          </div>
          <div className="w-full md:w-72">
            <Input
              placeholder="Filter applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4 text-zinc-400" />}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Application
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Resources
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Health & SLIs
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  CPU Usage
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Last Deploy
                </th>
                <th className="px-6 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredApps.map((app) => (
                <tr
                  key={app.id}
                  className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                >
                  {/* Application Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-200 dark:border-zinc-700 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 transition-all">
                        <Box
                          size={16}
                          className="text-zinc-400 group-hover:text-indigo-500 transition-colors"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {app.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-zinc-400 font-medium">
                            {app.platform}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">
                            ·
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-semibold px-1.5 py-0 border-0",
                              app.environment === "Production"
                                ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400"
                                : "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
                            )}
                          >
                            {app.environment}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Resources */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <Box size={11} className="text-zinc-400" />
                        <span className="text-zinc-400">Services:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {app.services}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <Activity size={11} className="text-zinc-400" />
                        <span className="text-zinc-400">Pods:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {app.instances}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Health */}
                  <td className="px-6 py-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            app.status === "Healthy"
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-amber-500",
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            app.status === "Healthy"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {app.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>
                          Uptime:{" "}
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            {app.uptime}
                          </span>
                        </span>
                        <span className="text-zinc-200 dark:text-zinc-700">
                          |
                        </span>
                        <span>~22ms</span>
                      </div>
                    </div>
                  </td>

                  {/* CPU Usage bar */}
                  <td className="px-6 py-4">
                    <div className="w-28 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-medium text-zinc-400">
                        <span>{app.cpu}</span>
                        <span>{app.cpuPct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            app.cpuPct > 80 ? "bg-amber-500" : "bg-indigo-500",
                          )}
                          style={{ width: `${app.cpuPct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Last Deploy */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <Clock size={11} />
                        {app.lastDeploy}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {app.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded text-[9px] font-semibold uppercase tracking-wide"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {app.publicUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <ExternalLink size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                      >
                        <Settings size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50/50 dark:bg-zinc-900/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-400 font-medium">
            Showing{" "}
            <span className="text-zinc-600 dark:text-zinc-300 font-semibold">
              {filteredApps.length}
            </span>{" "}
            of {mockApplications.length} applications
          </p>
          <button className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
            View all <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
