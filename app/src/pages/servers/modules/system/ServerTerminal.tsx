import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Maximize2, Minimize2, Power, RefreshCw, Terminal as TerminalIcon } from "lucide-react";

export default function ServerTerminal() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [status, setStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            theme: {
                background: "#09090b", // zinc-950
                foreground: "#f4f4f5", // zinc-100
                cursor: "#3b82f6", // blue-500
            },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Simulate Connection
        term.writeln("\x1b[34m➜\x1b[0m Connecting to server...");

        setTimeout(() => {
            term.writeln("\x1b[32m✓\x1b[0m Connected to production-db (10.0.0.5)");
            term.writeln("Last login: " + new Date().toLocaleString());
            term.write("\r\n\x1b[32madmin@production-db\x1b[0m:\x1b[34m~\x1b[0m$ ");
            setStatus("connected");
        }, 1500);

        // Handle Input (Mock Echo)
        term.onData((data) => {
            const code = data.charCodeAt(0);
            if (code === 13) { // Enter
                term.write("\r\n");
                term.write("\x1b[32madmin@production-db\x1b[0m:\x1b[34m~\x1b[0m$ ");
            } else {
                term.write(data);
            }
        });

        // Handle Resize
        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        return () => {
            term.dispose();
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        // Wait for transition animation
        setTimeout(() => fitAddonRef.current?.fit(), 300);
    };

    return (
        <div className={`flex flex-col bg-[#09090b] text-zinc-400 rounded-sm overflow-hidden border border-zinc-800 shadow-2xl transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen w-screen" : "h-[600px] w-full"
            }`}>
            {/* Terminal Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 select-none">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                    </div>
                    <div className="h-4 w-px bg-zinc-800 mx-2"></div>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <TerminalIcon size={12} />
                        <span>ssh admin@10.0.0.5</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5 ${status === "connected" ? "bg-green-900/30 text-green-400" :
                            status === "connecting" ? "bg-yellow-900/30 text-yellow-400" :
                                "bg-red-900/30 text-red-400"
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-green-500" : "bg-current"}`}></span>
                        {status}
                    </span>
                    <button onClick={() => xtermRef.current?.clear()} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={toggleFullscreen} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button onClick={() => setStatus("disconnected")} className="p-1.5 hover:bg-red-900/30 rounded text-zinc-500 hover:text-red-400 transition-colors">
                        <Power size={14} />
                    </button>
                </div>
            </div>

            {/* xterm Container */}
            <div className="flex-1 relative p-4">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
}
