const BASE = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly code?: string;

  constructor(status: number, body: string, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

interface ErrorEnvelope {
  status: "error";
  resource?: string;
  action?: string;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface SuccessEnvelope<TItem = unknown, TItems = unknown> {
  status: string;
  resource?: string;
  action?: string;
  item?: TItem;
  items?: TItems;
  command?: unknown;
  result?: unknown;
  meta?: Record<string, unknown>;
}

type Envelope<TItem = unknown, TItems = unknown> = SuccessEnvelope<TItem, TItems> | ErrorEnvelope;

export interface AgentInstallScriptDTO {
  server_id: string;
  control_plane_url: string;
  grpc_url?: string;
  binary_url?: string;
  update_manifest_url?: string;
  script: string;
  install_script: string;
  command: string;
  install_url?: string;
}

export interface AgentStatusDTO {
  server_id: string;
  version?: string;
  online: boolean;
  last_seen?: string;
  cpu_percent?: number;
  mem_percent?: number;
  disk_percent?: number;
  has_docker?: boolean;
  has_k8s?: boolean;
  os?: string;
  arch?: string;
  capabilities?: string[];
  updated_at?: string;
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  uptime_seconds?: number;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return !!value && typeof value === "object" && "error" in value;
}

function isSuccessEnvelope<TItem = unknown, TItems = unknown>(value: unknown): value is SuccessEnvelope<TItem, TItems> {
  return !!value && typeof value === "object" && "status" in value && !("error" in value);
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-User-Role": "admin",
      "X-User-ID": "frontend-user",
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: init?.cache,
  });

  const text = await res.text();
  const parsed = text ? safeParseJSON(text) : undefined;

  if (!res.ok) {
    const envelope = parsed as Partial<ErrorEnvelope> | undefined;
    const message = envelope?.error?.message ?? text ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, text, `[${method} ${url}] ${message}`, envelope?.error?.code);
  }

  if (res.status === 204 || !text) {
    return undefined as T;
  }

  return parsed as T;
}

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function expectEnvelope<TItem = unknown, TItems = unknown>(value: unknown): Envelope<TItem, TItems> {
  return value as Envelope<TItem, TItems>;
}

function unwrapItem<T>(value: unknown): T {
  const envelope = expectEnvelope<T>(value);
  if (isErrorEnvelope(envelope) && envelope.error) {
    throw new ApiError(500, JSON.stringify(envelope), envelope.error.message, envelope.error.code);
  }
  if (isSuccessEnvelope<T>(envelope) && envelope.item !== undefined) {
    return envelope.item as T;
  }
  return value as T;
}

function unwrapItems<T>(value: unknown): { items: T[]; meta: Record<string, unknown> } {
  const envelope = expectEnvelope<never, T[]>(value);
  if (isErrorEnvelope(envelope) && envelope.error) {
    throw new ApiError(500, JSON.stringify(envelope), envelope.error.message, envelope.error.code);
  }
  const items = isSuccessEnvelope<never, T[]>(envelope) && Array.isArray(envelope.items) ? envelope.items : [];
  return {
    items: items as T[],
    meta: isSuccessEnvelope(envelope) ? envelope.meta ?? {} : {},
  };
}

