import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Package, RefreshCw, Sparkles } from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { packagesApi, serversApi, terminalApi, type PackageListEntry, type TypedControlResult } from "@/shared/api/client";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";

type PackageRow = PackageListEntry;

export default function ServerPackages() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOS, setServerOS] = useState("linux");
  const [packageName, setPackageName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<"install" | "remove" | "update" | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [packageSuggestions, setPackageSuggestions] = useState<string[]>([]);

  const loadPackages = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const server = await serversApi.get(serverId);
      setServerOS(server.os);
      if (server.os !== "linux") {
        setPackages([]);
        return;
      }

      const response = await packagesApi.list(serverId);
      const commandStatus = String((response.command as { status?: string } | undefined)?.status ?? "").toUpperCase();
      if (commandStatus && commandStatus !== "SUCCESS") {
        const fallback = await terminalApi.exec(serverId, {
          command: "dpkg-query -W -f='${Package}\\t${Version}\\t${Architecture}\\n'",
          timeout_sec: 25,
        });
        const output = String(fallback.raw_output ?? "");
        const fallbackItems = parsePackagesOutput(output);
        if (fallbackItems.length === 0) {
          throw new Error(String(response.raw_output ?? "Package inventory command failed."));
        }
        setPackages(fallbackItems);
        return;
      }
      const result = (response.result ?? null) as TypedControlResult<PackageRow[]> | null;
      const items = Array.isArray(result?.data) ? result.data : [];
      if (items.length === 0 && response.raw_output && !String(response.raw_output).includes("package inventory loaded")) {
        const fallback = await terminalApi.exec(serverId, {
          command: "dpkg-query -W -f='${Package}\\t${Version}\\t${Architecture}\\n'",
          timeout_sec: 25,
        });
        const output = String(fallback.raw_output ?? "");
        const fallbackItems = parsePackagesOutput(output);
        if (fallbackItems.length === 0) {
          throw new Error(String(response.raw_output));
        }
        setPackages(fallbackItems);
        return;
      }
      setPackages(items);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load packages",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPackages();
  }, [serverId]);

  const runPackageAction = async (action: "install" | "remove" | "update") => {
    if (!serverId || !packageName.trim()) return;
    setActionLoading(action);
    try {
      await packagesApi.action(serverId, {
        action,
        package_name: packageName.trim(),
      });
      showNotification({
        type: "success",
        message: `Package ${action} dispatched`,
        description: `${packageName.trim()} has been sent to the backend package action flow.`,
      });
      setSearchQuery(packageName.trim());
      await loadPackages();
    } catch (error) {
      showNotification({
        type: "error",
        message: `Package ${action} failed`,
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isBusy = loading || actionLoading !== null;
  const filteredPackages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return packages;
    }
    return packages.filter((pkg) =>
      [pkg.name, pkg.version, pkg.arch].some((value) => String(value ?? "").toLowerCase().includes(query)),
    );
  }, [packages, searchQuery]);

  const installedSuggestions = useMemo(() => {
    const query = packageName.trim().toLowerCase();
    if (!query) {
      return [];
    }
    const seen = new Set<string>();
    return packages
      .map((pkg) => pkg.name)
      .filter((name) => name.toLowerCase().includes(query))
      .filter((name) => {
        if (seen.has(name)) {
          return false;
        }
        seen.add(name);
        return true;
      })
      .slice(0, 6);
  }, [packageName, packages]);

  useEffect(() => {
    let cancelled = false;

    const loadSuggestions = async () => {
      if (!serverId || serverOS !== "linux") {
        setPackageSuggestions([]);
        return;
      }
      const query = packageName.trim();
      if (query.length < 2) {
        setPackageSuggestions([]);
        return;
      }

      setSuggestionsLoading(true);
      try {
        const escaped = query.replace(/'/g, "'\"'\"'");
        const lookup = await terminalApi.exec(serverId, {
          command: `sh -lc \"if command -v apt-cache >/dev/null 2>&1; then apt-cache search --names-only '${escaped}' | head -n 10; elif command -v dnf >/dev/null 2>&1; then dnf search '${escaped}' | head -n 10; elif command -v yum >/dev/null 2>&1; then yum search '${escaped}' | head -n 10; fi\"`,
          timeout_sec: 20,
        });
        if (cancelled) {
          return;
        }
        const remote = parsePackageSuggestions(String(lookup.raw_output ?? ""));
        const merged = Array.from(new Set([...installedSuggestions, ...remote])).slice(0, 10);
        setPackageSuggestions(merged);
      } catch {
        if (!cancelled) {
          setPackageSuggestions(installedSuggestions);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    };

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [serverId, serverOS, packageName, installedSuggestions]);

  const visibleSuggestions = packageName.trim().length >= 2 ? packageSuggestions : installedSuggestions;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Installed Packages</h2>
          <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
          Inventory and package actions both go through the typed backend command path.
          </p>
        </div>
        <Button variant="primary" onClick={() => void loadPackages()} className="shadow-sm" disabled={isBusy}>
          <RefreshCw size={16} className={loading ? "mr-2 animate-spin" : "mr-2"} />
          Refresh Packages
        </Button>
      </div>

      {serverOS !== "linux" ? (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
          Package inventory is currently implemented with the Linux package query path. This node is `{serverOS}`.
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="w-full md:max-w-[320px]">
            <Input value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="nginx" className="w-full" disabled={isBusy} />
            {packageName.trim().length >= 2 ? (
              <div className="mt-2 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-2 dark:border-zinc-800/70 dark:bg-zinc-900/40">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Sparkles size={12} />
                  Package suggestions
                  {suggestionsLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                </div>
                {visibleSuggestions.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Chưa có gợi ý phù hợp. Bạn vẫn có thể nhập tên package thủ công để cài.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {visibleSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setPackageName(suggestion)}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-blue-500/50 dark:hover:text-blue-300"
                      >
                        <Check size={12} />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search installed packages..." className="md:max-w-[280px]" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runPackageAction("install")} disabled={!packageName.trim() || isBusy}>
              {actionLoading === "install" ? <RefreshCw size={14} className="mr-2 animate-spin" /> : null}
              {actionLoading === "install" ? "Installing..." : "Install"}
            </Button>
            <Button variant="outline" onClick={() => void runPackageAction("update")} disabled={!packageName.trim() || isBusy}>
              {actionLoading === "update" ? <RefreshCw size={14} className="mr-2 animate-spin" /> : null}
              {actionLoading === "update" ? "Updating..." : "Update"}
            </Button>
            <Button variant="danger" onClick={() => void runPackageAction("remove")} disabled={!packageName.trim() || isBusy}>
              {actionLoading === "remove" ? <RefreshCw size={14} className="mr-2 animate-spin" /> : null}
              {actionLoading === "remove" ? "Removing..." : "Remove"}
            </Button>
          </div>
        </div>
        {actionLoading ? (
          <div className="mt-4 rounded-xl border border-blue-200/60 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/10 dark:text-blue-300">
            <div className="flex items-center gap-2 font-medium">
              <RefreshCw size={14} className="animate-spin" />
              {actionLoading === "install" ? "Installing package" : actionLoading === "update" ? "Updating package" : "Removing package"}
            </div>
            <div className="mt-1 text-xs opacity-80">
              Waiting for the agent command to finish for <span className="font-semibold">{packageName.trim()}</span>.
            </div>
          </div>
        ) : null}
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Refresh sẽ đồng bộ lại toàn bộ inventory package hiện có trên node, bao gồm cả package vừa cài xong.
        </div>
        {searchQuery.trim() ? (
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Showing {filteredPackages.length} / {packages.length} packages for "<span className="font-medium">{searchQuery.trim()}</span>".
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all dark:border-zinc-800/60 dark:bg-[#121212]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Architecture</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
                  Loading packages...
                </TableCell>
              </TableRow>
            ) : filteredPackages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500">
                  {packages.length === 0 ? "No packages available." : "No packages match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPackages.map((pkg) => (
                <TableRow key={`${pkg.name}-${pkg.version}`} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800/50">
                        <Package size={16} />
                      </div>
                      <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{pkg.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[200px] font-mono text-[13px] text-zinc-600 dark:text-zinc-400">{pkg.version}</TableCell>
                  <TableCell className="w-[150px] text-[13px] font-medium text-zinc-500">{pkg.arch}</TableCell>
                  <TableCell className="w-[150px]"><Badge variant="success">Installed</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function parsePackagesOutput(output: string): PackageRow[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, version, arch] = line.split("\t");
      return {
        name: name ?? "",
        version: version ?? "",
        arch: arch ?? "-",
      };
    })
    .filter((item) => item.name.length > 0);
}

function parsePackageSuggestions(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+-\s+|\s+/)[0] ?? "")
    .filter((value) => value.length > 0 && !value.includes(":") && !value.startsWith("Listing") && !value.startsWith("Installed"))
    .slice(0, 10);
}
