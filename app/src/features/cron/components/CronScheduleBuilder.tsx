import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Clock, Calendar, AlertTriangle } from "lucide-react";
import parser from "cron-parser";

interface CronScheduleBuilderProps {
    value: string;
    onChange: (value: string) => void;
}

type Mode = 'simple' | 'advanced';
type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

export function CronScheduleBuilder({ value, onChange }: CronScheduleBuilderProps) {
    // Determine initial mode based on value complexity
    const [mode, setMode] = useState<Mode>('simple');

    // Simple mode state
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [minute, setMinute] = useState(0);
    const [hour, setHour] = useState(0);
    const [dayOfWeek, setDayOfWeek] = useState(1); // 0-6 (Sun-Sat) or 1-7 depending on cron parser config, usually 0-6
    const [dayOfMonth, setDayOfMonth] = useState(1); // 1-31

    // Advanced mode state
    const [advancedExpression, setAdvancedExpression] = useState(value);
    const [error, setError] = useState<string | null>(null);

    // Sync state when value changes externally (initial load)
    useEffect(() => {
        setAdvancedExpression(value);
        // Try to parse simple presets from value to set UI state
        // This is a naive parser for demo purposes
        const parts = value.split(' ');
        if (parts.length === 5) {
            // Check Daily: "min hour * * *"
            if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
                setFrequency('daily');
                setMinute(parseInt(parts[0]) || 0);
                setHour(parseInt(parts[1]) || 0);
            }
            // Check Weekly: "min hour * * dow"
            else if (parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') {
                setFrequency('weekly');
                setMinute(parseInt(parts[0]) || 0);
                setHour(parseInt(parts[1]) || 0);
                setDayOfWeek(parseInt(parts[4]) || 0);
            }
        }
    }, [value]);

    // Update cron output when simple controls change
    const updateSimpleCron = () => {
        let cron = "* * * * *";
        if (frequency === 'hourly') {
            cron = `${minute} * * * *`;
        } else if (frequency === 'daily') {
            cron = `${minute} ${hour} * * *`;
        } else if (frequency === 'weekly') {
            cron = `${minute} ${hour} * * ${dayOfWeek}`;
        } else if (frequency === 'monthly') {
            cron = `${minute} ${hour} ${dayOfMonth} * *`;
        }
        onChange(cron);
        setAdvancedExpression(cron);
    };

    // Update cron output when advanced input changes
    const handleAdvancedChange = (val: string) => {
        setAdvancedExpression(val);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (parser as any).parseExpression(val);
            setError(null);
            onChange(val);
        } catch (err) {
            setError("Invalid cron expression");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setMode('simple')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-all",
                        mode === 'simple'
                            ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                >
                    Visual Builder
                </button>
                <button
                    onClick={() => setMode('advanced')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium rounded-md transition-all",
                        mode === 'advanced'
                            ? "bg-white dark:bg-zinc-950 text-blue-600 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                >
                    Raw Expression
                </button>
            </div>

            {mode === 'simple' ? (
                <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Frequency</label>
                        <div className="flex gap-2">
                            {(['hourly', 'daily', 'weekly', 'monthly'] as Frequency[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => {
                                        setFrequency(f);
                                        // Trigger update immediately (using timeout to let state settle or just call helper with new val)
                                        // Ideally use useEffect for this, but for simplicity:
                                        setTimeout(updateSimpleCron, 0);
                                    }}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium border capitalize transition-all",
                                        frequency === f
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                                    )}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {frequency !== 'hourly' && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Time</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={0}
                                        max={23}
                                        value={hour}
                                        onChange={(e) => {
                                            setHour(parseInt(e.target.value) || 0);
                                            setTimeout(updateSimpleCron, 0);
                                        }}
                                        className="w-16 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center"
                                        placeholder="HH"
                                    />
                                    <span className="text-zinc-400 font-bold">:</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={minute}
                                        onChange={(e) => {
                                            setMinute(parseInt(e.target.value) || 0);
                                            setTimeout(updateSimpleCron, 0);
                                        }}
                                        className="w-16 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center"
                                        placeholder="MM"
                                    />
                                </div>
                            </div>
                        )}

                        {frequency === 'hourly' && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Minute past hour</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={minute}
                                    onChange={(e) => {
                                        setMinute(parseInt(e.target.value) || 0);
                                        setTimeout(updateSimpleCron, 0);
                                    }}
                                    className="w-20 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center"
                                />
                            </div>
                        )}

                        {frequency === 'weekly' && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Day of Week</label>
                                <select
                                    value={dayOfWeek}
                                    onChange={(e) => {
                                        setDayOfWeek(parseInt(e.target.value));
                                        setTimeout(updateSimpleCron, 0);
                                    }}
                                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 w-full"
                                >
                                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                                        <option key={day} value={idx}>{day}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {frequency === 'monthly' && (
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Day of Month</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dayOfMonth}
                                    onChange={(e) => {
                                        setDayOfMonth(parseInt(e.target.value) || 1);
                                        setTimeout(updateSimpleCron, 0);
                                    }}
                                    className="w-20 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500 mt-2 bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-200 dark:border-yellow-900/20">
                        <Clock size={14} className="text-yellow-600 dark:text-yellow-500" />
                        <span>Generated Schedule: <code className="font-bold font-mono text-zinc-900 dark:text-white">{advancedExpression}</code></span>
                    </div>
                </div>
            ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <input
                        type="text"
                        value={advancedExpression}
                        onChange={(e) => handleAdvancedChange(e.target.value)}
                        className={cn(
                            "w-full px-4 py-3 rounded-xl border text-lg font-mono tracking-wide focus:ring-2 focus:ring-blue-500 outline-none transition-colors",
                            error
                                ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
                        )}
                        placeholder="* * * * *"
                    />
                    {error && (
                        <p className="text-xs text-red-500 flex items-center gap-1 font-bold">
                            <AlertTriangle size={12} /> {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
