import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CronJobFormData, cronService } from "@/features/cron/cronService";
import { ArrowLeft, Save, Trash2, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { CronScheduleBuilder } from "@/features/cron/components/CronScheduleBuilder";

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
    const now = Date.now();
    setExecPreview([
      new Date(now + 60 * 60 * 1000).toString(),
      new Date(now + 2 * 60 * 60 * 1000).toString(),
      new Date(now + 3 * 60 * 60 * 1000).toString(),
    ]);
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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
          {/* Basic Info Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Job Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="e.g. Daily Database Backup"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Command <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) =>
                      setFormData({ ...formData, command: e.target.value })
                    }
                    className="w-full pl-4 pr-4 py-3 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-900 text-green-400 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="/usr/bin/php /var/www/artisan schedule:run"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Ensure the command is executable by the specified user
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Run As User
                </label>
                <input
                  type="text"
                  value={formData.user}
                  onChange={(e) =>
                    setFormData({ ...formData, user: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
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
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Schedule
            </h3>
            <CronScheduleBuilder
              value={formData.schedule}
              onChange={(val) => setFormData({ ...formData, schedule: val })}
            />

            {execPreview.length > 0 && (
              <div className="mt-4 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-sm border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Upcoming Executions
                </h4>
                <div className="space-y-1">
                  {execPreview.map((time, idx) => (
                    <div
                      key={idx}
                      className="text-sm font-mono text-zinc-600 dark:text-zinc-400"
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
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Configuration
            </h3>

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-sm border border-zinc-100 dark:border-zinc-800">
              <div>
                <div className="font-medium text-zinc-900 dark:text-white">
                  Prevent Overlapping
                </div>
                <div className="text-sm text-zinc-500">
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

            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-sm border border-zinc-100 dark:border-zinc-800">
              <div>
                <div className="font-medium text-zinc-900 dark:text-white">
                  Job Enabled
                </div>
                <div className="text-sm text-zinc-500">
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
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Environment Variables
                </label>
                <button
                  onClick={addEnvVar}
                  className="text-sm text-white font-medium hover:text-gray-400 hover:cursor-pointer flex items-center gap-1"
                >
                  <PlusIcon size={16} /> Add Variable
                </button>
              </div>
              <div className="space-y-3">
                {envList.map((env, idx) => (
                  <div key={idx} className="flex gap-3">
                    <input
                      placeholder="VARIABLE_KEY"
                      value={env.key}
                      onChange={(e) => updateEnvVar(idx, "key", e.target.value)}
                      className="flex-1 px-4 py-3 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-sm"
                    />
                    <input
                      placeholder="VALUE"
                      value={env.value}
                      onChange={(e) =>
                        updateEnvVar(idx, "value", e.target.value)
                      }
                      className="flex-1 px-4 py-3 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-sm"
                    />
                    <button
                      onClick={() => removeEnvVar(idx)}
                      className="text-zinc-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {envList.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-sm text-zinc-400 text-sm">
                    No environment variables defined
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-4">
          <Link
            to={`/servers/${serverId}/cron`}
            className="px-6 py-2.5 rounded-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={!formData.title || !formData.command}
            className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Save size={18} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function PlusIcon({ size }: { size: number }) {
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
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
