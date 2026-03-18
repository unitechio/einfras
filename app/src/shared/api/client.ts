/**
 * Centralized API client for EINFRA backend.
 *
 * Base prefix:
 *   /api/v1  →  proxied by Vite dev → http://localhost:8080/api/v1
 *
 * Verified against api/internal/http/router/router.go
 */

const BASE = "/api/v1";

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  
  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      text,
      `[${method} ${url}] ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  if (res.status === 204 || !text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, text, `Non-JSON response from ${url}`);
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ─────────────────────────────────────────────────────────────────────────────
// Health (unauthenticated, no /api/v1 prefix)
// Route: GET /health
// ─────────────────────────────────────────────────────────────────────────────

export const systemApi = {
  health: () =>
    fetch("/health").then((r) => r.json() as Promise<{ status: string; timestamp: string }>),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVERS
// Routes:
//   POST   /api/v1/servers
//   GET    /api/v1/servers
//   GET    /api/v1/servers/:id
//   PUT    /api/v1/servers/:id
//   DELETE /api/v1/servers/:id
//   GET    /api/v1/servers/:id/metrics
//   POST   /api/v1/servers/:id/health-check
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerDTO {
  id: string;
  name: string;
  description?: string;
  ip_address: string;
  hostname?: string;
  os: string;
  os_version?: string;
  cpu_cores?: number;
  cpu_model?: string;
  memory_gb?: number;
  disk_gb?: number;
  status: "online" | "offline" | "maintenance" | "error";
  tags?: string[];
  location?: string;
  provider?: string;
  ssh_port?: number;
  ssh_user?: string;
  tunnel_enabled?: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServerListResponse {
  data: ServerDTO[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  ip_address: string;
  os: string;
  os_version?: string;
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  location?: string;
  provider?: string;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_path?: string;
  tunnel_enabled?: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
  tunnel_user?: string;
}

export const serversApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString() ? `?${qs}` : "";
    return api.get<ServerListResponse>(`/servers${query}`);
  },

  get: (id: string) => api.get<ServerDTO>(`/servers/${id}`),

  create: (body: CreateServerRequest) => api.post<ServerDTO>("/servers", body),

  update: (id: string, body: Partial<CreateServerRequest>) =>
    api.put<ServerDTO>(`/servers/${id}`, body),

  delete: (id: string) => api.delete<void>(`/servers/${id}`),

  metrics: (id: string) =>
    api.get<{
      server_id: string;
      cpu_usage: number;
      memory_usage: number;
      disk_usage: number;
      network_in_mbps: number;
      network_out_mbps: number;
      uptime: number;
      load_average: number[];
      timestamp: string;
      disk_mounts?: Array<{ mount: string; used: number; total: number; percent: number }>;
    }>(`/servers/${id}/metrics`),

  healthCheck: (id: string) =>
    api.post<{ healthy: boolean; message?: string }>(`/servers/${id}/health-check`),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVER SERVICES (systemd)
// Routes:
//   GET  /api/v1/servers/:id/services
//   GET  /api/v1/servers/:id/services/:serviceName
//   POST /api/v1/servers/:id/services/:serviceName/action
//   GET  /api/v1/servers/:id/services/:serviceName/logs
// ─────────────────────────────────────────────────────────────────────────────

export interface ServiceDTO {
  id?: string;
  server_id?: string;
  name: string;
  status: string;         // active | inactive | failed
  boot_status?: string;   // enabled | disabled
  description?: string;
  load_state?: string;
  sub_state?: string;
}

export const servicesApi = {
  list: (serverId: string) =>
    api.get<ServiceDTO[]>(`/servers/${serverId}/services`),

  get: (serverId: string, serviceName: string) =>
    api.get<ServiceDTO>(`/servers/${serverId}/services/${serviceName}`),

  action: (serverId: string, serviceName: string, action: "start" | "stop" | "restart" | "reload" | "enable" | "disable") =>
    api.post<{ message: string }>(`/servers/${serverId}/services/${serviceName}/action`, { action }),

  logs: (serverId: string, serviceName: string, lines = 100) =>
    api.get<{ logs: string }>(`/servers/${serverId}/services/${serviceName}/logs?lines=${lines}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVER CRONJOBS
// ─────────────────────────────────────────────────────────────────────────────

export interface CronjobDTO {
  id: string;
  server_id: string;
  name?: string;
  schedule: string;
  command: string;
  user?: string;
  enabled?: boolean;
  last_run?: string;
  next_run?: string;
  created_at?: string;
}

