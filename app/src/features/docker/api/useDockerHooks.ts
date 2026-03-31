import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildApiWebSocketUrl } from '@/core/api-client';
import type { DockerContainer, DockerImage, DockerNetwork, DockerVolume, DockerStack, DockerTopology, RuntimeAuditRecord, DockerAutoHealPolicy, DockerContainerCreateRequest, DockerContainerConfig, DockerSecretAsset, DockerStackService, DockerContainerStats, DockerFileEntry, DockerServiceDetail, DockerRegistryCatalog, DockerImageExportResult, DockerImageImportResult, DockerBuildHistoryRecord, RuntimeAuditFilters, DockerSwarmStatus, DockerDiskUsage } from '../types';

export const dockerKeys = {
  all: ['docker'] as const,
  containers: (environmentId: string) => [...dockerKeys.all, 'containers', environmentId] as const,
  images: (environmentId: string) => [...dockerKeys.all, 'images', environmentId] as const,
  containerLogs: (environmentId: string, containerId: string) => [...dockerKeys.containers(environmentId), containerId, 'logs'] as const,
  containerConfig: (environmentId: string, containerId: string) => [...dockerKeys.containers(environmentId), containerId, 'config'] as const,
  containerStats: (environmentId: string, containerId: string) => [...dockerKeys.containers(environmentId), containerId, 'stats'] as const,
  containerFiles: (environmentId: string, containerId: string, path: string) => [...dockerKeys.containers(environmentId), containerId, 'files', path] as const,
  stackDetail: (environmentId: string, stackName: string) => [...dockerKeys.all, 'stack', environmentId, stackName] as const,
  stackServiceDetail: (environmentId: string, stackName: string, serviceName: string) => [...dockerKeys.all, 'stack-service', environmentId, stackName, serviceName] as const,
  secrets: (environmentId: string) => [...dockerKeys.all, 'secrets', environmentId] as const,
  topology: (environmentId: string) => [...dockerKeys.all, 'topology', environmentId] as const,
  audit: (environmentId: string) => [...dockerKeys.all, 'audit', environmentId] as const,
  buildHistory: (environmentId: string) => [...dockerKeys.all, 'build-history', environmentId] as const,
  autoheal: (environmentId: string) => [...dockerKeys.all, 'autoheal', environmentId] as const,
  networks: (environmentId: string) => [...dockerKeys.all, 'networks', environmentId] as const,
  volumes: (environmentId: string) => [...dockerKeys.all, 'volumes', environmentId] as const,
  stacks: (environmentId: string) => [...dockerKeys.all, 'stacks', environmentId] as const,
  volumeFiles: (environmentId: string, volumeName: string, path: string) => [...dockerKeys.volumes(environmentId), volumeName, 'files', path] as const,
  diskUsage: (environmentId: string) => [...dockerKeys.all, 'disk-usage', environmentId] as const,
};

// Containers

export const useContainers = (environmentId: string, all: boolean = true) => {
  return useQuery({
    queryKey: [...dockerKeys.containers(environmentId), { all }],
    queryFn: async (): Promise<DockerContainer[]> => {
      return apiFetch<DockerContainer[]>(`/v1/environments/${environmentId}/docker/containers?all=${all}`).catch(() => []);
    },
    enabled: !!environmentId,
  });
};

export const useContainerAction = (environmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ containerId, action, payload }: { containerId: string; action: 'start' | 'stop' | 'restart' | 'kill' | 'pause' | 'unpause' | 'rename' | 'commit'; payload?: Record<string, unknown> }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}/${action}`, {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

export const useContainerLogs = (environmentId: string, containerId: string, tail: number = 100) => {
  return useQuery({
    queryKey: dockerKeys.containerLogs(environmentId, containerId),
    queryFn: async (): Promise<{ logs: string }> => {
      return apiFetch<{ logs: string }>(`/v1/environments/${environmentId}/docker/containers/${containerId}/logs?tail=${tail}`).catch((): { logs: string } => ({ logs: "" }));
    },
    enabled: !!environmentId && !!containerId,
    refetchInterval: 5000,
  });
};

export const useContainerExec = (environmentId: string) => {
  return useMutation({
    mutationFn: async ({ containerId, command }: { containerId: string; command: string[] }) => {
      return apiFetch<{ output: string }>(`/v1/environments/${environmentId}/docker/containers/${containerId}/exec`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    },
  });
};

export const useContainerConfig = (environmentId: string, containerId: string) => {
  return useQuery({
    queryKey: dockerKeys.containerConfig(environmentId, containerId),
    queryFn: async (): Promise<DockerContainerConfig> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}`);
    },
    enabled: !!environmentId && !!containerId,
  });
};

