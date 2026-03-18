import { useState } from "react";
import { Play, Code, FileCode, Plus, Search, MoreHorizontal, Clock, Hash } from "lucide-react";

interface Script {
    id: number;
    name: string;
    type: "shell" | "powershell" | "python";
    description: string;
    lastRun: string;
    version: string;
}

export default function ScriptLibraryPage() {
    const [activeTab, setActiveTab] = useState<"library" | "history">("library");

    // Mock Data
    const [scripts] = useState<Script[]>([
        { id: 1, name: "Deploy Docker Stack", type: "shell", description: "Updates docker service with new image tag", lastRun: "2h ago", version: "v1.2" },
        { id: 2, name: "System Cleanup", type: "shell", description: "Removes old logs and temp files", lastRun: "1d ago", version: "v2.0" },
        { id: 3, name: "Audit AD Users", type: "powershell", description: "Exports inactive users to CSV", lastRun: "Never", version: "v1.0" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Code className="text-purple-500" /> Script Library
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage and execute automated maintenance scripts.
                    </p>
                </div>
                <button className="bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                    <Plus size={16} /> New Script
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Script List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search scripts..."
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {scripts.map(script => (
                            <div key={script.id} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-4 hover:border-purple-500/50 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${script.type === "powershell"
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                            }`}>
                                            {script.type === "powershell" ? <TerminalIcon /> : <Hash size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-zinc-900 dark:text-white text-base group-hover:text-purple-600 transition-colors">
                                                {script.name}
                                            </h3>
                                            <p className="text-sm text-zinc-500 mt-1 line-clamp-1">{script.description}</p>
                                            <div className="flex items-center gap-4 mt-3 text-xs font-medium text-zinc-400">
                                                <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase">{script.type}</span>
                                                <span className="flex items-center gap-1"><Clock size={12} /> Last run: {script.lastRun}</span>
                                                <span>{script.version}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-sm shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
                                        <Play size={16} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Stats / Recent Activity */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Clock size={16} /> Recent Executions
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-3 items-start pb-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">System Cleanup</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">on production-db</div>
                                    <div className="text-[10px] text-zinc-400 mt-1">Today, 09:41 AM</div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start pb-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-zinc-900 dark:text-white">Deploy Docker Stack</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">on dev-web-01</div>
                                    <div className="text-[10px] text-zinc-400 mt-1">Yesterday, 4:20 PM</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TerminalIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
    );
}
