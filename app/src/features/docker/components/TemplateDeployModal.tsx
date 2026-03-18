import { useState } from "react";
import { X, Settings2, Play } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface TemplateDeployModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: any;
}

export default function TemplateDeployModal({ isOpen, onClose, template }: TemplateDeployModalProps) {
    const [name, setName] = useState(template?.title.toLowerCase() || "");
    const [port, setPort] = useState("8080");

    if (!isOpen || !template) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex flex-col gap-2 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 relative">
                    <button onClick={onClose} className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md transition-colors">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center p-2">
                            <img 
                                src={template.logo} 
                                alt={template.title} 
                                className="max-h-full max-w-full object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTFBMTBhIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=' }}
                            />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                                {template.title}
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">{template.description}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <Settings2 size={16} /> Deploy Configuration
                    </h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">App/Stack Name</label>
                        <Input type="text" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Host Port Binding</label>
                        <div className="flex gap-2 items-center">
                            <Input type="text" value={port} onChange={e => setPort(e.target.value)} className="w-1/3" />
                            <span className="text-zinc-500">:</span>
                            <span className="text-zinc-900 dark:text-zinc-100 font-mono bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-md">80 (Container)</span>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4">
                        <p className="text-xs text-blue-700 dark:text-blue-400/90 leading-relaxed">
                            This template will be deployed directly to your selected Docker Swarm / Host environment. Essential environment variables such as default passwords will be auto-generated if left blank.
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white" onClick={onClose}>
                        <Play size={14} className="mr-2 fill-current" />
                        Deploy to Host
                    </Button>
                </div>
            </div>
        </div>
    );
}
