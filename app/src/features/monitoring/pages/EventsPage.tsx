"use client";

import { useState } from "react";
import { Activity, Search, Filter, Clock, ShieldAlert, Zap, ServerCrash } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";

export default function EventsPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const events = [
        { id: 1, type: "Login", user: "Admin", description: "Successful login from 192.168.1.1", time: "2 mins ago", severity: "info", icon: Activity },
        { id: 2, type: "Update", user: "DevOps", description: "Modified Environment Production-Cluster-01", time: "15 mins ago", severity: "warning", icon: Zap },
        { id: 3, type: "Security", user: "System", description: "Blocked unusual traffic on Port 22", time: "1 hour ago", severity: "danger", icon: ShieldAlert },
        { id: 4, type: "System", user: "System", description: "Application container crashed and restarted", time: "3 hours ago", severity: "danger", icon: ServerCrash },
    ];

    const filteredEvents = events.filter(e => 
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Activity className="h-6 w-6 text-indigo-500" />
                        Platform Events
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Track system activities, alerts, and security logs in real-time.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filters</Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-md">
                    <Input 
                        icon={<Search className="h-4 w-4 text-zinc-400" />} 
                        placeholder="Search events... (e.g. login, system, DevOps)" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredEvents.length === 0 ? (
                        <div className="p-16 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                            <Activity size={32} className="mb-3 opacity-20" />
                            <p className="text-[13px] font-medium">No events found matching your criteria.</p>
                        </div>
                    ) : (
                        filteredEvents.map((event) => {
                            const Icon = event.icon;
                            return (
                                <div key={event.id} className="p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors flex items-start gap-4 group cursor-default">
                                    <div className={cn(
                                        "mt-0.5 p-2 rounded-lg flex-shrink-0 transition-colors", 
                                        event.severity === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20' :
                                        event.severity === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20' :
                                        'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20'
                                    )}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{event.type}</span>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">{event.user}</Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                                <Clock size={12} className="opacity-70" /> {event.time}
                                            </div>
                                        </div>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{event.description}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {filteredEvents.length > 0 && (
                    <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 text-center">
                        <Button variant="ghost" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-xs font-semibold uppercase tracking-widest w-full">
                            Load Older Events
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
