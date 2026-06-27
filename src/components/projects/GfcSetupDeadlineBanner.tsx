import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2 } from "lucide-react";

interface Props { projectId: string; }

export default function GfcSetupDeadlineBanner({ projectId }: Props) {
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("gfc_budget_approved_at")
        .eq("id", projectId)
        .maybeSingle();
      setApprovedAt((data as any)?.gfc_budget_approved_at ?? null);
    })();
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, [projectId]);

  if (!approvedAt) return null;
  const approved = new Date(approvedAt);
  const deadline = new Date(approved.getTime() + 72 * 36e5);
  const hoursLeft = Math.round((deadline.getTime() - Date.now()) / 36e5);
  const red = hoursLeft < 12;

  return (
    <div className="rounded-md border p-3 flex flex-wrap items-center gap-3 text-sm"
      style={{ background: red ? "#FEF2F2" : "#F1FAF5", borderColor: red ? "#FECACA" : "#CDEAD9" }}>
      <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />
      <span><b>GFC Budget approved:</b> {approved.toLocaleString("en-IN")}</span>
      <span className="mx-2 opacity-40">·</span>
      <Clock className="h-4 w-4" style={{ color: red ? "#F40009" : "#D4860A" }} />
      <span style={{ color: red ? "#F40009" : "#1A1A1A", fontWeight: red ? 700 : 500 }}>
        Project Setup deadline: {deadline.toLocaleString("en-IN")} ({hoursLeft > 0 ? `${hoursLeft}h remaining` : `${Math.abs(hoursLeft)}h overdue`})
      </span>
    </div>
  );
}
