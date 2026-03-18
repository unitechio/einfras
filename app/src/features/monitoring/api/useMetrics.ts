import { useQuery } from '@tanstack/react-query';
import type { Metric } from '../types';

export const metricKeys = { all: ['monitoring', 'metrics'] as const };

export const useMetrics = () => {
  return useQuery({
    queryKey: metricKeys.all,
    queryFn: async (): Promise<Metric[]> => [
      { id: 'cpu', name: 'CPU Usage', value: 45.2 }
    ],
  });
};
