import { useState, useEffect } from "react";
import {
  mockSecurityService,
  type ServerAuditLog,
} from "../shared/mockServerService";
import { CheckCircle, XCircle, Search } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Audit Logs
          </h2>
          <p className="text-zinc-500 text-sm">
            Track all activities and changes on this server.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">From:</span>
            <input
              type="datetime-local"
              className="px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-sm"
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">To:</span>
            <input
              type="datetime-local"
              className="px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-sm"
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search logs..."
              className="pl-9 pr-4 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
        <div className="flow-root">
          <ul
            role="list"
            className="divide-y divide-zinc-200 dark:divide-zinc-800"
          >
            {loading ? (
              <li className="px-6 py-8 text-center text-zinc-500">
                Loading logs...
              </li>
            ) : (
              filteredLogs.map((log) => (
                <li
                  key={log.id}
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {log.status === "success" ? (
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                          <CheckCircle size={16} />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                          <XCircle size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {log.action}
                      </p>
                      <p className="text-sm text-zinc-500 truncate">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">
                        {log.user}
                      </p>
                      <p>{new Date(log.timestamp).toLocaleString()}</p>
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
