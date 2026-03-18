import { useState } from "react";
import { Folder, File, Upload, Download, MoreVertical, Home, ChevronRight, FileCode, FileText, Image } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

export default function FileManagerPage() {
    const [currentPath] = useState("/var/www/html");

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col pb-20">
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2 overflow-hidden bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 px-5 py-3 rounded-xl shadow-sm flex-1 max-w-2xl transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                    <Home size={16} className="text-zinc-400 shrink-0" />
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                    <span className="font-mono text-[13px] font-bold text-zinc-700 dark:text-zinc-200 truncate tracking-tight">{currentPath}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="primary" className="shadow-sm">
                        <Upload size={14} className="mr-1.5" /> Upload
                    </Button>
                    <Button variant="outline" className="bg-white dark:bg-[#121212] shadow-sm">
                        <Download size={14} className="mr-1.5" /> Download
                    </Button>
                </div>
            </div>

            {/* File Table */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50%]">Name</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Last Modified</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.map((file, idx) => {
                            const Icon = file.type === "folder" ? Folder : (file.icon || File);
                            return (
                                <TableRow key={idx} className="cursor-pointer group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl shadow-inner ${file.type === "folder" ? "bg-blue-50 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20" : "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50"}`}>
                                                <Icon
                                                    size={18}
                                                    className={file.type === "folder" ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400"}
                                                />
                                            </div>
                                            <span className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{file.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-[12px] text-zinc-500">{file.size}</TableCell>
                                    <TableCell className="text-[13px] text-zinc-500">{file.date}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                                <MoreVertical size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
