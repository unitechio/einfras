import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/core/api-client';
import type { K8sCluster, K8sPod, K8sDeployment, K8sService } from '../types';

export const k8sKeys = {
  all: ['kubernetes'] as const,
  clusters: () => [...k8sKeys.all, 'clusters'] as const,
  pods: (clusterId: string, namespace: string) => [...k8sKeys.all, 'pods', clusterId, namespace] as const,
  deployments: (clusterId: string, namespace: string) => [...k8sKeys.all, 'deployments', clusterId, namespace] as const,
  services: (clusterId: string, namespace: string) => [...k8sKeys.all, 'services', clusterId, namespace] as const,
};

export const useClusters = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: k8sKeys.clusters(),
    queryFn: async (): Promise<{ data: K8sCluster[] }> => {
      // Assuming a paginated response or wrapper object to match typical list endpoints
      try {
           return await apiFetch<{ data: K8sCluster[] }>('/v1/kubernetes/clusters');
      } catch (e) {
          // Fallback structure in case it returns an array directly
         const res = await apiFetch<K8sCluster[]>('/v1/kubernetes/clusters');
         return { data: Array.isArray(res) ? res : [] };
      }
    },
    enabled: options?.enabled !== false,
  });
};

export const usePods = (clusterId: string, namespace: string = 'default') => {
  return useQuery({
    queryKey: k8sKeys.pods(clusterId, namespace),
    queryFn: async (): Promise<K8sPod[]> => {
      return apiFetch<K8sPod[]>(`/v1/kubernetes/clusters/${clusterId}/namespaces/${namespace}/pods`);
    },
    enabled: !!clusterId,
  });
};

export const useDeployments = (clusterId: string, namespace: string = 'default') => {
  return useQuery({
    queryKey: k8sKeys.deployments(clusterId, namespace),
    queryFn: async (): Promise<K8sDeployment[]> => {
      return apiFetch<K8sDeployment[]>(`/v1/kubernetes/clusters/${clusterId}/namespaces/${namespace}/deployments`);
    },
    enabled: !!clusterId,
  });
};

export const useServices = (clusterId: string, namespace: string = 'default') => {
  return useQuery({
    queryKey: k8sKeys.services(clusterId, namespace),
    queryFn: async (): Promise<K8sService[]> => {
      return apiFetch<K8sService[]>(`/v1/kubernetes/clusters/${clusterId}/namespaces/${namespace}/services`);
    },
    enabled: !!clusterId,
  });
};
