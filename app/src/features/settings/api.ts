import { apiFetch } from "@/core/api-client";

export interface RuntimeSystemSetting {
  id: string;
  key: string;
  category: string;
  value: string;
  description: string;
  sensitive: boolean;
  metadata?: Record<string, unknown>;
}

export interface RuntimeFeatureFlag {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface RuntimeLicense {
  id: string;
  license_key: string;
  tier: string;
  status: string;
  contact_email: string;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RuntimeLicenseKey {
  id: string;
  name: string;
  license_key: string;
  tier: string;
  status: string;
  is_primary: boolean;
  issued_to?: string;
  expires_at?: string | null;
  activated_at?: string | null;
  revoked_at?: string | null;
  features: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeUserSettings {
  id: string;
  payload: Record<string, unknown>;
}

export interface PublicLoginConfiguration {
  enabled: boolean;
  title: string;
  message: string;
  severity: string;
  help_text: string;
  button_label: string;
}

export const settingsApi = {
  getPublicLoginConfiguration: (organization = "default") =>
    fetch(`/api/v1/public/login-config?organization=${encodeURIComponent(organization)}`, {
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | (PublicLoginConfiguration & { error?: { message?: string } })
        | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      return (payload ?? {
        enabled: false,
        title: "Workspace notice",
        message: "",
        severity: "info",
        help_text: "",
        button_label: "Review workspace notice",
      }) as PublicLoginConfiguration;
    }),
  listSystem: (category?: string) =>
    apiFetch<{ items: RuntimeSystemSetting[] }>(
      `/v1/settings/system${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ).then((response) => response.items ?? []),
  saveSystem: (items: Array<Partial<RuntimeSystemSetting> & { key: string; category: string; value: string }>) =>
    apiFetch<{ items: RuntimeSystemSetting[] }>("/v1/settings/system", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }).then((response) => response.items ?? []),
  listFeatureFlags: () =>
    apiFetch<{ items: RuntimeFeatureFlag[] }>("/v1/settings/feature-flags").then(
      (response) => response.items ?? [],
    ),
  saveFeatureFlags: (items: Array<Partial<RuntimeFeatureFlag> & { key: string; enabled: boolean }>) =>
    apiFetch<{ items: RuntimeFeatureFlag[] }>("/v1/settings/feature-flags", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }).then((response) => response.items ?? []),
  getLicense: () => apiFetch<RuntimeLicense>("/v1/settings/license"),
  saveLicense: (body: Partial<RuntimeLicense>) =>
    apiFetch<RuntimeLicense>("/v1/settings/license", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  generateLicense: (tier?: string) =>
    apiFetch<RuntimeLicense>("/v1/settings/license/generate", {
      method: "POST",
      body: JSON.stringify({ tier }),
    }),
  listLicenseKeys: () =>
    apiFetch<{ items: RuntimeLicenseKey[] }>("/v1/settings/license-keys").then(
      (response) => response.items ?? [],
    ),
  createLicenseKey: (body: Partial<RuntimeLicenseKey> & { name?: string; tier?: string }) =>
    apiFetch<RuntimeLicenseKey>("/v1/settings/license-keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLicenseKey: (id: string, body: Partial<RuntimeLicenseKey>) =>
    apiFetch<RuntimeLicenseKey>(`/v1/settings/license-keys/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  removeLicenseKey: (id: string) =>
    apiFetch<{ message: string }>(`/v1/settings/license-keys/${id}`, {
      method: "DELETE",
    }),
  getUserSettings: () => apiFetch<RuntimeUserSettings>("/v1/settings/user"),
  saveUserSettings: (payload: Record<string, unknown>) =>
    apiFetch<RuntimeUserSettings>("/v1/settings/user", {
      method: "PUT",
      body: JSON.stringify({ payload }),
    }),
};
