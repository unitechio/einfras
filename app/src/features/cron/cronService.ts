import type { CronJob, CronExecutionLog, CronStatus, CronJobFormData } from "../../types/cron";
import parseExpression from "cron-parser";

export type { CronJobFormData };


const STORAGE_KEYS = {
    JOBS: "mock_cron_jobs",
    LOGS: "mock_cron_logs",
};

const INITIAL_JOBS: CronJob[] = [
    {
        id: "1",
        title: "Daily Database Backup",
        schedule: "0 0 * * *",
        command: "/usr/bin/backup.sh",
        user: "root",
        timezone: "Asia/Ho_Chi_Minh",
        enabled: true,
        preventOverlap: true,
        timeout: 3600,
        env: { DB_HOST: "localhost" },
        lastRunStatus: "success",
        lastRunAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: "2",
        title: "Laravel Scheduler",
        schedule: "*/1 * * * *",
        command: "php artisan schedule:run",
        user: "www-data",
        timezone: "UTC",
        enabled: true,
        preventOverlap: false,
        env: {},
        lastRunStatus: "success",
        lastRunAt: new Date(Date.now() - 60000).toISOString(),
    },
    {
        id: "3",
        title: "Cleanup Temp Files",
        schedule: "0 2 * * 0",
        command: "rm -rf /tmp/*",
        user: "root",
        timezone: "Asia/Ho_Chi_Minh",
        enabled: false,
        preventOverlap: false,
        env: {},
    }
];

class CronService {
    private getJobsFromStorage(): CronJob[] {
        const stored = localStorage.getItem(STORAGE_KEYS.JOBS);
        if (!stored) {
            this.saveJobsToStorage(INITIAL_JOBS);
            return INITIAL_JOBS;
        }
        return JSON.parse(stored);
    }

    private saveJobsToStorage(jobs: CronJob[]) {
        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    }

    private getLogsFromStorage(): CronExecutionLog[] {
        const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
        return stored ? JSON.parse(stored) : [];
    }

    private saveLogsToStorage(logs: CronExecutionLog[]) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    }

    getJobs(): CronJob[] {
        const jobs = this.getJobsFromStorage();
        // Recalculate next run for all jobs
        return jobs.map(job => {
            if (!job.enabled) return { ...job, nextRunAt: undefined };
            try {
                const interval = parseExpression(job.schedule, { tz: job.timezone || "UTC" });
                return { ...job, nextRunAt: interval.next().toISOString() };
            } catch (e) {
                console.error(`Invalid cron expression for job ${job.id}`, e);
                return job;
            }
        });
    }

    getJob(id: string): CronJob | undefined {
        return this.getJobs().find(j => j.id === id);
    }

    addJob(data: CronJobFormData): CronJob {
        const jobs = this.getJobsFromStorage();
        const newJob: CronJob = {
            ...data,
            id: crypto.randomUUID(),
            enabled: true,
            preventOverlap: data.preventOverlap ?? false,
            env: data.env || {},
            user: data.user || "root",
            timezone: data.timezone || "UTC",
        };
        jobs.push(newJob);
        this.saveJobsToStorage(jobs);
        return newJob;
    }

    updateJob(id: string, data: Partial<CronJob>): CronJob {
        const jobs = this.getJobsFromStorage();
        const index = jobs.findIndex(j => j.id === id);
        if (index === -1) throw new Error("Job not found");

        jobs[index] = { ...jobs[index], ...data };
        this.saveJobsToStorage(jobs);
        return jobs[index];
    }

    deleteJob(id: string) {
        const jobs = this.getJobsFromStorage().filter(j => j.id !== id);
        this.saveJobsToStorage(jobs);
    }

    toggleJob(id: string, enabled: boolean) {
        return this.updateJob(id, { enabled });
    }

    getLogs(jobId: string): CronExecutionLog[] {
        return this.getLogsFromStorage()
            .filter(l => l.jobId === jobId)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }

    // Mock Execution
    async runJob(id: string): Promise<void> {
        const job = this.getJob(id);
        if (!job) return;

        // 1. Mark as running (optional, usually handled by UI state in this lightweight mock)
        // In a real app, we'd update job status in DB. Here we just return a promise that resolves.

        const startTime = new Date();
        const logId = crypto.randomUUID();

        // Simulate network/execution delay (1s - 5s)
        const delay = Math.floor(Math.random() * 4000) + 1000;

        return new Promise((resolve) => {
            setTimeout(() => {
                const endTime = new Date();
                const duration = endTime.getTime() - startTime.getTime();

                // Random success/fail
                const isSuccess = Math.random() > 0.2; // 80% success
                const status: CronStatus = isSuccess ? "success" : "failed";
                const exitCode = isSuccess ? 0 : 1;

                const newLog: CronExecutionLog = {
                    id: logId,
                    jobId: id,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    duration,
                    status,
                    exitCode,
                    stdout: isSuccess ? `Job ${job.title} executed successfully.\nOutput: Done.` : `Starting job...\nProcessing...`,
                    stderr: isSuccess ? "" : `Error: Command failed with exit code 1.\nModule not found or permission denied.`,
                };

                const logs = this.getLogsFromStorage();
                logs.unshift(newLog);
                // Retention policy: keep last 100 logs total (simplification)
                if (logs.length > 100) logs.pop();
                this.saveLogsToStorage(logs);

                // Update job last run
                this.updateJob(id, {
                    lastRunAt: startTime.toISOString(),
                    lastRunStatus: status
                });

                resolve();
            }, delay);
        });
    }
}

export const cronService = new CronService();
