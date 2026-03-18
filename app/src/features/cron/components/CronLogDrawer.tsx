import { CronExecutionLog } from "@/features/cron/cronService";
import { CronStatusBadge } from "./CronStatusBadge";
import { X, Terminal } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CronLogDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    jobTitle: string;
    logs: CronExecutionLog[];
}

export function CronLogDrawer({ isOpen, onClose, jobTitle, logs }: CronLogDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            // Prevent body scroll
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-all duration-300">
            <div
                ref={drawerRef}
                className="h-full w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-200 dark:border-zinc-800 flex flex-col animate-in slide-in-from-right duration-300"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <Terminal size={18} />
                            Execution History
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            Logs for <span className="font-mono text-zinc-700 dark:text-zinc-300">{jobTitle}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            No execution history found.
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CronStatusBadge status={log.status} />
                                        <span className="text-xs text-zinc-500 font-mono">
                                            {new Date(log.startTime).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                                        <span>Duration: <span className="font-mono text-zinc-700 dark:text-zinc-300">{log.duration ? `${log.duration}ms` : '-'}</span></span>
                                        <span>Exit: <span className={cn("font-mono font-bold", log.exitCode === 0 ? "text-green-600" : "text-red-600")}>{log.exitCode ?? '-'}</span></span>
                                    </div>
                                </div>
                                <div className="p-4 bg-zinc-900 text-zinc-300 font-mono text-xs overflow-x-auto">
                                    {log.stdout && (
                                        <div className="mb-2">
                                            <div className="text-zinc-500 mb-1 uppercase tracking-wider text-[10px]">STDOUT</div>
                                            <pre className="whitespace-pre-wrap">{log.stdout}</pre>
                                        </div>
                                    )}
                                    {log.stderr && (
                                        <div className="text-red-400">
                                            <div className="text-red-500/70 mb-1 uppercase tracking-wider text-[10px]">STDERR</div>
                                            <pre className="whitespace-pre-wrap">{log.stderr}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
