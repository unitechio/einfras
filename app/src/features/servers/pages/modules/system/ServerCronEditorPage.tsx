import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { CronScheduleBuilder } from "@/features/cron/components/CronScheduleBuilder";
import { cronjobsApi, type CronjobDTO } from "@/shared/api/client";
import { useNotification } from "@/core/NotificationContext";
import * as parser from "cron-parser";

type FormState = {
  name: string;
  description: string;
  schedule: string;
  command: string;
  user: string;
  enabled: boolean;
  working_dir: string;
};

export default function ServerCronEditorPage() {
  const { serverId = "", jobId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isEditMode = !!jobId;

  const [formData, setFormData] = useState<FormState>({
    name: "",
    description: "",
    schedule: "0 0 * * *",
    command: "",
    user: "root",
    enabled: true,
    working_dir: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [execPreview, setExecPreview] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!isEditMode || !jobId) {
        setIsLoading(false);
        return;
      }
      try {
        const job = await cronjobsApi.get(jobId);
        hydrate(job);
      } catch (error) {
        showNotification({
          type: "error",
          message: "Unable to load cron job",
          description: error instanceof Error ? error.message : "Request failed.",
        });
        navigate(`/servers/${serverId}/cron`);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [isEditMode, jobId, serverId, navigate]);

  useEffect(() => {
    try {
      const interval = (parser as any).parseExpression(formData.schedule) as any;
      setExecPreview([
        interval.next().toString(),
        interval.next().toString(),
        interval.next().toString(),
      ]);
    } catch {
      setExecPreview([]);
    }
  }, [formData.schedule]);

  const handleSave = async () => {
    if (!serverId || !formData.name.trim() || !formData.command.trim() || !formData.schedule.trim()) {
      showNotification({
        type: "error",
        message: "Missing required fields",
        description: "Name, schedule, and command are required.",
      });
      return;
    }
    setSaving(true);
    try {
      if (isEditMode && jobId) {
        await cronjobsApi.update(jobId, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          schedule: formData.schedule.trim(),
          cron_expression: formData.schedule.trim(),
          command: formData.command.trim(),
          working_dir: formData.working_dir.trim(),
          user: formData.user.trim(),
          enabled: formData.enabled,
        });
      } else {
        await cronjobsApi.create(serverId, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          schedule: formData.schedule.trim(),
          command: formData.command.trim(),
          working_dir: formData.working_dir.trim(),
          user: formData.user.trim(),
        });
      }
      showNotification({
        type: "success",
        message: isEditMode ? "Job updated" : "Job created",
        description: "Scheduler configuration has been saved to the backend.",
      });
      navigate(`/servers/${serverId}/cron`);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to save job",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!jobId || !window.confirm("Delete this job?")) return;
    setSaving(true);
    try {
      await cronjobsApi.delete(jobId);
      showNotification({
        type: "success",
        message: "Job deleted",
        description: "The scheduler job has been removed.",
      });
      navigate(`/servers/${serverId}/cron`);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Failed to delete job",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-zinc-500 dark:text-zinc-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Loading scheduler form...
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link
          to={`/servers/${serverId}/cron`}
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {isEditMode ? "Edit Job" : "Create New Job"}
          </h1>
          <p className="text-sm text-zinc-500">Configure task execution and schedule from the real backend API.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm transition-all dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="space-y-8 p-8">
          <section className="space-y-6">
            <h3 className="border-b border-zinc-100 pb-3 text-lg font-bold tracking-tight text-zinc-900 dark:border-zinc-800/60 dark:text-white">
              Job Details
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="col-span-2">
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Job Name <span className="text-red-500">*</span>
                </label>
                <Input value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Daily Database Backup" />
              </div>
              <div className="col-span-2">
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Command <span className="text-red-500">*</span>
                </label>
                <Input value={formData.command} onChange={(e) => setFormData((prev) => ({ ...prev, command: e.target.value }))} className="font-mono" placeholder="/usr/bin/php artisan schedule:run" />
                <p className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-zinc-200/50 bg-zinc-50 p-2 text-[12px] font-medium text-zinc-500 dark:border-zinc-800/50 dark:bg-[#1A1A1A]">
                  <AlertCircle size={14} className="text-amber-500" />
                  Ensure the command is executable by the selected user.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Run As User</label>
                <Input value={formData.user} onChange={(e) => setFormData((prev) => ({ ...prev, user: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Working Directory</label>
                <Input value={formData.working_dir} onChange={(e) => setFormData((prev) => ({ ...prev, working_dir: e.target.value }))} placeholder="/opt/app" />
              </div>
              <div className="col-span-2">
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">Description</label>
                <Input value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional description for operators" />
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="border-b border-zinc-100 pb-3 text-lg font-bold tracking-tight text-zinc-900 dark:border-zinc-800/60 dark:text-white">
              Schedule
            </h3>
            <CronScheduleBuilder
              value={formData.schedule}
              onChange={(val) => setFormData((prev) => ({ ...prev, schedule: val }))}
            />
            {execPreview.length > 0 ? (
              <div className="rounded-xl border border-zinc-200/50 bg-zinc-50 p-5 shadow-sm dark:border-zinc-800/50 dark:bg-[#1A1A1A]">
                <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"></div>
                  Upcoming Executions
                </h4>
                <div className="space-y-2">
                  {execPreview.map((time, idx) => (
                    <div key={idx} className="w-fit rounded-md border border-zinc-200/60 bg-white px-3 py-1.5 font-mono text-[13px] font-medium text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-300">
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <h3 className="border-b border-zinc-100 pb-3 text-lg font-bold tracking-tight text-zinc-900 dark:border-zinc-800/60 dark:text-white">
              Runtime
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200/60 bg-zinc-50/50 p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800/60 dark:bg-zinc-800/10 dark:hover:border-zinc-700">
              <div className="pr-4">
                <div className="text-[14px] font-bold text-zinc-900 dark:text-white">Job Enabled</div>
                <div className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
                  Toggle whether the job should run according to its schedule.
                </div>
              </div>
              <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))} />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200/60 bg-zinc-50/60 px-8 py-5 dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <div>
            {isEditMode ? (
              <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
                <Trash2 size={16} className="mr-2" />
                Delete Job
              </Button>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate(`/servers/${serverId}/cron`)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
              {isEditMode ? "Save Changes" : "Create Job"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function hydrate(job: CronjobDTO): FormState {
  return {
    name: job.name ?? "",
    description: job.description ?? "",
    schedule: job.schedule ?? job.cron_expression,
    command: job.command,
    user: job.user ?? "root",
    enabled: job.enabled ?? true,
    working_dir: job.working_dir ?? "",
  };
}
