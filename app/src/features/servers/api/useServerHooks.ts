import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Server } from "../types";
import { serverKeys } from "./useServers";
import type { FirewallRule } from "@/types/firewall.types";
import {
  serversApi,
  servicesApi,
  cronjobsApi,
  backupsApi,
  networkApi,
  iptablesApi,
  monitoringApi,
  type ServiceDTO,
  type CronjobDTO,
  type BackupDTO,
  type IPTableRuleDTO,
} from "@/shared/api/client";

// ─── Export types for consumers ───────────────────────────────────────────────

export type { ServiceDTO, CronjobDTO, BackupDTO, IPTableRuleDTO };

export interface ServerMetrics {
  server_id: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
  uptime: number;
  load_average: number[];
  timestamp: string;
}

// ─── Server Detail ─────────────────────────────────────────────────────────────
// GET /api/v1/servers/:id

export const useServerDetail = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: async (): Promise<Server> => {
      const dto = await serversApi.get(id);
      return {
        id: dto.id,
        name: dto.name,
        description: dto.description ?? "",
        status: dto.status,
        ip_address: dto.ip_address,
        os: dto.os as Server["os"],
        os_version: dto.os_version ?? "",
        cpu_cores: dto.cpu_cores ?? 0,
        memory_gb: dto.memory_gb ?? 0,
        disk_gb: dto.disk_gb ?? 0,
        ssh_port: dto.ssh_port ?? 22,
        ssh_user: dto.ssh_user ?? "root",
        tunnel_enabled: dto.tunnel_enabled ?? false,
        location: dto.location,
        provider: dto.provider,
        created_at: dto.created_at,
        updated_at: dto.updated_at,
      };
    },
    enabled: !!id && options?.enabled !== false,
    staleTime: 60_000,
  });
};

// ─── Metrics ──────────────────────────────────────────────────────────────────
// GET /api/v1/servers/:id/metrics

export const useServerMetrics = (serverId: string, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: ["servers", "metrics", serverId],
    queryFn: async () => {
      const m = await serversApi.metrics(serverId);
      return {
        server_id: serverId,
        cpu_usage: m.cpu_usage,
        memory_usage: m.memory_usage,
        disk_usage: m.disk_usage,
        network_in_mbps: m.network_in_mbps,
        network_out_mbps: m.network_out_mbps,
        uptime: m.uptime,
        load_average: m.load_average ?? [0, 0, 0],
        timestamp: m.timestamp,
      } satisfies ServerMetrics;
    },
    enabled: !!serverId,
    refetchInterval: options?.refetchInterval ?? 10_000,
    retry: 2,
  });
};

// ─── Health Check ─────────────────────────────────────────────────────────────
// POST /api/v1/servers/:id/health-check

export const useServerHealth = (serverId: string, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: ["servers", "health", serverId],
    queryFn: () => serversApi.healthCheck(serverId),
    enabled: !!serverId,
    refetchInterval: options?.refetchInterval ?? 30_000,
    retry: 2,
  });
};

// ─── Heartbeat (polling health) ───────────────────────────────────────────────

export const useServerHeartbeat = (id: string, refetchInterval = 30_000) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["servers", "heartbeat", id],
    queryFn: async () => {
      try {
        const result = await serversApi.healthCheck(id);
        qc.setQueryData(serverKeys.detail(id), (old: Server | undefined) =>
          old ? { ...old, status: result.healthy ? "online" : "error" } : old,
        );
        return { server_id: id, healthy: result.healthy };
      } catch {
        return { server_id: id, healthy: false };
      }
    },
    enabled: !!id,
    refetchInterval,
    retry: false,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES (systemd)
// GET  /api/v1/servers/:id/services
// POST /api/v1/servers/:id/services/:name/action
// GET  /api/v1/servers/:id/services/:name/logs
// ─────────────────────────────────────────────────────────────────────────────

export const useServerServices = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "services", serverId],
    queryFn: () => servicesApi.list(serverId),
    enabled: !!serverId,
    staleTime: 15_000,
  });

export const useServiceAction = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      action,
    }: {
      name: string;
      action: "start" | "stop" | "restart" | "reload" | "enable" | "disable";
    }) => servicesApi.action(serverId, name, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "services", serverId] }),
  });
};