function unwrapAction<T = unknown>(value: unknown): { command?: unknown; result?: T; meta: Record<string, unknown> } {
  const envelope = expectEnvelope<never, never>(value);
  if (isErrorEnvelope(envelope) && envelope.error) {
    throw new ApiError(500, JSON.stringify(envelope), envelope.error.message, envelope.error.code);
  }
  return {
    command: isSuccessEnvelope(envelope) ? envelope.command : undefined,
    result: (isSuccessEnvelope(envelope) ? envelope.result : undefined) as T,
    meta: isSuccessEnvelope(envelope) ? envelope.meta ?? {} : {},
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTerminalCommandStatus(status?: string) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return ["completed", "success", "failed", "cancelled", "canceled", "timed_out", "timeout", "error"].includes(normalized);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export const systemApi = {
  health: () =>
    fetch("/health").then((r) => r.json() as Promise<{ status: string; service: string }>),
};

export interface ServerDTO {
  id: string;
  name: string;
  description?: string;
  hostname?: string;
  ip_address: string;
  os: string;
  os_version?: string;
  status: "online" | "offline" | "maintenance" | "error";
  environment?: string;
  connection_mode?: string;
  onboarding_status?: string;
  location?: string;
  provider?: string;
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  ssh_port?: number;
  ssh_user?: string;
  ssh_key_path?: string;
  tags?: string[];
  last_check_at?: string;
  agent_version?: string;
  created_at?: string;
  updated_at?: string;
  tunnel_enabled?: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
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
  hostname?: string;
  ip_address: string;
  os: string;
  os_version?: string;
  environment?: string;
  connection_mode?: string;
  location?: string;
  provider?: string;
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  ssh_port?: number;
  ssh_user?: string;
  ssh_password?: string;
  ssh_key_path?: string;
  tags?: string[];
  tunnel_enabled?: boolean;
  tunnel_host?: string;
  tunnel_port?: number;
}

export interface CommandEnvelope {
  id: string;
  server_id: string;
  user_id: string;
  command_type: string;
  command: string;
  status: string;
  exit_code?: number | null;
  timeout_sec?: number;
  created_at?: string;
  started_at?: string;
  done_at?: string;
  output_preview?: string;
  output_chunks?: number;
  result?: unknown;
  raw_output?: string;
}

export interface TypedControlResult<T = unknown> {
  schema?: string;
  operation: string;
  status: string;
  summary?: string;
  data?: T;
  preview?: string;
  redactions?: string[];
  truncated?: boolean;
}

export interface ServiceDTO {
  id?: string;
  server_id?: string;
  name: string;
  display_name?: string;
  status: string;
  enabled?: boolean;
  boot_status?: "enabled" | "disabled" | "unknown";
  description?: string;
  pid?: number;
  port?: number;
  config_path?: string;
  log_path?: string;
  last_checked_at?: string;
}

export interface CronjobDTO {
  id: string;
  server_id: string;
  name?: string;
  description?: string;
  status?: string;
  enabled?: boolean;
  cron_expression: string;
  schedule?: string;
  command: string;
  working_dir?: string;
  user?: string;
  last_run_at?: string;
  last_run?: string;
  next_run_at?: string;
  next_run?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BackupDTO {
  id: string;
  server_id: string;
  name?: string;
  label?: string;
  description?: string;
  type?: string;
  status?: string;
  size_bytes?: number;
  size?: number;
  size_gb?: number;
  backup_path?: string;
  path?: string;
  created_at?: string;
}

export interface NetworkInterfaceDTO {
  id: string;
  server_id?: string;
  name: string;
  type?: string;
  ip_address?: string;
  mac_address?: string;
  netmask?: string;
  gateway?: string;
  mtu: number;
  speed?: number;
  is_up: boolean;
  bytes_received?: number;
  bytes_sent?: number;
  last_updated_at?: string;
}

export interface DiskDTO {
  id: string;
  server_id?: string;
  name: string;
  device?: string;
  type?: string;
  filesystem?: string;
  mount_point?: string;
  total_bytes?: number;
  used_bytes?: number;
  free_bytes?: number;
  read_bytes?: number;
  write_bytes?: number;
  is_removable?: boolean;
  state?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PackageListEntry {
  name: string;
  version: string;
  arch: string;
}

export interface AuditLogDTO {
  id: string;
  server_id?: string;
  tenant_id?: string;
  server_groups?: string[];
  actor_id?: string;
  actor_role?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  status?: string;
  policy_decision?: string;
  policy_reason?: string;
  required_capability?: string;
  operation_params_json?: string;
  details?: string;
  created_at?: string;
}

export interface MetricHistoryEntryDTO {
  id?: string;
  server_id?: string;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  disk_read_bytes?: number;
  disk_write_bytes?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  recorded_at?: string;
}

function normalizeService(dto: ServiceDTO): ServiceDTO {
  return {
    ...dto,
    boot_status: dto.boot_status ?? (dto.enabled === true ? "enabled" : dto.enabled === false ? "disabled" : "unknown"),
  };
}

function normalizeCronjob(dto: CronjobDTO): CronjobDTO {
  const enabled = dto.enabled ?? dto.status !== "disabled";
  return {
    ...dto,
    enabled,
    schedule: dto.schedule ?? dto.cron_expression,
    last_run: dto.last_run ?? dto.last_run_at,
    next_run: dto.next_run ?? dto.next_run_at,
  };
}

function normalizeBackup(dto: BackupDTO): BackupDTO {
  return {
    ...dto,
    label: dto.label ?? dto.name,
    path: dto.path ?? dto.backup_path,
    size: dto.size ?? dto.size_bytes,
  };
}

export interface IPTableRuleDTO {
  id: string;
  server_id?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  chain: string;
  action: string;
  protocol?: string;
  source_ip?: string;
  source_port?: string;
  dest_ip?: string;
  dest_port?: string;
  interface?: string;
  state?: string;
  position?: number;
  comment?: string;
  packet_count?: number;
  byte_count?: number;
  last_applied?: string;
  created_at?: string;
  updated_at?: string;
}

export const serversApi = {
  list: async (params?: { page?: number; page_size?: number; status?: string; os?: string; location?: string; provider?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.status) qs.set("status", params.status);
    if (params?.os) qs.set("os", params.os);
    if (params?.location) qs.set("location", params.location);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.search?.trim()) qs.set("search", params.search.trim());
    const query = qs.toString() ? `?${qs}` : "";
    const response = await api.get<Envelope<never, ServerDTO[]>>(`/servers${query}`);
    const { items, meta } = unwrapItems<ServerDTO>(response);
    return {
      data: items,
      total: Number(meta.total ?? items.length),
      page: Number(meta.page ?? params?.page ?? 1),
      page_size: Number(meta.page_size ?? params?.page_size ?? 20),
    } satisfies ServerListResponse;
  },

  get: async (id: string) => unwrapItem<ServerDTO>(await api.get<Envelope<ServerDTO>>(`/servers/${id}`)),
  create: async (body: CreateServerRequest) => unwrapItem<ServerDTO>(await api.post<Envelope<ServerDTO>>("/servers", body)),
  update: async (id: string, body: Partial<CreateServerRequest>) => unwrapItem<ServerDTO>(await api.put<Envelope<ServerDTO>>(`/servers/${id}`, body)),
  delete: async (id: string) => api.delete<Envelope>(`/servers/${id}`),
  metrics: async (id: string) => unwrapItem<any>(await api.get<Envelope<any>>(`/servers/${id}/metrics`)),
  status: async (id: string) => unwrapItem<any>(await api.get<Envelope<any>>(`/servers/${id}/status`)),
  agentStatus: async (id: string) => unwrapItem<AgentStatusDTO>(await api.get<Envelope<AgentStatusDTO>>(`/servers/${id}/agent-status`)),
  healthCheck: async (id: string) => {
    const item = await serversApi.agentStatus(id);
    return {
      healthy: !!item.online,
      message: item.online ? "agent online" : "agent offline",
    };
  },
  agentToken: async (id: string) => unwrapItem<{ server_id: string; token: string; note?: string }>(await api.post<Envelope<{ server_id: string; token: string; note?: string }>>(`/servers/${id}/agent-token`)),
  installScript: async (id: string) =>
    unwrapItem<AgentInstallScriptDTO>(
      await request<Envelope<AgentInstallScriptDTO>>("POST", `/servers/${id}/agent/install-script`, undefined, {
        cache: "no-store",
      }),
    ),
};

export const commandsApi = {
  list: async (serverId: string, limit = 50) =>
    unwrapItems<CommandEnvelope>(await api.get<Envelope<never, CommandEnvelope[]>>(`/servers/${serverId}/commands?limit=${limit}`)).items,
  get: async (serverId: string, commandId: string) =>
    unwrapItem<CommandEnvelope>(await api.get<Envelope<CommandEnvelope>>(`/servers/${serverId}/commands/${commandId}`)),
  cancel: async (serverId: string, commandId: string) =>
    unwrapAction(await api.delete<Envelope>(`/servers/${serverId}/commands/${commandId}`)),
  waitForResult: async (
    serverId: string,
    commandId: string,
    options?: { timeoutMs?: number; intervalMs?: number },
  ) => {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const intervalMs = options?.intervalMs ?? 1_500;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const command = await commandsApi.get(serverId, commandId);
      if (isTerminalCommandStatus(command.status)) {
        return command;
      }
      await sleep(intervalMs);
    }

    throw new ApiError(408, "", `Timed out while waiting for command ${commandId}`);
  },
};

export const servicesApi = {
  list: async (serverId: string) => unwrapItems<ServiceDTO>(await api.get<Envelope<never, ServiceDTO[]>>(`/servers/${serverId}/services`)).items.map(normalizeService),
  get: async (serverId: string, serviceName: string) => normalizeService(unwrapItem<ServiceDTO>(await api.get<Envelope<ServiceDTO>>(`/servers/${serverId}/services/${serviceName}`))),
  action: async (serverId: string, serviceName: string, action: "start" | "stop" | "restart" | "reload" | "enable" | "disable") =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/services/${serviceName}/actions`, { action })),
  discovery: async (serverId: string) =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/services/discovery`)),
  logs: async (serverId: string, serviceName: string, lines = 100) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/services/${serviceName}/logs?lines=${lines}`).then((response) => unwrapAction(response)),
      { timeoutMs: 45_000 },
    ),
};

export const cronjobsApi = {
  list: async (serverId: string) => unwrapItems<CronjobDTO>(await api.get<Envelope<never, CronjobDTO[]>>(`/servers/${serverId}/cronjobs`)).items.map(normalizeCronjob),
  create: async (serverId: string, body: { name?: string; schedule: string; command: string; user?: string; description?: string; working_dir?: string }) =>
    normalizeCronjob(unwrapItem<CronjobDTO>(await api.post<Envelope<CronjobDTO>>(`/servers/${serverId}/cronjobs`, {
      name: body.name,
      description: body.description,
      cron_expression: body.schedule,
      command: body.command,
      working_dir: body.working_dir,
      user: body.user,
    }))),
  get: async (cronjobId: string) => normalizeCronjob(unwrapItem<CronjobDTO>(await api.get<Envelope<CronjobDTO>>(`/cronjobs/${cronjobId}`))),
  update: async (cronjobId: string, body: Partial<CronjobDTO>) =>
    normalizeCronjob(unwrapItem<CronjobDTO>(await api.put<Envelope<CronjobDTO>>(`/cronjobs/${cronjobId}`, {
      ...body,
      cron_expression: body.cron_expression ?? body.schedule,
      status: body.enabled === undefined ? body.status : body.enabled ? "active" : "disabled",
    }))),
  delete: async (cronjobId: string) => api.delete<Envelope>(`/cronjobs/${cronjobId}`),
  execute: async (cronjobId: string) => unwrapAction(await api.post<Envelope>(`/cronjobs/${cronjobId}/execute`)),
  history: async (cronjobId: string) => unwrapItems<any>(await api.get<Envelope<never, any[]>>(`/cronjobs/${cronjobId}/history`)).items,
};

export const backupsApi = {
  list: async (serverId: string) => unwrapItems<BackupDTO>(await api.get<Envelope<never, BackupDTO[]>>(`/servers/${serverId}/backups`)).items.map(normalizeBackup),
  create: async (serverId: string, body: { label?: string; path?: string }) =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/backups`, {
      name: body.label ?? `backup-${Date.now()}`,
      type: "full",
      backup_path: body.path ?? "/var/backups",
      paths: [body.path ?? "/etc"],
    })),
  get: async (backupId: string) => normalizeBackup(unwrapItem<BackupDTO>(await api.get<Envelope<BackupDTO>>(`/backups/${backupId}`))),
  restore: async (backupId: string) => unwrapAction(await api.post<Envelope>(`/backups/${backupId}/restore`)),
  delete: async (backupId: string) => api.delete<Envelope>(`/backups/${backupId}`),
};

