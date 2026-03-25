"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Key,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Settings,
  Shield,
  Sun,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { useTheme } from "@/core/ThemeContext";
import { useNotification } from "@/core/NotificationContext";
import { getStoredSession, saveSession } from "@/features/authentication/auth-session";
import { settingsApi } from "@/features/settings/api";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";

type ProfileTab = "profile" | "security" | "preferences";

type ProfileForm = {
  fullName: string;
  email: string;
  jobTitle: string;
  location: string;
};

type SecurityForm = {
  alertEmail: string;
  sessionTimeout: string;
  requireMFA: boolean;
  notifyNewLogin: boolean;
};

type PreferencesForm = {
  language: string;
  density: string;
  startPage: string;
};

export default function UserProfilePage() {
  const session = getStoredSession();
  const { theme, setTheme } = useTheme();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<ProfileTab | null>(null);
  const [settingsPayload, setSettingsPayload] = useState<Record<string, unknown>>({});
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    fullName: session?.user.full_name || session?.user.username || "Admin User",
    email: session?.user.email || "admin@einfra.io",
    jobTitle: "System Administrator",
    location: "Global / Remote",
  });
  const [securityForm, setSecurityForm] = useState<SecurityForm>({
    alertEmail: session?.user.email || "admin@einfra.io",
    sessionTimeout: "12h",
    requireMFA: Boolean(session?.user.totp_enabled),
    notifyNewLogin: true,
  });
  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    language: "English (US)",
    density: "comfortable",
    startPage: "/dashboard",
  });

  useEffect(() => {
    let mounted = true;
    void settingsApi.getUserSettings()
      .then((response) => {
        if (!mounted) {
          return;
        }
        const payload = response.payload || {};
        const profile = readObject(payload.profile);
        const security = readObject(payload.security);
        const preferences = readObject(payload.preferences);
        setSettingsPayload(payload);
        setProfileForm((current) => ({
          fullName: readString(profile.fullName, current.fullName),
          email: readString(profile.email, current.email),
          jobTitle: readString(profile.jobTitle, current.jobTitle),
          location: readString(profile.location, current.location),
        }));
        setSecurityForm((current) => ({
          alertEmail: readString(security.alertEmail, current.alertEmail),
          sessionTimeout: readString(security.sessionTimeout, current.sessionTimeout),
          requireMFA: readBoolean(security.requireMFA, current.requireMFA),
          notifyNewLogin: readBoolean(security.notifyNewLogin, current.notifyNewLogin),
        }));
        setPreferencesForm((current) => ({
          language: readString(preferences.language, current.language),
          density: readString(preferences.density, current.density),
          startPage: readString(preferences.startPage, current.startPage),
        }));
        const savedTheme = readString(preferences.theme, "");
        if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "highcontrast") {
          setTheme(savedTheme as typeof theme);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [setTheme]);

  const initials = useMemo(() => {
    const source = profileForm.fullName.trim() || session?.user.username || "AD";
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "AD";
  }, [profileForm.fullName, session?.user.username]);

  const tabs = [
    { id: "profile", label: "Identity", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "preferences", label: "Interface", icon: Palette },
  ] as const;

  async function persist(next: Record<string, unknown>, successMessage: string, tab: ProfileTab) {
    setIsSaving(tab);
    try {
      const saved = await settingsApi.saveUserSettings(next);
      setSettingsPayload(saved.payload || next);
      showNotification({
        type: "success",
        message: successMessage,
        description: "Profile settings are now reflected across your workspace.",
      });
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to save profile settings",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(null);
    }
  }

  async function saveProfileSection() {
    const next = {
      ...settingsPayload,
      profile: profileForm,
      security: securityForm,
      preferences: {
        ...preferencesForm,
        theme,
      },
    };
    const currentSession = getStoredSession();
    if (currentSession) {
      saveSession({
        ...currentSession,
        user: {
          ...currentSession.user,
          full_name: profileForm.fullName,
          email: profileForm.email,
        },
        principal: {
          ...currentSession.principal,
          email: profileForm.email,
        },
      });
    }
    await persist(next, "Profile updated", "profile");
  }

  async function saveSecuritySection() {
    await persist({
      ...settingsPayload,
      profile: profileForm,
      security: securityForm,
      preferences: {
        ...preferencesForm,
        theme,
      },
    }, "Security preferences updated", "security");
  }

  async function savePreferencesSection(nextTheme?: string) {
    await persist({
      ...settingsPayload,
      profile: profileForm,
      security: securityForm,
      preferences: {
        ...preferencesForm,
        theme: nextTheme || theme,
      },
    }, "Interface preferences updated", "preferences");
  }

  const usageStats = [
    { label: "Node Connections", value: "14 / 20", pct: 70, color: "emerald" },
    { label: "Storage Bandwidth", value: "840 GB / 1 TB", pct: 84, color: "indigo" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <User size={120} />
        </div>
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 text-2xl font-bold text-white shadow-lg shadow-indigo-500/25">
              {initials}
            </div>
            <button className="absolute -bottom-1.5 -right-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-700 shadow-md transition-all hover:scale-105 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <Camera size={12} />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="mb-1 flex flex-col gap-2 md:flex-row md:items-center">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {profileForm.fullName}
              </h1>
              <Badge variant="outline" className="mx-auto w-fit border-indigo-100 bg-indigo-50 px-2 text-[10px] font-semibold uppercase tracking-widest text-indigo-600 dark:mx-0 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                {session?.principal.roles?.[0] || "System Root"}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-4 text-zinc-500 dark:text-zinc-400 md:justify-start">
              <div className="flex items-center gap-1.5 text-xs">
                <Mail size={12} className="text-zinc-600 dark:text-zinc-400" />
                {profileForm.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Globe size={12} className="text-zinc-600 dark:text-zinc-400" />
                {profileForm.location}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock size={12} className="text-zinc-600 dark:text-zinc-400" />
                {profileForm.jobTitle}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <Button variant="outline" size="md" className="group transition-all hover:border-red-300 hover:text-red-500 dark:hover:border-red-500/30">
              <LogOut size={14} className="mr-2 transition-transform group-hover:rotate-12" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
              activeTab === tab.id
                ? "border border-zinc-200 bg-white text-indigo-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100",
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
              Loading profile settings...
            </div>
          ) : null}

          {!isLoading && activeTab === "profile" ? (
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300 dark:border-zinc-800 dark:bg-[#121212]">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Personal Details</h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Update your identity information and keep the profile header in sync.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <Input value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))} />
                </Field>
                <Field label="Email Address">
                  <Input value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
                <Field label="Job Title">
                  <Input value={profileForm.jobTitle} onChange={(event) => setProfileForm((current) => ({ ...current, jobTitle: event.target.value }))} />
                </Field>
                <Field label="Location">
                  <Input value={profileForm.location} onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))} />
                </Field>
              </div>
              <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button variant="primary" onClick={() => void saveProfileSection()} isLoading={isSaving === "profile"}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoading && activeTab === "security" ? (
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300 dark:border-zinc-800 dark:bg-[#121212]">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Access Control</h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Persist your security operations defaults so the page reflects the latest saved state.</p>
              </div>

              <div className="space-y-3">
                <SecurityCard
                  icon={<Key size={14} />}
                  title="Cluster Password"
                  description="Operational reset action. This button is available, while preference fields below are persisted."
                  action={<Button variant="outline" size="md">Reset Password</Button>}
                />
                <SecurityCard
                  icon={<Lock size={14} />}
                  title="Two-Factor Auth"
                  description={securityForm.requireMFA ? "MFA is required for this profile." : "MFA requirement is currently relaxed for this profile."}
                  action={
                    <button
                      type="button"
                      onClick={() => setSecurityForm((current) => ({ ...current, requireMFA: !current.requireMFA }))}
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest",
                        securityForm.requireMFA ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
                      )}
                    >
                      {securityForm.requireMFA ? "Required" : "Optional"}
                    </button>
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Alert Email">
                  <Input value={securityForm.alertEmail} onChange={(event) => setSecurityForm((current) => ({ ...current, alertEmail: event.target.value }))} />
                </Field>
                <Field label="Session Timeout">
                  <select
                    value={securityForm.sessionTimeout}
                    onChange={(event) => setSecurityForm((current) => ({ ...current, sessionTimeout: event.target.value }))}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                  >
                    <option value="4h">4 hours</option>
                    <option value="8h">8 hours</option>
                    <option value="12h">12 hours</option>
                    <option value="24h">24 hours</option>
                  </select>
                </Field>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Notify on new sign-in</span>
                <input
                  type="checkbox"
                  checked={securityForm.notifyNewLogin}
                  onChange={(event) => setSecurityForm((current) => ({ ...current, notifyNewLogin: event.target.checked }))}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">API Access Keys</h4>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <span className="opacity-60">SK_PROD_88A2...X991L</span>
                  <Button variant="outline" size="sm" onClick={() => showNotification({ type: "info", message: "API key manager", description: "Dedicated key lifecycle management will be wired here next." })}>
                    Manage
                  </Button>
                </div>
              </div>

              <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button variant="primary" onClick={() => void saveSecuritySection()} isLoading={isSaving === "security"}>
                  Save Security Preferences
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoading && activeTab === "preferences" ? (
            <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm animate-in fade-in slide-in-from-left-2 duration-300 dark:border-zinc-800 dark:bg-[#121212]">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Interface Customization</h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Theme, language, density, and start page are now loaded from saved user settings.</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Appearance</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", icon: Sun, label: "Light" },
                    { id: "dark", icon: Moon, label: "Dark" },
                    { id: "highcontrast", icon: Monitor, label: "High Contrast" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTheme(opt.id as typeof theme);
                        void savePreferencesSection(opt.id);
                      }}
                      className={cn(
                        "relative rounded-xl border-2 p-4 text-left transition-all",
                        theme === opt.id
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-500/30",
                      )}
                    >
                      {theme === opt.id ? (
                        <div className="absolute top-2 right-2 rounded-full bg-indigo-600 p-0.5 text-white">
                          <Check size={9} />
                        </div>
                      ) : null}
                      <opt.icon size={18} className={cn("mb-2", theme === opt.id ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-400")} />
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Language">
                  <Input value={preferencesForm.language} onChange={(event) => setPreferencesForm((current) => ({ ...current, language: event.target.value }))} />
                </Field>
                <Field label="Density">
                  <select
                    value={preferencesForm.density}
                    onChange={(event) => setPreferencesForm((current) => ({ ...current, density: event.target.value }))}
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </Field>
                <Field label="Start Page">
                  <Input value={preferencesForm.startPage} onChange={(event) => setPreferencesForm((current) => ({ ...current, startPage: event.target.value }))} />
                </Field>
              </div>

              <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <Button variant="primary" onClick={() => void savePreferencesSection()} isLoading={isSaving === "preferences"}>
                  Save Interface Preferences
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <h4 className="mb-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Usage & Limits</h4>
            <div className="space-y-5">
              {usageStats.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    <span className="text-zinc-900 dark:text-zinc-50">{item.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={cn("h-full rounded-full", item.color === "emerald" ? "bg-emerald-500" : "bg-indigo-500")}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="md" className="group mt-6 w-full border-dashed text-xs text-zinc-500 transition-all hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-500/30">
              Upgrade Plan <ChevronRight size={12} className="ml-1 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle size={14} />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Security Audit</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  You have <span className="font-semibold text-amber-600 dark:text-amber-400">2 pending</span> security audits for production servers.
                </p>
                <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400">
                  View Security Logs <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quick Actions</h4>
            {[
              { label: "Activity Log", icon: TrendingUp },
              { label: "Connected Apps", icon: Zap },
              { label: "Account Settings", icon: Settings },
            ].map((action) => (
              <button
                key={action.label}
                className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
              >
                <action.icon size={14} className="text-zinc-500 transition-colors group-hover:text-indigo-500" />
                <span className="text-sm font-medium">{action.label}</span>
                <ChevronRight size={12} className="ml-auto opacity-0 transition-all group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

function SecurityCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-all dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