export const useServiceLogs = (serverId: string, name: string, lines = 200) =>
  useQuery({
    queryKey: ["servers", "service-logs", serverId, name, lines],
    queryFn: () => servicesApi.logs(serverId, name, lines),
    enabled: !!serverId && !!name,
    refetchInterval: 5_000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// CRONJOBS
// POST /api/v1/servers/:id/cronjobs
// GET  /api/v1/servers/:id/cronjobs
// PUT/DELETE /api/v1/cronjobs/:id
// ─────────────────────────────────────────────────────────────────────────────

export const useServerCron = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "cron", serverId],
    queryFn: () => cronjobsApi.list(serverId),
    enabled: !!serverId,
    staleTime: 30_000,
  });

export const useAddCronJob = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; schedule: string; command: string; user?: string }) =>
      cronjobsApi.create(serverId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "cron", serverId] }),
  });
};

export const useUpdateCronJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CronjobDTO> }) =>
      cronjobsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers"] }),
  });
};

export const useDeleteCronJob = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cronId: string) => cronjobsApi.delete(cronId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "cron", serverId] }),
  });
};

export const useExecuteCronJob = () =>
  useMutation({
    mutationFn: (cronId: string) => cronjobsApi.execute(cronId),
  });

export const useCronHistory = (cronId: string) =>
  useQuery({
    queryKey: ["cronjobs", "history", cronId],
    queryFn: () => cronjobsApi.history(cronId),
    enabled: !!cronId,
  });

// ─────────────────────────────────────────────────────────────────────────────
// BACKUPS
// POST /api/v1/servers/:id/backups
// GET  /api/v1/servers/:id/backups
// POST/DELETE /api/v1/backups/:id
// ─────────────────────────────────────────────────────────────────────────────

export const useServerBackups = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "backup", serverId],
    queryFn: () => backupsApi.list(serverId),
    enabled: !!serverId,
    staleTime: 60_000,
  });

export const useCreateBackup = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { label?: string; path?: string }) => backupsApi.create(serverId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "backup", serverId] }),
  });
};

export const useRestoreBackup = () =>
  useMutation({ mutationFn: (backupId: string) => backupsApi.restore(backupId) });

export const useDeleteBackup = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backupId: string) => backupsApi.delete(backupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "backup", serverId] }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// NETWORK
// GET /api/v1/servers/:id/network/interfaces
// POST /api/v1/servers/:id/network/check
// POST /api/v1/servers/:id/network/test-port
// ─────────────────────────────────────────────────────────────────────────────

export const useServerNetworkInterfaces = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "network", "interfaces", serverId],
    queryFn: () => networkApi.interfaces(serverId),
    enabled: !!serverId,
    staleTime: 30_000,
  });

export const useCheckConnectivity = (serverId: string) =>
  useMutation({
    mutationFn: (target: string) => networkApi.check(serverId, target),
  });

export const useTestPort = (serverId: string) =>
  useMutation({
    mutationFn: ({ host, port }: { host: string; port: number }) =>
      networkApi.testPort(serverId, host, port),
  });

export const useConnectivityHistory = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "network", "history", serverId],
    queryFn: () => networkApi.history(serverId),
    enabled: !!serverId,
    staleTime: 30_000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// IPTABLES (Firewall)
// GET /api/v1/servers/:id/iptables
// POST /api/v1/servers/:id/iptables
// POST /api/v1/servers/:id/iptables/apply
// PUT/DELETE /api/v1/iptables/:ruleId
// ─────────────────────────────────────────────────────────────────────────────

export const useFirewallRules = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "firewall", serverId],
    queryFn: async (): Promise<FirewallRule[]> => {
      const rules = await iptablesApi.list(serverId);
      return rules.map((rule, idx) => ({
        id: rule.id,
        priority: rule.position ?? idx + 1,
        direction: (rule.chain === "OUTPUT" ? "OUTBOUND" : "INBOUND") as FirewallRule["direction"],
        protocol: ((rule.protocol || "ANY").toUpperCase() as FirewallRule["protocol"]),
        port: rule.dest_port || rule.source_port || "*",
        source: rule.source_ip || rule.dest_ip || "Any",
        action: (rule.action || "ALLOW") as FirewallRule["action"],
        enabled: rule.enabled ?? true,
        note: rule.comment || rule.description,
      }));
    },
    enabled: !!serverId,
    staleTime: 20_000,
  });