export const cronjobsApi = {
  list: (serverId: string) =>
    api.get<CronjobDTO[]>(`/servers/${serverId}/cronjobs`),

  create: (serverId: string, body: { name?: string; schedule: string; command: string; user?: string }) =>
    api.post<CronjobDTO>(`/servers/${serverId}/cronjobs`, body),

  get: (cronjobId: string) => api.get<CronjobDTO>(`/cronjobs/${cronjobId}`),

  update: (cronjobId: string, body: Partial<CronjobDTO>) =>
    api.put<CronjobDTO>(`/cronjobs/${cronjobId}`, body),

  delete: (cronjobId: string) => api.delete<void>(`/cronjobs/${cronjobId}`),

  execute: (cronjobId: string) =>
    api.post<{ message: string }>(`/cronjobs/${cronjobId}/execute`),

  history: (cronjobId: string) =>
    api.get<Array<{ id: string; status: string; output?: string; executed_at: string; duration_ms?: number }>>(
      `/cronjobs/${cronjobId}/history`,
    ),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVER BACKUPS
// ─────────────────────────────────────────────────────────────────────────────

export interface BackupDTO {
  id: string;
  server_id: string;
  label?: string;
  path?: string;
  size?: number;
  status?: string;
  created_at: string;
}

export const backupsApi = {
  list: (serverId: string) =>
    api.get<BackupDTO[]>(`/servers/${serverId}/backups`),

  create: (serverId: string, body: { label?: string; path?: string }) =>
    api.post<BackupDTO>(`/servers/${serverId}/backups`, body),

  get: (backupId: string) => api.get<BackupDTO>(`/backups/${backupId}`),

  restore: (backupId: string) =>
    api.post<{ message: string }>(`/backups/${backupId}/restore`),

  delete: (backupId: string) => api.delete<void>(`/backups/${backupId}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVER NETWORK
// ─────────────────────────────────────────────────────────────────────────────

export const networkApi = {
  interfaces: (serverId: string) =>
    api.get<Array<{ name: string; ip: string; mac: string; mtu: number; status: string }>>(`/servers/${serverId}/network/interfaces`),

  check: (serverId: string, target: string) =>
    api.post<{ reachable: boolean; latency_ms?: number; message?: string }>(
      `/servers/${serverId}/network/check`, { target }),

  testPort: (serverId: string, host: string, port: number) =>
    api.post<{ open: boolean; message?: string }>(
      `/servers/${serverId}/network/test-port`, { host, port }),

  history: (serverId: string) =>
    api.get<Array<{ target: string; reachable: boolean; checked_at: string; latency_ms?: number }>>(
      `/servers/${serverId}/network/history`),
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVER IPTABLES (Firewall)
// ─────────────────────────────────────────────────────────────────────────────

export interface IPTableRuleDTO {
  id: string;
  server_id?: string;
  chain: string;
  protocol?: string;
  port?: string;
  source?: string;
  destination?: string;
  action: string;
  enabled?: boolean;
  priority?: number;
  note?: string;
  created_at?: string;
}

export const iptablesApi = {
  list: (serverId: string) =>
    api.get<IPTableRuleDTO[]>(`/servers/${serverId}/iptables`),

  add: (serverId: string, body: Omit<IPTableRuleDTO, "id" | "server_id">) =>
    api.post<IPTableRuleDTO>(`/servers/${serverId}/iptables`, body),

  update: (ruleId: string, body: Partial<IPTableRuleDTO>) =>
    api.put<IPTableRuleDTO>(`/iptables/${ruleId}`, body),

  delete: (ruleId: string) => api.delete<void>(`/iptables/${ruleId}`),

  apply: (serverId: string) =>
    api.post<{ message: string }>(`/servers/${serverId}/iptables/apply`),

  backup: (serverId: string) =>
    api.post<{ backup_id: string; message: string }>(`/servers/${serverId}/iptables/backup`),

  restore: (backupId: string) =>
    api.post<{ message: string }>(`/iptables/backups/${backupId}/restore`),
};

// ─────────────────────────────────────────────────────────────────────────────
// DOCKER
// ─────────────────────────────────────────────────────────────────────────────

export const dockerApi = {
  listHosts: () => api.get<Array<{ id: string; name: string; endpoint: string; status: string }>>("/docker/hosts"),
  createHost: (body: { name: string; endpoint: string }) => api.post("/docker/hosts", body),
  getHost: (id: string) => api.get(`/docker/hosts/${id}`),
  updateHost: (id: string, body: unknown) => api.put(`/docker/hosts/${id}`, body),
  deleteHost: (id: string) => api.delete(`/docker/hosts/${id}`),

  listContainers: (hostId: string) =>
    api.get<Array<{ id: string; name: string; image: string; status: string; created: number; ports?: unknown[] }>>(
      `/docker/hosts/${hostId}/containers`),
  startContainer: (hostId: string, containerId: string) =>
    api.post(`/docker/hosts/${hostId}/containers/${containerId}/start`),
  stopContainer: (hostId: string, containerId: string) =>
    api.post(`/docker/hosts/${hostId}/containers/${containerId}/stop`),
  containerLogs: (hostId: string, containerId: string) =>
    api.get<{ logs: string }>(`/docker/hosts/${hostId}/containers/${containerId}/logs`),

  listImages: (hostId: string) =>
    api.get<Array<{ id: string; tags: string[]; size: number; created: number }>>(
      `/docker/hosts/${hostId}/images`),
  pullImage: (hostId: string, image: string) =>
    api.post(`/docker/hosts/${hostId}/images/pull`, { image }),
};

// ─────────────────────────────────────────────────────────────────────────────
// KUBERNETES
// ─────────────────────────────────────────────────────────────────────────────

export const kubernetesApi = {
  listClusters: () =>
    api.get<Array<{ id: string; name: string; endpoint: string; status: string; node_count?: number }>>(
      "/kubernetes/clusters"),
  createCluster: (body: unknown) => api.post("/kubernetes/clusters", body),
  getCluster: (id: string) => api.get(`/kubernetes/clusters/${id}`),
  updateCluster: (id: string, body: unknown) => api.put(`/kubernetes/clusters/${id}`, body),
  deleteCluster: (id: string) => api.delete(`/kubernetes/clusters/${id}`),
  listNamespaces: (clusterId: string) => api.get(`/kubernetes/clusters/${clusterId}/namespaces`),
  listDeployments: (clusterId: string) => api.get(`/kubernetes/clusters/${clusterId}/deployments`),
  listPods: (clusterId: string) => api.get(`/kubernetes/clusters/${clusterId}/pods`),
  listNodes: (clusterId: string) => api.get(`/kubernetes/clusters/${clusterId}/nodes`),
  podLogs: (clusterId: string, namespace: string, podName: string) =>
    api.get(`/kubernetes/clusters/${clusterId}/namespaces/${namespace}/pods/${podName}/logs`),
  scaleDeployment: (clusterId: string, namespace: string, name: string, replicas: number) =>
    api.post(`/kubernetes/clusters/${clusterId}/namespaces/${namespace}/deployments/${name}/scale`, { replicas }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat re-exports
// ─────────────────────────────────────────────────────────────────────────────

export const auditsApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const qs = params ? `?page=${params.page ?? 1}&limit=${params.limit ?? 50}` : "";
    return api.get(`/audits/logs${qs}`);
  },
  getById: (id: string) => api.get(`/audits/logs/${id}`),
  statistics: () => api.get("/audits/statistics"),
  export: () => api.get("/audits/export"),
};

export const monitoringApi = {
  getMetrics: (serverId: string) => serversApi.metrics(serverId).then((m) => ({
    cpuUsage: m.cpu_usage,
    memTotal: 0,
    memUsed: 0,
    memPercent: m.memory_usage,
    diskMounts: [],
    netRxBytes: 0,
    netTxBytes: 0,
    uptimeSeconds: m.uptime,
    loadAvg: (m.load_average ?? [0, 0, 0]) as [number, number, number],
    collectedAt: m.timestamp,
  })),
  getHealth: (serverId: string) => serversApi.healthCheck(serverId).then((r) => ({
    status: r.healthy ? ("healthy" as const) : ("critical" as const),
    issues: r.message ? [r.message] : [],
    metrics: null,
  })),
  listAlerts: (_serverId: string) => Promise.resolve([] as Array<{ id: string; resource: string; operator: string; threshold: number; status: string; createdAt: string }>),
  createAlert: (_serverId: string, _body: unknown) => Promise.resolve(null),
  deleteAlert: (_serverId: string, _alertId: string) => Promise.resolve(null),
};
