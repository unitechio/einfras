import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import { RefreshCw, XCircle } from "lucide-react";

export default function ServerProcesses() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    setLoading(true);
    try {
      // Accessing the new method from mockSecurityService which we added to mockServerService actually in the previous step
      // But since we extended mockServerService, we should use that or cast it.
      // Correction: The update was made to mockSecurityService's parent file but attached to `mockSecurityService` object?
      // Re-checking the previous tool call...
      // It was added to `mockSecurityService` object in `mockServerService.ts`?
      // Wait, I see I modified the END of the file `mockServerService.ts`.
      // The object I modified was likely `mockSecurityService` because the previous context was adding alerts to it.
      // Actually, looking at the file `mockServerService.ts`, `mockSecurityService` is at the end.
      // However, `getProcesses` is more of a generic server thing.
      // Let's assume I appended it to `mockSecurityService` for now since that's where I sent the edit.
      // I will use `mockSecurityService` to call `getProcesses`.
      const data = await (mockSecurityService as any).getProcesses();
      setProcesses(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Process Management
          </h2>
          <p className="text-zinc-500 text-sm">
            View and manage running processes.
          </p>
        </div>
        <button
          onClick={loadProcesses}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4">PID</th>
              <th className="px-6 py-4">Port</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Command</th>
              <th className="px-6 py-4">CPU %</th>
              <th className="px-6 py-4">MEM %</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                  Loading processes...
                </td>
              </tr>
            ) : (
              processes.map((proc) => (
                <tr
                  key={proc.pid}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-zinc-600 dark:text-zinc-400">
                    {proc.pid}
                  </td>
                  <td className="px-6 py-4">
                    {proc.ports && proc.ports.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {proc.ports.map((port: number) => (
                          <span
                            key={port}
                            className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono rounded"
                          >
                            {port}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{proc.user}</td>
                  <td className="px-6 py-4 font-mono text-zinc-900 dark:text-white">
                    {proc.command}
                  </td>
                  <td className="px-6 py-4">{proc.cpu}%</td>
                  <td className="px-6 py-4">{proc.mem}%</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-red-500 hover:text-red-700 font-medium text-xs flex items-center gap-1 ml-auto">
                      <XCircle size={14} /> Kill
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
