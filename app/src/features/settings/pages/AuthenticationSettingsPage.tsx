"use client";

import { useState } from "react";
import { Shield, Lock, Save, RefreshCw, KeyRound, Smartphone, Github, Mail, Building2, CheckCircle2, ChevronRight, X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { useNotification } from "@/core/NotificationContext";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";

export default function AuthenticationSettingsPage() {
    const { showNotification } = useNotification();
    const [isSaving, setIsSaving] = useState(false);
    
    // Form States
    const [settings, setSettings] = useState({
        enableLocalAuth: true,
        enforce2FA: false,
        passwordExpiry: "90",
        sessionTimeout: "24",
    });

    // Mock Connected status
    const [connectedProviders, setConnectedProviders] = useState<string[]>(['google']);

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const toggleProvider = (providerId: string) => {
        setConnectedProviders(prev => 
            prev.includes(providerId) ? prev.filter(p => p !== providerId) : [...prev, providerId]
        );
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            showNotification({
                type: "success",
                message: "Authentication secure",
                description: "Your security constraints and identity providers have been updated."
            });
        }, 800);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Lock className="h-6 w-6 text-indigo-500" />
                        Authentication
                    </h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1.5">Manage identity providers, session security, and multi-factor authentication.</p>
                </div>
                <Button variant="primary" size="md" onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                    {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* SSO Providers */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
                            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <Shield className="w-4 h-4 text-zinc-500" />
                                Single Sign-On (SSO)
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <ProviderCard 
                                id="google"
                                name="Google Workspace" 
                                description="Allow users to sign in with their corporate Google accounts."
                                icon={<Mail className="w-5 h-5" />}
                                connected={connectedProviders.includes("google")}
                                onToggle={() => toggleProvider("google")}
                            />
                            <ProviderCard 
                                id="github"
                                name="GitHub" 
                                description="Authenticate using GitHub organization member IDs."
                                icon={<Github className="w-5 h-5" />}
                                connected={connectedProviders.includes("github")}
                                onToggle={() => toggleProvider("github")}
                            />
                            <ProviderCard 
                                id="microsoft"
                                name="Microsoft Entra" 
                                description="Connect to Azure AD and sync enterprise active directories."
                                icon={<Building2 className="w-5 h-5" />}
                                connected={connectedProviders.includes("microsoft")}
                                onToggle={() => toggleProvider("microsoft")}
                            />
                        </div>
                    </div>

                    {/* Local Auth Settings */}
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
                            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-zinc-500" />
                                Local Authentication
                            </h2>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            <ToggleRow 
                                title="Enable Local Authentication" 
                                description="Allow users to log in with a username and password natively on EINFRA."
                                active={settings.enableLocalAuth}
                                onClick={() => handleToggle("enableLocalAuth")}
                            />
                            <ToggleRow 
                                title="Enforce Multi-Factor Auth (MFA)" 
                                description="Require all users to configure a Time-based One-Time Password (TOTP) authenticator."
                                active={settings.enforce2FA}
                                onClick={() => handleToggle("enforce2FA")}
                            />
                        </div>
                        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-6 bg-zinc-50/30 dark:bg-[#121212]">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Password Expiry (Days)</label>
                                <Input 
                                    name="passwordExpiry"
                                    value={settings.passwordExpiry}
                                    onChange={handleChange}
                                    type="number" 
                                    className="h-10 text-[13px] w-full" 
                                    disabled={!settings.enableLocalAuth}
                                />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Global Session Timeout (Hours)</label>
                                <Input 
                                    name="sessionTimeout"
                                    value={settings.sessionTimeout}
                                    onChange={handleChange}
                                    type="number" 
                                    className="h-10 text-[13px] w-full" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Setup Guide */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                            <Smartphone className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white mb-2">Authenticator Apps</h3>
                        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                            If MFA is heavily enforced, users will be required prompted to pair apps like Google Authenticator or Microsoft Authenticator upon their next login attempt.
                        </p>
                        <Button variant="outline" className="w-full text-[13px]">
                            View MFA Recovery Guide
                        </Button>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-[14px] font-semibold text-emerald-900 dark:text-emerald-300">Security Score: A+</h3>
                        </div>
                        <p className="text-[12px] text-emerald-800/80 dark:text-emerald-300/80">
                            Your platform currently meets enterprise security compliance for authentication. Keep session timeouts fairly restricted.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProviderCard({ name, description, icon, connected, onToggle }: { name: string, description: string, icon: React.ReactNode, id: string, connected: boolean, onToggle: () => void }) {
    return (
        <div className={cn(
            "flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
            connected 
                ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700/50" 
                : "bg-white border-zinc-100 dark:bg-[#121212] dark:border-zinc-800"
        )}>
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    connected ? "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white shadow-sm" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400"
                )}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                        {name}
                        {connected && <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Connected</span>}
                    </h3>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-[280px]">{description}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {connected ? (
                    <Button variant="outline" size="sm" onClick={onToggle} className="h-8 text-[12px] border-zinc-200 dark:border-zinc-700 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
                        <X className="w-3.5 h-3.5 mr-1" /> Disconnect
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" onClick={onToggle} className="h-8 text-[12px] bg-white dark:bg-zinc-900">
                        Configure <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function ToggleRow({ title, description, active, onClick }: { title: string, description: string, active: boolean, onClick: () => void }) {
    return (
        <div className="p-6 flex items-start justify-between gap-8 group">
            <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-white mb-1.5">{title}</h3>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">{description}</p>
            </div>
            <button 
                onClick={onClick}
                className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    active ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
                )}
            >
                <span 
                    className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        active ? "translate-x-4" : "translate-x-0"
                    )}
                />
            </button>
        </div>
    );
}
