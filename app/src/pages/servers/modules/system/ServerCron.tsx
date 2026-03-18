import { useState, useEffect, useCallback } from "react";
import { CronJob, CronExecutionLog } from "@/features/cron/cronService";
import { cronService } from "@/features/cron/cronService";
import { Plus, Play, Trash2, Edit2, RotateCcw } from "lucide-react";
import { CronStatusBadge } from "@/features/cron/components/CronStatusBadge";
import { CronNextRun } from "@/features/cron/components/CronNextRun";
import { CronLogDrawer } from "@/features/cron/components/CronLogDrawer";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { Link, useParams } from "react-router-dom";

export default function ServerCron() {
  const { serverId } = useParams();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  // Drawer State
  const [selectedJobIdForLogs, setSelectedJobIdForLogs] = useState<
    string | null
  >(null);
  const [logs, setLogs] = useState<CronExecutionLog[]>([]);

  const loadJobs = useCallback(() => {
    const data = cronService.getJobs();
    setJobs(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
    // Refresh periodically for "next run" updates
    const interval = setInterval(loadJobs, 60000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const handleToggle = (id: string, enabled: boolean) => {
    cronService.toggleJob(id, enabled);
    loadJobs();
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this cron job?")) {
      cronService.deleteJob(id);
      loadJobs();
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningJobs((prev) => new Set(prev).add(id));
    try {
      await cronService.runJob(id);
      cronService.getJobs(); // Refresh status immediately in service if persisted
      loadJobs(); // Refresh UI
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleOpenLogs = (job: CronJob) => {
    const jobLogs = cronService.getLogs(job.id);
    setLogs(jobLogs);
    setSelectedJobIdForLogs(job.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            Job Scheduler
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs px-2 py-0.5 rounded-full">
              {jobs.length}
            </span>
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Manage scheduled tasks and background workers
          </p>
        </div>
        <Link
          to={`/servers/${serverId}/cron/new`}
          className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={16} />
          <span>Add Job</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/30 dark:bg-zinc-800/10 text-zinc-500 text-xs uppercase font-bold tracking-wider">
              <th className="px-6 py-4 w-12">On</th>
              <th className="px-6 py-4">Job / Schedule</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Run</th>
              <th className="px-6 py-4">Next Run</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-400">
                  Loading jobs...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-400">
                  No cron jobs configured
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className={cn(
                    "group transition-colors",
                    job.enabled
                      ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      : "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/50",
                  )}
                >
                  <td className="px-6 py-4">
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(c) => handleToggle(job.id, c)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">
                        {job.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {job.schedule}
                        </span>
                        <span
                          className="text-xs text-zinc-400 truncate max-w-[200px]"
                          title={job.command}
                        >
                          {job.command}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {runningJobs.has(job.id) ? (
                      <CronStatusBadge status="running" />
                    ) : (
                      <CronStatusBadge status={job.lastRunStatus || "idle"} />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {job.lastRunAt ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {new Date(job.lastRunAt).toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(job.lastRunAt).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <CronNextRun nextRunAt={job.nextRunAt} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRunNow(job.id)}
                        disabled={runningJobs.has(job.id) || !job.enabled}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Run Now"
                      >
                        <Play
                          size={16}
                          className={
                            runningJobs.has(job.id) ? "animate-pulse" : ""
                          }
                        />
                      </button>
                      <button
                        onClick={() => handleOpenLogs(job)}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                        title="View Logs"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <Link
                        to={`/servers/${serverId}/cron/${job.id}/edit`}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </Link>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CronLogDrawer
        isOpen={!!selectedJobIdForLogs}
        onClose={() => setSelectedJobIdForLogs(null)}
        jobTitle={jobs.find((j) => j.id === selectedJobIdForLogs)?.title || ""}
        logs={logs}
      />
    </div>
  );
}