export const useContainerStats = (environmentId: string, containerId: string) => {
  return useQuery({
    queryKey: dockerKeys.containerStats(environmentId, containerId),
    queryFn: async (): Promise<DockerContainerStats> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}/stats`);
    },
    enabled: !!environmentId && !!containerId,
    refetchInterval: 5000,
  });
};

export const useLiveContainerLogs = (environmentId: string, containerId: string, tail: number = 200, enabled: boolean = true) => {
  const [logs, setLogs] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "closed" | "error">("idle");

  useEffect(() => {
    if (!environmentId || !containerId || !enabled) {
      setStatus("idle");
      return;
    }
    setLogs("");
    setStatus("connecting");
    const socket = new WebSocket(buildApiWebSocketUrl(`/v1/environments/${environmentId}/docker/containers/${containerId}/logs/ws?tail=${tail}`));
    socket.onopen = () => setStatus("connected");
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { type?: string; logs?: string; message?: string };
        if (payload.type === "snapshot") {
          setLogs(payload.logs ?? "");
          setStatus("connected");
          return;
        }
        if (payload.type === "error") {
          setStatus("error");
        }
      } catch {
        setLogs(event.data);
      }
    };
    socket.onerror = () => setStatus("error");
    socket.onclose = () => {
      setStatus((current) => current === "error" ? "error" : "closed");
    };
    return () => {
      socket.close();
    };
  }, [containerId, enabled, environmentId, tail]);

  return { logs, status };
};

export const useLiveContainerStats = (environmentId: string, containerId: string, enabled: boolean = true) => {
  const [stats, setStats] = useState<DockerContainerStats | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "closed" | "error">("idle");

  useEffect(() => {
    if (!environmentId || !containerId || !enabled) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    const socket = new WebSocket(buildApiWebSocketUrl(`/v1/environments/${environmentId}/docker/containers/${containerId}/stats/ws`));
    socket.onopen = () => setStatus("connected");
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { type?: string; data?: DockerContainerStats };
        if (payload.type === "snapshot" && payload.data) {
          setStats(payload.data);
          setStatus("connected");
          return;
        }
        if (payload.type === "error") {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    socket.onerror = () => setStatus("error");
    socket.onclose = () => {
      setStatus((current) => current === "error" ? "error" : "closed");
    };
    return () => {
      socket.close();
    };
  }, [containerId, enabled, environmentId]);

  return { stats, status };
};

export const useDockerSystemLogs = (environmentId: string, lines: number = 200) => {
  return useQuery({
    queryKey: [...dockerKeys.all, "system-logs", environmentId, lines],
    queryFn: async (): Promise<{ raw_output: string }> => {
      return apiFetch<{ raw_output: string }>(`/v1/environments/${environmentId}/docker/system-logs?lines=${lines}`).catch((): { raw_output: string } => ({ raw_output: "" }));
    },
    enabled: !!environmentId,
    refetchInterval: 15000,
  });
};

export const useDockerDiskUsage = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.diskUsage(environmentId),
    queryFn: async (): Promise<DockerDiskUsage> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/disk-usage`);
    },
    enabled: !!environmentId,
  });
};

