import { Activity, ShieldCheck, Download, RefreshCw, Server, Zap } from "lucide-react";
import { Button } from "@/shared/ui/Button";

export default function AgentManagementPage() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-100/50 dark:border-green-500/20">
                            <ShieldCheck className="text-green-500" size={20} />
                        </div>
                        Agent Management
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Monitor and update the security agent deployed on this node.
                    </p>
                </div>
                <Button variant="primary" className="shadow-sm">
                    <RefreshCw size={16} className="mr-2" /> Upgrade Agent
                </Button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700 transition-colors">
                    <div className="p-3.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-100/50 dark:border-green-500/20 rounded-xl shadow-inner">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Status</div>
                        <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">Online</div>
                        <div className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit border border-emerald-100/50 dark:border-emerald-500/20">
                            <Zap size={10} fill="currentColor" /> Connected via Agent Protocol
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700 transition-colors">
                    <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-500/20 rounded-xl shadow-inner">
                        <Server size={24} />
                    </div>
                    <div>
                        <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Version</div>
                        <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">v2.19.4</div>
                        <div className="text-[12px] font-medium text-zinc-500 mt-1.5">Latest is v2.20.0 (Update available)</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 flex items-start gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700 transition-colors">
                    <div className="p-3.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-500/20 rounded-xl shadow-inner">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">Heartbeat</div>
                        <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">24ms</div>
                        <div className="text-[12px] font-medium text-zinc-500 mt-1.5">Last seen: Just now</div>
                    </div>
                </div>
            </div>

            {/* Configuration Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white mb-6">Tunnel Configuration</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl bg-zinc-50/50 dark:bg-[#1A1A1A]">
                            <div>
                                <div className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100">Reverse Tunnel</div>
                                <div className="text-[12px] font-medium text-zinc-500 mt-0.5">Allow inbound connections without opening ports</div>
                            </div>
                            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 cursor-pointer shadow-inner">
                                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6 shadow-sm" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl bg-zinc-50/50 dark:bg-[#1A1A1A]">
                            <div>
                                <div className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100">mTLS Encryption</div>
                                <div className="text-[12px] font-medium text-zinc-500 mt-0.5">Enforce mutual TLS for all agent traffic</div>
                            </div>
                            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500 cursor-pointer shadow-inner">
                                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6 shadow-sm" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold text-[16px] tracking-tight text-zinc-900 dark:text-white mb-6">Debug & Logs</h3>
                    <div className="space-y-4">
                        <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-mono text-[12px] p-4 rounded-xl h-32 overflow-y-auto border border-zinc-800/60 shadow-inner space-y-1">
                            <div><span className="text-blue-400 font-bold">[INFO]</span> Agent started successfully on port 443</div>
                            <div><span className="text-blue-400 font-bold">[INFO]</span> Connected to control plane at 10.0.0.1</div>
                            <div><span className="text-blue-400 font-bold">[INFO]</span> Heartbeat sent (seq=1204)</div>
                            <div><span className="text-blue-400 font-bold">[INFO]</span> Checking for updates... found v2.20.0</div>
                            <div className="text-yellow-400 font-medium"><span className="text-yellow-500 font-bold">[WARN]</span> High latency detected on previous check (150ms)</div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 text-[13px] shadow-sm">
                                <Download size={14} className="mr-2" /> Download Logs
                            </Button>
                            <Button variant="outline" className="flex-1 text-[13px] shadow-sm">
                                <RefreshCw size={14} className="mr-2" /> Restart Agent
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
