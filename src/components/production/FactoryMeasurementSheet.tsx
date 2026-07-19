import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, Plus, Trash2, Send, AlertTriangle, BellRing } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const OVERHEAD_PCT = 0.05;

interface Props {
  projectId: string;
  projectName?: string | null;
  userRole: string | null;
}

interface StageRow {
  stage: string;
  unit: string;
  trade: string;
  boq_qty: number;
  boq_rate: number;
  first_boq_item_id: string;
}

interface LineDraft {
  stage_name: string;
  boq_item_id: string;
  unit: string;
  trade: string;
  today_qty: number;
  boq_total_qty: number;
  cumulative_prev: number;
  labour_rate: number;
  files: File[];
}

const SUPERVISOR_ROLES = ["factory_floor_supervisor", "production_head", "head_operations", "super_admin", "managing_director"];
const COSTING_ROLES = ["costing_engineer", "finance_manager", "finance_director", "head_of_projects", "managing_director", "super_admin", "head_operations", "production_head"];

const fmt = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function FactoryMeasurementSheet({ projectId, projectName, userRole }: Props) {
  const canSubmit = SUPERVISOR_ROLES.includes(userRole ?? "");
  const canReview = COSTING_ROLES.includes(userRole ?? "");
  const today = format(new Date(), "yyyy-MM-dd");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingHeaderId, setExistingHeaderId] = useState<string | null>(null);
  const [existingLines, setExistingLines] = useState<any[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [activeStages, setActiveStages] = useState<string[]>([]);
  const [materialCostToday, setMaterialCostToday] = useState(0);
  const [wip, setWip] = useState<any | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: stageTotals }, { data: active }, { data: matCost }, { data: wipData }, { data: header }] =
      await Promise.all([
        supabase.rpc("get_boq_totals_by_stage", { _project_id: projectId }),
        supabase.rpc("get_active_production_stages_for_project", { _project_id: projectId }),
        supabase.rpc("get_project_material_cost_for_date", { _project_id: projectId, _on_date: today }),
        supabase.rpc("get_project_wip_summary", { _project_id: projectId, _on_date: today }),
        supabase
          .from("daily_measurements")
          .select("id, submitted_at, total_wip_today")
          .eq("project_id", projectId)
          .eq("measurement_date", today)
          .eq("location", "factory")
          .eq("is_archived", false)
          .maybeSingle(),
      ]);

    setStages((stageTotals as StageRow[]) ?? []);
    setActiveStages(((active as { stage_name: string }[]) ?? []).map((r) => r.stage_name));
    setMaterialCostToday(Number(matCost ?? 0));
    setWip(Array.isArray(wipData) ? wipData[0] : wipData);
    setExistingHeaderId(header?.id ?? null);

    if (header?.id) {
      const { data: items } = await supabase
        .from("measurement_line_items")
        .select("*")
        .eq("measurement_id", header.id);
      setExistingLines(items ?? []);
    } else {
      setExistingLines([]);
    }
    setLoading(false);
  }, [projectId, today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Sign URLs for existing line photos
  useEffect(() => {
    (async () => {
      const paths: string[] = [];
      existingLines.forEach((l) => (l.photo_urls ?? []).forEach((p: string) => paths.push(p)));
      if (paths.length === 0) return;
      const map: Record<string, string> = {};
      for (const p of paths) {
        const { data } = await supabase.storage.from("production-photos").createSignedUrl(p, 60 * 60);
        if (data?.signedUrl) map[p] = data.signedUrl;
      }
      setPreviewUrls(map);
    })();
  }, [existingLines]);

  const addLine = async (stageName: string) => {
    if (lines.some((l) => l.stage_name === stageName)) {
      toast.error("Stage already added");
      return;
    }
    const s = stages.find((x) => x.stage === stageName);
    if (!s) { toast.error("Stage not in BOQ — add BOQ items first"); return; }

    // Cumulative previous for this stage
    const { data: prevAgg } = await supabase
      .from("measurement_line_items")
      .select("today_qty, measurement:measurement_id(project_id, measurement_date)")
      .eq("boq_item_id", s.first_boq_item_id);
    const cumPrev = (prevAgg ?? []).reduce((sum: number, r: any) => {
      if (r.measurement?.project_id === projectId && r.measurement?.measurement_date < today) {
        return sum + Number(r.today_qty || 0);
      }
      return sum;
    }, 0);

    const { data: labourRate } = await supabase.rpc("get_labour_rate_for_trade", { _trade: s.trade });

    setLines((prev) => [
      ...prev,
      {
        stage_name: stageName,
        boq_item_id: s.first_boq_item_id,
        unit: s.unit,
        trade: s.trade,
        today_qty: 0,
        boq_total_qty: Number(s.boq_qty),
        cumulative_prev: cumPrev,
        labour_rate: Number(labourRate ?? 0),
        files: [],
      },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleFiles = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    if (files.length) updateLine(idx, { files: [...lines[idx].files, ...files].slice(0, 4) });
  };

  const totals = useMemo(() => {
    const lineCount = Math.max(lines.length, 1);
    const matShare = materialCostToday / lineCount;
    return lines.map((l) => {
      const labour = l.today_qty * l.labour_rate;
      const mat = matShare;
      const overhead = (labour + mat) * OVERHEAD_PCT;
      const wip = labour + mat + overhead;
      const cumulative = l.cumulative_prev + l.today_qty;
      const pct = l.boq_total_qty > 0 ? Math.min(100, (cumulative / l.boq_total_qty) * 100) : 0;
      return { labour, mat, wip, cumulative, pct };
    });
  }, [lines, materialCostToday]);

  const totalWip = totals.reduce((s, t) => s + t.wip, 0);

  const handleSubmit = async () => {
    if (lines.length === 0) return toast.error("Add at least one stage");
    if (lines.some((l) => l.today_qty <= 0)) return toast.error("Today's quantity required for each line");
    if (lines.some((l) => l.files.length < 1)) return toast.error("At least one photo required per stage");

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1) Header
      const trade = lines[0].trade || "general";
      const { data: header, error: hErr } = await supabase
        .from("daily_measurements")
        .insert({
          project_id: projectId,
          measurement_date: today,
          location: "factory",
          trade,
          submitted_by: user.id,
          submitted_at: new Date().toISOString(),
          total_wip_today: totalWip,
        })
        .select("id")
        .single();
      if (hErr) throw hErr;

      // 2) Upload photos and build line rows
      const lineRows: any[] = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const t = totals[i];
        const photoPaths: string[] = [];
        for (const f of l.files) {
          const path = `${projectId}/${today}/${header.id}-${i}-${Date.now()}-${f.name}`;
          const { error: upErr } = await supabase.storage.from("production-photos").upload(path, f);
          if (upErr) throw upErr;
          photoPaths.push(path);
        }
        lineRows.push({
          measurement_id: header.id,
          boq_item_id: l.boq_item_id,
          stage_name: l.stage_name,
          today_qty: l.today_qty,
          cumulative_qty_snapshot: t.cumulative,
          value_today_snapshot: l.today_qty * l.labour_rate,
          pct_complete_snapshot: Number(t.pct.toFixed(2)),
          labour_cost_today: t.labour,
          material_cost_today: t.mat,
          wip_today: t.wip,
          photo_urls: photoPaths,
        });
      }
      const { error: lErr } = await supabase.from("measurement_line_items").insert(lineRows);
      if (lErr) throw lErr;

      toast.success("Measurement sheet submitted");
      setLines([]);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const notifyAhead = async () => {
    const { data: people } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", ["production_head", "planning_head"])
      .eq("is_active", true);
    const rows = (people ?? []).map((p: any) => ({
      recipient_id: p.auth_user_id,
      type: "alert",
      category: "measurement",
      title: "Material tracking ahead of BOQ",
      body: `Costing flagged WIP > 90% of BOQ for ${projectName ?? "project"}.`,
      content: `Costing flagged WIP > 90% of BOQ for ${projectName ?? "project"}.`,
      navigate_to: `/production?project=${projectId}&tab=measurement`,
      priority: "high",
    }));
    if (rows.length) {
      await supabase.from("notifications").insert(rows);
      toast.success("Notified production & planning heads");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const amber = wip && Number(wip.pct_consumed) > 90;

  return (
    <div className="space-y-4">
      {/* WIP summary - visible to both */}
      {(canReview || existingHeaderId) && wip && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>WIP Summary — {format(new Date(today), "dd/MM/yyyy")}</span>
              {amber && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning gap-1 text-[10px]">
                  <AlertTriangle className="h-3 w-3" /> Tracking ahead of BOQ
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <Stat label="Labour today" today={Number(wip.labour_today)} yday={Number(wip.labour_yday)} />
            <Stat label="Material today" today={Number(wip.material_today)} yday={Number(wip.material_yday)} />
            <Stat label="WIP today" today={Number(wip.wip_today)} yday={Number(wip.wip_yday)} />
            <div className="border rounded p-2">
              <p className="text-muted-foreground">Cumulative WIP</p>
              <p className="font-bold">{fmt(Number(wip.cumulative_wip))}</p>
            </div>
            <div className="border rounded p-2">
              <p className="text-muted-foreground">WIP vs BOQ</p>
              <p className="font-bold">{Number(wip.pct_consumed).toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">of {fmt(Number(wip.boq_total))}</p>
            </div>
            {canReview && amber && (
              <div className="col-span-full">
                <Button size="sm" variant="outline" onClick={notifyAhead}>
                  <BellRing className="h-3.5 w-3.5 mr-1" /> Notify Production & Planning Heads
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing submitted sheet */}
      {existingHeaderId && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground text-[10px]">Submitted</Badge>
              Measurement sheet for today · Total WIP: <span className="font-bold">{fmt(totalWip || existingLines.reduce((s, l: any) => s + Number(l.wip_today || 0), 0))}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {existingLines.map((l) => (
              <div key={l.id} className="border rounded p-2 text-xs space-y-1">
                <div className="flex justify-between font-medium">
                  <span>{l.stage_name ?? "—"}</span>
                  <span>{l.today_qty} {l.unit ?? ""} · {Number(l.pct_complete_snapshot).toFixed(1)}%</span>
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>Labour {fmt(Number(l.labour_cost_today))}</span>
                  <span>Material {fmt(Number(l.material_cost_today))}</span>
                  <span>WIP {fmt(Number(l.wip_today))}</span>
                </div>
                {l.photo_urls?.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {l.photo_urls.map((p: string) => (
                      <a key={p} href={previewUrls[p]} target="_blank" rel="noreferrer">
                        {previewUrls[p] ? (
                          <img src={previewUrls[p]} alt="" className="h-14 w-14 object-cover rounded border" />
                        ) : (
                          <div className="h-14 w-14 bg-muted rounded border" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Entry form (only if no sheet yet today) */}
      {canSubmit && !existingHeaderId && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm">New Measurement Sheet · {format(new Date(today), "dd/MM/yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Add active stage</label>
                <Select onValueChange={addLine}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {activeStages.length === 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">No active production stages today</div>
                    )}
                    {activeStages.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                Material cost today (GRN): <span className="font-bold">{fmt(materialCostToday)}</span>
              </div>
            </div>

            {lines.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No stages added yet.</p>
            )}

            {lines.map((l, i) => {
              const t = totals[i];
              return (
                <div key={i} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{l.stage_name}</p>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-muted-foreground">Today's qty ({l.unit})</label>
                      <Input type="number" min="0" step="0.01" value={l.today_qty || ""}
                        onChange={(e) => updateLine(i, { today_qty: Number(e.target.value) })}
                        className="text-sm" />
                    </div>
                    <ReadOnly label="Cumulative" value={`${t.cumulative.toFixed(2)} ${l.unit}`} />
                    <ReadOnly label="BOQ total" value={`${l.boq_total_qty.toFixed(2)} ${l.unit}`} />
                    <ReadOnly label="% complete" value={`${t.pct.toFixed(1)}%`} />
                    <ReadOnly label="Labour today" value={fmt(t.labour)} hint={`@ ${fmt(l.labour_rate)}/${l.unit}`} />
                    <ReadOnly label="Material share" value={fmt(t.mat)} />
                    <ReadOnly label="WIP today" value={fmt(t.wip)} hint="+5% overhead" />
                    <div>
                      <label className="text-muted-foreground">Progress photos *</label>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {l.files.map((f, fi) => (
                          <div key={fi} className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-[9px] text-center px-0.5 overflow-hidden">
                            {f.name.slice(0, 14)}
                          </div>
                        ))}
                        {l.files.length < 4 && (
                          <label className="h-12 w-12 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer">
                            <Camera className="h-4 w-4 text-muted-foreground" />
                            <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                              onChange={(e) => handleFiles(i, e)} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {lines.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm">Total WIP today: <span className="font-bold">{fmt(totalWip)}</span></p>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Submit Sheet
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!canSubmit && !existingHeaderId && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No measurement sheet submitted yet today.
        </p>
      )}
    </div>
  );
}

function Stat({ label, today, yday }: { label: string; today: number; yday: number }) {
  const delta = today - yday;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  const color = delta > 0 ? "text-warning" : delta < 0 ? "text-primary" : "text-muted-foreground";
  return (
    <div className="border rounded p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-bold">{fmt(today)}</p>
      <p className={`text-[10px] ${color}`}>{arrow} vs yday {fmt(yday)}</p>
    </div>
  );
}

function ReadOnly({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="text-muted-foreground">{label}</label>
      <p className="text-sm font-medium">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
