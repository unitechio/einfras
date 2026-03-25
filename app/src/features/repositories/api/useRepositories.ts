import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api-client';
import type { Registry, Repository } from '../types';

export const repoKeys = { all: ['repositories'] as const };
export const registryKeys = { all: ['registries'] as const };

export const useRepositories = () => {
  return useQuery({
    queryKey: repoKeys.all,
    queryFn: async (): Promise<Repository[]> => [
      { id: '1', url: 'https://github.com/org/repo.git', branch: 'main' }
    ],
  });
};

export const useRegistries = () => {
  return useQuery({
    queryKey: registryKeys.all,
    queryFn: async (): Promise<Registry[]> => {
      return apiFetch<Registry[]>('/v1/registries');
    },
  });
};

export const useSaveRegistry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Registry) => {
      return apiFetch<Registry>('/v1/registries', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registryKeys.all });
    },
  });
};

export const useDeleteRegistry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/v1/registries/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registryKeys.all });
    },
  });
};

export const useTestRegistry = () => {
  return useMutation({
    mutationFn: async (body: Registry) => {
      return apiFetch<{ message: string }>('/v1/registries/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  });
};
