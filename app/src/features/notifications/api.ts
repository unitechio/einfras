import { apiFetch } from "@/core/api-client";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: string;
  channel: string;
  priority: string;
  status: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreferences {
  in_app_enabled: boolean;
  email_enabled: boolean;
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
  only_high_priority: boolean;
  digest: string;
}

export interface IntegrationPlugin {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  status: string;
  endpoint: string;
  secret: string;
  events: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationRoutingRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  integration_kind: string;
  event_types: string[];
  priorities: string[];
  channels: string[];
  statuses: string[];
  tags: string[];
  tag_prefixes: string[];
  metadata?: Record<string, unknown>;
}

export interface NotificationRoutingSimulationRequest {
  title?: string;
  description?: string;
  type?: string;
  channel?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface NotificationRoutingRuleSimulationResult {
  id: string;
  name: string;
  integration_kind: string;
  matched: boolean;
  reasons: string[];
}

export interface NotificationRoutingProviderSimulationResult {
  kind: string;
  name: string;
  enabled: boolean;
  interested: boolean;
  has_rule_set: boolean;
  matched_rule_ids: string[];
  would_deliver: boolean;
  decision_reasons: string[];
}

export interface NotificationRoutingSimulationResponse {
  extracted_tags: string[];
  rule_results: NotificationRoutingRuleSimulationResult[];
  providers: NotificationRoutingProviderSimulationResult[];
}

export const notificationsApi = {
  list: (params?: Record<string, string>) =>
    apiFetch<{ items: NotificationItem[] }>(
      `/v1/notifications${params ? `?${new URLSearchParams(params).toString()}` : ""}`,
    ).then((response) => response.items ?? []),
  get: (id: string) => apiFetch<NotificationItem>(`/v1/notifications/${id}`),
  create: (body: Partial<NotificationItem>) =>
    apiFetch<NotificationItem>("/v1/notifications", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markRead: (id: string) =>
    apiFetch<{ message: string }>(`/v1/notifications/${id}/read`, {
      method: "PUT",
    }),
  markUnread: (id: string) =>
    apiFetch<{ message: string }>(`/v1/notifications/${id}/unread`, {
      method: "PUT",
    }),
  markAllRead: () =>
    apiFetch<{ message: string }>("/v1/notifications/read-all", {
      method: "PUT",
    }),
  updateStatus: (id: string, status: string) =>
    apiFetch<{ message: string }>(`/v1/notifications/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/v1/notifications/${id}`, {
      method: "DELETE",
    }),
  getPreferences: () =>
    apiFetch<NotificationPreferences>("/v1/notifications/preferences"),
  savePreferences: (body: NotificationPreferences) =>
    apiFetch<NotificationPreferences>("/v1/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const integrationsApi = {
  list: () =>
    apiFetch<{ items: IntegrationPlugin[] }>("/v1/integrations").then(
      (response) => response.items ?? [],
    ),
  save: (kind: string, body: Partial<IntegrationPlugin>) =>
    apiFetch<IntegrationPlugin>(`/v1/integrations/${encodeURIComponent(kind)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  test: (kind: string) =>
    apiFetch<{ message: string }>(
      `/v1/integrations/${encodeURIComponent(kind)}/test`,
      { method: "POST" },
    ),
};

export const notificationRoutingApi = {
  list: () =>
    apiFetch<{ items: NotificationRoutingRule[] }>("/v1/notification-routing-rules").then(
      (response) => response.items ?? [],
    ),
  create: (body: Partial<NotificationRoutingRule>) =>
    apiFetch<NotificationRoutingRule>("/v1/notification-routing-rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<NotificationRoutingRule>) =>
    apiFetch<NotificationRoutingRule>(`/v1/notification-routing-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/v1/notification-routing-rules/${id}`, {
      method: "DELETE",
    }),
  simulate: (body: NotificationRoutingSimulationRequest) =>
    apiFetch<NotificationRoutingSimulationResponse>("/v1/notification-routing-rules/simulate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
