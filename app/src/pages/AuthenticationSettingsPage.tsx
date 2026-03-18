"use client";

import { Shield, Info } from "lucide-react";

export default function AuthenticationSettingsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    Authentication Settings
                </h1>
            </div>

            <div className="bg-[#1c1c1c] border border-zinc-800 rounded overflow-hidden">
                <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center gap-2">
                    <Shield size={16} className="text-blue-400" />
                    <h2 className="text-sm font-bold text-white">Authentication Configuration</h2>
                </div>
                <div className="p-6">
                    <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/30 rounded">
                        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-200/90">
                            Authentication settings page is under construction. This will include LDAP, OAuth, and other authentication provider configurations.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
