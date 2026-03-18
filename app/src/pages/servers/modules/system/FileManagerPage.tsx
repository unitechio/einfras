import { useState } from "react";
import { Folder, File, Upload, Download, MoreVertical, Search, Home, ChevronRight, FileCode, FileText, Image } from "lucide-react";

export default function FileManagerPage() {
    const [currentPath, setCurrentPath] = useState("/var/www/html");

    // Mock Files
    const files = [
        { name: "assets", type: "folder", size: "-", date: "Jan 8, 2024" },
        { name: "config", type: "folder", size: "-", date: "Dec 20, 2023" },
        { name: "index.php", type: "file", icon: FileCode, size: "2.4 KB", date: "Jan 9, 2024" },
        { name: "README.md", type: "file", icon: FileText, size: "1.1 KB", date: "Jan 2, 2024" },
        { name: "logo.png", type: "file", icon: Image, size: "45 KB", date: "Nov 15, 2023" },
        { name: ".env", type: "file", icon: File, size: "0.2 KB", date: "Jan 1, 2024" },
    ];

    return (
        <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-sm">
                <div className="flex items-center gap-2 overflow-hidden bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-sm flex-1">
                    <Home size={16} className="text-zinc-400 shrink-0" />
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-300 truncate">{currentPath}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                        <Upload size={14} /> Upload
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        <Download size={14} /> Download
                    </button>
                </div>
            </div>

            {/* File Grid */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-100 dark:border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-3">Last Modified</div>
                    <div className="col-span-1 text-right">Action</div>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto flex-1">
                    {files.map((file, idx) => {
                        const Icon = file.type === "folder" ? Folder : (file.icon || File);
                        return (
                            <div key={idx} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer group transition-colors">
                                <div className="col-span-6 flex items-center gap-3">
                                    <Icon
                                        size={20}
                                        className={file.type === "folder" ? "text-blue-400 fill-blue-400/20" : "text-zinc-400"}
                                    />
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{file.name}</span>
                                </div>
                                <div className="col-span-2 text-sm text-zinc-500 font-mono">{file.size}</div>
                                <div className="col-span-3 text-sm text-zinc-500">{file.date}</div>
                                <div className="col-span-1 flex justify-end">
                                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500">
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
