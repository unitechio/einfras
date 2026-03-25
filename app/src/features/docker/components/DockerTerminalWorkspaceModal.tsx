import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, ClipboardPaste, Maximize2, Minimize2, PlugZap, Terminal as TerminalIcon, X } from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { apiFetch, buildApiWebSocketUrl } from "@/core/api-client";
import { useNotification } from "@/core/NotificationContext";

export type DockerTerminalWorkspaceSession = {
    tabId: string;
    containerName: string;
    containerId: string;
    environmentId: string;
    sessionId?: string;
};

type DockerTerminalWorkspaceModalProps = {
    isOpen: boolean;
    onClose: () => void;
    sessions: DockerTerminalWorkspaceSession[];
    activeTabId: string;
    onActivateTab: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onUpdateSession: (tabId: string, patch: Partial<DockerTerminalWorkspaceSession>) => void;
};

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

export default function DockerTerminalWorkspaceModal({
    isOpen,
    onClose,
    sessions,
    activeTabId,
    onActivateTab,
    onCloseTab,
    onUpdateSession,
}: DockerTerminalWorkspaceModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = "unset";
            return;
        }
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    const activeSession = useMemo(
        () => sessions.find((item) => item.tabId === activeTabId) ?? sessions[0] ?? null,
        [activeTabId, sessions],
    );

    if (!isOpen || sessions.length === 0 || !activeSession) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`flex flex-col border border-zinc-200 bg-[#0A0A0A] shadow-2xl transition-all duration-300 dark:border-zinc-800 ${
                isMaximized ? "absolute inset-0 h-full w-full rounded-none" : "h-[78vh] w-full max-w-7xl rounded-xl"
            }`}>
                <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-[#121212]">
                    <div className="flex min-w-0 items-center gap-3">
                        <TerminalIcon size={16} className="text-blue-500" />
                        <div className="min-w-0">
                            <div className="truncate font-mono text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                                Runtime terminal workspace
                            </div>
                            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                {sessions.length} active session{sessions.length === 1 ? "" : "s"} across containers
                            </div>
                        </div>
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

                <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-800 bg-[#101010] px-3 py-2">
                    {sessions.map((session) => {
                        const isActive = session.tabId === activeSession.tabId;
                        return (
                            <div
                                key={session.tabId}
                                className={`group inline-flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
                                    isActive
                                        ? "border-blue-500/40 bg-blue-500/10 text-blue-100"
                                        : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => onActivateTab(session.tabId)}
                                    className="inline-flex min-w-0 items-center gap-2"
                                >
                                    <PlugZap className={`h-3.5 w-3.5 ${session.sessionId ? "text-emerald-400" : "text-zinc-500"}`} />
                                    <span className="max-w-[180px] truncate font-medium" title={session.containerName}>
                                        {session.containerName}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onCloseTab(session.tabId)}
                                    className="rounded-md p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="relative flex-1 bg-black">
                    {sessions.map((session) => (
                        <div
                            key={session.tabId}
                            className={session.tabId === activeSession.tabId ? "h-full w-full" : "hidden"}
                        >
                            <DockerTerminalPane
                                session={session}
                                active={session.tabId === activeSession.tabId}
                                onUpdateSession={(patch) => onUpdateSession(session.tabId, patch)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DockerTerminalPane({
    session,
    active,
    onUpdateSession,
}: {
    session: DockerTerminalWorkspaceSession;
    active: boolean;
    onUpdateSession: (patch: Partial<DockerTerminalWorkspaceSession>) => void;
}) {
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
        if (!terminalRef.current) {
            return;
        }
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
        term.attachCustomKeyEventHandler((event) => {
            const isMeta = event.ctrlKey || event.metaKey;
            const lowerKey = event.key.toLowerCase();
            if (isMeta && lowerKey === "c" && term.hasSelection()) {
                void navigator.clipboard?.writeText(term.getSelection());
                return false;
            }
            if (isMeta && lowerKey === "v") {
                void navigator.clipboard?.readText().then((text) => {
                    if (!text) {
                        return;
                    }
                    if (fallbackModeRef.current) {
                        fallbackBufferRef.current += text;
                        term.write(text.replace(/\n/g, "\r\n"));
                        return;
                    }
                    socketRef.current?.send(JSON.stringify({ type: "input", data: text }));
                }).catch(() => undefined);
                return false;
            }
            return true;
        });
        term.open(terminalRef.current);
        fitAddon.fit();
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        return () => {
            term.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!xtermRef.current || !fitAddonRef.current) {
            return;
        }
        if (active) {
            const timer = window.setTimeout(() => {
                fitAddonRef.current?.fit();
                xtermRef.current?.focus();
                const dimensions = fitAddonRef.current?.proposeDimensions();
                if (socketRef.current?.readyState === WebSocket.OPEN && dimensions) {
                    socketRef.current.send(JSON.stringify({ type: "resize", data: JSON.stringify({ cols: dimensions.cols, rows: dimensions.rows }) }));
                }
            }, 80);
            return () => window.clearTimeout(timer);
        }
    }, [active]);

    useEffect(() => {
        const term = xtermRef.current;
        const fitAddon = fitAddonRef.current;
        if (!term || !fitAddon) {
            return;
        }

        term.reset();
        term.writeln(`Connecting to ${session.containerName} (${session.containerId.substring(0, 12)})`);
        term.writeln(session.sessionId ? "Restoring interactive runtime session..." : "Interactive runtime session is being established...");
        setConnectionStatus("connecting");

        const endpoint = session.sessionId
            ? `/ws/terminal?session_id=${encodeURIComponent(session.sessionId)}`
            : `/ws/terminal?runtime=docker&environment_id=${encodeURIComponent(session.environmentId)}&container_id=${encodeURIComponent(session.containerId)}`;
        const socket = new WebSocket(buildApiWebSocketUrl(endpoint));
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
                        const response = await apiFetch<{ output: string }>(`/v1/environments/${session.environmentId}/docker/containers/${session.containerId}/exec`, {
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
            term.writeln(session.sessionId ? "Interactive websocket reconnected." : "Interactive websocket connected.");
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
                const message = JSON.parse(String(event.data)) as { type?: string; message?: string; status?: string; session_id?: string; resumed?: boolean };
                if (message.session_id) {
                    onUpdateSession({ sessionId: message.session_id });
                }
                if (message.type === "error") {
                    enableFallbackMode(message.message ?? "Session error");
                    return;
                }
                if (message.type === "status" && message.status === "connected") {
                    if (message.message) {
                        term.writeln(message.message);
                    }
                    return;
                }
                if (message.type === "status" && message.status === "closed") {
                    setConnectionStatus((current) => current === "fallback" ? current : "closed");
                    if (message.message) {
                        term.writeln(`\r\n${message.message}`);
                    }
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
                description: `Websocket exec is unavailable for ${session.containerName}, so terminal switched to command mode.`,
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
                term.writeln("\r\nInteractive session disconnected. Reopen or refresh this tab to resume if the backend session is still alive.");
            }
        };

        const promptTimeout = window.setTimeout(() => {
            if (!fallbackModeRef.current && socket.readyState === WebSocket.OPEN && !receivedPayload) {
                showNotification({
                    type: "warning",
                    message: "Docker terminal fallback",
                    description: `Interactive shell did not become ready for ${session.containerName}, so terminal switched to command mode.`,
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

        return () => {
            disposable.dispose();
            window.clearTimeout(connectionTimeout);
            window.clearTimeout(promptTimeout);
            window.removeEventListener("resize", handleResize);
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            socketRef.current = null;
            fallbackModeRef.current = false;
            fallbackRunningRef.current = false;
            fallbackBufferRef.current = "";
        };
    }, [session.containerId, session.containerName, session.environmentId, session.sessionId, onUpdateSession, showNotification]);

    const copySelection = async () => {
        const selection = xtermRef.current?.getSelection() || "";
        if (selection) {
            await navigator.clipboard?.writeText(selection);
        }
    };

    const pasteClipboard = async () => {
        const text = await navigator.clipboard?.readText();
        if (!text) {
            return;
        }
        if (fallbackModeRef.current) {
            fallbackBufferRef.current += text;
            xtermRef.current?.write(text.replace(/\n/g, "\r\n"));
            return;
        }
        socketRef.current?.send(JSON.stringify({ type: "input", data: text }));
    };

    return (
        <div className="flex h-full min-w-0 flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-[#111111] px-4 py-2.5">
                <div className="min-w-0">
                    <div className="truncate font-mono text-[13px] font-medium text-zinc-100" title={session.containerName}>
                        {session.containerName}
                    </div>
                    <div className="truncate text-xs text-zinc-500" title={session.containerId}>
                        {session.containerId}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        connectionStatus === "connected"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : connectionStatus === "connecting"
                                ? "bg-amber-500/10 text-amber-400"
                                : connectionStatus === "fallback"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : connectionStatus === "error"
                                        ? "bg-red-500/10 text-red-400"
                                        : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                        <PlugZap size={12} />
                        {connectionStatus}
                    </span>
                    <button
                        type="button"
                        onClick={() => void copySelection()}
                        className="rounded-md border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                        title="Copy selected terminal text"
                    >
                        <ClipboardCopy className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void pasteClipboard()}
                        className="rounded-md border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                        title="Paste from clipboard"
                    >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                    </button>
                    {session.sessionId ? (
                        <span className="hidden rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500 md:inline-flex">
                            restorable
                        </span>
                    ) : (
                        <span className="hidden rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600 md:inline-flex">
                            new session
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-1 bg-black p-4">
                <div ref={terminalRef} className="h-full w-full" />
            </div>
        </div>
    );
}