export const networkApi = {
  interfaces: async (serverId: string) => unwrapItems<NetworkInterfaceDTO>(await api.get<Envelope<never, NetworkInterfaceDTO[]>>(`/servers/${serverId}/network/interfaces`)).items,
  refresh: async (serverId: string) => unwrapAction(await api.post<Envelope>(`/servers/${serverId}/network/refresh`)),
  check: async (serverId: string, target: string) =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/network/checks`, { target_host: target, protocol: "icmp" })),
  testPort: async (serverId: string, host: string, port: number) =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/network/checks`, { target_host: host, target_port: port, protocol: "tcp" })),
  history: async (serverId: string) => unwrapItems<any>(await api.get<Envelope<never, any[]>>(`/servers/${serverId}/network/checks`)).items,
};

export const iptablesApi = {
  list: async (serverId: string) => unwrapItems<IPTableRuleDTO>(await api.get<Envelope<never, IPTableRuleDTO[]>>(`/servers/${serverId}/iptables/rules`)).items,
  add: async (serverId: string, body: Omit<IPTableRuleDTO, "id" | "server_id">) =>
    unwrapItem<IPTableRuleDTO>(await api.post<Envelope<IPTableRuleDTO>>(`/servers/${serverId}/iptables/rules`, body)),
  update: async (serverId: string, ruleId: string, body: Partial<IPTableRuleDTO>) =>
    unwrapItem<IPTableRuleDTO>(await api.put<Envelope<IPTableRuleDTO>>(`/servers/${serverId}/iptables/rules/${ruleId}`, body)),
  delete: async (serverId: string, ruleId: string) => api.delete<Envelope>(`/servers/${serverId}/iptables/rules/${ruleId}`),
  apply: async (serverId: string) => unwrapAction(await api.post<Envelope>(`/servers/${serverId}/iptables/apply`)),
  backup: async (serverId: string) => unwrapAction(await api.post<Envelope>(`/servers/${serverId}/iptables/backups`, { name: `rules-${Date.now()}` })),
  listBackups: async (serverId: string) => unwrapItems<any>(await api.get<Envelope<never, any[]>>(`/servers/${serverId}/iptables/backups`)).items,
  restore: async (backupId: string) => unwrapAction(await api.post<Envelope>(`/iptables/backups/${backupId}/restore`)),
};

