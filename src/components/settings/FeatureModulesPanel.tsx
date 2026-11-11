import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { FEATURE_FLAG_LABELS } from "@/lib/feature-flags";
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const ADMIN_ROLES = ["super_admin", "managing_director"];

export function FeatureModulesPanel({ role }: { role: string | null }) {
  const allowed = role !== null && ADMIN_ROLES.includes(role);
  const flagsQuery = useFeatureFlags();
  const queryClient = useQueryClient();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const jobsQuery = useQuery({
    queryKey: ["scheduled-job-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_scheduled_job_status");
      if (error) throw error;
      return data ?? [];
    },
    enabled: allowed,
    staleTime: 30_000,
  });

  const rows = FEATURE_FLAG_DEFINITIONS.map((definition) => ({
    ...definition,
    ...(flagsQuery.flags.find((row) => row.key === definition.key) ?? {}),
  })).sort((a, b) => a.wave - b.wave || a.label.localeCompare(b.label));

  const changeFlag = async (key: string, enabled: boolean) => {
    setSavingKey(key);
    const { error } = await supabase.rpc("set_feature_flag", { _key: key, _enabled: enabled });
    if (error) toast.error("Could not update module status");
    else {
      await queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast.success(`${FEATURE_FLAG_LABELS[key] ?? key} ${enabled ? "enabled" : "disabled"}`);
    }
    setSavingKey(null);
  };

  if (!allowed) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="modules-heading">
        <div>
          <h2 id="modules-heading" className="font-display text-lg font-bold text-foreground">Modules</h2>
          <p className="text-sm text-muted-foreground">Choose which modules are available in the app.</p>
        </div>
        {flagsQuery.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : flagsQuery.isError ? (
          <p className="text-sm text-destructive">Module settings could not be loaded.</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {rows.map((flag) => (
              <div key={flag.key} className="flex min-h-14 items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-foreground">{flag.label}</p>
                  <p className="text-xs text-muted-foreground">Wave {flag.wave}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">{flag.enabled ? "On" : "Off"}</span>
                  <Switch
                    checked={flag.enabled}
                    disabled={savingKey === flag.key}
                    onCheckedChange={(enabled) => void changeFlag(flag.key, enabled)}
                    aria-label={`Enable ${flag.label}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="scheduled-jobs-heading">
        <div>
          <h2 id="scheduled-jobs-heading" className="font-display text-lg font-bold text-foreground">Scheduled jobs</h2>
          <p className="text-sm text-muted-foreground">Current status and run times, in UTC.</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {jobsQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : jobsQuery.isError ? (
            <p className="py-3 text-sm text-destructive">Scheduled job status could not be loaded.</p>
          ) : jobsQuery.data?.map((job) => (
              <div key={job.job_name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 break-all text-sm font-medium text-foreground">{job.job_name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{job.schedule}</span>
                  <Badge variant={job.active ? "default" : "secondary"}>{job.active ? "Active" : "Paused"}</Badge>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}