import { useState, useEffect } from "react";
import {
  mockSecurityService,
  type ServerAuditLog,
} from "../shared/mockServerService";
import { CheckCircle, XCircle, Search, ScrollText } from "lucide-react";
import { Input } from "@/shared/ui/Input";

export default function ServerAuditLogs() {
  const [logs, setLogs] = useState<ServerAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await mockSecurityService.getAuditLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase());

    const logDate = new Date(log.timestamp).getTime();
    const matchesFrom = fromDate
      ? logDate >= new Date(fromDate).getTime()
      : true;
    const matchesTo = toDate ? logDate <= new Date(toDate).getTime() : true;

    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-100/50 dark:border-emerald-500/20">
              <ScrollText className="text-emerald-500" size={20} />
            </div>
            Audit Logs
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
            Track all activities and changes on this server.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider">From:</span>
            <Input
              type="datetime-local"
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider">To:</span>
            <Input
              type="datetime-local"
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              size={16}
            />
            <Input
              type="text"
              placeholder="Search logs..."
              className="pl-10 w-full md:w-64"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm transition-all">
        <div className="flow-root">
          <ul
            role="list"
            className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60"
          >
            {loading ? (
              <li className="px-6 py-12 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
                Loading logs...
              </li>
            ) : (
              filteredLogs.map((log) => (
                <li
                  key={log.id}
                  className="p-5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {log.status === "success" ? (
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 dark:border-emerald-900/30 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                          <CheckCircle size={20} />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-100 dark:border-red-900/30 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
                          <XCircle size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                        {log.action}
                      </p>
                      <p className="text-[13px] text-zinc-500 truncate mt-0.5">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-right text-[12px] font-medium text-zinc-500">
                      <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">
                        {log.user}
                      </p>
                      <p className="mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
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
