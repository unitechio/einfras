import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Settings, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import { findTemplateById, loadTemplates, saveTemplates } from "./custom-template-store";

export default function CustomTemplateSettingsPage() {
    const navigate = useNavigate();
    const { templateId } = useParams();
    const template = findTemplateById(templateId);
    const { showNotification } = useNotification();
    const [rows, setRows] = useState((template?.settings || "environment=dev").split(/\r?\n/).filter(Boolean).map((row) => {
        const [key, ...rest] = row.split("=");
        return { key: key?.trim() || "", value: rest.join("=").trim() };
    }));

    const saveSettings = () => {
        if (!template) {
            navigate("/templates/custom");
            return;
        }
        const items = loadTemplates();
        const settings = rows.filter((row) => row.key.trim()).map((row) => `${row.key.trim()}=${row.value}`).join("\n");
        saveTemplates(items.map((item) => item.id === template.id ? { ...item, settings, lastUpdated: new Date().toISOString().slice(0, 10) } : item));
        showNotification({ type: "success", message: "Template settings updated", description: template.name });
        navigate("/templates/custom");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/templates/custom")}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to templates
                </Button>
                <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    <Settings className="h-6 w-6 text-indigo-500" />
                    Template Settings
                </h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Dedicated settings page for parameter inputs and deployment defaults.
                </p>
            </div>

            <div className="max-w-4xl rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{template?.name || "Template"}</div>
                        <div className="text-xs text-zinc-500">These settings feed into YAML refill and deploy helpers.</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setRows((current) => [...current, { key: "", value: "" }])}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Setting
                    </Button>
                </div>
                <div className="space-y-2">
                    {rows.map((row, index) => (
                        <div key={`${row.key}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                            <Input value={row.key} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="replicas" />
                            <Input value={row.value} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="2" />
                            <Button variant="ghost" size="icon" onClick={() => setRows((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : [{ key: "", value: "" }])}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => navigate("/templates/custom")}>Cancel</Button>
                    <Button variant="primary" onClick={saveSettings}>Save Settings</Button>
                </div>
            </div>
        </div>
    );
}