export const monitoringApi = {
  getMetrics: async (serverId: string) => {
    const [m, agent] = await Promise.all([
      serversApi.metrics(serverId),
      serversApi.agentStatus(serverId).catch(() => null),
    ]);
    return {
      cpuUsage: Number(m.cpu_usage ?? agent?.cpu_percent ?? 0),
      memTotal: Number(agent?.memory_gb ?? 0) * 1024 * 1024 * 1024,
      memUsed: 0,
      memPercent: Number(m.memory_usage ?? agent?.mem_percent ?? 0),
      diskMounts: [],
      netRxBytes: 0,
      netTxBytes: 0,
      uptimeSeconds: Number(m.uptime ?? agent?.uptime_seconds ?? 0),
      loadAvg: (m.load_average ?? [0, 0, 0]) as [number, number, number],
      collectedAt: new Date().toISOString(),
    };
  },
  getMetricsHistory: async (serverId: string, limit = 24) =>
    unwrapItems<MetricHistoryEntryDTO>(
      await api.get<Envelope<never, MetricHistoryEntryDTO[]>>(`/servers/${serverId}/metrics/history?limit=${limit}`),
    ).items,
  getHealth: (serverId: string) => serversApi.healthCheck(serverId).then((r) => ({
    status: r.healthy ? ("healthy" as const) : ("critical" as const),
    issues: r.message ? [r.message] : [],
    metrics: null,
  })),
  listAlerts: async (serverId: string) => {
    const [metrics, disks, agentStatus] = await Promise.all([
      monitoringApi.getMetrics(serverId),
      disksApi.list(serverId).catch(() => [] as DiskDTO[]),
      serversApi.agentStatus(serverId).catch(() => null),
    ]);
    const alerts: Array<{ id: string; severity: "info" | "warning" | "critical"; title: string; description: string }> = [];
    if (!agentStatus?.online) {
      alerts.push({
        id: "agent-offline",
        severity: "critical",
        title: "Agent offline",
        description: "The node is not currently connected to the control plane.",
      });
    }
    if (Number(metrics.cpuUsage ?? 0) >= 85) {
      alerts.push({
        id: "cpu-high",
        severity: Number(metrics.cpuUsage ?? 0) >= 95 ? "critical" : "warning",
        title: "High CPU usage",
        description: `CPU load is ${Number(metrics.cpuUsage).toFixed(1)}%.`,
      });
    }
    if (Number(metrics.memPercent ?? 0) >= 85) {
      alerts.push({
        id: "memory-high",
        severity: Number(metrics.memPercent ?? 0) >= 95 ? "critical" : "warning",
        title: "High memory usage",
        description: `Memory usage is ${Number(metrics.memPercent).toFixed(1)}%.`,
      });
    }
    for (const disk of disks) {
      const percent =
        disk.total_bytes && disk.total_bytes > 0
          ? Math.round(((disk.used_bytes ?? 0) / disk.total_bytes) * 100)
          : 0;
      if (percent >= 85) {
        alerts.push({
          id: `disk-${disk.id}`,
          severity: percent >= 95 ? "critical" : "warning",
          title: `Disk usage high on ${disk.mount_point || disk.name}`,
          description: `Disk usage is ${percent}% on ${disk.mount_point || disk.name}.`,
        });
      }
    }
    if (alerts.length === 0) {
      alerts.push({
        id: "healthy",
        severity: "info",
        title: "No active alerts",
        description: "The latest agent, disk, and metrics checks look healthy.",
      });
    }
    return alerts;
  },
  createAlert: async () => null,
  deleteAlert: async () => null,
};

