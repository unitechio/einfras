import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsApi, type RuntimeFeatureFlag } from "./api";

export function useRuntimeFeatureFlags() {
  const query = useQuery({
    queryKey: ["settings", "feature-flags"],
    queryFn: () => settingsApi.listFeatureFlags(),
    staleTime: 30_000,
  });

  const byKey = useMemo(
    () =>
      (query.data ?? []).reduce<Record<string, RuntimeFeatureFlag>>((acc, item) => {
        acc[item.key] = item;
        return acc;
      }, {}),
    [query.data],
  );

  const isEnabled = (key: string, fallback = true) => {
    if (!byKey[key]) {
      return fallback;
    }
    return !!byKey[key].enabled;
  };

  return {
    ...query,
    flags: query.data ?? [],
    byKey,
    isEnabled,
  };
}
