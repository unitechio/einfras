export type CronStatus = 'idle' | 'running' | 'success' | 'failed' | 'timeout';

export interface CronExecutionLog {
    id: string;
    jobId: string;
    startTime: string; // ISO string
    endTime?: string; // ISO string
    duration?: number; // ms
    exitCode?: number;
    stdout: string;
    stderr: string;
    status: CronStatus;
}

export interface CronJob {
    id: string;
    title: string;
    description?: string;

    // Scheduling
    schedule: string; // Cron expression
    timezone: string;
    humanReadableSchedule?: string;

    // Execution
    command: string;
    user: string; // e.g. 'root', 'www-data'
    cwd?: string; // Working directory
    timeout?: number; // Seconds
    preventOverlap: boolean;

    // State
    enabled: boolean;
    lastRunAt?: string; // ISO string
    lastRunStatus?: CronStatus;
    nextRunAt?: string; // ISO string

    // Environment
    env: Record<string, string>;
}

export interface CronJobFormData extends Omit<CronJob, 'id' | 'lastRunAt' | 'lastRunStatus' | 'nextRunAt'> {
    id?: string;
}