export const auditApi = {
  list: async (
    serverId: string,
    params?: { tenant_id?: string; policy_decision?: string; action?: string; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.tenant_id) qs.set("tenant_id", params.tenant_id);
    if (params?.policy_decision) qs.set("policy_decision", params.policy_decision);
    if (params?.action) qs.set("action", params.action);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return unwrapItems<AuditLogDTO>(await api.get<Envelope<never, AuditLogDTO[]>>(`/servers/${serverId}/audit-logs${query}`));
  },
};

export const disksApi = {
  list: async (serverId: string) =>
    unwrapItems<DiskDTO>(await api.get<Envelope<never, DiskDTO[]>>(`/servers/${serverId}/disks`)).items,
  refresh: async (serverId: string) =>
    unwrapAction(await api.post<Envelope>(`/servers/${serverId}/disks/refresh`)),
};

async function resolveCommandAction<T = unknown>(
  serverId: string,
  actionPromise: Promise<{ command?: unknown; result?: T; meta: Record<string, unknown> }>,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<{ command?: unknown; result?: T; meta: Record<string, unknown>; raw_output?: string }> {
  const action = await actionPromise;
  const command = action.command as CommandEnvelope | undefined;
  if (!command?.id) {
    return action;
  }
  const completed = await commandsApi.waitForResult(serverId, command.id, options);
  return {
    ...action,
    command: completed,
    result: (completed.result as T | undefined) ?? action.result,
    raw_output: completed.raw_output ?? completed.output_preview,
  };
}

export const terminalApi = {
  exec: async (serverId: string, body: { command: string; timeout_sec?: number }) =>
    resolveCommandAction(
      serverId,
      api
        .post<Envelope>(`/servers/${serverId}/terminal/exec`, body)
        .then((response) => unwrapAction(response)),
      { timeoutMs: (body.timeout_sec ?? 30) * 1000 + 15_000 },
    ),
};

export const filesystemApi = {
  list: async (serverId: string, body: { path: string; depth?: number }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/filesystem/list`, body).then((response) => unwrapAction(response)),
    ),
  read: async (serverId: string, body: { path: string; lines?: number }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/filesystem/read`, body).then((response) => unwrapAction(response)),
    ),
  write: async (serverId: string, body: { path: string; content: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/filesystem/write`, body).then((response) => unwrapAction(response)),
    ),
  chmod: async (serverId: string, body: { path: string; mode: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/filesystem/chmod`, body).then((response) => unwrapAction(response)),
    ),
};

