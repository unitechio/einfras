import { useState } from "react";
import { Play, Code, Plus, Search, Clock, Hash } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface Script {
    id: number;
    name: string;
    type: "shell" | "powershell" | "python";
    description: string;
    lastRun: string;
    version: string;
}

export default function ScriptLibraryPage() {
    // Tabs state kept but not displayed for now

    // Mock Data
    const [scripts] = useState<Script[]>([
        { id: 1, name: "Deploy Docker Stack", type: "shell", description: "Updates docker service with new image tag", lastRun: "2h ago", version: "v1.2" },
        { id: 2, name: "System Cleanup", type: "shell", description: "Removes old logs and temp files", lastRun: "1d ago", version: "v2.0" },
        { id: 3, name: "Audit AD Users", type: "powershell", description: "Exports inactive users to CSV", lastRun: "Never", version: "v1.0" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100/50 dark:border-purple-500/20">
                            <Code className="text-purple-500" size={20} />
                        </div>
                        Script Library
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Manage and execute automated maintenance scripts.
                    </p>
                </div>
                <Button variant="primary" className="shadow-sm">
                    <Plus size={16} className="mr-2" /> New Script
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Script List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <Input
                                type="text"
                                placeholder="Search scripts..."
                                className="w-full pl-10"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {scripts.map(script => (
                            <div key={script.id} className="group bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-5 hover:border-purple-500/50 hover:shadow-md transition-all shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 font-bold border shadow-inner ${script.type === "powershell"
                                                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-500/20"
                                                : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                                            }`}>
                                            {script.type === "powershell" ? <TerminalIcon /> : <Hash size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                {script.name}
                                            </h3>
                                            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{script.description}</p>
                                            <div className="flex items-center gap-4 mt-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                                <span className="bg-zinc-100/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700/50">{script.type}</span>
                                                <span className="flex items-center gap-1.5"><Clock size={12} /> Last run: {script.lastRun}</span>
                                                <span className="flex items-center gap-1.5"><Code size={12} /> {script.version}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-500/20 active:scale-95 transition-all w-10 h-10 border border-purple-500/50"
                                    >
                                        <Play size={16} fill="currentColor" className="ml-0.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Stats / Recent Activity */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
                        <h3 className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-white mb-5 flex items-center gap-2">
                            <Clock size={16} className="text-purple-500" /> Recent Executions
                        </h3>
                        <div className="space-y-5">
                            <div className="flex gap-3.5 items-start pb-5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">System Cleanup</div>
                                    <div className="text-[12px] font-medium text-zinc-500 mt-1">on production-db</div>
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mt-1.5">Today, 09:41 AM</div>
                                </div>
                            </div>
                            <div className="flex gap-3.5 items-start pb-5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 last:pb-0">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                <div className="flex-1">
                                    <div className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">Deploy Docker Stack</div>
                                    <div className="text-[12px] font-medium text-zinc-500 mt-1">on dev-web-01</div>
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mt-1.5">Yesterday, 4:20 PM</div>
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
