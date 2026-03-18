import { useState } from "react";
import { X, Layers, Code } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface StackEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    initialName?: string;
    initialContent?: string;
}

export default function StackEditorModal({ isOpen, onClose, mode, initialName, initialContent }: StackEditorModalProps) {
    const [name, setName] = useState(initialName || "");
    const [composeContent, setComposeContent] = useState(initialContent || "version: '3.8'\r\nservices:\r\n  web:\r\n    image: nginx:latest\r\n    ports:\r\n      - '80:80'\r\n");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-4xl flex flex-col h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-pink-500" />
                        {mode === 'create' ? 'Deploy Stack' : `Edit Stack: ${initialName}`}
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-700 dark:text-zinc-300 rounded-md transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col p-6 space-y-4 min-h-0">
                    {mode === 'create' && (
                        <div>
                            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Stack Name <span className="text-red-500">*</span></label>
                            <Input type="text" placeholder="e.g. backend-stack" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    )}
                    
                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                            <Code size={14} className="text-zinc-600 dark:text-zinc-400" />
                            docker-compose.yml contents
                        </label>
                        <div className="flex-1 relative border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-zinc-50 dark:bg-[#1e1e1e]">
                            <textarea 
                                className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-transparent outline-none resize-none text-[#d4d4d4] custom-scrollbar focus:ring-0"
                                value={composeContent}
                                onChange={e => setComposeContent(e.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">Use Standard Docker Compose v3 syntax.</p>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-pink-600 hover:bg-pink-700 dark:bg-pink-600 dark:hover:bg-pink-700 text-zinc-900 dark:text-white" onClick={onClose}>
                        {mode === 'create' ? 'Deploy Stack' : 'Update Stack'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
