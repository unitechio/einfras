import { Activity, ShieldCheck, Download, RefreshCw, Server, Zap } from "lucide-react";

export default function AgentManagementPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-green-500" /> Agent Management
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Monitor and update the security agent deployed on this node.
                    </p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                    <RefreshCw size={16} /> Upgrade Agent
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 flex items-start gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-500">Status</div>
                        <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">Online</div>
                        <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <Zap size={10} fill="currentColor" /> Connected via Agent Protocol
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 flex items-start gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-lg">
                        <Server size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-500">Version</div>
                        <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">v2.19.4</div>
                        <div className="text-xs text-zinc-400 mt-1">Latest is v2.20.0 (Update available)</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 flex items-start gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-500">Heartbeat</div>
                        <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">24ms</div>
                        <div className="text-xs text-zinc-400 mt-1">Last seen: Just now</div>
                    </div>
                </div>
            </div>

            {/* Configuration Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-4">Tunnel Configuration</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-800 rounded-sm">
                            <div>
                                <div className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Reverse Tunnel</div>
                                <div className="text-xs text-zinc-500">Allow inbound connections without opening ports</div>
                            </div>
                            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-500 cursor-pointer">
                                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-800 rounded-sm">
                            <div>
                                <div className="font-bold text-sm text-zinc-700 dark:text-zinc-300">mTLS Encryption</div>
                                <div className="text-xs text-zinc-500">Enforce mutual TLS for all agent traffic</div>
                            </div>
                            <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-green-500 cursor-pointer">
                                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6">
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-4">Debug & Logs</h3>
                    <div className="space-y-3">
                        <div className="bg-zinc-950 text-zinc-400 font-mono text-xs p-4 rounded-sm h-32 overflow-y-auto">
                            <div>[INFO] Agent started successfully on port 443</div>
                            <div>[INFO] Connected to control plane at 10.0.0.1</div>
                            <div>[INFO] Heartbeat sent (seq=1204)</div>
                            <div>[INFO] Checking for updates... found v2.20.0</div>
                            <div className="text-yellow-400">[WARN] High latency detected on previous check (150ms)</div>
                        </div>
                        <div className="flex gap-2">
                            <button className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-2 rounded-sm text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                <Download size={14} /> Download Logs
                            </button>
                            <button className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-2 rounded-sm text-xs font-bold transition-colors flex items-center justify-center gap-2">
                                <RefreshCw size={14} /> Restart Agent
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