export const useReclaimDiskSpace = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiFetch<{ message: string }>(`/v1/environments/${environmentId}/docker/system/prune`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.diskUsage(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.networks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumes(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDockerSwarmStatus = (environmentId: string) => {
  return useQuery({
    queryKey: [...dockerKeys.all, "swarm-status", environmentId],
    queryFn: async (): Promise<DockerSwarmStatus> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/swarm/status`);
    },
    enabled: !!environmentId,
    refetchInterval: 30000,
  });
};

export const useContainerFiles = (environmentId: string, containerId: string, path: string) => {
  return useQuery({
    queryKey: dockerKeys.containerFiles(environmentId, containerId, path),
    queryFn: async (): Promise<{ path: string; items: DockerFileEntry[] }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}/files?path=${encodeURIComponent(path)}`);
    },
    enabled: !!environmentId && !!containerId,
  });
};

export const useReadContainerFile = (environmentId: string, containerId: string, path: string) => {
  return useQuery({
    queryKey: [...dockerKeys.containerFiles(environmentId, containerId, path), 'content'],
    queryFn: async (): Promise<{ path: string; content: string }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}/files/read?path=${encodeURIComponent(path)}`);
    },
    enabled: !!environmentId && !!containerId && !!path,
  });
};

export const useSaveContainerFile = (environmentId: string, containerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/containers/${containerId}/files/save`, {
        method: 'POST',
        body: JSON.stringify({ path, content }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containerFiles(environmentId, containerId, variables.path) });
    },
  });
};

export const useCreateContainer = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DockerContainerCreateRequest) => {
      return apiFetch<{ message: string; container_id: string }>(`/v1/environments/${environmentId}/docker/containers/create`, {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          image: payload.image,
          command: payload.command ?? [],
          environment: payload.environment ?? {},
          ports: payload.ports ?? [],
          volumes: payload.volumes ?? [],
          labels: payload.labels ?? {},
          restart_policy: payload.restart_policy ?? 'unless-stopped',
          registry_id: payload.registry_id,
          auto_start: payload.auto_start ?? true,
          healthcheck_command: payload.healthcheck_command,
          healthcheck_interval: payload.healthcheck_interval,
          healthcheck_timeout: payload.healthcheck_timeout,
          healthcheck_start_period: payload.healthcheck_start_period,
          healthcheck_retries: payload.healthcheck_retries,
          healthcheck_disabled: payload.healthcheck_disabled,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

export const useUpdateContainer = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ containerId, recreate, ...payload }: DockerContainerCreateRequest & { containerId: string; recreate?: boolean }) => {
      return apiFetch<{ message: string; container_id: string }>(`/v1/environments/${environmentId}/docker/containers/${containerId}/update`, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          labels: payload.labels ?? {},
          recreate: !!recreate,
          healthcheck_command: payload.healthcheck_command,
          healthcheck_interval: payload.healthcheck_interval,
          healthcheck_timeout: payload.healthcheck_timeout,
          healthcheck_start_period: payload.healthcheck_start_period,
          healthcheck_retries: payload.healthcheck_retries,
          healthcheck_disabled: payload.healthcheck_disabled,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

// Images

export const useImages = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.images(environmentId),
    queryFn: async (): Promise<DockerImage[]> => {
      return apiFetch<DockerImage[]>(`/v1/environments/${environmentId}/docker/images`);
    },
    enabled: !!environmentId,
  });
};

