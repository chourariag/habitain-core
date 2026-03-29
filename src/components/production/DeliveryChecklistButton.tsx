import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardCheck, Check, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
}

export function DeliveryChecklistButton({ projectId }: Props) {
  const navigate = useNavigate();
  const [siteReady, setSiteReady] = useState<boolean | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: proj }, { data: cl }] = await Promise.all([
        supabase.from("projects").select("site_ready_confirmed").eq("id", projectId).single(),
        (supabase.from("delivery_checklists") as any)
          .select("status")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      setSiteReady((proj as any)?.site_ready_confirmed ?? false);
      setChecklistStatus((cl as any[])?.[0]?.status ?? null);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const isComplete = checklistStatus === "dispatched";
  const isActive = siteReady && !isComplete;
  const isDisabled = !siteReady;

  if (isComplete) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        style={{ backgroundColor: "#E8F2ED", color: "#006039", borderColor: "#006039" }}
        onClick={() => navigate(`/production/delivery-checklist/${projectId}`)}
      >
        <Check className="h-4 w-4" /> Delivery Checklist ✓
      </Button>
    );
  }

  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" disabled className="gap-1.5 opacity-50">
            <ClipboardCheck className="h-4 w-4" /> Delivery Checklist
          </Button>
        </TooltipTrigger>
        <TooltipContent>Waiting for site readiness confirmation</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      size="sm"
      className="gap-1.5"
      style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
      onClick={() => navigate(`/production/delivery-checklist/${projectId}`)}
    >
      <ClipboardCheck className="h-4 w-4" /> Delivery Checklist
    </Button>
  );
}