export const accessApi = {
  action: async (serverId: string, body: { action: string; target?: string; payload?: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/access/actions`, {
        action: body.action,
        target: body.target ?? "",
        payload: body.payload ?? "",
      }).then((response) => unwrapAction(response)),
    ),
};

export const configApi = {
  action: async (serverId: string, body: { action: string; target?: string; payload?: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/config/actions`, {
        action: body.action,
        target: body.target ?? "",
        payload: body.payload ?? "",
      }).then((response) => unwrapAction(response)),
    ),
};

export const processApi = {
  signal: async (serverId: string, body: { pid: number; signal: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/processes/actions`, body).then((response) => unwrapAction(response)),
    ),
};

export const packagesApi = {
  list: async (serverId: string) =>
    resolveCommandAction<TypedControlResult<PackageListEntry[]>>(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/packages/actions`, { action: "list", package_name: "" }).then((response) => unwrapAction(response)),
      { timeoutMs: 120_000 },
    ),
  action: async (serverId: string, body: { action: string; package_name: string }) =>
    resolveCommandAction(
      serverId,
      api.post<Envelope>(`/servers/${serverId}/packages/actions`, body).then((response) => unwrapAction(response)),
      { timeoutMs: 120_000 },
    ),
};

export const dockerApi = {
  listHosts: async () => [],
  createHost: async (_body: { name: string; endpoint: string }) => null,
  getHost: async (_id: string) => null,
  updateHost: async (_id: string, _body: unknown) => null,
  deleteHost: async (_id: string) => null,
  listContainers: async (_hostId: string) => [],
  startContainer: async (_hostId: string, _containerId: string) => null,
  stopContainer: async (_hostId: string, _containerId: string) => null,
  containerLogs: async (_hostId: string, _containerId: string) => ({ logs: "" }),
  listImages: async (_hostId: string) => [],
  pullImage: async (_hostId: string, _image: string) => null,
};

export const kubernetesApi = {
  listClusters: async () => [],
  createCluster: async (_body: unknown) => null,
  getCluster: async (_id: string) => null,
  updateCluster: async (_id: string, _body: unknown) => null,
  deleteCluster: async (_id: string) => null,
  listNamespaces: async (_clusterId: string) => [],
  listDeployments: async (_clusterId: string) => [],
  listPods: async (_clusterId: string) => [],
  listNodes: async (_clusterId: string) => [],
  podLogs: async (_clusterId: string, _namespace: string, _podName: string) => ({}),
  scaleDeployment: async (_clusterId: string, _namespace: string, _name: string, _replicas: number) => null,
};
