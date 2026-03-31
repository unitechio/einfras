"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cloud,
  Database,
  Download,
  Github,
  GitBranch,
  Globe,
  Lock,
  MessageCircle,
  ExternalLink,
  PlugZap,
  Save,
  Send,
  Settings as SettingsIcon,
  Tag,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import {
  integrationsApi,
  type IntegrationPlugin,
} from "@/features/notifications/api";
import {
  settingsApi,
  type RuntimeSystemSetting,
} from "@/features/settings/api";
import { useRuntimeFeatureFlags } from "@/features/settings/useRuntimeFeatureFlags";

type ProviderField = {
  key: string;
  label: string;
  placeholder: string;
};

const providerFields: Record<string, ProviderField[]> = {
  "github-actions": [
    { key: "repository", label: "Repository", placeholder: "owner/repo" },
    { key: "workflow_id", label: "Workflow ID", placeholder: "deploy.yml" },
    { key: "ref", label: "Git Ref", placeholder: "main" },
  ],
  "gitlab-cicd": [
    {
      key: "project_id",
      label: "Project ID",
      placeholder: "group%2Fproject or 123456",
    },
    { key: "ref", label: "Git Ref", placeholder: "main" },
    {
      key: "trigger_token",
      label: "Trigger Token",
      placeholder: "GitLab trigger token",
    },
  ],
  telegram: [
    { key: "bot_token", label: "Bot Token", placeholder: "123456:ABC..." },
    { key: "chat_id", label: "Chat ID", placeholder: "-1001234567890" },
  ],
  whatsapp: [
    {
      key: "phone_number_id",
      label: "Phone Number ID",
      placeholder: "123456789012345",
    },
    { key: "recipient", label: "Recipient", placeholder: "84901234567" },
    {
      key: "access_token",
      label: "Access Token",
      placeholder: "Meta access token",
    },
  ],
};

function toMap(items: RuntimeSystemSetting[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value ?? "";
    return acc;
  }, {});
}

function boolValue(map: Record<string, string>, key: string, fallback = false) {
  const value = map[key];
  if (!value) {
    return fallback;
  }
  return value === "true";
}

function stringValue(map: Record<string, string>, key: string, fallback = "") {
  return map[key] ?? fallback;
}

function bannerTone(value: string) {
  switch (value) {
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-50";
    case "critical":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-50";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-50";
    default:
      return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-50";
  }
}

