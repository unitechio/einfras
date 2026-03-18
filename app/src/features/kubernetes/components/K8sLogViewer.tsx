"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Play, Pause, Trash2, Download, Search, Settings, ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";

interface LogLine {
    id: string;
    timestamp: string;
    content: string;
    type: "info" | "warn" | "error" | "system";
}

interface LogViewerProps {
    lines: LogLine[];
    onClear?: () => void;
    onDownload?: () => void;
    isLoading?: boolean;
}

export function K8sLogViewer({ lines, onClear, onDownload, isLoading }: LogViewerProps) {
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState("");
    const scrollViewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll && scrollViewportRef.current) {
            scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
        }
    }, [lines, autoScroll]);

    const filteredLines = lines.filter(l => 
        l.content.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] dark:bg-[#020202] rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl relative">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        <TerminalIcon size={16} className="text-indigo-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                             Container Logs
                             {isLoading && <RefreshCw size={12} className="animate-spin text-zinc-500" />}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-medium font-mono uppercase tracking-tighter">Live Streaming Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="relative mr-2">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Filter logs..."
                            className="bg-transparent border-none text-xs text-zinc-200 focus:ring-0 w-32 pl-8 py-1.5"
                        />
                    </div>
                    
                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-8 w-8", autoScroll ? "text-emerald-500" : "text-zinc-500")}
                        onClick={() => setAutoScroll(!autoScroll)}
                        title={autoScroll ? "Pause autoscroll" : "Resume autoscroll"}
                    >
                        {autoScroll ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-red-500"
                        onClick={onClear}
                        title="Clear console"
                    >
                        <Trash2 size={14} />
                    </Button>

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-blue-500"
                        onClick={onDownload}
                        title="Download logs"
                    >
                        <Download size={14} />
                    </Button>
                </div>
            </div>

            {/* Viewport */}
            <div 
                ref={scrollViewportRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-6 font-mono text-xs leading-relaxed selection:bg-indigo-500/30 custom-scrollbar scroll-smooth"
            >
                {filteredLines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none pointer-events-none">
                        <TerminalIcon size={48} className="mb-4" />
                        <p className="tracking-widest uppercase">Waiting for output...</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredLines.map((line) => (
                            <div 
                                key={line.id} 
                                className={cn(
                                    "flex gap-4 group hover:bg-white/5 transition-colors -mx-2 px-2 rounded-sm",
                                    line.type === "error" && "text-red-400 bg-red-400/5",
                                    line.type === "warn" && "text-amber-400 bg-amber-400/5",
                                    line.type === "system" && "text-indigo-400 font-bold"
                                )}
                            >
                                <span className="opacity-30 select-none whitespace-nowrap tabular-nums">
                                    {line.timestamp}
                                </span>
                                <span className="flex-1 break-all text-zinc-300 group-hover:text-zinc-100">
                                    {line.content}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected</span>
                    <span>Buffer: {lines.length} lines</span>
                </div>
                <div className="uppercase tracking-widest opacity-50">UTF-8 / xterm-256color</div>
            </div>
        </div>
    );
}
