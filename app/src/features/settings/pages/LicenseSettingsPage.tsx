"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Badge } from "@/shared/ui/Badge";
import {
  settingsApi,
  type RuntimeLicense,
  type RuntimeLicenseKey,
} from "@/features/settings/api";

type LicenseFeature = {
  key: string;
  label: string;
};

const LICENSE_FEATURES: LicenseFeature[] = [
  { key: "runtime_topology", label: "Runtime Topology" },
  { key: "docker_compose_runtime", label: "Docker Compose Runtime" },
  { key: "docker_tree_view", label: "Docker Tree View" },
  { key: "integration_providers", label: "Integration Providers" },
  { key: "notification_routing", label: "Notification Routing Rules" },
  { key: "native_integrations", label: "Native Integrations" },
  { key: "edge_compute", label: "Edge Compute" },
  { key: "tags_catalog", label: "Tags Catalog" },
  { key: "applications_catalog", label: "Applications Catalog" },
  { key: "runtime_audit", label: "Runtime Audit Trail" },
  { key: "dashboard_overview", label: "Dashboard Overview" },
  { key: "license_management", label: "License Management" },
];

const emptyKeyDraft = (): Partial<RuntimeLicenseKey> => ({
  name: "",
  tier: "free",
  status: "draft",
  is_primary: false,
  issued_to: "",
  expires_at: null,
  features: [
    "runtime_topology",
    "docker_compose_runtime",
    "integration_providers",
  ],
  metadata: {},
});

