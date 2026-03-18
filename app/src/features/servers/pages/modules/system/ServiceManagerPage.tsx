import { useState } from "react";
import { Play, Square, RotateCcw, Search, Settings } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function ServiceManagerPage() {
    // Mock Services
    const [services] = useState([
        { name: "nginx", description: "High performance web server", status: "running", startup: "enabled" },
        { name: "docker", description: "Docker Application Container Engine", status: "running", startup: "enabled" },
        { name: "mysql", description: "MySQL Community Server", status: "stopped", startup: "disabled" },
        { name: "ssh", description: "OpenBSD Secure Shell server", status: "running", startup: "enabled" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg border border-orange-100/50 dark:border-orange-500/20">
                            <Settings className="text-orange-500" size={20} />
                        </div>
                        Service Management
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Control system services (systemd / Windows Services).
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 p-4 rounded-xl flex gap-4 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <Input
                        type="text"
                        placeholder="Filter services..."
                        className="pl-10 w-full"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Startup</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.map((svc) => (
                            <TableRow key={svc.name} className="group hover:bg-orange-50/20 dark:hover:bg-orange-500/5 transition-colors">
                                <TableCell className="font-semibold text-zinc-900 dark:text-white font-mono text-[13px]">{svc.name}</TableCell>
                                <TableCell className="text-zinc-500 text-[13px]">{svc.description}</TableCell>
                                <TableCell>
                                    <Badge variant={svc.status === "running" ? "success" : "error"}>
                                        {svc.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className={`font-mono text-[12px] font-medium px-2 py-0.5 rounded-md border ${svc.startup === "enabled" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" : "bg-transparent text-zinc-400 border-transparent"}`}>
                                        {svc.startup}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        {svc.status === "running" ? (
                                            <Button variant="ghost" size="icon" title="Stop" className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20">
                                                <Square size={14} fill="currentColor" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" title="Start" className="h-8 w-8 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20">
                                                <Play size={14} fill="currentColor" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" title="Restart" className="h-8 w-8 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20">
                                            <RotateCcw size={14} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
