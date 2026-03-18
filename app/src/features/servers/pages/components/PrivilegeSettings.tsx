import { Shield, ShieldAlert, Terminal, User } from "lucide-react";

interface PrivilegeSettingsProps {
    os: "linux" | "windows";
    value: {
        user: string;
        escalation: string;
    };
    onChange: (value: { user: string; escalation: string }) => void;
}

export default function PrivilegeSettings({
    os,
    value,
    onChange,
}: PrivilegeSettingsProps) {
    const handleChange = (key: string, val: string) => {
        onChange({ ...value, [key]: val });
    };

    if (os === "linux") {
        return (
            <div className="space-y-4">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <ShieldAlert size={16} /> Privilege Escalation
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Default User */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Login User</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <input
                                type="text"
                                value={value.user}
                                onChange={(e) => handleChange("user", e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm pl-9 pr-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono"
                                placeholder="e.g. ubuntu"
                            />
                        </div>
                    </div>

                    {/* Sudo Strategy */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Sudo Strategy</label>
                        <select
                            value={value.escalation}
                            onChange={(e) => handleChange("escalation", e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none cursor-pointer"
                        >
                            <option value="sudo">sudo (with password)</option>
                            <option value="sudo_nopasswd">sudo NOPASSWD</option>
                            <option value="su">su - root</option>
                            <option value="none">None (Standard User)</option>
                        </select>
                    </div>
                </div>

                {value.escalation === "none" && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-sm text-xs text-orange-700 dark:text-orange-400 flex gap-2">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                        <span>Some administrative actions may fail without privilege escalation.</span>
                    </div>
                )}
            </div>
        );
    }

    return ( // Windows
        <div className="space-y-4">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Shield size={16} /> Execution Context
            </label>

            <div className="grid grid-cols-1 gap-4">
                <div className="flex gap-4">
                    <button
                        onClick={() => handleChange("escalation", "user")}
                        className={`flex-1 p-3 rounded-sm border transition-all text-left group ${value.escalation === "user"
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-600"
                            }`}
                    >
                        <div className="flex items-center gap-2 font-bold text-sm mb-1">
                            <User size={16} /> Standard User
                        </div>
                        <div className="text-[10px] opacity-70">Run scripts as the logged-in user</div>
                    </button>

                    <button
                        onClick={() => handleChange("escalation", "admin")}
                        className={`flex-1 p-3 rounded-sm border transition-all text-left group ${value.escalation === "admin"
                                ? "bg-purple-50 border-purple-200 text-purple-700"
                                : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-600"
                            }`}
                    >
                        <div className="flex items-center gap-2 font-bold text-sm mb-1">
                            <Shield size={16} /> Administrator
                        </div>
                        <div className="text-[10px] opacity-70">Run with elevated admin privileges</div>
                    </button>

                    <button
                        onClick={() => handleChange("escalation", "system")}
                        className={`flex-1 p-3 rounded-sm border transition-all text-left group ${value.escalation === "system"
                                ? "bg-red-50 border-red-200 text-red-700"
                                : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-600"
                            }`}
                    >
                        <div className="flex items-center gap-2 font-bold text-sm mb-1">
                            <Terminal size={16} /> SYSTEM
                        </div>
                        <div className="text-[10px] opacity-70">Run as NT AUTHORITY\SYSTEM</div>
                    </button>
                </div>
            </div>
        </div>
    );
}
