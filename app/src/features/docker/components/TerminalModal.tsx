import { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from "lucide-react";

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    containerName: string;
    containerId: string;
}

export default function TerminalModal({ isOpen, onClose, containerName, containerId }: TerminalModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [command, setCommand] = useState("");
    const [history, setHistory] = useState([
        { type: 'system', text: `Connected to container: ${containerName} (${containerId.substring(0, 12)})` },
        { type: 'system', text: `Terminal proxy ready. Type commands to interact with the container runtime.` },
        { type: 'output', text: `root@${containerId.substring(0, 12)}:/# ` }
    ]);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
            inputRef.current?.focus();
        }
    }, [history, isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && command.trim()) {
            const currentCmd = command;
            setHistory(prev => [
                ...prev.slice(0, prev.length - 1), // Remove current prompt
                { type: 'input', text: `root@${containerId.substring(0, 12)}:/# ${currentCmd}` },
                { type: 'output', text: `Executing: ${currentCmd}... (Mock terminal)` },
                { type: 'output', text: `root@${containerId.substring(0, 12)}:/# ` }
            ]);
            setCommand("");
        } else if (e.key === 'Enter') {
            setHistory(prev => [
                ...prev.slice(0, prev.length - 1),
                { type: 'input', text: `root@${containerId.substring(0, 12)}:/# ` },
                { type: 'output', text: `root@${containerId.substring(0, 12)}:/# ` }
            ]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className={`bg-[#0A0A0A] border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ${
                isMaximized ? 'w-full h-full rounded-none inset-0 absolute' : 'w-full max-w-5xl h-[70vh] rounded-xl'
            }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121212] select-none rounded-t-xl">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <TerminalIcon size={16} className="text-blue-500" />
                        <span className="text-[13px] font-mono font-medium">{containerName} <span className="text-zinc-500 text-xs">interactive terminal</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-white hover:bg-zinc-100 dark:bg-zinc-800 rounded-md transition-colors"
                        >
                            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-white hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Terminal Area */}
                <div 
                    className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed custom-scrollbar bg-black"
                    onClick={() => inputRef.current?.focus()}
                >
                    {history.map((line, i) => (
                        <div key={i} className={`whitespace-pre-wrap ${
                            line.type === 'system' ? 'text-zinc-500 italic' : 
                            line.type === 'input' ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'
                        }`}>
                            {line.text}
                        </div>
                    ))}
                    <div className="flex">
                        <span className="text-zinc-700 dark:text-zinc-300 whitespace-pre">root@{containerId.substring(0, 12)}:/# </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={handleCommand}
                            className="flex-1 bg-transparent text-zinc-900 dark:text-white outline-none border-none focus:ring-0 p-0 font-mono caret-white"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                    <div ref={bottomRef} className="h-4" />
                </div>
            </div>
        </div>
    );
}
