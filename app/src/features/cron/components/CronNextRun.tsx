import { formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";

interface CronNextRunProps {
    nextRunAt?: string;
}

export function CronNextRun({ nextRunAt }: CronNextRunProps) {
    if (!nextRunAt) {
        return <span className="text-zinc-400 text-xs italic">Not scheduled</span>;
    }

    const date = new Date(nextRunAt);
    const now = new Date();

    // If next run is in the past (e.g. missed schedule), show in red
    const isOverdue = date < now;

    return (
        <div className="flex flex-col items-start gap-0.5" title={date.toLocaleString()}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? "text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>
                <Clock size={12} />
                {formatDistanceToNow(date, { addSuffix: true })}
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
                {date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
}
