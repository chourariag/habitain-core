import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlagRow = {
  key: string;
  label: string;
  wave: number;
  enabled: boolean;
  updated_at: string;
};

export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key,label,wave,enabled,updated_at")
        .order("wave")
        .order("label");
      if (error) throw error;
      return (data ?? []) as FeatureFlagRow[];
    },
    staleTime: 30_000,
  });

  const flags = query.data ?? [];
  const enabledKeys = new Set(flags.filter((flag) => flag.enabled).map((flag) => flag.key));

  return {
    ...query,
    flags,
    isEnabled: (key: string) => enabledKeys.has(key),
  };
}