export default function LicenseSettingsPage() {
  const { showNotification } = useNotification();
  const [license, setLicense] = useState<RuntimeLicense | null>(null);
  const [licenseKeys, setLicenseKeys] = useState<RuntimeLicenseKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [draft, setDraft] =
    useState<Partial<RuntimeLicenseKey>>(emptyKeyDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedKey = useMemo(
    () => licenseKeys.find((item) => item.id === selectedKeyId) ?? null,
    [licenseKeys, selectedKeyId],
  );

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [runtimeLicense, keys] = await Promise.all([
        settingsApi.getLicense(),
        settingsApi.listLicenseKeys(),
      ]);
      setLicense(runtimeLicense);
      setLicenseKeys(keys);
      if (keys.length > 0) {
        setSelectedKeyId((current) => current ?? keys[0].id);
        setDraft(keys[0]);
      } else {
        setSelectedKeyId(null);
        setDraft(emptyKeyDraft());
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load license data",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateDraft = (patch: Partial<RuntimeLicenseKey>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const toggleFeature = (key: string) => {
    const current = draft.features ?? [];
    updateDraft({
      features: current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    });
  };

  const saveLicenseProfile = async () => {
    if (!license) return;
    setIsSaving(true);
    try {
      setLicense(await settingsApi.saveLicense(license));
      showNotification({ type: "success", message: "License profile saved" });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save license profile",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateLicense = async () => {
    setIsGenerating(true);
    try {
      setLicense(await settingsApi.generateLicense(license?.tier));
      await loadAll();
      showNotification({
        type: "success",
        message: "Primary license key regenerated",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to generate license",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveLicenseKey = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        expires_at: draft.expires_at
          ? `${String(draft.expires_at).slice(0, 10)}T00:00:00Z`
          : "",
      };
      const saved = selectedKey?.id
        ? await settingsApi.updateLicenseKey(selectedKey.id, payload)
        : await settingsApi.createLicenseKey(payload);
      showNotification({ type: "success", message: "License key saved" });
      await loadAll();
      setSelectedKeyId(saved.id);
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to save license key",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLicenseKey = async () => {
    if (!selectedKey) return;
    setIsSaving(true);
    try {
      await settingsApi.removeLicenseKey(selectedKey.id);
      showNotification({ type: "success", message: "License key deleted" });
      await loadAll();
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete license key",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyKey = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showNotification({ type: "success", message: "License key copied" });
    } catch {
      showNotification({
        type: "error",
        message: "Unable to copy license key",
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <KeyRound className="h-6 w-6 text-amber-500" />
            License Keys
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage the active organization license plus a reusable inventory of
            customer-facing activation keys.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedKeyId(null);
              setDraft(emptyKeyDraft());
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Key
          </Button>
          <Button
            variant="outline"
            onClick={() => void generateLicense()}
            isLoading={isGenerating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate Active Key
          </Button>
          <Button
            variant="primary"
            onClick={() => void saveLicenseProfile()}
            isLoading={isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Active License
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-dashed border-zinc-300 p-8 text-sm text-zinc-500">
          Loading license profile...
        </div>
      ) : null}

      {license ? (
        <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline">{license.tier.toUpperCase()}</Badge>
                <Badge variant="outline">{license.status}</Badge>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Active organization license
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                This is the currently promoted license used by runtime gating
                and entitlement summaries.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void copyKey(license.license_key)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Active Key
            </Button>
          </div>
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-4 font-mono text-sm tracking-[0.18em] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
            {license.license_key || "No active key"}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              value={license.tier}
              onChange={(e) => setLicense({ ...license, tier: e.target.value })}
              placeholder="Tier"
            />
            <Input
              value={license.status}
              onChange={(e) =>
                setLicense({ ...license, status: e.target.value })
              }
              placeholder="Status"
            />
            <Input
              value={license.contact_email}
              onChange={(e) =>
                setLicense({ ...license, contact_email: e.target.value })
              }
              placeholder="Contact email"
            />
            <Input
              value={license.expires_at ? license.expires_at.slice(0, 10) : ""}
              onChange={(e) =>
                setLicense({
                  ...license,
                  expires_at: e.target.value
                    ? `${e.target.value}T00:00:00Z`
                    : null,
                })
              }
              placeholder="Expiry date"
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Key Inventory
            </div>
            <Badge variant="outline">{licenseKeys.length} keys</Badge>
          </div>
          {licenseKeys.map((key) => (
            <button
              key={key.id}
              type="button"
              onClick={() => {
                setSelectedKeyId(key.id);
                setDraft(key);
              }}
              className={`w-full rounded-xl border px-4 py-4 text-left ${selectedKeyId === key.id ? "border-amber-500 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10" : "border-zinc-200 dark:border-zinc-800"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {key.name}
                </div>
                <Badge variant={key.is_primary ? "success" : "outline"}>
                  {key.is_primary ? "primary" : key.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-500">{key.tier}</div>
              <div className="mt-3 font-mono text-[11px] text-zinc-500">
                {key.license_key}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-6 rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={draft.name ?? ""}
              onChange={(e) => updateDraft({ name: e.target.value })}
              placeholder="Customer Production Key"
            />
            <Input
              value={draft.issued_to ?? ""}
              onChange={(e) => updateDraft({ issued_to: e.target.value })}
              placeholder="Issued to / account name"
            />
            <Input
              value={draft.tier ?? "free"}
              onChange={(e) => updateDraft({ tier: e.target.value })}
              placeholder="Tier"
            />
            <Input
              value={draft.status ?? "draft"}
              onChange={(e) => updateDraft({ status: e.target.value })}
              placeholder="Status"
            />
            <Input
              value={
                draft.expires_at ? String(draft.expires_at).slice(0, 10) : ""
              }
              onChange={(e) =>
                updateDraft({ expires_at: e.target.value || null })
              }
              placeholder="Expiry date"
            />
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
              <span>Promote as primary key</span>
              <input
                type="checkbox"
                checked={draft.is_primary ?? false}
                onChange={(e) => updateDraft({ is_primary: e.target.checked })}
              />
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212]">
              <div className="mb-4 flex items-center gap-3">
                <Shield className="h-5 w-5 text-amber-500" />
                <div>
                  <h2 className="text-base font-semibold">Entitlements</h2>
                  <p className="text-sm text-zinc-500">
                    Control which features this specific license key can
                    activate.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {LICENSE_FEATURES.map((feature) => {
                  const enabled = (draft.features ?? []).includes(feature.key);
                  return (
                    <button
                      key={feature.key}
                      type="button"
                      onClick={() => toggleFeature(feature.key)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${enabled ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" : "border-zinc-200 dark:border-zinc-800"}`}
                    >
                      <span className="text-sm font-medium">
                        {feature.label}
                      </span>
                      <span className="text-xs">
                        {enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212]">
              <div className="mb-4 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <div>
                  <h2 className="text-base font-semibold">Key Actions</h2>
                  <p className="text-sm text-zinc-500">
                    Persist or retire customer-facing keys without losing the
                    main organization license profile.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {selectedKey?.license_key ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void copyKey(selectedKey.license_key)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Selected Key
                  </Button>
                ) : null}
                {selectedKey ? (
                  <Button
                    variant="outline"
                    className="w-full text-red-600"
                    onClick={() => void deleteLicenseKey()}
                    isLoading={isSaving}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected Key
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => void saveLicenseKey()}
                  isLoading={isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save License Key
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
