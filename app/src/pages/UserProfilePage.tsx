"use client";

import React, { useState } from "react";
import { User, Lock, Check } from "lucide-react";
import { useTheme } from "../core/ThemeContext";

export default function UserProfilePage() {
    const { theme, setTheme } = useTheme();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const themeOptions = [
        { id: "light", label: "Light Theme", icon: "☀️" },
        { id: "dark", label: "Dark Theme", icon: "🌙" },
        { id: "contrast", label: "High Contrast", icon: "👁️" },
        { id: "system", label: "System Theme", icon: "🔄" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <h1 className="text-2xl font-bold">User settings</h1>
            </div>

            {/* Theme Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <span className="p-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"><User size={14} /></span>
                    User theme
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {themeOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => {
                                if (option.id === 'light' || option.id === 'dark') {
                                    setTheme(option.id);
                                }
                            }}
                            className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${(theme === option.id && option.id !== 'system') || (option.id === 'system' && false)
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-500"
                                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}
              `}
                        >
                            {theme === option.id && (
                                <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check size={10} className="text-white" />
                                </div>
                            )}
                            <div className="flex flex-col gap-2">
                                <span className="text-2xl">{option.icon}</span>
                                <span className="font-bold text-sm">{option.label}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Password Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <span className="p-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"><Lock size={14} /></span>
                    Change user password
                </h2>

                <div className="space-y-4 max-w-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Current password <span className="text-red-500">*</span></label>
                        <div className="md:col-span-2">
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New password <span className="text-red-500">*</span></label>
                        <div className="md:col-span-2">
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm password <span className="text-red-500">*</span></label>
                        <div className="md:col-span-2 relative">
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none pr-10"
                            />
                            {confirmPassword && confirmPassword === newPassword && (
                                <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-xs bg-amber-50 dark:bg-amber-900/10 p-3 rounded border border-amber-200 dark:border-amber-800/30">
                        <span className="font-bold">⚠️ The password must be at least 12 characters long.</span>
                    </div>

                    <div className="pt-2">
                        <button className="bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 font-bold py-2 px-4 rounded text-sm cursor-not-allowed border border-zinc-300 dark:border-zinc-700">
                            Update password
                        </button>
                    </div>
                </div>
            </div>

            {/* Application Settings Section Snippet */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 opacity-50 pointer-events-none">
                <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                    <span className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">⚙️</span>
                    Application settings
                </h2>
                <p className="text-sm">Global application settings are managed by the administrator.</p>
            </div>

        </div>
    );
}
