import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildApiWebSocketUrl, buildAuthHeaders } from '@/core/api-client';
import type {
  K8sCluster,
  K8sPod,
  K8sDeployment,
  K8sService,
  K8sNode,
  K8sNodeDetail,
  K8sNamespace,
  K8sIngress,
  K8sConfigMap,
  K8sSecret,
  ImportedK8sEnvironment,
  K8sPersistentVolume,
  K8sPersistentVolumeClaim,
  K8sJob,
  K8sCronJob,
  HelmRelease,
  K8sGenericResource,
  K8sTopologyGraph,
  K8sManifestHistoryEntry,
  K8sSearchResult,
} from '../types';
import { useEnvironmentInventory } from './useEnvironmentInventory';

export const k8sKeys = {
  all: ['kubernetes'] as const,
  clusters: () => [...k8sKeys.all, 'clusters'] as const,
  pods: (clusterId: string, namespace: string) => [...k8sKeys.all, 'pods', clusterId, namespace] as const,
  deployments: (clusterId: string, namespace: string) => [...k8sKeys.all, 'deployments', clusterId, namespace] as const,
  services: (clusterId: string, namespace: string) => [...k8sKeys.all, 'services', clusterId, namespace] as const,
  ingresses: (clusterId: string, namespace: string) => [...k8sKeys.all, 'ingresses', clusterId, namespace] as const,
  configMaps: (clusterId: string, namespace: string) => [...k8sKeys.all, 'configmaps', clusterId, namespace] as const,
  secrets: (clusterId: string, namespace: string) => [...k8sKeys.all, 'secrets', clusterId, namespace] as const,
  nodes: (clusterId: string) => [...k8sKeys.all, 'nodes', clusterId] as const,
  nodeDetail: (clusterId: string, nodeName: string) => [...k8sKeys.all, 'nodeDetail', clusterId, nodeName] as const,
  namespaces: (clusterId: string) => [...k8sKeys.all, 'namespaces', clusterId] as const,
  persistentVolumes: (clusterId: string) => [...k8sKeys.all, 'persistentVolumes', clusterId] as const,
  persistentVolumeClaims: (clusterId: string, namespace: string) => [...k8sKeys.all, 'persistentVolumeClaims', clusterId, namespace] as const,
  jobs: (clusterId: string, namespace: string) => [...k8sKeys.all, 'jobs', clusterId, namespace] as const,
  cronJobs: (clusterId: string, namespace: string) => [...k8sKeys.all, 'cronjobs', clusterId, namespace] as const,
  podLogs: (clusterId: string, namespace: string, podName: string, tail: number) => [...k8sKeys.all, 'podLogs', clusterId, namespace, podName, tail] as const,
  helmReleases: (clusterId: string) => [...k8sKeys.all, 'helmReleases', clusterId] as const,
  genericResources: (clusterId: string, kind: string, namespace: string) => [...k8sKeys.all, 'genericResources', clusterId, kind, namespace] as const,
  topology: (clusterId: string) => [...k8sKeys.all, 'topology', clusterId] as const,
  resourceHistory: (clusterId: string, kind: string, namespace: string, name: string) => [...k8sKeys.all, 'resourceHistory', clusterId, kind, namespace, name] as const,
  search: (clusterId: string, namespace: string, query: string) => [...k8sKeys.all, 'search', clusterId, namespace, query] as const,
};

type K8sQueryOptions = {
  watch?: boolean;
  enabled?: boolean;
};

export const useClusters = (options?: { enabled?: boolean }) => {
  const inventory = useEnvironmentInventory();

  return {
    ...inventory,
    data: {
      data: (inventory.data ?? [])
        .filter((env) => env.type === 'kubernetes')
        .map((env): K8sCluster => ({
          id: env.id,
          name: env.name,
          server_id: env.serverId ?? '',
          status: env.status,
          version: 'self-host',
          node_count: env.stats?.nodes ?? 0,
        })),
    },
    isLoading: inventory.isLoading && options?.enabled !== false,
  };
};

