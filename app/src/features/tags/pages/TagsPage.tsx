"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Edit2,
  Filter,
  Hash,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";
import { tagsApi, type TagItem } from "@/features/catalog/api";

const COLOR_MAP: Record<string, { dot: string; bg: string; text: string }> = {
  emerald: { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  blue: { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  amber: { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  indigo: { dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
  red: { dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  purple: { dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
  cyan: { dot: "bg-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
};

const emptyDraft = { name: "", type: "Environment", color: "indigo", count: 0, description: "" };

export default function TagsPage() {
  const { showNotification } = useNotification();
  const [items, setItems] = useState<TagItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<TagItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const loadTags = async (search?: string) => {
    setIsLoading(true);
    try {
      setItems(await tagsApi.list(search));
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load tags",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTags();
  }, []);

  const filteredTags = useMemo(
    () =>
      items.filter(
        (tag) =>
          tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tag.type.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [items, searchQuery],
  );

  const totalTagged = filteredTags.reduce((acc, tag) => acc + tag.count, 0);
  const categories = new Set(items.map((item) => item.type)).size;

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
  };

  const openEdit = (item: TagItem) => {
    setEditing(item);
    setDraft({
      name: item.name,
      type: item.type,
      color: item.color,
      count: item.count,
      description: item.description || "",
    });
  };

  const saveTag = async () => {
    setIsSaving(true);
    try {
      if (editing) {
        await tagsApi.update(editing.id, draft);
      } else {
        await tagsApi.create(draft);
      }
      showNotification({
        type: "success",
        message: editing ? "Tag updated" : "Tag created",
      });
      openCreate();
      await loadTags(searchQuery);
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save tag",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: TagItem) => {
    try {
      await tagsApi.remove(item.id);
      setItems((current) => current.filter((tag) => tag.id !== item.id));
      showNotification({
        type: "success",
        message: "Tag deleted",
        description: `Removed #${item.name} from the registry.`,
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete tag",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <TagIcon className="h-6 w-6 text-indigo-500" />
            Resource Tags
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Real tag registry with persisted create, edit, delete and coverage counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadTags(searchQuery)} isLoading={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4 text-zinc-400" />
            Sync Registry
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Tag
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Active Tags", value: items.length, unit: "identifiers", icon: Hash, tone: "indigo" },
          { label: "Resources Tagged", value: totalTagged, unit: "items", icon: Layers, tone: "emerald" },
          { label: "Categories", value: categories, unit: "types", icon: Filter, tone: "blue" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className={cn("rounded-lg p-2.5", stat.tone === "indigo" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" : stat.tone === "emerald" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400")}>
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">{stat.label}</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{stat.value} <span className="text-sm font-medium text-zinc-400">{stat.unit}</span></p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex flex-col gap-3 border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800/80 dark:bg-[#121212] md:flex-row md:items-center md:justify-between">
            <div className="relative flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950 md:w-72">
              <Search size={13} className="shrink-0 text-zinc-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search tags..." className="w-full bg-transparent text-xs outline-none" />
            </div>
            <span className="text-xs font-medium text-zinc-400">Showing {filteredTags.length} of {items.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Tag Name</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Category</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">References</th>
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Coverage</th>
                  <th className="px-6 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-sm text-zinc-500">Loading tags...</td></tr>
                ) : filteredTags.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-sm text-zinc-500">No tags found.</td></tr>
                ) : (
                  filteredTags.map((tag) => {
                    const c = COLOR_MAP[tag.color] ?? COLOR_MAP.indigo;
                    const pct = Math.round((tag.count / Math.max(totalTagged || 1, 20)) * 100);
                    return (
                      <tr key={tag.id} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-8 w-2 shrink-0 rounded-full", c.dot)} />
                            <div>
                              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"><span className="font-normal text-zinc-400">#</span>{tag.name}</p>
                              <p className="text-[10px] uppercase tracking-wide text-zinc-400">ID: INFRA-{tag.id.slice(0, 6)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", c.bg, c.text)}>{tag.type}</span></td>
                        <td className="px-6 py-4"><span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{tag.count}</span><span className="ml-1 text-xs text-zinc-400">items</span></td>
                        <td className="px-6 py-4">
                          <div className="flex w-36 items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div className={cn("h-full rounded-full", pct > 50 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-zinc-500">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-500/10" onClick={() => openEdit(tag)}>
                              <Edit2 size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" onClick={() => void handleDelete(tag)}>
                              <Trash2 size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-600">
                              <ArrowUpRight size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{editing ? "Edit Tag" : "Create Tag"}</p>
              <p className="text-sm text-zinc-500">Persist tags for applications and runtime grouping.</p>
            </div>
            {editing ? <Button variant="ghost" size="icon" onClick={openCreate}><X className="h-4 w-4" /></Button> : null}
          </div>
          <div className="space-y-3">
            <Input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Tag name" />
            <Input value={draft.type} onChange={(e) => setDraft((current) => ({ ...current, type: e.target.value }))} placeholder="Category" />
            <Input value={draft.color} onChange={(e) => setDraft((current) => ({ ...current, color: e.target.value }))} placeholder="Color token" />
            <Input type="number" value={String(draft.count)} onChange={(e) => setDraft((current) => ({ ...current, count: Number(e.target.value || 0) }))} placeholder="Reference count" />
            <Input value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} placeholder="Description" />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => void saveTag()} isLoading={isSaving}>{editing ? "Save Tag" : "Create Tag"}</Button>
          </div>
          <div className="mt-8 flex items-start gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><Sparkles size={16} /></div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Architecture Best Practices</p>
              <p className="mt-0.5 text-sm text-zinc-500">Use environment and service tags to drive deploy policy, notification routing and audit filters.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
