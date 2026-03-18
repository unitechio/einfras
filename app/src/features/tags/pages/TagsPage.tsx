"use client";

import { useState } from "react";
import {
  Tag as TagIcon,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Hash,
  Layers,
  Filter,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";

const COLOR_MAP: Record<string, { dot: string; bg: string; text: string }> = {
  emerald: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  indigo: {
    dot: "bg-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  red: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
  purple: {
    dot: "bg-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
  },
  cyan: {
    dot: "bg-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
  },
};

const mockTags = [
  {
    id: "1",
    name: "production",
    count: 12,
    color: "emerald",
    type: "Environment",
  },
  { id: "2", name: "frontend", count: 8, color: "blue", type: "Layer" },
  { id: "3", name: "database", count: 5, color: "amber", type: "Stack" },
  { id: "4", name: "core", count: 14, color: "indigo", type: "Criticality" },
  { id: "5", name: "legacy", count: 3, color: "red", type: "Status" },
  { id: "6", name: "staking", count: 7, color: "purple", type: "Service" },
  { id: "7", name: "backup", count: 4, color: "cyan", type: "Internal" },
];

export default function TagsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { showNotification } = useNotification();

  const filteredTags = mockTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalTagged = mockTags.reduce((acc, t) => acc + t.count, 0);

  const handleDelete = (name: string) => {
    showNotification({
      type: "success",
      message: "Tag deleted",
      description: `Successfully removed #${name} from the global registry.`,
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <TagIcon className="h-6 w-6 text-indigo-500" />
            Resource Tags
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Standardize categorization across clusters, applications, and
            networking layers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <RefreshCw className="h-4 w-4 mr-2 text-zinc-400" />
            Sync Registry
          </Button>
          <Button variant="primary" size="md">
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Active Tags",
            value: mockTags.length,
            unit: "identifiers",
            icon: Hash,
            color: "indigo",
          },
          {
            label: "Resources Tagged",
            value: totalTagged,
            unit: "items",
            icon: Layers,
            color: "emerald",
          },
          {
            label: "Categories",
            value: 5,
            unit: "types",
            icon: Filter,
            color: "blue",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
          >
            <div
              className={cn(
                "p-2.5 rounded-lg",
                stat.color === "indigo"
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : stat.color === "emerald"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
              )}
            >
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {stat.label}
              </p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {stat.value}{" "}
                <span className="text-sm font-medium text-zinc-400">
                  {stat.unit}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col md:flex-row justify-between items-center gap-3 bg-zinc-50/50 dark:bg-[#121212]">
          <div className="relative flex items-center w-full md:w-72 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 gap-2">
            <Search size={13} className="text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-xs text-zinc-700 dark:text-zinc-300 w-full placeholder:text-zinc-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">
                Registry Healthy
              </span>
            </div>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-400 font-medium">
              Showing {filteredTags.length} of {mockTags.length}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Tag Name
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  References
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Coverage
                </th>
                <th className="px-6 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredTags.map((tag) => {
                const c = COLOR_MAP[tag.color] ?? COLOR_MAP.indigo;
                const pct = Math.round((tag.count / 20) * 100);
                return (
                  <tr
                    key={tag.id}
                    className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn("w-2 h-8 rounded-full shrink-0", c.dot)}
                        />
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            <span className="text-zinc-400 font-normal">#</span>
                            {tag.name}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide mt-0.5">
                            ID: INFRA-{tag.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
                          c.bg,
                          c.text,
                        )}
                      >
                        {tag.type}
                      </span>
                    </td>

                    {/* Count */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        {tag.count}
                      </span>
                      <span className="text-xs text-zinc-400 ml-1">items</span>
                    </td>

                    {/* Coverage */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 w-36">
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              pct > 50 ? "bg-emerald-500" : "bg-indigo-500",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-zinc-500 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                        >
                          <Edit2 size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => handleDelete(tag.name)}
                        >
                          <Trash2 size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-600"
                        >
                          <ArrowUpRight size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50/50 dark:bg-zinc-900/20 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Conflict Check:</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              0 issues
            </span>
          </div>
          <span className="text-xs text-zinc-400">
            Metadata Redundancy: 1.2%
          </span>
        </div>
      </div>

      {/* Best Practices CTA */}
      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0 mt-0.5">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Architecture Best Practices
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl">
              Use environment-level tags to trigger automated security scans and
              deployment pipelines across clusters.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="md">
            Standardization Docs
          </Button>
          <Button variant="primary" size="md">
            Audit Policies
          </Button>
        </div>
      </div>
    </div>
  );
}
