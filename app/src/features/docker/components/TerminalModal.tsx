import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, PlugZap, Terminal as TerminalIcon, X } from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { apiFetch, buildApiWebSocketUrl } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    containerName: string;
    containerId: string;
    environmentId: string;
}

type ConnectionState = "connecting" | "connected" | "closed" | "error" | "fallback";

const shellCandidates = [
    ["sh", "-lc"],
    ["/bin/sh", "-lc"],
    ["bash", "-lc"],
    ["/bin/bash", "-lc"],
    ["ash", "-lc"],
    ["/bin/ash", "-lc"],
    ["busybox", "sh", "-lc"],
    ["pwsh", "-Command"],
    ["powershell", "-Command"],
    ["powershell.exe", "-Command"],
    ["cmd", "/C"],
    ["cmd.exe", "/C"],
];

export default function TerminalModal({ isOpen, onClose, containerName, containerId, environmentId }: TerminalModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("connecting");
    const terminalRef = useRef<HTMLDivElement | null>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const fallbackBufferRef = useRef("");
    const fallbackModeRef = useRef(false);
    const fallbackRunningRef = useRef(false);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (!isOpen || !terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            convertEol: true,
            theme: {
                background: "#000000",
                foreground: "#e4e4e7",
                cursor: "#60a5fa",
            },
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        term.focus();
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        term.writeln(`Connected to ${containerName} (${containerId.substring(0, 12)})`);
        term.writeln("Interactive runtime session is being established...");

        const socket = new WebSocket(
            buildApiWebSocketUrl(
                `/ws/terminal?runtime=docker&environment_id=${encodeURIComponent(environmentId)}&container_id=${encodeURIComponent(containerId)}`,
            ),
        );
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;
        let established = false;
        let receivedPayload = false;

        const sendResize = () => {
            const dimensions = fitAddon.proposeDimensions();
            if (socket.readyState === WebSocket.OPEN && dimensions) {
                socket.send(JSON.stringify({ type: "resize", data: JSON.stringify({ cols: dimensions.cols, rows: dimensions.rows }) }));
            }
        };

        const runFallbackCommand = async (command: string) => {
            const trimmed = command.trim();
            if (!trimmed || fallbackRunningRef.current) {
                return;
            }
            fallbackRunningRef.current = true;
            term.write("\r\n");
            try {
                let output = "";
                let lastError: Error | null = null;
                for (const candidate of shellCandidates) {
                    try {
                        const response = await apiFetch<{ output: string }>(`/v1/environments/${environmentId}/docker/containers/${containerId}/exec`, {
                            method: "POST",
                            body: JSON.stringify({ command: [...candidate, trimmed] }),
                        });
                        output = response.output ?? "";
                        lastError = null;
                        break;
                    } catch (error) {
                        lastError = error instanceof Error ? error : new Error("Command execution failed");
                    }
                }
                if (lastError) {
                    throw lastError;
                }
                if (output) {
                    term.write(output.replace(/\n/g, "\r\n"));
                    if (!output.endsWith("\n")) {
                        term.write("\r\n");
                    }
                }
            } catch (error) {
                term.writeln(`\x1b[31m${error instanceof Error ? error.message : "Command execution failed"}\x1b[0m`);
            } finally {
                fallbackRunningRef.current = false;
                fallbackBufferRef.current = "";
                term.write("$ ");
            }
        };

        const enableFallbackMode = (message?: string) => {
            if (fallbackModeRef.current) {
                return;
            }
            fallbackModeRef.current = true;
            established = true;
            setConnectionStatus("fallback");
            term.writeln("");
            term.writeln("\x1b[33mRealtime websocket exec is unavailable. Switched to command mode.\x1b[0m");
            if (message) {
                term.writeln(`\x1b[33m${message}\x1b[0m`);
            }
            term.writeln("Type a command and press Enter.");
            term.write("$ ");
        };

        const connectionTimeout = window.setTimeout(() => {
            if (socket.readyState !== WebSocket.OPEN) {
                enableFallbackMode("Interactive session timed out while connecting.");
            }
        }, 8000);

        socket.onopen = () => {
            established = true;
            setConnectionStatus("connected");
            window.clearTimeout(connectionTimeout);
            term.writeln("");
            term.writeln("Interactive websocket connected.");
            socket.send(JSON.stringify({ type: "input", data: "\n" }));
            sendResize();
        };
        socket.onmessage = (event) => {
            established = true;
            receivedPayload = true;
            setConnectionStatus("connected");
            if (typeof event.data !== "string") {
                void new Response(event.data).text().then((text) => {
                    xtermRef.current?.write(text);
                });
                return;
            }
            try {
                const message = JSON.parse(String(event.data)) as { type?: string; message?: string; status?: string };
                if (message.type === "error") {
                    enableFallbackMode(message.message ?? "Session error");
                    return;
                }
                if (message.type === "status" && message.status === "connected") {
                    term.writeln(message.message ?? "Session connected");
                    return;
                }
                if (message.type === "status" && message.status === "closed") {
                    setConnectionStatus((current) => current === "fallback" ? current : "closed");
                    term.writeln("\r\nSession closed.");
                    return;
                }
            } catch {
                term.write(String(event.data));
            }
        };
        socket.onerror = () => {
            window.clearTimeout(connectionTimeout);
            showNotification({
                type: "warning",
                message: "Docker terminal fallback",
                description: `Websocket exec is unavailable for ${containerName}, so terminal switched to command mode.`,
            });
            enableFallbackMode("Unable to open interactive websocket session.");
        };
        socket.onclose = () => {
            window.clearTimeout(connectionTimeout);
            if (!established) {
                enableFallbackMode("Interactive session closed before the shell was ready.");
                return;
            }
            setConnectionStatus((current) => (current === "fallback" || current === "error" ? current : "closed"));
            if (!fallbackModeRef.current) {
                term.writeln("\r\nInteractive session closed.");
            }
        };

        const promptTimeout = window.setTimeout(() => {
            if (!fallbackModeRef.current && socket.readyState === WebSocket.OPEN && !receivedPayload) {
                showNotification({
                    type: "warning",
                    message: "Docker terminal fallback",
                    description: `Interactive shell did not become ready for ${containerName}, so terminal switched to command mode.`,
                });
                enableFallbackMode("Interactive shell did not emit a prompt or output in time.");
            }
        }, 4000);

        const disposable = term.onData((data) => {
            if (fallbackModeRef.current) {
                if (data === "\r") {
                    const command = fallbackBufferRef.current;
                    void runFallbackCommand(command);
                    return;
                }
                if (data === "\u007F") {
                    if (fallbackBufferRef.current.length > 0) {
                        fallbackBufferRef.current = fallbackBufferRef.current.slice(0, -1);
                        term.write("\b \b");
                    }
                    return;
                }
                if (data === "\u0003") {
                    fallbackBufferRef.current = "";
                    term.write("^C\r\n$ ");
                    return;
                }
                fallbackBufferRef.current += data;
                term.write(data);
                return;
            }
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }
            socket.send(JSON.stringify({ type: "input", data }));
        });

        const handleResize = () => {
            fitAddon.fit();
            sendResize();
        };
        window.addEventListener("resize", handleResize);
        document.body.style.overflow = "hidden";

        return () => {
            disposable.dispose();
            window.clearTimeout(connectionTimeout);
            window.clearTimeout(promptTimeout);
            window.removeEventListener("resize", handleResize);
            document.body.style.overflow = "unset";
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "close", data: "" }));
                socket.close();
            }
            term.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
            socketRef.current = null;
            fallbackModeRef.current = false;
            fallbackRunningRef.current = false;
            fallbackBufferRef.current = "";
        };
    }, [containerId, containerName, environmentId, isOpen, showNotification]);

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = "unset";
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => {
            fitAddonRef.current?.fit();
            const dimensions = fitAddonRef.current?.proposeDimensions();
            if (socketRef.current?.readyState === WebSocket.OPEN && dimensions) {
                socketRef.current.send(JSON.stringify({ type: "resize", data: JSON.stringify({ cols: dimensions.cols, rows: dimensions.rows }) }));
            }
            xtermRef.current?.focus();
        }, 200);
        return () => window.clearTimeout(timer);
    }, [isMaximized, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`flex flex-col border border-zinc-200 bg-[#0A0A0A] shadow-2xl transition-all duration-300 dark:border-zinc-800 ${
                isMaximized ? "absolute inset-0 h-full w-full rounded-none" : "h-[72vh] w-full max-w-6xl rounded-xl"
            }`}>
                <div className="flex items-center justify-between rounded-t-xl border-b border-zinc-200 bg-white px-4 py-3 select-none dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <TerminalIcon size={16} className="text-blue-500" />
                        <span className="font-mono text-[13px] font-medium">
                            {containerName} <span className="text-xs text-zinc-500">interactive runtime terminal</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            connectionStatus === "connected"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : connectionStatus === "connecting"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : connectionStatus === "fallback"
                                        ? "bg-blue-500/10 text-blue-500"
                                        : connectionStatus === "error"
                                            ? "bg-red-500/10 text-red-500"
                                            : "bg-zinc-500/10 text-zinc-500"
                        }`}>
                            <PlugZap size={12} />
                            {connectionStatus}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setIsMaximized((current) => !current)}
                            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white"
                        >
                            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/20 hover:text-red-400 dark:text-zinc-400"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-black p-4">
                    <div ref={terminalRef} className="h-full w-full" />
                </div>
            </div>
        </div>
    );
}
