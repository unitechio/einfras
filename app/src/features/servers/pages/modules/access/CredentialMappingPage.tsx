import { useState } from "react";
import { User, Server, Key, Shield, Plus, Search, Filter, Trash2, Edit } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface AccessRule {
    id: number;
    user: string;
    server: string;
    credential: string;
    privilege: string;
    status: "active" | "expired" | "pending";
}

export default function CredentialMappingPage() {
    const [searchTerm, setSearchTerm] = useState("");

    // Mock Data
    const [rules] = useState<AccessRule[]>([
        { id: 1, user: "admin@company.com", server: "production-db", credential: "Prod SSH Key", privilege: "sudo", status: "active" },
        { id: 2, user: "john.dev@company.com", server: "dev-web-01", credential: "Dev Key", privilege: "user", status: "active" },
        { id: 3, user: "sarah.qa@company.com", server: "staging-app", credential: "Staging Pwd", privilege: "user", status: "expired" },
    ]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100/50 dark:border-blue-500/20">
                            <Key className="text-blue-500" size={20} />
                        </div>
                        Access & Credential Mapping
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
                        Control who accesses which server with what credentials.
                    </p>
                </div>
                <Button variant="primary" className="shadow-sm">
                    <Plus size={16} className="mr-2" /> New Mapping
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search user, server, or credential..."
                        className="w-full pl-10"
                    />
                </div>
                <Button variant="outline" className="bg-white dark:bg-[#121212]">
                    <Filter size={16} className="mr-2" /> Filter
                </Button>
            </div>

            {/* Access Matrix Table */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-200/60 dark:border-zinc-800/60">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">User Identity</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Target Server</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Credential Used</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Privileges</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 font-bold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                            {rules.map((rule) => (
                                <tr key={rule.id} className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center border border-zinc-200/50 dark:border-zinc-700/50">
                                                <User size={14} />
                                            </div>
                                            <span className="font-semibold text-zinc-900 dark:text-white tracking-tight">{rule.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                            <Server size={14} />
                                            <span className="font-mono text-[12px] font-medium">{rule.server}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Key size={14} className="text-orange-500" />
                                            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{rule.credential}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${rule.privilege === "sudo"
                                                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100/50 dark:border-red-500/20"
                                                : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-700/50"
                                            }`}>
                                            <Shield size={10} /> {rule.privilege}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 shadow-inner border ${rule.status === "active" ? "bg-emerald-500 border-emerald-600" : "bg-zinc-300 dark:bg-zinc-600 border-zinc-400 dark:border-zinc-700"
                                            }`}></span>
                                        <span className="capitalize text-[13px] font-medium text-zinc-500">{rule.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20">
                                                <Edit size={14} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20">
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rules.length === 0 && (
                    <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
                        <Shield size={48} className="mb-4 text-zinc-300 dark:text-zinc-700 opacity-50" />
                        <h3 className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white">No Access Rules Defined</h3>
                        <p className="mt-1 text-[13px] text-zinc-500">Start by mapping users to servers.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
