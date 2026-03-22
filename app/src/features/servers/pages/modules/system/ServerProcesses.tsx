import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, RefreshCw, Search, XCircle } from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { processApi, serversApi, terminalApi } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";

type ProcessRow = {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
};

export default function ServerProcesses() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [serverOS, setServerOS] = useState<string>("linux");
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [search, setSearch] = useState("");

  const loadProcesses = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const server = await serversApi.get(serverId);
      setServerOS(server.os);
      if (server.os !== "linux") {
        setProcesses([]);
        return;
      }

      const response = await terminalApi.exec(serverId, {
        command: "ps -eo pid,user,pcpu,pmem,command --sort=-pcpu | head -n 251",
        timeout_sec: 20,
      });
      const output = String(response.raw_output ?? "");
      setProcesses(parsePsOutput(output));
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load processes",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = processes.filter((proc) => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return true;
    return (
      String(proc.pid).includes(normalized) ||
      proc.user.toLowerCase().includes(normalized) ||
      proc.command.toLowerCase().includes(normalized)
    );
  });

  useEffect(() => {
    void loadProcesses();
  }, [serverId]);

  const handleKill = async (pid: number) => {
    if (!serverId) return;
    try {
      await processApi.signal(serverId, { pid, signal: "TERM" });
      showNotification({
        type: "success",
        message: "Signal sent",
        description: `TERM dispatched to PID ${pid}.`,
      });
      await loadProcesses();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to stop process",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-purple-100/50 bg-purple-50 p-2 dark:border-purple-500/20 dark:bg-purple-500/10">
              <Activity className="text-purple-500" size={20} />
            </div>
            Process Management
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Real process snapshot via terminal exec. Signal action is wired to the typed process API.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadProcesses()} className="flex items-center gap-2" disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Snapshot
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by PID, user, command, or port text..."
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
        <div className="text-xs font-medium text-zinc-500">
          {filteredProcesses.length} / {processes.length} process{processes.length === 1 ? "" : "es"}
        </div>
      </div>

      {serverOS !== "linux" ? (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
          Process inventory currently uses the Linux `ps` path. This server is `{serverOS}`, so only signal actions are available from API today.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all dark:border-zinc-800/60 dark:bg-[#121212]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Command</TableHead>
              <TableHead>CPU %</TableHead>
              <TableHead>MEM %</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, index) => (
                <TableRow key={index}>
                  <TableCell><div className="h-4 w-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-20 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-10 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-10 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                  <TableCell><div className="ml-auto h-6 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /></TableCell>
                </TableRow>
              ))
            ) : filteredProcesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <Activity size={32} className="mb-3 opacity-20" />
                    <p className="text-[13px] font-medium">{processes.length === 0 ? "No processes found." : "No process matches your search."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProcesses.map((proc) => (
                <TableRow key={proc.pid} className="group">
                  <TableCell className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400">{proc.pid}</TableCell>
                  <TableCell className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{proc.user}</TableCell>
                  <TableCell className="text-[12px] font-mono text-zinc-600 dark:text-zinc-300">
                    <div className="max-w-xs truncate" title={proc.command}>{proc.command}</div>
                  </TableCell>
                  <TableCell><UsageText value={proc.cpu} /></TableCell>
                  <TableCell><UsageText value={proc.mem} /></TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-red-500 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={() => void handleKill(proc.pid)}
                    >
                      <XCircle size={14} className="mr-1.5" /> Kill
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UsageText({ value }: { value: number }) {
  const tone =
    value > 80 ? "text-red-500 dark:text-red-400" : value > 50 ? "text-amber-500 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-300";
  return <span className={`text-[13px] font-bold ${tone}`}>{value}%</span>;
}

function parsePsOutput(output: string): ProcessRow[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/, 5);
      return {
        pid: Number.parseInt(parts[0] ?? "0", 10),
        user: parts[1] ?? "-",
        cpu: Number.parseFloat(parts[2] ?? "0"),
        mem: Number.parseFloat(parts[3] ?? "0"),
        command: parts[4] ?? "",
      };
    })
    .filter((item) => Number.isFinite(item.pid) && item.pid > 0);
}
