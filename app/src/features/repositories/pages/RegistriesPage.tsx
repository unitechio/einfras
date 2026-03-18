"use client";

import { useState, useMemo } from "react";
import { Search, Trash2, Plus, Box, Check, Shield, EyeOff, X, Eye, Settings2 } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";

interface Registry { id: string; name: string; url: string; isAnonymous?: boolean; isHidden?: boolean; }
type Provider = "dockerhub" | "ecr" | "quay" | "proget" | "azure" | "gitlab" | "custom";

export default function RegistriesPage() {
    const { showNotification } = useNotification();
    const [view, setView] = useState<"list" | "create">("list");
    const [selectedProvider, setSelectedProvider] = useState<Provider>("dockerhub");
    const [searchTerm, setSearchTerm] = useState("");

    const [registries, setRegistries] = useState<Registry[]>([
        { id: "1", name: "Docker Hub (anonymous)", url: "docker.io", isAnonymous: true, isHidden: false },
        { id: "2", name: "AWS Production ECR", url: "aws-account.dkr.ecr.us-east-1.amazonaws.com", isAnonymous: false, isHidden: false },
    ]);

    const [formData, setFormData] = useState({
        name: "", username: "", token: "", url: "", awsKey: "", awsSecret: "", region: "us-west-1", authEnabled: true,
    });

    const providers = [
        { id: "dockerhub", name: "DockerHub", desc: "DockerHub authenticated account" },
        { id: "ecr", name: "AWS ECR", desc: "Amazon elastic container registry" },
        { id: "quay", name: "Quay.io", desc: "Quay container registry" },
        { id: "proget", name: "ProGet", desc: "ProGet container registry" },
        { id: "azure", name: "Azure", desc: "Azure container registry" },
        { id: "gitlab", name: "GitLab", desc: "GitLab container registry" },
        { id: "custom", name: "Custom registry", desc: "Define your own registry" },
    ];

    const filteredRegistries = useMemo(() => {
        return registries.filter((r) => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [registries, searchTerm]);

    const handleAddRegistry = () => {
        if (!formData.name && !selectedProvider) return;
        const newRegistry: Registry = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name || `New ${selectedProvider}`,
            url: formData.url || "registry.io",
            isHidden: false,
        };
        setRegistries([...registries, newRegistry]);
        setView("list");
        showNotification({ type: "success", message: "Registry added", description: `Registry ${newRegistry.name} configured.` });
    };

    const handleDeleteRegistry = (id: string, name: string) => {
        if (confirm(`Remove registry ${name}?`)) {
            setRegistries(registries.filter((r) => r.id !== id));
            showNotification({ type: "error", message: "Registry Removed", description: "The registry has been deleted." });
        }
    };

    const toggleHideRegistry = (id: string) => {
        setRegistries(registries.map((r) => {
            if (r.id === id) {
                const newState = !r.isHidden;
                showNotification({ type: "info", message: newState ? "Registry Hidden" : "Registry Visible", description: `${r.name} visibility updated.` });
                return { ...r, isHidden: newState };
            }
            return r;
        }));
    };

    if (view === "create") {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                            <Box className="h-6 w-6 text-orange-500" />
                            Add Registry
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure a new container image registry connection.</p>
                    </div>
                    <Button variant="outline" onClick={() => setView("list")}><X className="h-4 w-4 mr-2" /> Cancel</Button>
                </div>

                <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-8">
                    <div className="space-y-4">
                        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Select Provider</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {providers.map((p) => (
                                <div 
                                    key={p.id}
                                    onClick={() => setSelectedProvider(p.id as Provider)}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col items-start gap-2",
                                        selectedProvider === p.id ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 ring-1 ring-orange-500/50" : "bg-white dark:bg-[#121212] border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                >
                                    {selectedProvider === p.id && (
                                        <div className="absolute top-3 right-3">
                                            <div className="bg-orange-500 text-white rounded-full p-0.5"><Check size={12} /></div>
                                        </div>
                                    )}
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{p.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-8 space-y-5 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Connection Name <span className="text-red-500">*</span></label>
                            <Input placeholder={`e.g. My ${providers.find(p=>p.id===selectedProvider)?.name} Registry`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>

                        {selectedProvider === 'dockerhub' && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">DockerHub Username</label>
                                    <Input placeholder="username" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Access Token</label>
                                    <Input type="password" placeholder="••••••••••••••••" />
                                </div>
                            </div>
                        )}

                        {selectedProvider === 'ecr' && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Registry URL</label>
                                    <Input placeholder="aws-account-id.dkr.ecr.region.amazonaws.com" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">AWS Access Key ID</label>
                                    <Input placeholder="AKIA..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">AWS Secret Access Key</label>
                                    <Input type="password" placeholder="••••••••••••••••" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Default Region</label>
                                    <Input placeholder="us-east-1" />
                                </div>
                            </div>
                        )}

                        {['gitlab', 'quay', 'proget', 'azure', 'custom'].includes(selectedProvider) && (
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Registry URL</label>
                                    <Input placeholder="registry.example.com" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Username</label>
                                    <Input placeholder="username" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Password / Token</label>
                                    <Input type="password" placeholder="••••••••••••••••" />
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
                            <Button variant="primary" className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white" onClick={handleAddRegistry}>
                                <Plus size={16} className="mr-2" /> Connect Registry
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Box className="h-6 w-6 text-orange-500" />
                        Registries
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage external container registry connections and authentication.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="primary" size="md" onClick={() => setView("create")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Registry
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input 
                        icon={<Search className="h-4 w-4 text-zinc-400" />} 
                        placeholder="Search registries..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Registry Name</TableHead>
                            <TableHead>URL / Endpoint</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRegistries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                        <Box size={32} className="mb-3 opacity-20" />
                                        <p className="text-[13px] font-medium">No registries configured.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRegistries.map((r) => (
                                <TableRow key={r.id} className="group">
                                    <TableCell>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                            {r.name}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.url}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {r.isAnonymous ? (
                                                <Badge variant="outline">Anonymous</Badge>
                                            ) : (
                                                <Badge variant="success"><Shield className="w-3 h-3 mr-1 inline" /> Validated</Badge>
                                            )}
                                            {r.isHidden && <Badge variant="warning">Hidden globally</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-zinc-800" title={r.isHidden ? "Make Visible" : "Hide Registry"} onClick={() => toggleHideRegistry(r.id)}>
                                                {r.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-zinc-800" title="Configure">
                                                <Settings2 size={14} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete" onClick={() => handleDeleteRegistry(r.id, r.name)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
