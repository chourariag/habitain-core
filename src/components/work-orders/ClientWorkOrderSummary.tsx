import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle, Pencil, FileWarning, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getWoSummary, getPaymentStages, inr, type ClientWorkOrder, type WoSummary, type WoPaymentStage } from "@/lib/contractor-wo";
import { useUserRole } from "@/hooks/useUserRole";

const FINANCE_RELEASE_ROLES = ["finance_manager", "finance_director", "managing_director", "chairman", "super_admin"];

interface Props {
  workOrder: ClientWorkOrder;
  onEdit: () => void;
  onChanged: () => void;
}

export function ClientWorkOrderSummary({ workOrder, onEdit, onChanged }: Props) {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const canRelease = !!role && FINANCE_RELEASE_ROLES.includes(role);
  const [summary, setSummary] = useState<WoSummary | null>(null);
  const [stages, setStages] = useState<WoPaymentStage[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dlp, setDlp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, st, pr, dl] = await Promise.all([
      getWoSummary(workOrder.id),
      getPaymentStages(workOrder.id),
      supabase.from("projects").select("id, name, status, est_completion, actual_completion_date, wo_line_item_ref")
        .eq("client_work_order_id" as any, workOrder.id as any),
      (supabase.from("client_wo_dlp" as any) as any).select("*").eq("work_order_id", workOrder.id),
    ]);
    setSummary(s); setStages(st);
    setProjects((pr as any).data ?? []);
    setDlp(dl.data ?? []);
    setLoading(false);
  }, [workOrder.id]);

  useEffect(() => { load(); }, [load]);

  const releaseRetention = async (dlpRow: any) => {
    const notes = window.prompt("Retention release decision notes (recorded against Finance Manager):");
    if (notes === null) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase.from("client_wo_dlp" as any) as any)
      .update({ finance_decision: "released", decided_by: auth.user?.id ?? null, decided_at: new Date().toISOString(), notes })
      .eq("id", dlpRow.id);
    if (error) { toast.error(error.message); return; }
    await (supabase.from("client_wo_retention_entries" as any) as any)
      .update({ released: true, released_at: new Date().toISOString(), released_by: auth.user?.id ?? null, release_notes: notes })
      .eq("project_id", dlpRow.project_id);
    toast.success("Retention released by Finance decision");
    load(); onChanged();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const acceptanceOk = workOrder.acceptance_signed;
  const delayFlag = (summary?.delay_exposure ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display text-lg font-bold">{workOrder.wo_number}</p>
              {workOrder.amendment_number && (
                <Badge variant="outline" className="text-[10px]">Amd {workOrder.amendment_number}</Badge>
              )}
              <Badge className="text-[10px] border-0" style={{ backgroundColor: "#00603920", color: "#006039" }}>Contractor WO</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{workOrder.client_company_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {[workOrder.client_contact_name, workOrder.client_contact_email, workOrder.client_contact_phone].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Stat label="Grand Total" value={inr(summary?.grand_total)} />
          <Stat label="Billed to date" value={inr(summary?.billed_to_date)} />
          <Stat label="Retention held" value={inr(summary?.retention_held)} color="#D4860A" />
          <Stat label="Linked projects" value={String(summary?.linked_projects ?? 0)} />
        </div>
        <div className="space-y-1">
          <Progress value={Math.min(Number(summary?.billed_pct ?? 0), 100)} className="h-2" />
          <p className="text-[11px] text-muted-foreground">{Number(summary?.billed_pct ?? 0)}% of Work Order value billed across all linked projects</p>
        </div>
      </Card>

      {/* Acceptance statement gate */}
      <Card className="p-4 space-y-1.5">
        <div className="flex items-center gap-2">
          {acceptanceOk
            ? <ShieldCheck className="h-4 w-4" style={{ color: "#006039" }} />
            : <FileWarning className="h-4 w-4" style={{ color: "#F40009" }} />}
          <p className="text-sm font-bold">Acceptance Statement</p>
          <Badge className="text-[10px] border-0" style={{
            backgroundColor: acceptanceOk ? "#00603920" : "#F4000920",
            color: acceptanceOk ? "#006039" : "#F40009",
          }}>{acceptanceOk ? "Signed" : "Not signed — projects blocked"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {workOrder.our_signatory ? `Accepted for ALTREE by ${workOrder.our_signatory}` : "ALTREE signatory not recorded"}
          {workOrder.witness_name ? ` · Witness: ${workOrder.witness_name}` : ""}
          {workOrder.acceptance_date ? ` · ${format(new Date(workOrder.acceptance_date), "dd/MM/yyyy")}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {workOrder.acceptance_platform ?? "—"} · Doc ID {workOrder.acceptance_document_id ?? "—"}
          {workOrder.acceptance_pdf_url && (
            <> · <a href={workOrder.acceptance_pdf_url} target="_blank" rel="noreferrer" className="underline">View PDF</a></>
          )}
        </p>
      </Card>

      {/* Delay exposure */}
      {delayFlag && (
        <Card className="p-4" style={{ borderLeft: "4px solid #F40009" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />
            <p className="text-sm font-bold">Potential delay damages exposure — {inr(summary?.delay_exposure)}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary?.delay_weeks} week(s) past {workOrder.completion_days} days from commencement
            {workOrder.commencement_date ? ` (${format(new Date(workOrder.commencement_date), "dd/MM/yyyy")})` : ""}.
            {" "}{workOrder.delay_damages_pct_per_week}%/week, capped at {workOrder.delay_damages_cap_pct}% of WO value.
            Risk visibility for Finance Director and MD only — nothing is deducted automatically.
          </p>
        </Card>
      )}

      {/* Material advance */}
      <Card className="p-4 space-y-2">
        <p className="text-sm font-bold">Material Advance</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Stat label="Advance %" value={`${workOrder.material_advance_pct_1}% + ${workOrder.material_advance_pct_2}%`} />
          <Stat label="Disbursed" value={inr(summary?.advance_disbursed)} />
          <Stat label="Recovered" value={inr(summary?.advance_recovered)} />
          <Stat label="Outstanding" value={inr(summary?.advance_outstanding)} color="#D4860A" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Recovery is flagged pro-rata on each running bill until cumulative billing reaches{" "}
          {workOrder.advance_recovery_threshold_pct}% of the WO value ({inr((Number(workOrder.advance_recovery_threshold_pct) / 100) * Number(workOrder.grand_total))}).
          Flag only — never auto-deducted. {summary?.advance_recovery_active ? "Recovery currently active." : "Recovery window closed or fully recovered."}
        </p>
      </Card>

      {/* Payment schedule */}
      <Card className="p-4">
        <p className="text-sm font-bold mb-2">Payment Schedule (applies to all linked projects)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2">#</th><th className="py-1 pr-2">Stage</th>
              <th className="py-1 pr-2 text-right">%</th><th className="py-1 pr-2 text-right">Amount</th>
              <th className="py-1">Trigger</th>
            </tr></thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage_order} className="border-t">
                  <td className="py-1.5 pr-2 tabular-nums">{s.stage_order}</td>
                  <td className="py-1.5 pr-2 font-medium">{s.stage_name}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{s.percentage}%</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{inr(Number(s.percentage) / 100 * Number(workOrder.grand_total))}</td>
                  <td className="py-1.5 text-muted-foreground">{s.trigger_description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Linked projects + retention/DLP */}
      <Card className="p-4">
        <p className="text-sm font-bold mb-2">Linked Projects ({projects.length})</p>
        <div className="space-y-2">
          {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects linked to this Work Order yet.</p>}
          {projects.map((p) => {
            const d = dlp.find((x) => x.project_id === p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <button className="text-sm font-medium underline-offset-2 hover:underline" onClick={() => navigate(`/projects/${p.id}`)}>
                    {p.name}
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    {p.wo_line_item_ref ? `Line item ${p.wo_line_item_ref} · ` : ""}{p.status}
                    {d ? ` · DLP ends ${format(new Date(d.dlp_end_date), "dd/MM/yyyy")}` : ""}
                  </p>
                </div>
                {d?.flagged_for_review && d?.finance_decision !== "released" && (
                  canRelease ? (
                    <Button size="sm" variant="outline" onClick={() => releaseRetention(d)}>Review retention release</Button>
                  ) : (
                    <Badge className="text-[10px] border-0" style={{ backgroundColor: "#D4860A20", color: "#D4860A" }}>
                      DLP elapsed — Finance review
                    </Badge>
                  )
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: color ?? "#1A1A1A" }}>{value}</p>
    </div>
  );
}
