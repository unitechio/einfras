"use client";

import React from "react";
import { Activity, Search, Filter, Clock } from "lucide-react";

export default function EventsPage() {
    const events = [
        { id: 1, type: "Login", user: "Admin", description: "Successful login from 192.168.1.1", time: "2 mins ago", severity: "info" },
        { id: 2, type: "Update", user: "DevOps", description: "Modified Environment Production-Cluster-01", time: "15 mins ago", severity: "warning" },
        { id: 3, type: "Security", user: "System", description: "Blocked unusual traffic on Port 22", time: "1 hour ago", severity: "danger" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Audit Events</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Track all system activities and security logs.</p>
                </div>
                <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all">
                    <Filter size={18} />
                    <span>Filters</span>
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="relative w-full max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search audit logs..."
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {events.map((event) => (
                        <div key={event.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-lg ${event.severity === 'danger' ? 'bg-red-100 dark:bg-red-900/20 text-red-600' :
                                    event.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' :
                                        'bg-blue-100 dark:bg-blue-900/20 text-blue-600'
                                }`}>
                                <Activity size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-zinc-900 dark:text-white">{event.type}</span>
                                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                                        <Clock size={12} /> {event.time}
                                    </div>
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">{event.description}</p>
                                <div className="mt-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    Actor: <span className="text-blue-500">{event.user}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/5 text-center">
                    <button className="text-blue-500 hover:text-blue-600 text-xs font-bold uppercase tracking-widest">Load older events</button>
                </div>
            </div>
        </div>
    );
}
