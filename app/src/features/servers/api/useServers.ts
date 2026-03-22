import { useQuery } from "@tanstack/react-query";
import type { Server, ServerFilter } from "../types";
import { serversApi, type ServerDTO } from "@/shared/api/client";

export const serverKeys = {
  all: ["servers"] as const,
  list: (filter: ServerFilter) => ["servers", "list", filter] as const,
  detail: (id: string) => ["servers", "detail", id] as const,
};

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

// Map backend DTO → internal Server type
function mapServer(dto: ServerDTO): Server {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    hostname: dto.hostname ?? dto.name,
    status: dto.status,
    ip_address: dto.ip_address,
    os: dto.os as Server["os"],
    os_version: dto.os_version ?? "",
    environment: dto.environment,
    connection_mode: (dto.connection_mode as Server["connection_mode"]) ?? "agent",
    onboarding_status: dto.onboarding_status,
    cpu_cores: dto.cpu_cores ?? 0,
    memory_gb: dto.memory_gb ?? 0,
    disk_gb: dto.disk_gb ?? 0,
    location: dto.location,
    provider: dto.provider,
    ssh_port: dto.ssh_port ?? 22,
    ssh_user: dto.ssh_user ?? "root",
    tunnel_enabled: dto.tunnel_enabled ?? false,
    tags: dto.tags ?? [],
    agent_version: dto.agent_version,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
  };
}

export const useServers = (filter: ServerFilter = { page: 1, page_size: 20 }) => {
  return useQuery({
    queryKey: serverKeys.list(filter),
    queryFn: async (): Promise<PaginatedResponse<Server>> => {
      const res = await serversApi.list({
        page: filter.page,
        page_size: filter.page_size,
        status: filter.status,
        os: filter.os,
        location: filter.location,
        provider: filter.provider,
        search: filter.search,
      });
      const mapped = res.data.map(mapServer);
      const normalizedSearch = filter.search?.trim().toLowerCase();
      const filtered = normalizedSearch
        ? mapped.filter((server) =>
            [
              server.name,
              server.hostname,
              server.ip_address,
              server.description,
              server.location,
              server.provider,
              ...(server.tags ?? []),
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
          )
        : mapped;
      return {
        data: filtered,
        total: normalizedSearch ? filtered.length : res.total,
        page: res.page,
        page_size: res.page_size,
      };
    },
    staleTime: 30_000,
    retry: 2,
  });
};
