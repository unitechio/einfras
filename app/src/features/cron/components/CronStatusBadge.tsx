import { CronStatus } from "../../../types/cron";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, Loader2, CircleSlash } from "lucide-react";

interface CronStatusBadgeProps {
    status?: CronStatus;
    className?: string;
}

export function CronStatusBadge({ status, className }: CronStatusBadgeProps) {
    if (!status || status === 'idle') {
        return (
            <div className={cn("flex items-center gap-1.5 text-zinc-400 text-xs font-medium", className)}>
                <CircleSlash size={14} />
                <span>Idle</span>
            </div>
        );
    }

    if (status === 'running') {
        return (
            <div className={cn("flex items-center gap-1.5 text-blue-500 text-xs font-bold", className)}>
                <Loader2 size={14} className="animate-spin" />
                <span>Running</span>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className={cn("flex items-center gap-1.5 text-green-500 text-xs font-bold", className)}>
                <CheckCircle2 size={14} />
                <span>Success</span>
            </div>
        );
    }

    if (status === 'failed') {
        return (
            <div className={cn("flex items-center gap-1.5 text-red-500 text-xs font-bold", className)}>
                <XCircle size={14} />
                <span>Failed</span>
            </div>
        );
    }

    if (status === 'timeout') {
        return (
            <div className={cn("flex items-center gap-1.5 text-orange-500 text-xs font-bold", className)}>
                <Clock size={14} />
                <span>Timeout</span>
            </div>
        );
    }

    return null;
}
