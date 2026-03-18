import { useState, useEffect, useCallback } from "react";
import type { CronJob, CronExecutionLog } from "@/features/cron/cronService";
import { cronService } from "@/features/cron/cronService";
import { Plus, Play, Trash2, Edit2, RotateCcw } from "lucide-react";
import { CronStatusBadge } from "@/features/cron/components/CronStatusBadge";
import { CronNextRun } from "@/features/cron/components/CronNextRun";
import { CronLogDrawer } from "@/features/cron/components/CronLogDrawer";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            Job Scheduler
            <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-300 font-bold text-[10px] px-2 py-0.5 rounded-md shadow-sm">
              {jobs.length}
            </span>
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
            Manage scheduled tasks and background workers
          </p>
        </div>
        <Link
          to={`/servers/${serverId}/cron/new`}
        >
          <Button variant="primary" className="shadow-sm">
            <Plus size={16} className="mr-2" />
            <span>Add Job</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">On</TableHead>
              <TableHead>Job / Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center text-sm font-medium animate-pulse">
                    Loading jobs...
                  </div>
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  No cron jobs configured
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className={cn(
                    "group transition-colors",
                    job.enabled
                      ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      : "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/50",
                  )}
                >
                  <TableCell className="text-center">
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(c) => handleToggle(job.id, c)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-[14px] text-zinc-900 dark:text-white">
                        {job.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                          {job.schedule}
                        </span>
                        <span
                          className="text-[12px] text-zinc-400 truncate max-w-[200px]"
                          title={job.command}
                        >
                          {job.command}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {runningJobs.has(job.id) ? (
                      <CronStatusBadge status="running" />
                    ) : (
                      <CronStatusBadge status={job.lastRunStatus || "idle"} />
                    )}
                  </TableCell>
                  <TableCell>
                    {job.lastRunAt ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                          {new Date(job.lastRunAt).toLocaleTimeString()}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(job.lastRunAt).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-[13px]">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CronNextRun nextRunAt={job.nextRunAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRunNow(job.id)}
                        disabled={runningJobs.has(job.id) || !job.enabled}
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Run Now"
                      >
                        <Play
                          size={14}
                          className={
                            runningJobs.has(job.id) ? "animate-pulse" : ""
                          }
                          fill="currentColor"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenLogs(job)}
                        className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                        title="View Logs"
                      >
                        <RotateCcw size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.location.href = `/servers/${serverId}/cron/${job.id}/edit`}
                        className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(job.id)}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
