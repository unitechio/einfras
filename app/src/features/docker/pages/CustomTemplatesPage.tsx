import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Code, Plus, Trash2, Edit3, Settings } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { useNotification } from "@/core/NotificationContext";
import { loadTemplates, saveTemplates } from "./custom-template-store";

export default function CustomTemplatesPage() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState(loadTemplates());
    const [searchQuery, setSearchQuery] = useState("");
    const { showNotification } = useNotification();

    useEffect(() => {
        saveTemplates(templates);
    }, [templates]);

    const filtered = useMemo(
        () => templates.filter((template) => template.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [searchQuery, templates],
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                        <Code className="h-6 w-6 text-indigo-500" />
                        Custom Templates
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Manage reusable Docker blueprints, then open dedicated edit and settings pages for cleaner workflows.
                    </p>
                </div>
                <Button variant="primary" size="md" onClick={() => navigate("/templates/custom/new/edit")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                </Button>
            </div>

            <div className="w-full sm:max-w-xs">
                <Input type="text" placeholder="Search custom templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4 text-zinc-400" />} />
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Template Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-zinc-500 dark:text-zinc-400">No custom templates found.</TableCell>
                            </TableRow>
                        ) : filtered.map((template) => (
                            <TableRow key={template.id} className="group">
                                <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{template.name}</TableCell>
                                <TableCell>{template.type}</TableCell>
                                <TableCell>{template.author}</TableCell>
                                <TableCell>{template.lastUpdated}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/templates/custom/${template.id}/edit`)} title="Edit Template">
                                            <Edit3 size={14} />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => navigate(`/templates/custom/${template.id}/settings`)} title="Template Settings">
                                            <Settings size={14} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setTemplates((current) => current.filter((item) => item.id !== template.id));
                                                showNotification({ type: "success", message: "Template removed", description: template.name });
                                            }}
                                            title="Remove Template"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
