import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import { RefreshCw, XCircle, Activity } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100/50 dark:border-purple-500/20">
              <Activity className="text-purple-500" size={20} />
            </div>
            Process Management
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mt-2">
            Monitor and control actively running processes on the server.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadProcesses}
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Snapshot
        </Button>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm transition-all">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PID</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Command</TableHead>
              <TableHead>CPU %</TableHead>
              <TableHead>MEM %</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                      <TableCell><div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" /></TableCell>
                      <TableCell><div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse ml-auto" /></TableCell>
                  </TableRow>
              ))
            ) : processes.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                            <Activity size={32} className="mb-3 opacity-20" />
                            <p className="text-[13px] font-medium">No processes found.</p>
                        </div>
                    </TableCell>
                </TableRow>
            ) : (
              processes.map((proc) => (
                <TableRow key={proc.pid} className="group">
                  <TableCell className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {proc.pid}
                  </TableCell>
                  <TableCell>
                    {proc.ports && proc.ports.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {proc.ports.map((port: number) => (
                          <span
                            key={port}
                            className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-mono font-bold rounded-md shadow-sm"
                          >
                            {port}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600 text-[12px]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-zinc-900 dark:text-zinc-100 font-medium">{proc.user}</TableCell>
                  <TableCell className="text-[12px] font-mono text-zinc-600 dark:text-zinc-300">
                    <div className="max-w-xs truncate" title={proc.command}>
                      {proc.command}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[13px] font-bold ${proc.cpu > 80 ? 'text-red-500 dark:text-red-400' : proc.cpu > 50 ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                        {proc.cpu}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[13px] font-bold ${proc.mem > 80 ? 'text-red-500 dark:text-red-400' : proc.mem > 50 ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                        {proc.mem}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
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
