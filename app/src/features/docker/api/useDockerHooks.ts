import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api-client';
import type { DockerContainer, DockerImage, DockerNetwork, DockerVolume, DockerStack } from '../types';

export const dockerKeys = {
  all: ['docker'] as const,
  containers: (hostId: string) => [...dockerKeys.all, 'containers', hostId] as const,
  images: (hostId: string) => [...dockerKeys.all, 'images', hostId] as const,
  containerLogs: (hostId: string, containerId: string) => [...dockerKeys.containers(hostId), containerId, 'logs'] as const,
  networks: (hostId: string) => [...dockerKeys.all, 'networks', hostId] as const,
  volumes: (hostId: string) => [...dockerKeys.all, 'volumes', hostId] as const,
  stacks: (hostId: string) => [...dockerKeys.all, 'stacks', hostId] as const,
};

// Containers

export const useContainers = (hostId: string, all: boolean = true) => {
  return useQuery({
    queryKey: [...dockerKeys.containers(hostId), { all }],
    queryFn: async (): Promise<DockerContainer[]> => {
      return apiFetch<DockerContainer[]>(`/v1/docker/hosts/${hostId}/containers?all=${all}`);
    },
    enabled: !!hostId,
  });
};

export const useContainerAction = (hostId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ containerId, action }: { containerId: string; action: 'start' | 'stop' }) => {
      return apiFetch(`/v1/docker/hosts/${hostId}/containers/${containerId}/${action}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers(hostId) });
    },
  });
};

export const useContainerLogs = (hostId: string, containerId: string, tail: number = 100) => {
  return useQuery({
    queryKey: dockerKeys.containerLogs(hostId, containerId),
    queryFn: async (): Promise<{ logs: string }> => {
      return apiFetch(`/v1/docker/hosts/${hostId}/containers/${containerId}/logs?tail=${tail}`);
    },
    enabled: !!hostId && !!containerId,
    refetchInterval: 5000,
  });
};

// Images

export const useImages = (hostId: string) => {
  return useQuery({
    queryKey: dockerKeys.images(hostId),
    queryFn: async (): Promise<DockerImage[]> => {
      return apiFetch<DockerImage[]>(`/v1/docker/hosts/${hostId}/images`);
    },
    enabled: !!hostId,
  });
};

export const usePullImage = (hostId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageName: string) => {
      return apiFetch(`/v1/docker/hosts/${hostId}/images/pull`, {
        method: 'POST',
        body: JSON.stringify({ image_name: imageName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dockerKeys.images(hostId) });
    },
  });
};

// Networks
export const useNetworks = (hostId: string) => {
  return useQuery({
    queryKey: dockerKeys.networks(hostId),
    queryFn: async (): Promise<DockerNetwork[]> => {
      // Return empty array on mock error
      return apiFetch<DockerNetwork[]>(`/v1/docker/hosts/${hostId}/networks`).catch(() => []);
    },
    enabled: !!hostId,
  });
};

// Volumes
export const useVolumes = (hostId: string) => {
  return useQuery({
    queryKey: dockerKeys.volumes(hostId),
    queryFn: async (): Promise<DockerVolume[]> => {
      return apiFetch<any>(`/v1/docker/hosts/${hostId}/volumes`)
        .then(res => res.Volumes || [])
        .catch(() => []);
    },
    enabled: !!hostId,
  });
};

// Stacks
export const useStacks = (hostId: string) => {
  return useQuery({
    queryKey: dockerKeys.stacks(hostId),
    queryFn: async (): Promise<DockerStack[]> => {
      return apiFetch<DockerStack[]>(`/v1/docker/hosts/${hostId}/stacks`).catch(() => []);
    },
    enabled: !!hostId,
  });
};
