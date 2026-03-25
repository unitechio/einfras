import { useQuery } from "@tanstack/react-query";

import type { Environment } from "@/core/EnvironmentContext";
import { environmentsApi, type EnvironmentInventoryDTO } from "@/shared/api/client";

const inventoryKeys = {
  all: ["environment-inventory"] as const,
};

function mapInventory(dto: EnvironmentInventoryDTO): Environment {
  return {
    id: dto.id,
    serverId: dto.server_id,
    name: dto.server_name,
    type: dto.platform,
    status: dto.status === "up" ? "up" : "down",
    url: dto.endpoint ?? dto.server_ip,
    selfHost: dto.self_host,
    os: dto.os,
    arch: dto.arch,
    lastSeen: dto.last_seen,
    cpuCores: dto.cpu_cores,
    memoryGB: dto.memory_gb,
    diskGB: dto.disk_gb,
    cpuPercent: dto.cpu_percent,
    memPercent: dto.mem_percent,
    diskPercent: dto.disk_percent,
    stats:
      dto.platform === "docker"
        ? {
            stacks: dto.docker?.stacks ?? 0,
            containers: dto.docker?.total ?? 0,
            images: dto.docker?.images ?? 0,
            volumes: dto.docker?.volumes ?? 0,
            serverVersion: dto.docker?.server_version,
            storageDriver: dto.docker?.storage_driver,
            kernelVersion: dto.docker?.kernel_version,
            dockerRootDir: dto.docker?.docker_root_dir,
            memTotal: dto.docker?.mem_total,
            currentContext: dto.docker?.current_context,
            operatingSystem: dto.docker?.operating_system,
          }
        : {
            nodes: dto.kubernetes?.nodes ?? 0,
            readyNodes: dto.kubernetes?.ready_nodes ?? 0,
            namespaces: dto.kubernetes?.namespaces ?? 0,
            pods: dto.kubernetes?.pods ?? 0,
          },
  };
}

export function useEnvironmentInventory() {
  return useQuery({
    queryKey: inventoryKeys.all,
    queryFn: async (): Promise<Environment[]> => {
      const items = await environmentsApi.discovered();
      return items.map(mapInventory);
    },
    refetchInterval: 15000,
  });
}
