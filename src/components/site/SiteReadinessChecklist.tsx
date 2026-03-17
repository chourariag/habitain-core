import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardCheck, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  moduleId: string;
  userRole: string | null;
  onReadinessConfirmed: () => void;
}

const CHECKLIST_ITEMS = [
  { key: "foundation_ready", label: "Foundation ready" },
  { key: "crane_booked", label: "Crane booked" },
  { key: "site_access_clear", label: "Site access clear" },
  { key: "team_briefed", label: "Team briefed" },
  { key: "safety_equipment", label: "Safety equipment on site" },
] as const;

type CheckKey = typeof CHECKLIST_ITEMS[number]["key"];

export function SiteReadinessChecklist({ moduleId, userRole, onReadinessConfirmed }: Props) {
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    foundation_ready: false,
    crane_booked: false,
    site_access_clear: false,
    team_briefed: false,
    safety_equipment: false,
  });
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canManage = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? "");
  const allChecked = CHECKLIST_ITEMS.every((item) => checks[item.key]);

  useEffect(() => {
    loadExisting();
  }, [moduleId]);

  const loadExisting = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_readiness" as any)
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false })
      .limit(1);

    const record = (data as any[])?.[0];
    if (record) {
      setExisting(record);
      setChecks({
        foundation_ready: record.foundation_ready,
        crane_booked: record.crane_booked,
        site_access_clear: record.site_access_clear,
        team_briefed: record.team_briefed,
        safety_equipment: record.safety_equipment,
      });
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { client } = await getAuthedClient();
      const payload = {
        module_id: moduleId,
        submitted_by: user.id,
        ...checks,
        is_complete: allChecked,
        submitted_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await (client.from("site_readiness" as any) as any)
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("site_readiness" as any) as any)
          .insert(payload);
        if (error) throw error;
      }

      toast.success(allChecked ? "Site readiness confirmed!" : "Checklist saved.");
      if (allChecked) onReadinessConfirmed();
      await loadExisting();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  // Already submitted and complete
  if (existing?.is_complete) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-success">
            <Check className="h-4 w-4" />
            Site Readiness Confirmed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs text-card-foreground/70">
            Confirmed at {existing.submitted_at ? format(new Date(existing.submitted_at), "dd/MM/yyyy HH:mm") : "—"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 text-card-foreground">
          <ClipboardCheck className="h-4 w-4" />
          Site Readiness Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={checks[item.key]}
              onCheckedChange={(v) =>
                setChecks((prev) => ({ ...prev, [item.key]: !!v }))
              }
            />
            <span className="text-sm text-card-foreground">{item.label}</span>
            {checks[item.key] && <Check className="h-3.5 w-3.5 text-success ml-auto" />}
          </label>
        ))}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-2"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : null}
          {allChecked ? "Confirm Site Readiness" : "Save Progress"}
        </Button>
      </CardContent>
    </Card>
  );
}
