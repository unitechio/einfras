"use client";

import { useState, useMemo } from "react";
import {
    Search,
    RefreshCw,
    Trash2,
    Plus,
    AlertTriangle,
    HelpCircle,
    Radio,
    ChevronDown,
    Check,
    Shield,
    EyeOff,
    Briefcase,
    X,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";

interface Registry {
    id: string;
    name: string;
    url: string;
    isAnonymous?: boolean;
    isHidden?: boolean;
}

type Provider = "dockerhub" | "ecr" | "quay" | "proget" | "azure" | "gitlab" | "custom";

export default function RegistriesPage() {
    const { showNotification } = useNotification();
    const [view, setView] = useState<"list" | "create">("list");
    const [selectedProvider, setSelectedProvider] = useState<Provider>("dockerhub");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // List State
    const [registries, setRegistries] = useState<Registry[]>([
        {
            id: "1",
            name: "Docker Hub (anonymous)",
            url: "docker.io",
            isAnonymous: true,
            isHidden: false,
        },
    ]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        token: "",
        url: "",
        awsKey: "",
        awsSecret: "",
        region: "us-west-1",
        authEnabled: true,
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
        return registries.filter((r) =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [registries, searchTerm]);

    const handleAddRegistry = () => {
        const newRegistry: Registry = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name || selectedProvider,
            url: formData.url || "registry.io",
            isHidden: false,
        };
        setRegistries([...registries, newRegistry]);
        setView("list");
        showNotification({
            type: "success",
            message: "Registry added",
            description: `Registry ${newRegistry.name} has been configured.`,
        });
    };

    const handleDeleteRegistries = () => {
        const listBeforeDelete = [...registries];
        const newRegistries = registries.filter((r) => !selectedIds.has(r.id));

        // Ensure "Docker Hub (anonymous)" stays if no other registries exist
        const hasOtherRegistries = newRegistries.some(r => !r.isAnonymous);
        if (newRegistries.length === 0 || !hasOtherRegistries) {
            // Re-injecting Docker Hub (anonymous) if it's the only one left or if list is empty
            const dockerHub = listBeforeDelete.find(r => r.isAnonymous);
            if (dockerHub && !newRegistries.some(r => r.isAnonymous)) {
                newRegistries.push(dockerHub);
            }
        }

        setRegistries(newRegistries);
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        showNotification({
            type: "success",
            message: "Registries removed",
            description: "The selected registries have been deleted.",
        });
    };

    const toggleHideRegistry = (id: string) => {
        setRegistries((prev) =>
            prev.map((r) => {
                if (r.id === id) {
                    const newState = !r.isHidden;
                    showNotification({
                        type: "info",
                        message: newState ? "Registry hidden" : "Registry shown",
                        description: `${r.name} will ${newState ? "no longer" : "now"} appear in registry selection dropdowns.`,
                    });
                    return { ...r, isHidden: newState };
                }
                return r;
            })
        );
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    if (view === "create") {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <div className="flex items-center gap-2 mb-6">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        Create registry{" "}
                        <RefreshCw size={16} className="text-zinc-500 cursor-pointer" />
                    </h1>
                </div>

                {/* Provider Selection */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-white">Registry provider</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {providers.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProvider(p.id as Provider)}
                                className={cn(
                                    "p-4 rounded-lg border text-left transition-all relative group",
                                    selectedProvider === p.id
                                        ? "bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500"
                                        : "bg-[#1c1c1c] border-zinc-800 hover:border-zinc-700"
                                )}
                            >
                                <div className="mb-3">
                                    {p.id === "dockerhub" && <Radio className="text-blue-400" size={24} />}
                                    {p.id === "ecr" && <Shield className="text-orange-400" size={24} />}
                                    {p.id === "gitlab" && <Radio className="text-orange-600" size={24} />}
                                    {p.id === "custom" && <Plus className="text-zinc-400" size={24} />}
                                    {!["dockerhub", "ecr", "gitlab", "custom"].includes(p.id) && <Radio className="text-blue-400" size={24} />}
                                </div>
                                <div className="text-xs font-bold text-white mb-1">{p.name}</div>
                                <div className="text-[10px] text-zinc-500 leading-tight">{p.desc}</div>
                                {selectedProvider === p.id && (
                                    <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Check size={8} className="text-white" />
                                    </div>
                                )}
                                {selectedProvider !== p.id && (
                                    <div className="absolute top-2 right-2 w-3 h-3 border border-zinc-700 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notice */}
                <div className="space-y-2">
                    <h2 className="text-sm font-bold text-white">Important notice</h2>
                    <p className="text-[11px] text-zinc-400">
                        For information on how to generate credentials, follow the{" "}
                        <span className="text-blue-400 underline cursor-pointer">guide</span>.
                    </p>
                </div>

                {/* Form Details */}
                <div className="space-y-6 bg-[#1c1c1c] border border-zinc-800 rounded-sm p-6 mb-8">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                        {selectedProvider} account details
                    </h2>

                    <div className="space-y-6 max-w-4xl">
                        {/* Generic Name Field */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white">
                                Name<span className="text-red-500">*</span>
                            </label>
                            <input
                                placeholder={`${selectedProvider}-prod-us`}
                                className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none"
                            />
                            <p className="text-[10px] text-[#f1c40f] flex items-center gap-1">
                                <AlertTriangle size={10} /> This field is required.
                            </p>
                        </div>

                        {/* Provider Specific Fields */}
                        {selectedProvider === "dockerhub" && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">DockerHub username*</label>
                                    <input className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">DockerHub access token*</label>
                                    <input type="password" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                </div>
                            </>
                        )}

                        {selectedProvider === "ecr" && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">Registry URL*</label>
                                    <input placeholder="aws-account-id.dkr.ecr.us-east-1.amazonaws.com/" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                </div>
                                {/* Auth Toggle with Smooth Transition */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <label className="text-xs font-bold text-white">Authentication</label>
                                        <div
                                            onClick={() => setFormData({ ...formData, authEnabled: !formData.authEnabled })}
                                            className={cn(
                                                "w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200",
                                                formData.authEnabled ? "bg-blue-600" : "bg-zinc-800"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                                                    formData.authEnabled ? "translate-x-5" : "translate-x-0"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className={cn(
                                            "grid transition-all duration-300 ease-in-out",
                                            formData.authEnabled ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                        )}
                                    >
                                        <div className="overflow-hidden space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-white">AWS Access Key*</label>
                                                <input className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-white">AWS Secret Access Key*</label>
                                                <input type="password" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-white">Region*</label>
                                                <input placeholder="us-west-1" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedProvider === "gitlab" && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">Username*</label>
                                    <input className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">Personal Access Token*</label>
                                    <input type="password" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">Instance URL*</label>
                                    <div className="relative">
                                        <input defaultValue="https://gitlab.com" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                        <HelpCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedProvider === "custom" && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white">Registry URL*</label>
                                    <div className="relative group">
                                        <input placeholder="10.0.0.10:5000 or myregistry.domain.tld" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                        <HelpCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 cursor-help" />
                                        <div className="absolute left-0 -top-12 hidden group-hover:block bg-zinc-800 text-[10px] p-2 rounded shadow-xl w-64 border border-zinc-700">
                                            Specify the URL of your custom registry.
                                        </div>
                                    </div>
                                </div>
                                {/* Auth Toggle */}
                                <div className="flex items-center gap-4">
                                    <label className="text-xs font-bold text-white">Authentication</label>
                                    <div
                                        onClick={() => setFormData({ ...formData, authEnabled: !formData.authEnabled })}
                                        className={cn(
                                            "w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200",
                                            formData.authEnabled ? "bg-blue-600" : "bg-zinc-800"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                                                formData.authEnabled ? "translate-x-5" : "translate-x-0"
                                            )}
                                        />
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        "grid transition-all duration-300 ease-in-out",
                                        formData.authEnabled ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                    )}
                                >
                                    <div className="overflow-hidden space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-white">Username*</label>
                                            <input className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-white">Password*</label>
                                            <input type="password" className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="pt-8 mt-8 border-t border-zinc-800">
                        <h3 className="text-sm font-bold text-white mb-4">Actions</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={handleAddRegistry}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-xs font-bold transition-all shadow-lg shadow-blue-900/20"
                            >
                                Add registry
                            </button>
                            <button
                                onClick={() => setView("list")}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    Registries{" "}
                    <RefreshCw size={16} className="text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                </h1>
            </div>

            {/* Info Panel */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded p-4 space-y-2">
                <h2 className="text-sm font-bold text-white">Information</h2>
                <p className="text-xs text-zinc-400">
                    View registries via an environment to manage access for user(s) and/or team(s)
                </p>
            </div>

            {/* Main Table Container */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Radio size={16} className="text-zinc-400" />
                        <span className="text-sm font-bold text-white">Registries</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-[#121212] border border-zinc-800 rounded px-9 py-1.5 text-sm text-zinc-300 focus:border-zinc-700 outline-none w-64 transition-all"
                            />
                        </div>
                        <button
                            disabled={selectedIds.size === 0}
                            onClick={() => setShowDeleteConfirm(true)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all",
                                selectedIds.size > 0
                                    ? "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20"
                                    : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-50"
                            )}
                        >
                            <Trash2 size={14} /> Remove
                        </button>
                        <button
                            onClick={() => setView("create")}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all border border-zinc-700"
                        >
                            <Plus size={14} /> Add registry
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-800 text-left bg-zinc-900/30">
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === filteredRegistries.length && filteredRegistries.length > 0}
                                        onChange={() => {
                                            if (selectedIds.size === filteredRegistries.length) setSelectedIds(new Set());
                                            else setSelectedIds(new Set(filteredRegistries.map(r => r.id)));
                                        }}
                                        className="w-4 h-4 rounded border-zinc-800 bg-[#121212] accent-blue-600"
                                    />
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    Name <span className="ml-1 text-[10px]">↓↑</span>
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    URL <span className="ml-1 text-[10px]">↓↑</span>
                                </th>
                                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredRegistries.map((r) => (
                                <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(r.id)}
                                            onChange={() => toggleSelection(r.id)}
                                            className="w-4 h-4 rounded border-zinc-800 bg-[#121212] accent-blue-600"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-bold text-zinc-200">{r.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-zinc-400 font-mono">{r.url}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleHideRegistry(r.id)}
                                                className={cn(
                                                    "border px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-all",
                                                    r.isHidden
                                                        ? "bg-blue-900/20 text-blue-400 border-blue-400/20 hover:bg-blue-900/40"
                                                        : "bg-red-900/20 text-red-500 border-red-500/20 hover:bg-red-900/40"
                                                )}
                                            >
                                                {r.isHidden ? <EyeOff size={10} className="text-blue-400" /> : <EyeOff size={10} />}
                                                {r.isHidden ? "Show for all users" : "Hide for all users"}
                                            </button>
                                            <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 px-2 py-1 rounded">
                                                <Briefcase size={10} className={cn(r.isHidden ? "text-blue-400" : "text-zinc-500")} />
                                                <span className={cn("text-[10px] font-bold", r.isHidden ? "text-blue-400" : "text-zinc-400")}>
                                                    Business Feature {r.isHidden && "(Hidden)"}
                                                </span>
                                            </div>
                                            <HelpCircle size={14} className="text-zinc-600 cursor-help" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-zinc-800 flex justify-end">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Items per page</span>
                        <div className="flex items-center gap-1 bg-[#121212] border border-zinc-800 px-2 py-1 rounded text-xs font-bold text-white">
                            10 <ChevronDown size={14} className="text-zinc-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="text-red-500" size={20} />
                                Confirm Removal
                            </h2>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-zinc-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                Are you sure you want to remove the selected{" "}
                                <span className="text-white font-bold">
                                    {selectedIds.size}
                                </span>{" "}
                                registry(s)? This action cannot be undone.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteRegistries}
                                className="px-6 py-2 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all"
                            >
                                Remove registries
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
