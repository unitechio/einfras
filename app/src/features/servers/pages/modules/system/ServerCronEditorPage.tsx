import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { CronJobFormData } from "@/features/cron/cronService";
import { cronService } from "@/features/cron/cronService";
import { ArrowLeft, Save, Trash2, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { CronScheduleBuilder } from "@/features/cron/components/CronScheduleBuilder";
import * as parser from "cron-parser";

export default function ServerCronEditorPage() {
  const { serverId, jobId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!jobId;

  const [formData, setFormData] = useState<CronJobFormData>({
    title: "",
    schedule: "0 0 * * *",
    command: "",
    user: "root",
    timezone: "UTC",
    enabled: true,
    preventOverlap: false,
    env: {},
  });

  const [envList, setEnvList] = useState<{ key: string; value: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [execPreview, setExecPreview] = useState<string[]>([]);

  useEffect(() => {
    if (isEditMode && jobId) {
      const job = cronService.getJob(jobId);
      if (job) {
        setFormData({
          title: job.title,
          description: job.description,
          schedule: job.schedule,
          command: job.command,
          user: job.user,
          timezone: job.timezone,
          enabled: job.enabled,
          preventOverlap: job.preventOverlap,
          timeout: job.timeout,
          env: job.env,
        });
        setEnvList(
          Object.entries(job.env).map(([key, value]) => ({ key, value })),
        );
      } else {
        // Job not found, redirect back
        navigate(`/servers/${serverId}/cron`);
      }
    }
    setIsLoading(false);
  }, [isEditMode, jobId, serverId, navigate]);

  // Recalculate execution preview when schedule changes
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const interval = (parser as any).parseExpression(formData.schedule) as any;
      const next = [
        interval.next().toString(),
        interval.next().toString(),
        interval.next().toString(),
      ];
      setExecPreview(next);
    } catch (e) {
      setExecPreview([]);
    }
  }, [formData.schedule]);

  const handleSave = () => {
    // Transform env list to object
    const env = envList.reduce(
      (acc, curr) => {
        if (curr.key) acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const data = { ...formData, env };

    if (isEditMode && jobId) {
      cronService.updateJob(jobId, data);
    } else {
      cronService.addJob(data);
    }

    navigate(`/servers/${serverId}/cron`);
  };

  const addEnvVar = () => setEnvList([...envList, { key: "", value: "" }]);
  const removeEnvVar = (idx: number) =>
    setEnvList(envList.filter((_, i) => i !== idx));
  const updateEnvVar = (idx: number, field: "key" | "value", val: string) => {
    const copy = [...envList];
    copy[idx][field] = val;
    setEnvList(copy);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/servers/${serverId}/cron`}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {isEditMode ? "Edit Job" : "Create New Job"}
          </h1>
          <p className="text-zinc-500 text-sm">
            Configure task execution details and schedule
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
        <div className="p-8 space-y-8">
          {/* Basic Info Section */}
          <section className="space-y-6">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              Job Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full"
                  placeholder="e.g. Daily Database Backup"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Command <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.command}
                    onChange={(e) =>
                      setFormData({ ...formData, command: e.target.value })
                    }
                    className="w-full font-mono text-sm bg-zinc-50 dark:bg-zinc-950/50 text-emerald-600 dark:text-emerald-400 border-zinc-200/60 dark:border-zinc-800/60"
                    placeholder="/usr/bin/php /var/www/artisan schedule:run"
                  />
                </div>
                <p className="text-[12px] font-medium text-zinc-500 mt-2 flex items-center gap-1.5 bg-zinc-50 dark:bg-[#1A1A1A] p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 w-fit">
                  <AlertCircle size={14} className="text-amber-500" />
                  Ensure the command is executable by the specified user
                </p>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Run As User
                </label>
                <Input
                  type="text"
                  value={formData.user}
                  onChange={(e) =>
                    setFormData({ ...formData, user: e.target.value })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 transition-all h-10 font-medium text-zinc-900 dark:text-zinc-100"
                >
                  <option value="UTC">UTC</option>
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                </select>
              </div>
            </div>
          </section>

          {/* Schedule Section */}
          <section className="space-y-6">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              Schedule
            </h3>
            <CronScheduleBuilder
              value={formData.schedule}
              onChange={(val) => setFormData({ ...formData, schedule: val })}
            />

            {execPreview.length > 0 && (
              <div className="mt-4 bg-zinc-50 dark:bg-[#1A1A1A] p-5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                  Upcoming Executions
                </h4>
                <div className="space-y-2">
                  {execPreview.map((time, idx) => (
                    <div
                      key={idx}
                      className="text-[13px] font-medium font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 px-3 py-1.5 rounded-md w-fit"
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Advanced & Env */}
          <section className="space-y-6">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
              Configuration
            </h3>

            <div className="flex items-center justify-between p-5 bg-zinc-50/50 dark:bg-zinc-800/10 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
              <div className="pr-4">
                <div className="font-bold text-[14px] text-zinc-900 dark:text-white">
                  Prevent Overlapping
                </div>
                <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Do not start a new instance if the previous one is still
                  running
                </div>
              </div>
              <Switch
                checked={formData.preventOverlap}
                onCheckedChange={(c) =>
                  setFormData({ ...formData, preventOverlap: c })
                }
              />
            </div>

            <div className="flex items-center justify-between p-5 bg-zinc-50/50 dark:bg-zinc-800/10 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
              <div className="pr-4">
                <div className="font-bold text-[14px] text-zinc-900 dark:text-white">
                  Job Enabled
                </div>
                <div className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Active jobs will be executed according to schedule
                </div>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(c) =>
                  setFormData({ ...formData, enabled: c })
                }
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-[14px] font-bold text-zinc-900 dark:text-white">
                  Environment Variables
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEnvVar}
                  className="text-xs"
                >
                  <PlusIcon size={14} className="mr-1.5" /> Add Variable
                </Button>
              </div>
              <div className="space-y-3">
                {envList.map((env, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <Input
                      placeholder="VARIABLE_KEY"
                      value={env.key}
                      onChange={(e) => updateEnvVar(idx, "key", e.target.value)}
                      className="flex-1 font-mono text-xs w-full"
                    />
                    <Input
                      placeholder="VALUE"
                      value={env.value}
                      onChange={(e) =>
                        updateEnvVar(idx, "value", e.target.value)
                      }
                      className="flex-1 font-mono text-xs w-full"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(idx)}
                      className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {envList.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-zinc-200/60 dark:border-zinc-800/60 rounded-xl text-zinc-500 text-[13px] font-medium bg-zinc-50/50 dark:bg-zinc-800/10">
                    No environment variables defined
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="bg-zinc-50/50 dark:bg-[#0A0A0A] p-6 border-t border-zinc-200/60 dark:border-zinc-800/60 flex justify-end gap-3 items-center">
          <Link
            to={`/servers/${serverId}/cron`}
          >
            <Button variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!formData.title || !formData.command}
            className="shadow-sm"
          >
            <Save size={16} className="mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlusIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
