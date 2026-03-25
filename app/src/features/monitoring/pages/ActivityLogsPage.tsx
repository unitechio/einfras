"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Download,
  Globe,
  Info,
  Search,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import {
  monitoringAuditApi,
  type IAMAuditLogRecord,
} from "../api/auditLogs";

const JsonTree = ({ data, level = 0 }: { data: unknown; level?: number }) => {
  if (typeof data !== "object" || data === null) {
    return (
      <span
        className={cn(
          "text-xs font-mono",
          typeof data === "string"
            ? "text-emerald-500 dark:text-emerald-400"
            : "text-blue-500 dark:text-blue-400",
        )}
      >
        {typeof data === "string" ? `"${data}"` : String(data)}
      </span>
    );
  }
  return (
    <div className={cn("space-y-1", level > 0 && "ml-4 border-l border-zinc-200 pl-4 dark:border-zinc-800")}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex flex-col">
          <div className="flex items-start gap-2">
            <span className="font-mono text-xs text-zinc-500">{key}:</span>
            <JsonTree data={value} level={level + 1} />
          </div>
        </div>
      ))}
    </div>
  );
};

function downloadCSV(items: IAMAuditLogRecord[]) {
  const header = [
    "timestamp",
    "user_email",
    "action",
    "resource",
    "resource_id",
    "environment",
    "status",
    "ip_address",
  ];
  const lines = items.map((item) =>
    [
      item.timestamp,
      item.user_email,
      item.action,
      item.resource,
      item.resource_id,
      item.environment,
      item.status,
      item.ip_address,
    ]
      .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLogsPage() {
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [logs, setLogs] = useState<IAMAuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inspectingLog, setInspectingLog] = useState<IAMAuditLogRecord | null>(null);

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesKeyword =
        !keyword ||
        `${log.user_email} ${log.action} ${log.resource} ${log.ip_address} ${JSON.stringify(log.metadata)}`
          .toLowerCase()
          .includes(keyword);
      const matchesStatus = !statusFilter || log.status === statusFilter;
      const matchesResource = !resourceFilter || log.resource === resourceFilter;
      return matchesKeyword && matchesStatus && matchesResource;
    });
  }, [logs, resourceFilter, searchTerm, statusFilter]);

  const resourceOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.resource).filter(Boolean))).sort(),
    [logs],
  );

  async function loadLogs() {
    setIsLoading(true);
    try {
      setLogs(await monitoringAuditApi.list({ limit: 150 }));
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load audit logs",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Activity className="h-6 w-6 text-blue-500" />
            User Activity Logs
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Review security-sensitive actions recorded by the IAM middleware and permission engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => downloadCSV(filteredLogs)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => void loadLogs()} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="w-full lg:max-w-sm">
          <Input
            icon={<Search className="h-4 w-4 text-zinc-400" />}
            placeholder="Search user, action, resource or metadata"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <select
          value={resourceFilter}
          onChange={(event) => setResourceFilter(event.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
        >
          <option value="">All resources</option>
          {resourceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400">
          <Calendar size={12} className="text-blue-500" />
          Latest 150 records
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400">
          <Info size={12} className="text-blue-500" />
          Includes permission denials and sensitive operations
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Inspect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <Activity size={32} className="mb-3 opacity-20" />
                    <p className="text-[13px] font-medium">No audit logs found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <TableCell>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserIcon size={14} className="text-zinc-400" />
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {log.user_email || log.user_id || "system"}
                        </div>
                        {log.ip_address ? (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                            <Globe size={11} />
                            {log.ip_address}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {log.resource}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {log.resource_id || log.environment || "global"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "success" : "error"}>
                      <Shield className="mr-1 h-3 w-3" />
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectingLog(log)}
                      className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {inspectingLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Inspect Audit Record
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {inspectingLog.action} on {inspectingLog.resource}
                </p>
              </div>
              <button
                onClick={() => setInspectingLog(null)}
                className="rounded-md p-2 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 overflow-auto bg-zinc-50/50 p-6 dark:bg-black/20 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0f0f0f]">
                <div className="text-sm">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">Summary</div>
                  <div className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-300">
                    <div>User: {inspectingLog.user_email || inspectingLog.user_id || "system"}</div>
                    <div>Status: {inspectingLog.status}</div>
                    <div>Resource: {inspectingLog.resource}</div>
                    <div>Resource ID: {inspectingLog.resource_id || "n/a"}</div>
                    <div>Environment: {inspectingLog.environment || "n/a"}</div>
                    <div>IP: {inspectingLog.ip_address || "n/a"}</div>
                    <div>User-Agent: {inspectingLog.user_agent || "n/a"}</div>
                    <div>Timestamp: {new Date(inspectingLog.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0f0f0f]">
                <div className="mb-3 font-semibold text-zinc-900 dark:text-zinc-100">Metadata</div>
                <JsonTree data={inspectingLog.metadata ?? {}} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
