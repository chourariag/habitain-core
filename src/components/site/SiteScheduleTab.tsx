import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Save, Calendar, ClipboardCheck, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { SITE_STAGES } from "@/lib/hstack-stages";
import { SiteStageChecklistDrawer } from "@/components/site/SiteStageChecklistDrawer";

interface Props {
  projectId: string;
  projectName?: string;
  userRole: string | null;
  userId: string | null;
}

const SIM_ROLES = new Set([
  "site_installation_mgr", "site_engineer", "delivery_rm_lead",
  "super_admin", "managing_director", "head_operations",
]);

type Row = {
  stage_number: number;
  stage_name: string;
  planned_start: string;
  planned_end: string;
  notes: string;
  is_na: boolean;
  status: string;
  id?: string;
};

export function SiteScheduleTab({ projectId, projectName, userRole, userId }: Props) {
  const [unlockedAt, setUnlockedAt] = useState<string | null>(null);
  const [plannedDispatch, setPlannedDispatch] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerStage, setDrawerStage] = useState<string | null>(null);

  const canEdit = !!userRole && SIM_ROLES.has(userRole);

  async function load() {
    setLoading(true);
    const [{ data: proj }, { data: stages }, { data: dispatchAgg }] = await Promise.all([
      (supabase.from("projects") as any).select("site_schedule_unlocked_at").eq("id", projectId).maybeSingle(),
      (supabase.from("project_stages") as any).select("id, stage_number, stage_name, planned_start, planned_end, status, is_na").eq("project_id", projectId).gte("stage_number", 16).order("stage_number"),
      (supabase.from("modules") as any).select("dispatch_target_date").eq("project_id", projectId).eq("is_archived", false).order("dispatch_target_date", { ascending: true }).limit(1),
    ]);
    setUnlockedAt(proj?.site_schedule_unlocked_at ?? null);
    setPlannedDispatch(dispatchAgg?.[0]?.dispatch_target_date ?? null);

    const existing = new Map<number, any>();
    (stages || []).forEach((s: any) => existing.set(s.stage_number, s));

    setRows(SITE_STAGES.map(s => {
      const e = existing.get(s.number);
      return {
        stage_number: s.number,
        stage_name: s.name,
        planned_start: e?.planned_start ?? "",
        planned_end: e?.planned_end ?? "",
        notes: "",
        is_na: !!e?.is_na,
        status: e?.status ?? "Upcoming",
        id: e?.id,
      };
    }));
    setLoading(false);
  }

  useEffect(() => { if (projectId) load(); /* eslint-disable-next-line */ }, [projectId]);

  const locked = !unlockedAt;

  function update(idx: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function saveAll() {
    if (locked) { toast.error("Site schedule is locked until 14 days before dispatch"); return; }
    if (!canEdit) { toast.error("Only Awaiz / Site Installation Manager can edit"); return; }
    setSaving(true);
    const payload = rows.map(r => {
      const isNa = /^n\/?a$/i.test((r.notes ?? "").trim()) || r.is_na;
      return {
        project_id: projectId,
        stage_number: r.stage_number,
        stage_name: r.stage_name,
        planned_start: isNa || !r.planned_start ? null : r.planned_start,
        planned_end: isNa || !r.planned_end ? null : r.planned_end,
        is_na: isNa,
        status: isNa ? "N/A" : (r.status === "N/A" ? "Upcoming" : r.status),
        updated_by: userId,
      };
    });
    // Delete existing site rows for this project, then re-insert
    await (supabase.from("project_stages") as any).delete().eq("project_id", projectId).gte("stage_number", 16);
    const { error } = await (supabase.from("project_stages") as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Site schedule saved");
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-lg" style={{ color: "#1A1A1A" }}>Site Schedule</h3>
          <p className="text-xs" style={{ color: "#666" }}>
            Stages 16–23 (Erection → Handover) — entered directly by Awaiz, no template upload.
          </p>
        </div>
        {!locked && canEdit && (
          <Button onClick={saveAll} disabled={saving} style={{ backgroundColor: "#006039", color: "#fff" }}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Schedule"}
          </Button>
        )}
      </div>

      {locked ? (
        <div className="rounded-md p-4 flex items-start gap-3" style={{ backgroundColor: "#F7F7F7", border: "1px solid #E0E0E0" }}>
          <Lock className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>
              Site schedule unlocks 14 days before planned dispatch date
            </p>
            <p className="text-xs mt-1" style={{ color: "#666" }}>
              {plannedDispatch
                ? `Planned dispatch: ${format(parseISO(plannedDispatch), "dd/MM/yyyy")}. The trigger fires automatically when dispatch is 14 days away.`
                : "No dispatch date set yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md p-3 flex items-start gap-3" style={{ backgroundColor: "#E8F2ED", border: "1px solid #006039" }}>
          <Calendar className="h-4 w-4 mt-0.5" style={{ color: "#006039" }} />
          <div className="text-xs" style={{ color: "#006039" }}>
            <p className="font-semibold">Unlocked {unlockedAt ? format(parseISO(unlockedAt), "dd/MM/yyyy") : ""}</p>
            <p>Enter dates below. Type "N/A" in Notes to mark a stage out of scope (e.g. Steel Extensions).</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: "#F7F7F7" }}>
            <tr className="text-left">
              <th className="p-2 font-semibold w-10">#</th>
              <th className="p-2 font-semibold">Stage</th>
              <th className="p-2 font-semibold w-36">Planned Start</th>
              <th className="p-2 font-semibold w-36">Planned End</th>
              <th className="p-2 font-semibold w-32">Notes / N/A</th>
              <th className="p-2 font-semibold w-32">Status</th>
              <th className="p-2 font-semibold w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isNa = r.is_na || /^n\/?a$/i.test((r.notes ?? "").trim());
              const meta = SITE_STAGES.find(s => s.number === r.stage_number);
              return (
                <tr key={r.stage_number} className="border-t border-border" style={{ backgroundColor: isNa ? "#F7F7F7" : "#fff" }}>
                  <td className="p-2 font-mono text-xs" style={{ color: "#666" }}>{r.stage_number}</td>
                  <td className="p-2">
                    <div className="font-medium" style={{ color: "#1A1A1A" }}>{r.stage_name}</div>
                    {meta?.na_eligible && <span className="text-[10px]" style={{ color: "#D4860A" }}>N/A eligible</span>}
                  </td>
                  <td className="p-2">
                    <Input type="date" value={r.planned_start || ""} disabled={locked || !canEdit || isNa}
                      onChange={(e) => update(i, { planned_start: e.target.value })} className="h-8 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input type="date" value={r.planned_end || ""} disabled={locked || !canEdit || isNa}
                      onChange={(e) => update(i, { planned_end: e.target.value })} className="h-8 text-xs" />
                  </td>
                  <td className="p-2">
                    <Input value={r.notes} disabled={locked || !canEdit} placeholder={meta?.na_eligible ? "N/A or note" : "Note"}
                      onChange={(e) => update(i, { notes: e.target.value })} className="h-8 text-xs" />
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]"
                      style={{
                        backgroundColor: isNa ? "#F0F0F0" : r.status === "Completed" ? "#E8F2ED" : r.status === "In Progress" ? "#FFF8E8" : "#FFFFFF",
                        color: isNa ? "#999" : r.status === "Completed" ? "#006039" : r.status === "In Progress" ? "#D4860A" : "#666",
                      }}>
                      {isNa ? "N/A" : r.status}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {!locked && r.id && !isNa && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDrawerStage(r.stage_name)}>
                        <ClipboardCheck className="h-3 w-3 mr-1" /> Checklist
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerStage && (
        <SiteStageChecklistDrawer
          open={!!drawerStage}
          onOpenChange={(v) => !v && setDrawerStage(null)}
          projectId={projectId}
          projectName={projectName}
          initialStageName={drawerStage}
          userRole={userRole}
          userId={userId}
        />
      )}
    </div>
  );
}
