"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

import { buildApiWebSocketUrl } from "@/core/api-client";
import { cn } from "@/lib/utils";

type K8sPodExecTerminalProps = {
    clusterId: string;
    namespace: string;
    podName: string;
    containerName?: string;
    active: boolean;
};

type ConnectionState = "connecting" | "connected" | "closed" | "error";

export function K8sPodExecTerminal({ clusterId, namespace, podName, containerName = "", active }: K8sPodExecTerminalProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const [sessionId, setSessionId] = useState("");
    const [status, setStatus] = useState<ConnectionState>("connecting");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!active || !hostRef.current || !clusterId || !podName) {
            return;
        }

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            convertEol: true,
            theme: {
                background: "#050505",
                foreground: "#e4e4e7",
                cursor: "#38bdf8",
            },
        });
        const inputEncoder = new TextEncoder();
        const outputDecoder = new TextDecoder();
        term.attachCustomKeyEventHandler((event) => {
            const lowerKey = event.key.toLowerCase();
            const isMeta = event.ctrlKey || event.metaKey;
            if (isMeta && lowerKey === "c" && term.hasSelection()) {
                void navigator.clipboard?.writeText(term.getSelection());
                return false;
            }
            // Let xterm/browser handle paste so onData emits the payload once.
            return true;
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(hostRef.current);
        fitAddon.fit();
        term.focus();
        term.writeln(`Connecting to pod ${podName} in namespace ${namespace}...`);

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;

        const socket = new WebSocket(
            buildApiWebSocketUrl(
                sessionId
                    ? `/ws/terminal?session_id=${encodeURIComponent(sessionId)}`
                    : `/ws/terminal?runtime=kubernetes&environment_id=${encodeURIComponent(clusterId)}&namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(podName)}${containerName ? `&container=${encodeURIComponent(containerName)}` : ""}`,
            ),
        );
        socket.binaryType = "arraybuffer";
        socketRef.current = socket;

        const sendResize = () => {
            const dimensions = fitAddon.proposeDimensions();
            if (socket.readyState === WebSocket.OPEN && dimensions) {
                socket.send(JSON.stringify({ type: "resize", cols: dimensions.cols, rows: dimensions.rows }));
            }
        };

        socket.onopen = () => {
            setStatus("connected");
            term.writeln("Interactive pod shell connected.");
            sendResize();
        };
        socket.onmessage = (event) => {
            if (typeof event.data !== "string") {
                const chunk = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : event.data;
                const text = outputDecoder.decode(chunk, { stream: true });
                if (text) {
                    terminalRef.current?.write(text);
                }
                return;
            }
            try {
                const message = JSON.parse(event.data) as { type?: string; status?: string; message?: string; session_id?: string };
                if (message.session_id) {
                    setSessionId(message.session_id);
                }
                if (message.type === "status" && message.message) {
                    term.writeln(message.message);
                    if (message.status === "closed") {
                        setStatus("closed");
                    }
                    return;
                }
                if (message.type === "error") {
                    setStatus("error");
                    setErrorMessage(message.message || "Interactive pod shell failed.");
                    term.writeln(message.message || "Interactive pod shell failed.");
                    return;
                }
            } catch {
                term.write(String(event.data));
            }
        };
        socket.onerror = () => {
            setStatus("error");
            setErrorMessage("Unable to establish Kubernetes pod websocket.");
        };
        socket.onclose = () => {
            setStatus((current) => (current === "error" ? current : "closed"));
            term.writeln("\r\nPod shell closed.");
        };

        const disposable = term.onData((data) => {
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }
            socket.send(inputEncoder.encode(data));
        });

        const handleResize = () => {
            fitAddon.fit();
            sendResize();
        };

        window.addEventListener("resize", handleResize);
        return () => {
            disposable.dispose();
            window.removeEventListener("resize", handleResize);
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "close", data: "" }));
                socket.close();
            }
            term.dispose();
            terminalRef.current = null;
            fitAddonRef.current = null;
            socketRef.current = null;
        };
    }, [active, clusterId, containerName, namespace, podName, sessionId]);

    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                        <TerminalIcon size={15} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pod Exec</div>
                        <div className="text-[11px] text-zinc-500">
                            Interactive shell for {podName}{containerName ? ` / ${containerName}` : ""}
                        </div>
                    </div>
                </div>
                <div className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                    status === "connected" ? "bg-emerald-500/10 text-emerald-500" :
                    status === "connecting" ? "bg-amber-500/10 text-amber-500" :
                    status === "error" ? "bg-red-500/10 text-red-500" :
                    "bg-zinc-500/10 text-zinc-500",
                )}>
                    <RefreshCw className={cn("h-3 w-3", status === "connecting" && "animate-spin")} />
                    {status}
                </div>
            </div>
            <div className="h-[360px] p-4">
                <div ref={hostRef} className="h-full w-full" />
            </div>
            {errorMessage ? (
                <div className="border-t border-zinc-200 px-4 py-3 text-xs text-red-500 dark:border-zinc-800">
                    {errorMessage}
                </div>
            ) : null}
        </div>
    );
}
