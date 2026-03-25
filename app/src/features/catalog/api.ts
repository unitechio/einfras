import { apiFetch } from "@/core/api-client";

export interface TagItem {
  id: string;
  name: string;
  type: string;
  color: string;
  count: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplicationItem {
  id: string;
  name: string;
  platform: string;
  environment: string;
  status: string;
  uptime: string;
  services: number;
  instances: number;
  cpu: string;
  ram: string;
  last_deploy_at?: string | null;
  public_url?: string;
  tags: string[];
  cpu_pct: number;
  metadata?: Record<string, unknown>;
}

export const tagsApi = {
  list: (search?: string) =>
    apiFetch<{ items: TagItem[] }>(`/v1/tags${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((response) => response.items ?? []),
  create: (body: Partial<TagItem>) =>
    apiFetch<TagItem>("/v1/tags", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<TagItem>) =>
    apiFetch<TagItem>(`/v1/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/v1/tags/${id}`, {
      method: "DELETE",
    }),
};

export const applicationsApi = {
  list: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    return apiFetch<{ items: ApplicationItem[] }>(
      `/v1/applications${query.toString() ? `?${query.toString()}` : ""}`,
    ).then((response) => response.items ?? []);
  },
  create: (body: Partial<ApplicationItem> & { tags?: string[] }) =>
    apiFetch<ApplicationItem>("/v1/applications", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<ApplicationItem> & { tags?: string[] }) =>
    apiFetch<ApplicationItem>(`/v1/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: string) =>
    apiFetch<{ message: string }>(`/v1/applications/${id}`, {
      method: "DELETE",
    }),
};
