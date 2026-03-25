import { api } from "@/shared/api/client";

export interface IAMAuditLogRecord {
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
  metadata: Record<string, unknown>;
  timestamp: string;
}

export const monitoringAuditApi = {
  list: async (params?: {
    limit?: number;
    status?: string;
    resource?: string;
    action?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.resource) query.set("resource", params.resource);
    if (params?.action) query.set("action", params.action);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const result = await api.get<{ items: IAMAuditLogRecord[] }>(`/iam/audit-logs${suffix}`);
    return result.items ?? [];
  },
};