export const usePullImage = (environmentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageName, registryId }: { imageName: string; registryId?: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/images/pull`, {
        method: 'POST',
        body: JSON.stringify({ image_name: imageName, registry_id: registryId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const usePushImage = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageRef, registryId }: { imageRef: string; registryId?: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/images/push`, {
        method: 'POST',
        body: JSON.stringify({ image_ref: imageRef, registry_id: registryId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useExportImage = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageRef }: { imageRef: string }) => {
      return apiFetch<DockerImageExportResult>(`/v1/environments/${environmentId}/docker/images/export`, {
        method: 'POST',
        body: JSON.stringify({ image_ref: imageRef }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useBuildImage = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, dockerfile, tags }: { file: File; dockerfile?: string; tags: string[] }) => {
      const body = new FormData();
      body.append('file', file);
      body.append('dockerfile', dockerfile?.trim() || 'Dockerfile');
      tags.forEach((tag) => {
        if (tag.trim()) {
          body.append('tags', tag.trim());
        }
      });
      return apiFetch<DockerBuildHistoryRecord>(`/v1/environments/${environmentId}/docker/images/build`, {
        method: 'POST',
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.buildHistory(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useImportImageArchive = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ archive }: { archive: File }) => {
      const body = new FormData();
      body.append('archive', archive);
      return apiFetch<DockerImageImportResult>(`/v1/environments/${environmentId}/docker/images/import`, {
        method: 'POST',
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useRetagImage = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceRef, targetRef }: { sourceRef: string; targetRef: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/images/retag`, {
        method: 'POST',
        body: JSON.stringify({ source_ref: sourceRef, target_ref: targetRef }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
    },
  });
};

export const useRemoveImage = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imageRef, force }: { imageRef: string; force?: boolean }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/images/${encodeURIComponent(imageRef)}?force=${force ? 'true' : 'false'}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

// Networks
export const useNetworks = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.networks(environmentId),
    queryFn: async (): Promise<DockerNetwork[]> => {
      return apiFetch<DockerNetwork[]>(`/v1/environments/${environmentId}/docker/networks`).catch(() => []);
    },
    enabled: !!environmentId,
  });
};

export const useSaveNetwork = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ originalId, name, driver, internal, labels }: { originalId?: string; name: string; driver: string; internal: boolean; labels?: Record<string, string> }) => {
      const endpoint = originalId ? `/v1/environments/${environmentId}/docker/networks/${encodeURIComponent(originalId)}` : `/v1/environments/${environmentId}/docker/networks`;
      return apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ name, driver, internal, labels: labels ?? {} }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.networks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDeleteNetwork = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (networkId: string) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/networks/${encodeURIComponent(networkId)}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.networks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

export const useNetworkAttachment = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ networkId, action, containerId, force }: { networkId: string; action: 'attach' | 'detach'; containerId: string; force?: boolean }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/networks/${encodeURIComponent(networkId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ container_id: containerId, force }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.networks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
    },
  });
};

// Volumes
export const useVolumes = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.volumes(environmentId),
    queryFn: async (): Promise<DockerVolume[]> => {
      return apiFetch<any>(`/v1/environments/${environmentId}/docker/volumes`)
        .then(res => res.Volumes || [])
        .catch(() => []);
    },
    enabled: !!environmentId,
  });
};

export const useSaveVolume = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ originalName, name, driver, labels, options }: { originalName?: string; name: string; driver: string; labels?: Record<string, string>; options?: Record<string, string> }) => {
      const endpoint = originalName ? `/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(originalName)}` : `/v1/environments/${environmentId}/docker/volumes`;
      return apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ name, driver, labels: labels ?? {}, options: options ?? {} }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumes(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDeleteVolume = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ volumeName, force }: { volumeName: string; force?: boolean }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}?force=${force ? 'true' : 'false'}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumes(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

export const useVolumeFiles = (environmentId: string, volumeName: string, path: string) => {
  return useQuery({
    queryKey: dockerKeys.volumeFiles(environmentId, volumeName, path),
    queryFn: async (): Promise<{ path: string; items: DockerFileEntry[] }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files?path=${encodeURIComponent(path)}`);
    },
    enabled: !!environmentId && !!volumeName,
  });
};

export const useReadVolumeFile = (environmentId: string, volumeName: string, path: string) => {
  return useQuery({
    queryKey: [...dockerKeys.volumeFiles(environmentId, volumeName, path), 'content'],
    queryFn: async (): Promise<{ path: string; content: string }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files/read?path=${encodeURIComponent(path)}`);
    },
    enabled: !!environmentId && !!volumeName && !!path,
  });
};

export const useSaveVolumeFile = (environmentId: string, volumeName: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files/save`, {
        method: 'POST',
        body: JSON.stringify({ path, content }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumeFiles(environmentId, volumeName, variables.path) });
    },
  });
};

export const useDeleteVolumeFile = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ volumeName, path }: { volumeName: string; path: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumeFiles(environmentId, variables.volumeName, '/') });
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumes(environmentId) });
    },
  });
};

