"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Save, Search, Sparkles } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { settingsApi, type RuntimeFeatureFlag } from "@/features/settings/api";

export default function FeatureFlagsSettingsPage() {
  const { showNotification } = useNotification();
  const [flags, setFlags] = useState<RuntimeFeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    void loadFlags();
  }, []);

  const loadFlags = async () => {
    setIsLoading(true);
    try {
      setFlags(await settingsApi.listFeatureFlags());
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load feature flags",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const groupedFlags = useMemo(() => {
    return flags.reduce<Record<string, RuntimeFeatureFlag[]>>((acc, item) => {
      const key = item.category || "general";
      acc[key] = [...(acc[key] ?? []), item];
      return acc;
    }, {});
  }, [flags]);

  const categories = useMemo(
    () => ["all", ...Object.keys(groupedFlags).sort((left, right) => left.localeCompare(right))],
    [groupedFlags],
  );

  const filteredFlags = useMemo(() => {
    return flags.filter((item) => {
      const matchesSearch = !search.trim()
        || `${item.key} ${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, flags, search]);

  const groupedFilteredFlags = useMemo(() => {
    return filteredFlags.reduce<Record<string, RuntimeFeatureFlag[]>>((acc, item) => {
      const key = item.category || "general";
      acc[key] = [...(acc[key] ?? []), item];
      return acc;
    }, {});
  }, [filteredFlags]);

  const saveFlags = async () => {
    setIsSaving(true);
    try {
      await settingsApi.saveFeatureFlags(
        flags.map((flag) => ({
          key: flag.key,
          name: flag.name,
          category: flag.category,
          description: flag.description,
          enabled: flag.enabled,
          metadata: flag.metadata,
        })),
      );
      showNotification({
        type: "success",
        message: "Feature flags saved",
        description: "Runtime gates and settings screens now use the latest persisted state.",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save feature flags",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = (targetCategory: string, enabled: boolean) => {
    setFlags((current) =>
      current.map((item) =>
        item.category === targetCategory ? { ...item, enabled } : item,
      ),
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            Feature Flags
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Control runtime capabilities by category, search across flags, and save a cleaner feature posture.
          </p>
        </div>
        <Button variant="primary" onClick={() => void saveFlags()} isLoading={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Save Feature Flags
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="text-xs font-medium text-zinc-500">Total Flags</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{flags.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="text-xs font-medium text-zinc-500">Enabled</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{flags.filter((item) => item.enabled).length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="text-xs font-medium text-zinc-500">Categories</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{Object.keys(groupedFlags).length}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212] lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key, name or description"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-500">
          Loading feature flags...
        </div>
      ) : null}

      <div className="space-y-5">
        {Object.entries(groupedFilteredFlags)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([group, items]) => (
            <section key={group} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold capitalize">{group}</h2>
                  <p className="text-sm text-zinc-500">{items.length} flags in this capability group.</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{items.filter((item) => item.enabled).length} enabled</Badge>
                  <Button variant="outline" size="sm" onClick={() => toggleCategory(group, true)}>Enable All</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleCategory(group, false)}>Disable All</Button>
                </div>
              </div>
              <div className="space-y-3">
                {items.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-4 dark:border-zinc-800">
                    <div className="pr-4">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{flag.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">{flag.key}</div>
                      <div className="mt-2 text-sm text-zinc-500">{flag.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFlags((current) =>
                          current.map((item) => item.id === flag.id ? { ...item, enabled: !item.enabled } : item),
                        )
                      }
                      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${flag.enabled ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
                    >
                      <span className={`mt-1 block h-4 w-4 rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
