import { useState } from "react";
import { User, Server, Key, Shield, Plus, MoreVertical, Search, Filter, Trash2, Edit } from "lucide-react";

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
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Key className="text-blue-500" /> Access & Credential Mapping
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Control who accesses which server with what credentials.
                    </p>
                </div>
                <button className="bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 px-4 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95">
                    <Plus size={16} /> New Mapping
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search user, server, or credential..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>
                <button className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 transition-colors">
                    <Filter size={16} /> Filter
                </button>
            </div>

            {/* Access Matrix Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">User Identity</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Target Server</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Credential Used</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Privileges</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300">Status</th>
                                <th className="px-6 py-4 font-bold text-zinc-700 dark:text-zinc-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {rules.map((rule) => (
                                <tr key={rule.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                                <User size={14} />
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-white">{rule.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                                            <Server size={14} />
                                            <span className="font-mono text-xs">{rule.server}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Key size={14} className="text-orange-500" />
                                            <span className="font-medium">{rule.credential}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold uppercase ${rule.privilege === "sudo"
                                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                            }`}>
                                            <Shield size={10} /> {rule.privilege}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${rule.status === "active" ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
                                            }`}></span>
                                        <span className="capitalize text-zinc-500">{rule.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-blue-500 transition-colors">
                                                <Edit size={16} />
                                            </button>
                                            <button className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-zinc-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {rules.length === 0 && (
                    <div className="p-12 text-center text-zinc-500">
                        <Shield size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Access Rules Defined</h3>
                        <p className="mb-6">Start by mapping users to servers.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
