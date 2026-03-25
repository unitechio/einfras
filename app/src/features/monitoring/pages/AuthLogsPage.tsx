"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  Globe,
  Info,
  Search,
  ShieldAlert,
  User as UserIcon,
  XCircle,
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
import {
  monitoringAuditApi,
  type IAMAuditLogRecord,
} from "../api/auditLogs";

function exportCSV(items: IAMAuditLogRecord[]) {
  const header = ["timestamp", "user_email", "action", "status", "ip_address", "method", "reason"];
  const lines = items.map((item) =>
    [
      item.timestamp,
      item.user_email,
      item.action,
      item.status,
      item.ip_address,
      String(item.metadata?.method ?? ""),
      String(item.metadata?.reason ?? ""),
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `auth-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AuthLogsPage() {
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [events, setEvents] = useState<IAMAuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return events.filter((event) => {
      const matchesKeyword =
        !keyword ||
        `${event.user_email} ${event.ip_address} ${event.action} ${event.status} ${JSON.stringify(event.metadata)}`
          .toLowerCase()
          .includes(keyword);
      const matchesStatus = !statusFilter || event.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [events, searchTerm, statusFilter]);

  async function loadEvents() {
    setIsLoading(true);
    try {
      setEvents(await monitoringAuditApi.list({ limit: 150, resource: "auth" }));
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load authentication logs",
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
            <ShieldAlert className="h-6 w-6 text-indigo-500" />
            Authentication Logs
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Monitor login, MFA challenge and refresh outcomes recorded by the IAM service.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportCSV(filteredEvents)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => void loadEvents()} isLoading={isLoading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={<Search className="h-4 w-4 text-zinc-400" />}
            placeholder="Search IP, user or reason"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
        >
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <div className="sm:ml-auto flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400">
          <Calendar size={12} className="text-indigo-500" />
          Latest 150 auth events
        </div>
        <div className="flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800/30 dark:text-zinc-400">
          <Info size={12} className="text-indigo-500" />
          Includes password, TOTP and refresh activity
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Origin IP</TableHead>
              <TableHead className="text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-zinc-500">
                  Loading authentication events...
                </TableCell>
              </TableRow>
            ) : filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <ShieldAlert size={32} className="mb-3 opacity-20" />
                    <p className="text-[13px] font-medium">No authentication events found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => (
                <TableRow key={event.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <TableCell>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                        <UserIcon size={10} className="text-zinc-500" />
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {event.user_email || event.user_id || "unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex w-fit items-center rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {event.action}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {String(event.metadata?.method ?? event.metadata?.reason ?? "internal")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      <Globe size={12} className="opacity-50" />
                      {event.ip_address || "n/a"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end pr-2">
                      {event.status === "success" ? (
                        <Badge variant="success" className="border-none shadow-none">
                          <CheckCircle2 size={12} className="mr-1" /> Success
                        </Badge>
                      ) : (
                        <Badge variant="error" className="border-none shadow-none">
                          <XCircle size={12} className="mr-1" /> Failed
                        </Badge>
                      )}
                    </div>
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
