import { useQuery } from '@tanstack/react-query';
import type { Repository } from '../types';

export const repoKeys = { all: ['repositories'] as const };

export const useRepositories = () => {
  return useQuery({
    queryKey: repoKeys.all,
    queryFn: async (): Promise<Repository[]> => [
      { id: '1', url: 'https://github.com/org/repo.git', branch: 'main' }
    ],
  });
};
