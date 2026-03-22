import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, RefreshCw, ScrollText, Search, XCircle } from "lucide-react";

import { auditApi, type AuditLogDTO } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function ServerAuditLogs() {
  const { serverId = "" } = useParams();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [policyDecision, setPolicyDecision] = useState("");

  const loadLogs = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const response = await auditApi.list(serverId, {
        action: actionFilter || undefined,
        policy_decision: policyDecision || undefined,
        limit: 250,
      });
      setLogs(response.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [serverId, actionFilter, policyDecision]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const searchable = [log.action, log.details, log.actor_id, log.actor_role, log.policy_reason]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchable.includes(searchTerm.toLowerCase());
      const createdAt = log.created_at ? new Date(log.created_at).getTime() : 0;
      const matchesFrom = fromDate ? createdAt >= new Date(fromDate).getTime() : true;
      const matchesTo = toDate ? createdAt <= new Date(toDate).getTime() : true;
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [fromDate, logs, searchTerm, toDate]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-emerald-100/50 bg-emerald-50 p-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <ScrollText className="text-emerald-500" size={20} />
            </div>
            Audit Logs
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Real audit records from backend policy and operation tracking.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold uppercase tracking-wider text-zinc-500">From:</span>
          <Input type="datetime-local" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold uppercase tracking-wider text-zinc-500">To:</span>
          <Input type="datetime-local" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <select
          value={policyDecision}
          onChange={(event) => setPolicyDecision(event.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="">All policy decisions</option>
          <option value="allow">Allow</option>
          <option value="deny">Deny</option>
        </select>
        <Input value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} placeholder="Filter action" className="max-w-[220px]" />
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search logs..." className="w-full pl-10 md:w-64" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="flow-root">
          <ul role="list" className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {loading ? (
              <li className="px-6 py-12 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading logs...</li>
            ) : filteredLogs.length === 0 ? (
              <li className="px-6 py-12 text-center text-[13px] font-medium text-zinc-500">No audit entries match the current filters.</li>
            ) : (
              filteredLogs.map((log) => (
                <li key={log.id} className="p-5 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {log.status === "success" || log.policy_decision === "allow" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner dark:border-emerald-900/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle size={20} />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 shadow-inner dark:border-red-900/30 dark:bg-red-500/10 dark:text-red-400">
                          <XCircle size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{log.action}</p>
                      <p className="mt-0.5 truncate text-[13px] text-zinc-500">{log.details || log.policy_reason || "No extra detail"}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-500">
                        {log.actor_role ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{log.actor_role}</span> : null}
                        {log.required_capability ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">{log.required_capability}</span> : null}
                        {log.policy_decision ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{log.policy_decision}</span> : null}
                      </div>
                    </div>
                    <div className="text-right text-[12px] font-medium text-zinc-500">
                      <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{log.actor_id || "system"}</p>
                      <p className="mt-0.5">{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</p>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