export default function GeneralSettingsPage() {
  const { showNotification } = useNotification();
  const featureFlags = useRuntimeFeatureFlags();
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>(
    {},
  );
  const [integrations, setIntegrations] = useState<IntegrationPlugin[]>([]);
  const [filters, setFilters] = useState<
    Array<{ name: string; value: string }>
  >([]);
  const [filterName, setFilterName] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingKey, setIsSavingKey] = useState("");
  const [testingKind, setTestingKind] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [settings, plugins] = await Promise.all([
        settingsApi.listSystem(),
        integrationsApi.list(),
      ]);
      const map = toMap(settings);
      setSystemSettings(map);
      setIntegrations(plugins);
      try {
        const parsed = JSON.parse(map.hidden_container_filters || "[]");
        if (Array.isArray(parsed)) {
          setFilters(parsed);
        }
      } catch {
        setFilters([]);
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSystemSettings((current) => ({ ...current, [key]: value }));
  };

  const updateIntegration = (id: string, patch: Partial<IntegrationPlugin>) => {
    setIntegrations((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const updateIntegrationMetadata = (
    id: string,
    key: string,
    value: string,
  ) => {
    setIntegrations((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              metadata: {
                ...(item.metadata ?? {}),
                [key]: value,
              },
            }
          : item,
      ),
    );
  };

  const saveSystemCategory = async (
    savingKey: string,
    items: Array<{
      key: string;
      category: string;
      value: string;
      description: string;
      sensitive?: boolean;
    }>,
  ) => {
    setIsSavingKey(savingKey);
    try {
      await settingsApi.saveSystem(items);
      showNotification({
        type: "success",
        message: "Settings saved",
        description: "Configuration has been persisted to the backend.",
      });
      await loadAll();
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save settings",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSavingKey("");
    }
  };

  const saveIntegrations = async () => {
    setIsSavingKey("integrations");
    try {
      await Promise.all(
        integrations.map((integration) =>
          integrationsApi.save(integration.kind, {
            ...integration,
            metadata: {
              ...(integration.metadata ?? {}),
              route_tags: String(integration.metadata?.route_tags ?? ""),
              route_tag_prefixes: String(
                integration.metadata?.route_tag_prefixes ?? "",
              ),
              priority_filter: String(
                integration.metadata?.priority_filter ?? "all",
              ),
              channel_filter: String(
                integration.metadata?.channel_filter ?? "all",
              ),
              status_filter: String(
                integration.metadata?.status_filter ?? "all",
              ),
              type_filter: String(integration.metadata?.type_filter ?? "all"),
            },
          }),
        ),
      );
      showNotification({
        type: "success",
        message: "Providers saved",
        description:
          "Adapter configuration and delivery channels are now persisted.",
      });
      await loadAll();
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save providers",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSavingKey("");
    }
  };

  const saveContainerFilters = async () => {
    await saveSystemCategory("filters", [
      {
        key: "hidden_container_filters",
        category: "docker",
        value: JSON.stringify(filters),
        description: "Container label filters hidden from runtime views",
      },
    ]);
  };

  const addFilter = () => {
    if (!filterName.trim()) {
      showNotification({
        type: "error",
        message: "Label key required",
      });
      return;
    }
    setFilters((current) => [
      ...current,
      { name: filterName.trim(), value: filterValue.trim() },
    ]);
    setFilterName("");
    setFilterValue("");
  };

  const removeFilter = (index: number) => {
    setFilters((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const renderProviderIcon = (kind: string) => {
    if (kind === "github-actions") return Github;
    if (kind === "gitlab-cicd") return GitBranch;
    if (kind === "telegram") return Send;
    return MessageCircle;
  };

  const renderSwitch = (checked: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <SettingsIcon className="h-6 w-6 text-indigo-500" />
            General Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Core platform defaults, runtime behavior and provider adapters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            Feature flags:{" "}
            {featureFlags.flags.filter((item) => item.enabled).length} enabled
          </Badge>
          {featureFlags.isEnabled("license_management", true) ? (
            <Link
              to="/settings/license"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-300"
            >
              License Keys
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          <Link
            to="/settings/feature-flags"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-300"
          >
            Feature Flags
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {featureFlags.isEnabled("notification_routing", true) ? (
            <Link
              to="/settings/notification-routing"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-800 dark:text-zinc-300"
            >
              Routing Rules
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-10 text-sm text-zinc-500">
          Loading settings from backend...
        </div>
      ) : null}

      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="mb-5 flex items-center gap-3">
          <Globe className="h-5 w-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold">Application Settings</h2>
            <p className="text-sm text-zinc-500">
              Global defaults that affect login, edge refresh cadence,
              templates, and shared operator experience.
            </p>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Runtime snapshot interval
                </span>
                <Input
                  value={stringValue(systemSettings, "snapshot_interval", "5m")}
                  onChange={(e) =>
                    updateSetting("snapshot_interval", e.target.value)
                  }
                  placeholder="5m"
                />
                <p className="text-xs text-zinc-500">
                  How often the platform refreshes and persists environment
                  snapshots for dashboards and summaries.
                </p>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Edge agent poll frequency
                </span>
                <Input
                  value={stringValue(
                    systemSettings,
                    "edge_poll_frequency",
                    "5 seconds",
                  )}
                  onChange={(e) =>
                    updateSetting("edge_poll_frequency", e.target.value)
                  }
                  placeholder="5 seconds"
                />
                <p className="text-xs text-zinc-500">
                  Used by edge-connected runtimes when checking in for jobs,
                  heartbeat, and command delivery.
                </p>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  App templates catalog URL
                </span>
                <Input
                  value={stringValue(
                    systemSettings,
                    "app_templates_url",
                    "https://raw.githubusercontent.com/portainer/templates/master/templates.json",
                  )}
                  onChange={(e) =>
                    updateSetting("app_templates_url", e.target.value)
                  }
                  placeholder="https://..."
                />
                <p className="text-xs text-zinc-500">
                  Remote JSON catalog used in App Templates so operators know
                  exactly where templates are sourced from.
                </p>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Anonymous statistics
                  </div>
                  <div className="text-xs text-zinc-500">
                    Telemetry opt-in for product usage analytics.
                  </div>
                </div>
                {renderSwitch(
                  boolValue(systemSettings, "anonymous_statistics", true),
                  () =>
                    updateSetting(
                      "anonymous_statistics",
                      String(
                        !boolValue(
                          systemSettings,
                          "anonymous_statistics",
                          true,
                        ),
                      ),
                    ),
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Login banner
                  </div>
                  <div className="text-xs text-zinc-500">
                    Public pre-login notice for maintenance windows or workspace
                    policy.
                  </div>
                </div>
                {renderSwitch(
                  boolValue(systemSettings, "login_banner", false),
                  () =>
                    updateSetting(
                      "login_banner",
                      String(!boolValue(systemSettings, "login_banner", false)),
                    ),
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Login banner configuration
              </div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                These fields are now exposed to the public login page, so keep
                them operator-safe and non-sensitive.
              </div>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Banner title
              </span>
              <Input
                value={stringValue(
                  systemSettings,
                  "login_banner_title",
                  "Workspace notice",
                )}
                onChange={(e) =>
                  updateSetting("login_banner_title", e.target.value)
                }
                placeholder="Workspace notice"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Banner message
              </span>
              <textarea
                value={stringValue(systemSettings, "login_banner_message", "")}
                onChange={(e) =>
                  updateSetting("login_banner_message", e.target.value)
                }
                placeholder="Example: Production login is restricted during maintenance from 22:00 to 23:00 ICT."
                className="min-h-[110px] w-full rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-[#121212]"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Severity
                </span>
                <select
                  value={stringValue(
                    systemSettings,
                    "login_banner_severity",
                    "info",
                  )}
                  onChange={(e) =>
                    updateSetting("login_banner_severity", e.target.value)
                  }
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  CTA label
                </span>
                <Input
                  value={stringValue(
                    systemSettings,
                    "login_banner_button_label",
                    "Review workspace notice",
                  )}
                  onChange={(e) =>
                    updateSetting("login_banner_button_label", e.target.value)
                  }
                  placeholder="Review workspace notice"
                />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Helper text
              </span>
              <Input
                value={stringValue(
                  systemSettings,
                  "login_banner_help_text",
                  "This notice appears before sign-in and helps operators communicate maintenance or policy changes.",
                )}
                onChange={(e) =>
                  updateSetting("login_banner_help_text", e.target.value)
                }
                placeholder="Short helper note shown under the banner"
              />
            </label>
            <div
              className={cn(
                "rounded-md border px-4 py-4",
                bannerTone(
                  stringValue(systemSettings, "login_banner_severity", "info"),
                ),
              )}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em]">
                Preview
              </div>
              <div className="mt-2 text-base font-semibold">
                {stringValue(
                  systemSettings,
                  "login_banner_title",
                  "Workspace notice",
                )}
              </div>
              <div className="mt-1 text-sm leading-6">
                {stringValue(
                  systemSettings,
                  "login_banner_message",
                  "No banner message configured yet.",
                )}
              </div>
              <div className="mt-3 inline-flex items-center rounded-full border border-current/20 px-3 py-1 text-xs font-medium">
                {stringValue(
                  systemSettings,
                  "login_banner_button_label",
                  "Review workspace notice",
                )}
              </div>
              <div className="mt-2 text-xs opacity-80">
                {stringValue(
                  systemSettings,
                  "login_banner_help_text",
                  "This preview matches the public login screen banner.",
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            isLoading={isSavingKey === "application"}
            onClick={() =>
              void saveSystemCategory("application", [
                {
                  key: "snapshot_interval",
                  category: "application",
                  value: stringValue(systemSettings, "snapshot_interval", "5m"),
                  description: "Environment snapshot interval",
                },
                {
                  key: "edge_poll_frequency",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "edge_poll_frequency",
                    "5 seconds",
                  ),
                  description: "Default edge agent poll frequency",
                },
                {
                  key: "app_templates_url",
                  category: "application",
                  value: stringValue(systemSettings, "app_templates_url", ""),
                  description: "Application templates registry URL",
                },
                {
                  key: "anonymous_statistics",
                  category: "application",
                  value: String(
                    boolValue(systemSettings, "anonymous_statistics", true),
                  ),
                  description: "Anonymous telemetry opt-in",
                },
                {
                  key: "login_banner",
                  category: "application",
                  value: String(
                    boolValue(systemSettings, "login_banner", false),
                  ),
                  description: "Whether to show login banner",
                },
                {
                  key: "login_banner_title",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "login_banner_title",
                    "Workspace notice",
                  ),
                  description: "Public login banner title",
                },
                {
                  key: "login_banner_message",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "login_banner_message",
                    "",
                  ),
                  description: "Public login banner message",
                },
                {
                  key: "login_banner_severity",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "login_banner_severity",
                    "info",
                  ),
                  description: "Public login banner severity",
                },
                {
                  key: "login_banner_help_text",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "login_banner_help_text",
                    "This notice appears before sign-in and helps operators communicate maintenance or policy changes.",
                  ),
                  description: "Public login banner helper text",
                },
                {
                  key: "login_banner_button_label",
                  category: "application",
                  value: stringValue(
                    systemSettings,
                    "login_banner_button_label",
                    "Review workspace notice",
                  ),
                  description: "Public login banner CTA label",
                },
              ])
            }
          >
            <Save className="mr-2 h-4 w-4" />
            Save Application Settings
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="mb-5 flex items-center gap-3">
          <Database className="h-5 w-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold">Kubernetes & Runtime</h2>
            <p className="text-sm text-zinc-500">
              Helm, GitOps and compose/runtime defaults.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={stringValue(
              systemSettings,
              "helm_repo_url",
              "https://charts.bitnami.com/bitnami",
            )}
            onChange={(e) => updateSetting("helm_repo_url", e.target.value)}
            placeholder="Helm repository URL"
          />
          <Input
            value={stringValue(
              systemSettings,
              "kubeconfig_expiry",
              "No expiry",
            )}
            onChange={(e) => updateSetting("kubeconfig_expiry", e.target.value)}
            placeholder="Kubeconfig expiry"
          />
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm">Enforce GitOps</span>
            {renderSwitch(
              boolValue(systemSettings, "enforce_gitops", false),
              () =>
                updateSetting(
                  "enforce_gitops",
                  String(!boolValue(systemSettings, "enforce_gitops", false)),
                ),
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm">Require Change Note</span>
            {renderSwitch(
              boolValue(systemSettings, "require_change_note", false),
              () =>
                updateSetting(
                  "require_change_note",
                  String(
                    !boolValue(systemSettings, "require_change_note", false),
                  ),
                ),
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm">Enable K8s Stacks</span>
            {renderSwitch(
              boolValue(systemSettings, "enable_k8s_stacks", true),
              () =>
                updateSetting(
                  "enable_k8s_stacks",
                  String(!boolValue(systemSettings, "enable_k8s_stacks", true)),
                ),
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm">Force HTTPS Only</span>
            {renderSwitch(boolValue(systemSettings, "force_https", false), () =>
              updateSetting(
                "force_https",
                String(!boolValue(systemSettings, "force_https", false)),
              ),
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            isLoading={isSavingKey === "runtime"}
            onClick={() =>
              void saveSystemCategory("runtime", [
                {
                  key: "helm_repo_url",
                  category: "kubernetes",
                  value: stringValue(systemSettings, "helm_repo_url", ""),
                  description: "Global Helm repository",
                },
                {
                  key: "kubeconfig_expiry",
                  category: "kubernetes",
                  value: stringValue(systemSettings, "kubeconfig_expiry", ""),
                  description: "Kubeconfig expiry policy",
                },
                {
                  key: "enforce_gitops",
                  category: "kubernetes",
                  value: String(
                    boolValue(systemSettings, "enforce_gitops", false),
                  ),
                  description: "Require code-first deployment",
                },
                {
                  key: "require_change_note",
                  category: "kubernetes",
                  value: String(
                    boolValue(systemSettings, "require_change_note", false),
                  ),
                  description: "Require note for updates",
                },
                {
                  key: "enable_k8s_stacks",
                  category: "kubernetes",
                  value: String(
                    boolValue(systemSettings, "enable_k8s_stacks", true),
                  ),
                  description: "Enable Kubernetes stacks",
                },
                {
                  key: "force_https",
                  category: "security",
                  value: String(
                    boolValue(systemSettings, "force_https", false),
                  ),
                  description: "Force HTTPS connections",
                },
              ])
            }
          >
            Save Runtime Settings
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="mb-5 flex items-center gap-3">
          <PlugZap className="h-5 w-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold">Providers & Adapters</h2>
            <p className="text-sm text-zinc-500">
              Native config for GitHub, GitLab, Telegram and WhatsApp delivery,
              including tag-based routing rules.
            </p>
          </div>
        </div>
        {!featureFlags.isEnabled("integration_providers", true) ? (
          <div className="rounded-md border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
            Integration providers are currently disabled by feature flag.
            Re-enable them from the Feature Flags page to edit adapters and
            delivery rules.
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => {
              const Icon = renderProviderIcon(integration.kind);
              return (
                <div
                  key={integration.id}
                  className="rounded-md border border-zinc-200 p-5 dark:border-zinc-800"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">
                            {integration.name}
                          </h3>
                          <Badge variant="outline">{integration.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">
                          Configure provider-specific adapter values or fallback
                          webhook endpoint.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">Enabled</span>
                      {renderSwitch(integration.enabled, () =>
                        updateIntegration(integration.id, {
                          enabled: !integration.enabled,
                        }),
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <Input
                      value={integration.endpoint}
                      onChange={(e) =>
                        updateIntegration(integration.id, {
                          endpoint: e.target.value,
                        })
                      }
                      placeholder="Webhook endpoint fallback"
                    />
                    <Input
                      value={integration.secret}
                      onChange={(e) =>
                        updateIntegration(integration.id, {
                          secret: e.target.value,
                        })
                      }
                      placeholder="Secret / token"
                    />
                    <Input
                      value={integration.events}
                      onChange={(e) =>
                        updateIntegration(integration.id, {
                          events: e.target.value,
                        })
                      }
                      placeholder="deploy, alert, audit"
                    />
                    {(providerFields[integration.kind] ?? []).map((field) => (
                      <Input
                        key={`${integration.id}-${field.key}`}
                        value={String(integration.metadata?.[field.key] ?? "")}
                        onChange={(e) =>
                          updateIntegrationMetadata(
                            integration.id,
                            field.key,
                            e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                      />
                    ))}
                    <Input
                      value={String(integration.metadata?.route_tags ?? "")}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "route_tags",
                          e.target.value,
                        )
                      }
                      placeholder="Route tags: production,frontend,core"
                    />
                    <Input
                      value={String(
                        integration.metadata?.route_tag_prefixes ?? "",
                      )}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "route_tag_prefixes",
                          e.target.value,
                        )
                      }
                      placeholder="Tag prefixes: app:,team:,service:"
                    />
                    <select
                      value={String(
                        integration.metadata?.priority_filter ?? "all",
                      )}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "priority_filter",
                          e.target.value,
                        )
                      }
                      className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <option value="all">All priorities</option>
                      <option value="high">High only</option>
                      <option value="medium">Medium only</option>
                      <option value="low">Low only</option>
                    </select>
                    <select
                      value={String(
                        integration.metadata?.channel_filter ?? "all",
                      )}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "channel_filter",
                          e.target.value,
                        )
                      }
                      className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <option value="all">All channels</option>
                      <option value="in-app">In-app</option>
                      <option value="email">Email</option>
                      <option value="telegram">Telegram</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                    <select
                      value={String(
                        integration.metadata?.status_filter ?? "all",
                      )}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "status_filter",
                          e.target.value,
                        )
                      }
                      className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <option value="all">All statuses</option>
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <select
                      value={String(integration.metadata?.type_filter ?? "all")}
                      onChange={(e) =>
                        updateIntegrationMetadata(
                          integration.id,
                          "type_filter",
                          e.target.value,
                        )
                      }
                      className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <option value="all">All event types</option>
                      <option value="alert">Alert</option>
                      <option value="security">Security</option>
                      <option value="system">System</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-400">
                    Routing matches `metadata.tags`, `metadata.einfra.tags`, and
                    keys like `metadata.einfra.tag.app=payments`. Prefix rules
                    let one provider handle families such as `app:*` or
                    `team:*`.
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      isLoading={testingKind === integration.kind}
                      onClick={() => {
                        setTestingKind(integration.kind);
                        void integrationsApi
                          .save(integration.kind, integration)
                          .then(() => integrationsApi.test(integration.kind))
                          .then(() =>
                            showNotification({
                              type: "success",
                              message: `${integration.name} test sent`,
                              description:
                                "Native adapter or webhook delivery test was triggered.",
                            }),
                          )
                          .catch((err) =>
                            showNotification({
                              type: "error",
                              message: `${integration.name} test failed`,
                              description:
                                err instanceof Error
                                  ? err.message
                                  : "Unknown error",
                            }),
                          )
                          .finally(() => setTestingKind(""));
                      }}
                    >
                      Send Test
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            isLoading={isSavingKey === "integrations"}
            onClick={() => void saveIntegrations()}
            disabled={!featureFlags.isEnabled("integration_providers", true)}
          >
            Save Providers
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
        <div className="mb-5 flex items-center gap-3">
          <Tag className="h-5 w-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold">
              Hidden Container Label Rules
            </h2>
            <p className="text-sm text-zinc-500">
              Persisted tag rules for filtering runtime container lists.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Label key"
          />
          <Input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Label value"
          />
          <Button variant="outline" onClick={addFilter}>
            Add
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {filters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
              No label rules defined yet.
            </div>
          ) : (
            filters.map((filter, index) => (
              <div
                key={`${filter.name}-${index}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <span className="font-mono text-sm">
                  {filter.name}={filter.value || "*"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(index)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            isLoading={isSavingKey === "filters"}
            onClick={() => void saveContainerFilters()}
          >
            Save Label Rules
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="mb-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-semibold">Backup Preferences</h2>
              <p className="text-sm text-zinc-500">
                Metadata for backup/export actions.
              </p>
            </div>
          </div>
          <Input
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder="Optional export password"
          />
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              isLoading={isSavingKey === "backup"}
              onClick={() =>
                void saveSystemCategory("backup", [
                  {
                    key: "backup_password_configured",
                    category: "backup",
                    value: String(Boolean(backupPassword.trim())),
                    description:
                      "Whether a backup password has been configured in UI",
                  },
                ])
              }
            >
              Save Backup Settings
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="mb-4 flex items-center gap-3">
            <Download className="h-5 w-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-semibold">Certificates & Export</h2>
              <p className="text-sm text-zinc-500">
                Operational actions still run on existing backend flows.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
              <Upload className="h-4 w-4" />
              Upload CA bundle
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500">
              <Cloud className="h-4 w-4" />
              Prepare backup export
            </button>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            TLS file upload and archive generation remain action-based
            workflows; the configuration flags above are now persisted.
          </div>
        </div>
      </section>
    </div>
  );
}