export const usePods = (clusterId: string, namespace: string = 'default', options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.pods(clusterId, namespace),
  queryFn: async (): Promise<K8sPod[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/pods?namespace=${encodeURIComponent(namespace)}`),
  enabled: options?.enabled !== false && !!clusterId,
  refetchInterval: options?.watch ? 5000 : false,
});

export const usePodLogs = (clusterId: string, namespace: string, podName: string, tail: number = 200, enabled: boolean = true) => useQuery({
  queryKey: k8sKeys.podLogs(clusterId, namespace, podName, tail),
  queryFn: async (): Promise<{ logs: string }> => apiFetch(`/v1/environments/${clusterId}/kubernetes/pods/${encodeURIComponent(podName)}/logs?namespace=${encodeURIComponent(namespace)}&tail=${tail}`),
  enabled: !!clusterId && !!podName && enabled,
});

export const usePodExec = (clusterId: string) => useMutation({
  mutationFn: async ({ namespace, podName, command }: { namespace: string; podName: string; command: string[] }) => {
    return apiFetch<{ output: string }>(`/v1/environments/${clusterId}/kubernetes/pods/${encodeURIComponent(podName)}/exec`, {
      method: 'POST',
      body: JSON.stringify({ namespace, command }),
    });
  },
});

export const useDeployments = (clusterId: string, namespace: string = 'default', options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.deployments(clusterId, namespace),
  queryFn: async (): Promise<K8sDeployment[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/deployments?namespace=${encodeURIComponent(namespace)}`),
  enabled: options?.enabled !== false && !!clusterId,
  refetchInterval: options?.watch ? 5000 : false,
});

export const useScaleDeployment = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ namespace, deploymentName, replicas }: { namespace: string; deploymentName: string; replicas: number }) => {
      return apiFetch(`/v1/environments/${clusterId}/kubernetes/deployments/${encodeURIComponent(deploymentName)}/scale`, {
        method: 'POST',
        body: JSON.stringify({ namespace, replicas }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.deployments(clusterId, 'default') });
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useRestartDeployment = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ namespace, deploymentName }: { namespace: string; deploymentName: string }) => {
      return apiFetch(`/v1/environments/${clusterId}/kubernetes/deployments/${encodeURIComponent(deploymentName)}/restart`, {
        method: 'POST',
        body: JSON.stringify({ namespace }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.deployments(clusterId, 'default') });
    },
  });
};

export const useServices = (clusterId: string, namespace: string = 'default', options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.services(clusterId, namespace),
  queryFn: async (): Promise<K8sService[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/services?namespace=${encodeURIComponent(namespace)}`),
  enabled: options?.enabled !== false && !!clusterId,
  refetchInterval: options?.watch ? 5000 : false,
});

export const useIngresses = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.ingresses(clusterId, namespace),
  queryFn: async (): Promise<K8sIngress[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/ingresses?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useConfigMaps = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.configMaps(clusterId, namespace),
  queryFn: async (): Promise<K8sConfigMap[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/configmaps?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useSecrets = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.secrets(clusterId, namespace),
  queryFn: async (): Promise<K8sSecret[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/secrets?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useNodes = (clusterId: string, options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.nodes(clusterId),
  queryFn: async (): Promise<K8sNode[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/nodes`),
  enabled: options?.enabled !== false && !!clusterId,
  refetchInterval: options?.watch ? 5000 : false,
});

export const useKubernetesNodeDetail = (clusterId: string, nodeName: string, options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.nodeDetail(clusterId, nodeName),
  queryFn: async (): Promise<K8sNodeDetail> => apiFetch(`/v1/environments/${clusterId}/kubernetes/nodes/${encodeURIComponent(nodeName)}`),
  enabled: options?.enabled !== false && !!clusterId && !!nodeName,
  refetchInterval: options?.watch ? 5000 : false,
});

export const useKubernetesNodeAction = (clusterId: string, action: 'cordon' | 'uncordon' | 'drain') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeName }: { nodeName: string }) => {
      return apiFetch<{ message: string }>(`/v1/environments/${clusterId}/kubernetes/nodes/${encodeURIComponent(nodeName)}/${action}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.nodes(clusterId) });
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useStartKubernetesNodeDebugSession = (clusterId: string) => useMutation({
  mutationFn: async ({ nodeName, namespace, image }: { nodeName: string; namespace?: string; image?: string }) => {
    return apiFetch<{ node_name: string; namespace: string; pod_name: string; image: string; output?: string }>(
      `/v1/environments/${clusterId}/kubernetes/nodes/${encodeURIComponent(nodeName)}/debug`,
      {
        method: 'POST',
        body: JSON.stringify({ namespace, image }),
      },
    );
  },
});

export const useNamespaces = (clusterId: string, options?: K8sQueryOptions) => useQuery({
  queryKey: k8sKeys.namespaces(clusterId),
  queryFn: async (): Promise<K8sNamespace[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/namespaces`),
  enabled: options?.enabled !== false && !!clusterId,
  refetchInterval: options?.watch ? 7000 : false,
});