export const useBackupVolume = (environmentId: string) => {
  return useMutation({
    mutationFn: async (volumeName: string) => {
      return apiFetch<{ message: string; path: string }>(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/backup`, {
        method: 'POST',
      });
    },
  });
};

export const useCloneVolume = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ volumeName, targetName }: { volumeName: string; targetName: string }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/clone`, {
        method: 'POST',
        body: JSON.stringify({ target_name: targetName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.volumes(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.topology(environmentId) });
    },
  });
};

// Stacks
export const useStacks = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.stacks(environmentId),
    queryFn: async (): Promise<DockerStack[]> => {
      return apiFetch<DockerStack[]>(`/v1/environments/${environmentId}/docker/stacks`).catch(() => []);
    },
    enabled: !!environmentId,
  });
};

export const useStackDetail = (environmentId: string, stackName: string) => {
  return useQuery({
    queryKey: dockerKeys.stackDetail(environmentId, stackName),
    queryFn: async (): Promise<{ name: string; compose: string; environment: Record<string, string>; secrets: Record<string, string>; configs: Record<string, string>; revisions: Array<{ id: string; created_at: string; path: string }> }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}`);
    },
    enabled: !!environmentId && !!stackName,
  });
};

export const useStackServices = (environmentId: string, stackName: string) => {
  return useQuery({
    queryKey: [...dockerKeys.stackDetail(environmentId, stackName), 'services'],
    queryFn: async (): Promise<DockerStackService[]> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/services`);
    },
    enabled: !!environmentId && !!stackName,
  });
};

export const useStackServiceDetail = (environmentId: string, stackName: string, serviceName: string) => {
  return useQuery({
    queryKey: dockerKeys.stackServiceDetail(environmentId, stackName, serviceName),
    queryFn: async (): Promise<DockerServiceDetail> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/services/${encodeURIComponent(serviceName)}`);
    },
    enabled: !!environmentId && !!stackName && !!serviceName,
  });
};

export const useStackServiceLogs = (environmentId: string, stackName: string, serviceName: string, tail = 200) => {
  return useQuery({
    queryKey: [...dockerKeys.stackServiceDetail(environmentId, stackName, serviceName), 'logs', tail],
    queryFn: async (): Promise<{ logs: string }> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/services/${encodeURIComponent(serviceName)}/logs?tail=${tail}`);
    },
    enabled: !!environmentId && !!stackName && !!serviceName,
    refetchInterval: 5000,
  });
};

export const useDeployStack = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, compose, environment, secrets, configs, tags }: { name: string; compose: string; environment: Record<string, string>; secrets?: Record<string, string>; configs?: Record<string, string>; tags?: string[] }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/deploy`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          compose,
          environment,
          secrets: secrets ?? {},
          configs: configs ?? {},
          tags: tags ?? [],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.stacks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDockerSecrets = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.secrets(environmentId),
    queryFn: async (): Promise<DockerSecretAsset[]> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/secrets`);
    },
    enabled: !!environmentId,
  });
};

export const useSaveDockerSecret = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: DockerSecretAsset) => {
      return apiFetch<DockerSecretAsset>(`/v1/environments/${environmentId}/docker/secrets`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.secrets(environmentId) });
    },
  });
};

export const useDeleteDockerSecret = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/secrets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.secrets(environmentId) });
    },
  });
};

