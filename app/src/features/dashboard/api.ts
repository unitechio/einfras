import { apiFetch } from "@/core/api-client";

export interface PresenceUserSummary {
  user_id: string;
  email: string;
  full_name: string;
  last_seen_at: string;
  active_sessions: number;
  online_windows: string[];
}

export interface PresenceSummary {
  online_users_5m: number;
  online_users_15m: number;
  active_sessions: number;
  users: PresenceUserSummary[];
  generated_at: string;
}

export interface AuditTimelineItem {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource: string;
  resource_id: string;
  environment: string;
  status: string;
  ip_address: string;
  user_agent: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export const dashboardApi = {
  getPresence: () => apiFetch<PresenceSummary>("/v1/auth/presence"),
  listAuditTimeline: (limit = 12) =>
    apiFetch<{ items: AuditTimelineItem[] }>(`/v1/iam/audit-logs?limit=${limit}`).then((response) => response.items ?? []),
};