export const usePersistentVolumes = (clusterId: string) => useQuery({
  queryKey: k8sKeys.persistentVolumes(clusterId),
  queryFn: async (): Promise<K8sPersistentVolume[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/persistentvolumes`),
  enabled: !!clusterId,
});

export const usePersistentVolumeClaims = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.persistentVolumeClaims(clusterId, namespace),
  queryFn: async (): Promise<K8sPersistentVolumeClaim[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/persistentvolumeclaims?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useJobs = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.jobs(clusterId, namespace),
  queryFn: async (): Promise<K8sJob[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/jobs?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useCronJobs = (clusterId: string, namespace: string = 'default') => useQuery({
  queryKey: k8sKeys.cronJobs(clusterId, namespace),
  queryFn: async (): Promise<K8sCronJob[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/cronjobs?namespace=${encodeURIComponent(namespace)}`),
  enabled: !!clusterId,
});

export const useApplyManifest = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ namespace, manifest }: { namespace?: string; manifest: string }) => {
      return apiFetch<{ message: string; output: string }>(`/v1/environments/${clusterId}/kubernetes/apply`, {
        method: 'POST',
        body: JSON.stringify({ namespace, manifest }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useHelmReleases = (clusterId: string) => useQuery({
  queryKey: k8sKeys.helmReleases(clusterId),
  queryFn: async (): Promise<HelmRelease[]> => apiFetch(`/v1/environments/${clusterId}/kubernetes/helm/releases`),
  enabled: !!clusterId,
});

export const useGenericKubernetesResources = (
  clusterId: string,
  kind: string,
  namespace: string = 'default',
  namespaced: boolean = true,
  options?: K8sQueryOptions,
) => useQuery({
  queryKey: k8sKeys.genericResources(clusterId, kind, namespaced ? namespace : '_cluster'),
  queryFn: async (): Promise<K8sGenericResource[]> => {
    const query = namespaced
      ? `?namespace=${encodeURIComponent(namespace)}`
      : '?namespaced=false';
    return apiFetch(`/v1/environments/${clusterId}/kubernetes/resources/${encodeURIComponent(kind)}${query}`);
  },
  enabled: options?.enabled !== false && !!clusterId && !!kind,
  refetchInterval: options?.watch ? 5000 : false,
});

export const useKubernetesTopology = (clusterId: string) => useQuery({
  queryKey: k8sKeys.topology(clusterId),
  queryFn: async (): Promise<K8sTopologyGraph> => apiFetch(`/v1/environments/${clusterId}/kubernetes/topology`),
  enabled: !!clusterId,
});

export const useKubernetesResourceHistory = (clusterId: string, kind: string, namespace: string, name: string, namespaced: boolean = true) => useQuery({
  queryKey: k8sKeys.resourceHistory(clusterId, kind, namespaced ? namespace : '_cluster', name),
  queryFn: async (): Promise<K8sManifestHistoryEntry[]> => {
    const query = namespaced ? `?namespace=${encodeURIComponent(namespace)}` : '?namespaced=false';
    return apiFetch(`/v1/environments/${clusterId}/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/history${query}`);
  },
  enabled: !!clusterId && !!kind && !!name,
});

export const useKubernetesSearch = (clusterId: string, namespace: string, query: string) => useQuery({
  queryKey: k8sKeys.search(clusterId, namespace, query),
  queryFn: async (): Promise<K8sSearchResult[]> => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (namespace && namespace !== 'all') {
      params.set('namespace', namespace);
    }
    return apiFetch(`/v1/environments/${clusterId}/kubernetes/search?${params.toString()}`);
  },
  enabled: !!clusterId && query.trim().length >= 2,
});

export const useRollbackKubernetesResource = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, namespace, name, revisionId, namespaced = true }: { kind: string; namespace: string; name: string; revisionId: string; namespaced?: boolean }) => {
      const query = namespaced ? `?namespace=${encodeURIComponent(namespace)}` : '?namespaced=false';
      return apiFetch<{ message: string; output: string }>(`/v1/environments/${clusterId}/kubernetes/resources/${encodeURIComponent(kind)}/${encodeURIComponent(name)}/rollback${query}`, {
        method: 'POST',
        body: JSON.stringify({ revision_id: revisionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useInstallHelmRelease = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ namespace, name, chart, valuesYaml }: { namespace: string; name: string; chart: string; valuesYaml?: string }) => {
      return apiFetch<{ message: string; output: string }>(`/v1/environments/${clusterId}/kubernetes/helm/releases`, {
        method: 'POST',
        body: JSON.stringify({ namespace, name, chart, values_yaml: valuesYaml || '' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.helmReleases(clusterId) });
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useUninstallHelmRelease = (clusterId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ namespace, name }: { namespace: string; name: string }) => {
      return apiFetch<{ message: string; output: string }>(`/v1/environments/${clusterId}/kubernetes/helm/releases/${encodeURIComponent(name)}?namespace=${encodeURIComponent(namespace)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: k8sKeys.helmReleases(clusterId) });
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

export const useKubeAgentBootstrap = (clusterId: string, token: string, image?: string, enabled: boolean = true) => useQuery({
  queryKey: [...k8sKeys.all, 'agentBootstrap', clusterId, token, image || ''],
  queryFn: async (): Promise<{ manifest: string }> => apiFetch(`/v1/environments/${clusterId}/kubernetes/agent/bootstrap?token=${encodeURIComponent(token)}${image ? `&image=${encodeURIComponent(image)}` : ''}`),
  enabled: !!clusterId && !!token && enabled,
});

export const useImportKubeconfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, name }: { file: File; name?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (name?.trim()) {
        form.append('name', name.trim());
      }
      const response = await fetch('/api/v1/environments/kubernetes/import', {
        method: 'POST',
        body: form,
        headers: buildAuthHeaders(),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || payload?.message || 'Failed to import kubeconfig');
      }
      const payload = await response.json();
      return (payload?.items ?? []) as ImportedK8sEnvironment[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment-inventory'] });
      queryClient.invalidateQueries({ queryKey: k8sKeys.all });
    },
  });
};

function useKubernetesListStream<T>(endpoint: string, enabled: boolean) {
  const [data, setData] = useState<T[] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setIsConnected(false);
      setError(null);
      return;
    }

    const socket = new WebSocket(buildApiWebSocketUrl(endpoint));
    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as { type?: string; items?: T[]; message?: string };
        if (payload.type === 'snapshot') {
          setData(Array.isArray(payload.items) ? payload.items : []);
          return;
        }
        if (payload.type === 'error') {
          setError(payload.message || 'Live stream failed.');
        }
      } catch {
        setError('Invalid live stream payload.');
      }
    };
    socket.onerror = () => {
      setIsConnected(false);
      setError('Unable to connect live stream.');
    };
    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => socket.close();
  }, [enabled, endpoint]);

  return { data, isConnected, error };
}

export const useLivePods = (clusterId: string, namespace: string, enabled: boolean) =>
  useKubernetesListStream<K8sPod>(
    `/v1/environments/${clusterId}/kubernetes/pods/ws?namespace=${encodeURIComponent(namespace)}`,
    enabled && !!clusterId,
  );

export const useLiveDeployments = (clusterId: string, namespace: string, enabled: boolean) =>
  useKubernetesListStream<K8sDeployment>(
    `/v1/environments/${clusterId}/kubernetes/deployments/ws?namespace=${encodeURIComponent(namespace)}`,
    enabled && !!clusterId,
  );

export const useLiveServices = (clusterId: string, namespace: string, enabled: boolean) =>
  useKubernetesListStream<K8sService>(
    `/v1/environments/${clusterId}/kubernetes/services/ws?namespace=${encodeURIComponent(namespace)}`,
    enabled && !!clusterId,
  );

export const useLiveNodes = (clusterId: string, enabled: boolean) =>
  useKubernetesListStream<K8sNode>(
    `/v1/environments/${clusterId}/kubernetes/nodes/ws`,
    enabled && !!clusterId,
  );

export const useLiveGenericKubernetesResources = (
  clusterId: string,
  kind: string,
  namespace: string = 'default',
  namespaced: boolean = true,
  enabled: boolean = true,
) =>
  useKubernetesListStream<K8sGenericResource>(
    `/v1/environments/${clusterId}/kubernetes/resources/${encodeURIComponent(kind)}/ws${
      namespaced
        ? `?namespace=${encodeURIComponent(namespace)}`
        : '?namespaced=false'
    }`,
    enabled && !!clusterId && !!kind,
  );
