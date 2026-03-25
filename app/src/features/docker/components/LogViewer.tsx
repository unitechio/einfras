import { useEffect, useMemo, useRef, useState } from "react";

export function stripAnsi(value: string) {
    return value
        .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
        .replace(/\r/g, "");
}

export default function LogViewer({
    value,
    emptyMessage,
    className = "",
    autoScroll = true,
    status,
    scrollToLatestSignal = 0,
}: {
    value?: string;
    emptyMessage: string;
    className?: string;
    autoScroll?: boolean;
    status?: string;
    scrollToLatestSignal?: number;
}) {
    const normalized = useMemo(() => stripAnsi(value || "").trimEnd(), [value]);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [isPinnedToBottom, setIsPinnedToBottom] = useState(autoScroll);

    useEffect(() => {
        setIsPinnedToBottom(autoScroll);
    }, [autoScroll]);

    useEffect(() => {
        if (!scrollRef.current) {
            return;
        }
        if (isPinnedToBottom) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [normalized, isPinnedToBottom]);

    useEffect(() => {
        if (!scrollRef.current) {
            return;
        }
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        setIsPinnedToBottom(true);
    }, [scrollToLatestSignal]);

    const handleScroll = () => {
        const container = scrollRef.current;
        if (!container) {
            return;
        }
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
        setIsPinnedToBottom(distanceFromBottom < 24);
    };

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={`min-w-0 overflow-auto bg-black ${className}`}
        >
            <pre className="inline-block min-w-full whitespace-pre p-4 font-mono text-xs leading-6 text-zinc-200">
                {normalized || emptyMessage}
            </pre>
            {status === "connecting" ? (
                <div className="sticky bottom-3 right-3 ml-auto mr-3 w-fit rounded-full border border-zinc-700 bg-zinc-900/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                    Connecting live stream
                </div>
            ) : status === "paused" ? (
                <div className="sticky bottom-3 right-3 ml-auto mr-3 w-fit rounded-full border border-amber-700 bg-amber-950/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                    Stream paused
                </div>
            ) : null}
        </div>
    );
}
