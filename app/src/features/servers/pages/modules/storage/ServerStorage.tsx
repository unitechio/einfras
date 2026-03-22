import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, File, Folder, HardDrive, RefreshCw, Settings } from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { disksApi, filesystemApi, type DiskDTO, type TypedControlResult } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";

type FileEntry = {
  name: string;
  path?: string;
  type?: string;
  size?: number;
  mode?: string;
};

export default function ServerStorage() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [disks, setDisks] = useState<DiskDTO[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/etc");
  const [pathInput, setPathInput] = useState("/etc");
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [chmodTarget, setChmodTarget] = useState<FileEntry | null>(null);
  const [chmodMode, setChmodMode] = useState("644");
  const inFlightKey = useRef<string | null>(null);

  const loadStorage = async () => {
    if (!serverId) return;
    const requestKey = `${serverId}:${currentPath}`;
    if (inFlightKey.current === requestKey) {
      return;
    }
    inFlightKey.current = requestKey;
    setLoading(true);
    try {
      const [diskItems, listResponse] = await Promise.all([
        disksApi.list(serverId),
        filesystemApi.list(serverId, { path: currentPath, depth: 1 }),
      ]);

      const result = (listResponse.result ?? null) as TypedControlResult<FileEntry[]> | null;
      setDisks(diskItems);
      setFiles(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load storage",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      if (inFlightKey.current === requestKey) {
        inFlightKey.current = null;
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStorage();
  }, [serverId, currentPath]);

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  const diskCards = useMemo(() => {
    return disks.map((disk) => {
      const total = disk.total_bytes ?? 0;
      const used = disk.used_bytes ?? 0;
      const percent = total > 0 ? Math.round((used / total) * 100) : 0;
      return {
        ...disk,
        percent,
      };
    });
  }, [disks]);

  const handleRead = async (path: string) => {
    if (!serverId) return;
    try {
      const response = await filesystemApi.read(serverId, { path, lines: 400 });
      const result = (response.result ?? null) as TypedControlResult | null;
      setSelectedFile({
        path,
        content: result?.preview ?? result?.summary ?? "No readable preview returned.",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to read file",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const handleChmod = async () => {
    if (!serverId || !chmodTarget) return;
    try {
      await filesystemApi.chmod(serverId, { path: chmodTarget.path ?? chmodTarget.name, mode: chmodMode });
      showNotification({
        type: "success",
        message: "Permissions updated",
        description: `${chmodTarget.name} chmod ${chmodMode} dispatched successfully.`,
      });
      setChmodTarget(null);
    } catch (error) {
      showNotification({
        type: "error",
        message: "chmod failed",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const refreshDisks = async () => {
    if (!serverId) return;
    try {
      await disksApi.refresh(serverId);
      showNotification({
        type: "info",
        message: "Disk refresh queued",
        description: "Backend is refreshing the latest storage inventory.",
      });
      await loadStorage();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Disk refresh failed",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const openPath = async () => {
    const nextPath = pathInput.trim() || "/etc";
    if (nextPath === currentPath) {
      await loadStorage();
      return;
    }
    setCurrentPath(nextPath);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-orange-100/50 bg-orange-50 p-2 dark:border-orange-500/20 dark:bg-orange-500/10">
              <HardDrive className="text-orange-500" size={20} />
            </div>
            Disk Usage
          </h2>
          <Button variant="outline" onClick={() => void refreshDisks()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh disks
          </Button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading storage details...</div>
        ) : diskCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200/70 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800/70 dark:bg-[#171717] dark:text-zinc-400">
            No disk inventory yet. Try <span className="font-semibold">Refresh disks</span> after the node has sent a fresh storage snapshot.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {diskCards.map((disk) => (
              <div
                key={disk.id}
                className="rounded-xl border border-zinc-200/60 bg-white p-6 shadow-sm transition-colors hover:border-blue-500/50 dark:border-zinc-800/60 dark:bg-[#121212] dark:hover:border-blue-500/50"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="rounded-xl border border-orange-100/50 bg-orange-50 p-3 text-orange-600 dark:border-orange-900/30 dark:bg-orange-900/20 dark:text-orange-400">
                    <HardDrive size={22} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white">{disk.mount_point || disk.name}</h3>
                    <p className="mt-0.5 font-mono text-[12px] text-zinc-500">{disk.device} <span className="text-zinc-400">({disk.filesystem || disk.type})</span></p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-end justify-between">
                    <span className="text-[13px] font-medium text-zinc-500">
                      Used: <strong className="text-zinc-700 dark:text-zinc-300">{formatBytes(disk.used_bytes ?? 0)}</strong> / {formatBytes(disk.total_bytes ?? 0)}
                    </span>
                    <span className="text-[14px] font-bold text-zinc-900 dark:text-white">{disk.percent}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full border border-zinc-200/50 bg-zinc-100 shadow-inner dark:border-zinc-800/50 dark:bg-[#1A1A1A]">
                    <div className={`h-full rounded-[4px] transition-all duration-1000 ${disk.percent > 90 ? "bg-red-500" : disk.percent > 70 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${disk.percent}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              <div className="rounded-lg border border-blue-100/50 bg-blue-50 p-2 dark:border-blue-500/20 dark:bg-blue-500/10">
                <Folder className="text-blue-500" size={20} />
              </div>
              File Browser
            </h2>
            <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
              Backed by the real filesystem list/read/chmod APIs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input value={pathInput} onChange={(event) => setPathInput(event.target.value)} className="min-w-[260px]" />
            <Button variant="outline" onClick={() => void openPath()} disabled={loading}>
              <RefreshCw size={16} className="mr-2" />
              Open
            </Button>
          </div>
        </div>

        {selectedFile && (
          <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedFile.path}</h3>
              <Button variant="ghost" onClick={() => setSelectedFile(null)}>Close</Button>
            </div>
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
              {selectedFile.content}
            </pre>
          </div>
        )}

        {chmodTarget && (
          <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Change Permissions</h3>
              <Button variant="ghost" onClick={() => setChmodTarget(null)}>Cancel</Button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{chmodTarget.path ?? chmodTarget.name}</div>
                <div className="text-xs text-zinc-500">Enter a numeric chmod value such as `644` or `755`.</div>
              </div>
              <Input value={chmodMode} onChange={(event) => setChmodMode(event.target.value)} className="w-[120px]" />
              <Button variant="primary" onClick={() => void handleChmod()}>
                Apply chmod
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all dark:border-zinc-800/60 dark:bg-[#121212]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading directory listing...</TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-[13px] font-medium text-zinc-500">No files returned for this path.</TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow key={file.path ?? file.name} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${file.type === "dir" ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                          {file.type === "dir" ? <Folder size={18} className="fill-blue-500/20" /> : <File size={18} />}
                        </div>
                        <span className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100">{file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] font-medium text-zinc-500">{file.type || "-"}</TableCell>
                    <TableCell className="font-mono text-[12px] text-zinc-500">{typeof file.size === "number" ? formatBytes(file.size) : "-"}</TableCell>
                    <TableCell className="font-mono text-[12px] text-zinc-500">{file.path ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {file.type !== "dir" ? (
                          <Button variant="ghost" size="icon" onClick={() => void handleRead(file.path ?? file.name)} title="Read file">
                            <Eye size={14} />
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" onClick={() => setChmodTarget(file)} title="Permissions">
                          <Settings size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
