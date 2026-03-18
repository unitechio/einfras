"use client";

import { useState } from "react";
import {
    User,
    Lock,
    Check,
    Shield,
    Key,
    Globe,
    Camera,
    Mail,
    LogOut,
    ChevronRight,
    Monitor,
    Moon,
    Sun,
    Palette,
    Eye,
    Clock,
    Settings,
    AlertTriangle,
    TrendingUp,
    Zap,
} from "lucide-react";
import { useTheme } from "@/core/ThemeContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/lib/utils";
import { useNotification } from "@/core/NotificationContext";

export default function UserProfilePage() {
    const { theme, setTheme } = useTheme();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState<"profile" | "security" | "preferences">("profile");

    const tabs = [
        { id: "profile", label: "Identity", icon: User },
        { id: "security", label: "Security", icon: Shield },
        { id: "preferences", label: "Interface", icon: Palette },
    ] as const;

    const handleSave = () => {
        showNotification({
            type: "success",
            message: "Profile updated",
            description: "Your changes have been successfully synchronized.",
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Identity Hero Card */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                    <User size={120} />
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center font-bold text-2xl text-zinc-900 dark:text-white shadow-lg shadow-indigo-500/25">
                        AD
                    </div>
                    <button className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700">
                        <Camera size={12} />
                    </button>
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Admin User</h1>
                        <Badge variant="outline" className="w-fit mx-auto md:mx-0 text-[10px] font-semibold uppercase tracking-widest bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 px-2">
                            System Root
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-zinc-500 dark:text-zinc-400 mt-1">
                        <div className="flex items-center gap-1.5 text-xs">
                            <Mail size={12} className="text-zinc-600 dark:text-zinc-400" />
                            admin@einfra.io
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <Globe size={12} className="text-zinc-600 dark:text-zinc-400" />
                            Global Access
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                            <Clock size={12} className="text-zinc-600 dark:text-zinc-400" />
                            Joined June 2024
                        </div>
                    </div>
                </div>

                <div className="shrink-0">
                    <Button variant="outline" size="md" className="hover:border-red-300 dark:hover:border-red-500/30 hover:text-red-500 transition-all group">
                        <LogOut size={14} className="mr-2 group-hover:rotate-12 transition-transform" />
                        Log Out
                    </Button>
                </div>
            </div>

            {/* Tab Nav */}
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl w-fit border border-zinc-200 dark:border-zinc-800">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                            activeTab === tab.id
                                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700"
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-700 dark:text-zinc-300"
                        )}
                    >
                        <tab.icon size={13} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2">

                    {/* Profile Tab */}
                    {activeTab === "profile" && (
                        <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Personal Details</h3>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Update your core identity information</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { label: "Full Name", defaultValue: "Admin User" },
                                    { label: "Email Address", defaultValue: "admin@einfra.io" },
                                    { label: "Job Title", defaultValue: "System Administrator" },
                                    { label: "Location", defaultValue: "Global / Remote" },
                                ].map((field) => (
                                    <div key={field.label} className="space-y-1.5">
                                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{field.label}</label>
                                        <Input defaultValue={field.defaultValue} />
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                <Button variant="primary" onClick={handleSave}>
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === "security" && (
                        <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Access Control</h3>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Manage your credentials and MFA settings</p>
                            </div>

                            <div className="space-y-3">
                                {/* Password */}
                                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg group hover:border-amber-300 dark:hover:border-amber-500/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-105 transition-transform">
                                            <Key size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cluster Password</p>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Last changed 45 days ago</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="md">Reset Password</Button>
                                </div>

                                {/* 2FA */}
                                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg group hover:border-blue-300 dark:hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-105 transition-transform">
                                            <Lock size={14} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Two-Factor Auth</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</p>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge className="bg-emerald-500 text-zinc-900 dark:text-white border-0 text-[10px] font-semibold px-2.5">Secure</Badge>
                                </div>
                            </div>

                            {/* API Keys */}
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">API Access Keys</h4>
                                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 rounded-lg font-mono text-xs border border-zinc-200 dark:border-zinc-800">
                                    <span className="opacity-60">SK_PROD_88A2...X991L</span>
                                    <div className="flex gap-1.5">
                                        <button className="p-1 hover:text-zinc-900 dark:text-white transition-colors rounded">
                                            <Eye size={13} />
                                        </button>
                                        <button className="p-1 hover:text-zinc-900 dark:text-white transition-colors rounded">
                                            <Settings size={13} />
                                        </button>
                                    </div>
                                </div>
                                <Button variant="outline" size="md" className="w-full border-dashed text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/30">
                                    <Key size={13} className="mr-2" />
                                    Generate New Key
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === "preferences" && (
                        <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Interface Customization</h3>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">Tailor the dashboard aesthetics</p>
                            </div>

                            {/* Theme Picker */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Appearance</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: "light", icon: Sun, label: "Light" },
                                        { id: "dark", icon: Moon, label: "Dark" },
                                        { id: "highcontrast", icon: Monitor, label: "High Contrast" },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setTheme(opt.id as any)}
                                            className={cn(
                                                "relative p-4 rounded-xl border-2 transition-all text-left",
                                                theme === opt.id
                                                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10"
                                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700"
                                            )}
                                        >
                                            {theme === opt.id && (
                                                <div className="absolute top-2 right-2 p-0.5 bg-indigo-600 text-zinc-900 dark:text-white rounded-full">
                                                    <Check size={9} />
                                                </div>
                                            )}
                                            <opt.icon size={18} className={cn("mb-2", theme === opt.id ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-400")} />
                                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{opt.label}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language */}
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Regional Settings</h4>
                                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-lg">
                                            <Globe size={13} />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">System Language</span>
                                    </div>
                                    <Badge variant="outline" className="text-xs font-medium px-2.5 py-1">English (US)</Badge>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Usage stats */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-5">Usage & Limits</h4>
                        <div className="space-y-5">
                            {[
                                { label: "Node Connections", value: "14 / 20", pct: 70, color: "emerald" },
                                { label: "Storage Bandwidth", value: "840 GB / 1 TB", pct: 84, color: "indigo" },
                            ].map((item) => (
                                <div key={item.label} className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-zinc-500 dark:text-zinc-400">{item.label}</span>
                                        <span className="text-zinc-900 dark:text-zinc-50">{item.value}</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all", item.color === "emerald" ? "bg-emerald-500" : "bg-indigo-500")}
                                            style={{ width: `${item.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="md" className="w-full mt-6 text-zinc-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all group text-xs border-dashed">
                            Upgrade Plan <ChevronRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                    </div>

                    {/* Notification Card */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
                                <AlertTriangle size={14} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Security Audit</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    You have <span className="text-amber-600 dark:text-amber-400 font-semibold">2 pending</span> security audits for production servers.
                                </p>
                                <button className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                                    View Security Logs <ChevronRight size={11} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
                        <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Quick Actions</h4>
                        {[
                            { label: "Activity Log", icon: TrendingUp },
                            { label: "Connected Apps", icon: Zap },
                            { label: "Account Settings", icon: Settings },
                        ].map((action) => (
                            <button
                                key={action.label}
                                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all group"
                            >
                                <action.icon size={14} className="text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                <span className="text-sm font-medium">{action.label}</span>
                                <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