export const useAddFirewallRule = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<IPTableRuleDTO, "id" | "server_id">) =>
      iptablesApi.add(serverId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "firewall", serverId] }),
  });
};

export const useUpdateFirewallRule = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: Partial<IPTableRuleDTO> }) =>
      iptablesApi.update(serverId, ruleId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "firewall", serverId] }),
  });
};

export const useDeleteFirewallRule = (serverId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => iptablesApi.delete(serverId, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["servers", "firewall", serverId] }),
  });
};

export const useApplyFirewall = (serverId: string) =>
  useMutation({
    mutationFn: () => iptablesApi.apply(serverId),
    onSuccess: () => {
      // caller may still refetch explicitly, but keep firewall views fresh by default
    },
  });

export const useBackupFirewall = (serverId: string) =>
  useMutation({ mutationFn: () => iptablesApi.backup(serverId) });

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring Alerts (shim — returns empty until dedicated endpoint added)
// ─────────────────────────────────────────────────────────────────────────────

export const useAlerts = (serverId: string) =>
  useQuery({
    queryKey: ["servers", "alerts", serverId],
    queryFn: () => monitoringApi.listAlerts(serverId),
    enabled: !!serverId,
    refetchInterval: 30_000,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Add Server (POST /api/v1/servers)
// ─────────────────────────────────────────────────────────────────────────────

export const useServerHealthCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serverId: string) => serversApi.healthCheck(serverId),
    onSuccess: (_, serverId) => {
      qc.invalidateQueries({ queryKey: serverKeys.detail(serverId) });
      qc.invalidateQueries({ queryKey: ["servers", "status"] });
      qc.invalidateQueries({ queryKey: ["servers", "list"] });
    },
  });
};

export const useAddServer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newServer: Partial<Server>): Promise<Server> => {
      const dto = await serversApi.create({
        name: newServer.name ?? "new-server",
        hostname: newServer.hostname ?? newServer.name ?? "new-server",
        ip_address: newServer.ip_address ?? "",
        os: newServer.os ?? "linux",
        os_version: newServer.os_version,
        description: newServer.description,
        environment: newServer.environment,
        connection_mode:
          newServer.connection_mode === "ssh"
            ? "direct"
            : newServer.connection_mode ?? "agent",
        cpu_cores: newServer.cpu_cores,
        memory_gb: newServer.memory_gb,
        disk_gb: newServer.disk_gb,
        location: newServer.location,
        provider: newServer.provider,
        ssh_port: newServer.ssh_port,
        ssh_user: newServer.ssh_user,
        ssh_password: newServer.ssh_password,
        ssh_key_path: newServer.ssh_key_path,
        tags: newServer.tags,
      });
      return {
        id: dto.id,
        name: dto.name,
        description: dto.description ?? "",
        hostname: dto.hostname ?? dto.name,
        status: dto.status ?? "offline",
        ip_address: dto.ip_address,
        os: dto.os as Server["os"],
        os_version: dto.os_version ?? "",
        environment: dto.environment,
        connection_mode:
          dto.connection_mode === "direct"
            ? "ssh"
            : (dto.connection_mode as Server["connection_mode"]) ?? "agent",
        onboarding_status: dto.onboarding_status,
        cpu_cores: dto.cpu_cores ?? 0,
        memory_gb: dto.memory_gb ?? 0,
        disk_gb: dto.disk_gb ?? 0,
        location: dto.location,
        provider: dto.provider,
        ssh_port: dto.ssh_port ?? 22,
        ssh_user: dto.ssh_user ?? "root",
        ssh_password: newServer.ssh_password,
        ssh_key_path: dto.ssh_key_path,
        tunnel_enabled: false,
        tags: dto.tags ?? [],
        agent_version: dto.agent_version,
        created_at: dto.created_at,
        updated_at: dto.updated_at,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
  });
};

export const useAgentToken = () => {
  return useMutation({
    mutationFn: async (serverId: string): Promise<{ token: string }> => {
      return serversApi.agentToken(serverId).then((data) => ({ token: data.token }));
    },
  });
};