export const useRollbackStack = (environmentId: string, stackName: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (revision: string) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ revision }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.stacks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.stackDetail(environmentId, stackName) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useStackAction = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stackName, action, purge }: { stackName: string; action: 'start' | 'stop' | 'delete'; purge?: boolean }) => {
      const endpoint = action === 'delete'
        ? `/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}?purge=${purge ? 'true' : 'false'}`
        : `/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/${action}`;
      return apiFetch(endpoint, { method: action === 'delete' ? 'DELETE' : 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.stacks(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useScaleStackService = (environmentId: string, stackName: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceName, replicas }: { serviceName: string; replicas: number }) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/services/${encodeURIComponent(serviceName)}/scale`, {
        method: 'POST',
        body: JSON.stringify({ replicas }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.stacks(environmentId) });
      queryClient.invalidateQueries({ queryKey: [...dockerKeys.stackDetail(environmentId, stackName), 'services'] });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useRestartStackService = (environmentId: string, stackName: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serviceName: string) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/stacks/${encodeURIComponent(stackName)}/services/${encodeURIComponent(serviceName)}/restart`, {
        method: 'POST',
      });
    },
    onSuccess: (_, serviceName) => {
      queryClient.invalidateQueries({ queryKey: [...dockerKeys.stackDetail(environmentId, stackName), 'services'] });
      queryClient.invalidateQueries({ queryKey: dockerKeys.stackServiceDetail(environmentId, stackName, serviceName) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDockerTopology = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.topology(environmentId),
    queryFn: async (): Promise<DockerTopology> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/topology`);
    },
    enabled: !!environmentId,
    refetchInterval: 15000,
  });
};

export const useBuildHistory = (environmentId: string, limit: number = 50) => {
  return useQuery({
    queryKey: [...dockerKeys.buildHistory(environmentId), limit],
    queryFn: async (): Promise<DockerBuildHistoryRecord[]> => {
      return apiFetch<DockerBuildHistoryRecord[]>(`/v1/environments/${environmentId}/docker/build-history?limit=${limit}`).catch((): DockerBuildHistoryRecord[] => []);
    },
    enabled: !!environmentId,
    refetchInterval: 15000,
  });
};

export const useRuntimeAudit = (environmentId: string, limit: number = 100, filters?: RuntimeAuditFilters) => {
  return useQuery({
    queryKey: [...dockerKeys.audit(environmentId), limit, filters ?? {}],
    queryFn: async (): Promise<RuntimeAuditRecord[]> => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          params.set(key, value.trim());
        }
      });
      return apiFetch<RuntimeAuditRecord[]>(`/v1/environments/${environmentId}/audit?${params.toString()}`).catch((): RuntimeAuditRecord[] => []);
    },
    enabled: !!environmentId,
    refetchInterval: 10000,
  });
};

export const useDockerAutoHealPolicies = (environmentId: string) => {
  return useQuery({
    queryKey: dockerKeys.autoheal(environmentId),
    queryFn: async (): Promise<DockerAutoHealPolicy[]> => {
      return apiFetch(`/v1/environments/${environmentId}/docker/autoheal/policies`);
    },
    enabled: !!environmentId,
    refetchInterval: 15000,
  });
};

export const useSaveDockerAutoHealPolicy = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<DockerAutoHealPolicy>) => {
      return apiFetch<DockerAutoHealPolicy>(`/v1/environments/${environmentId}/docker/autoheal/policies`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.autoheal(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useDeleteDockerAutoHealPolicy = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policyId: string) => {
      return apiFetch(`/v1/environments/${environmentId}/docker/autoheal/policies/${policyId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.autoheal(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
    },
  });
};

export const useRunDockerAutoHeal = (environmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policyId?: string) => {
      const suffix = policyId ? `?policy_id=${encodeURIComponent(policyId)}` : '';
      return apiFetch<DockerAutoHealPolicy[]>(`/v1/environments/${environmentId}/docker/autoheal/run${suffix}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.autoheal(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.audit(environmentId) });
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(environmentId) });
    },
  });
};

export const useRegistryCatalog = (registryId: string, repository?: string) => {
  return useQuery({
    queryKey: ['registry-catalog', registryId, repository ?? ''],
    queryFn: async (): Promise<DockerRegistryCatalog> => {
      const suffix = repository ? `?repository=${encodeURIComponent(repository)}` : '';
      return apiFetch(`/v1/registries/${encodeURIComponent(registryId)}/catalog${suffix}`);
    },
    enabled: !!registryId,
  });
};
