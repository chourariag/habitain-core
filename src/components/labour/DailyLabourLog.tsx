import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { MODULAR_STAGES, HYBRID_STAGES, PANELISED_STAGES } from "@/lib/production-systems";

const SITE_STAGES = [
  "Site Readiness",
  "Foundation",
  "Module Receipt",
  "Module Placement",
  "Inter-Module Connection",
  "MEP Hookup",
  "External Finishing",
  "Snagging",
  "Handover",
] as const;

const TRADE_GROUPS = [
  "Fabricators",
  "Wall Panel Team",
  "MEP Electrical",
  "MEP Plumbing",
  "Painting",
  "Civil",
  "General Labour",
] as const;

// Map a trade group to skill_type values in labour_workers
const TRADE_TO_SKILLS: Record<string, string[]> = {
  Fabricators: ["MIG Welder", "Arc Welder", "Fitter"],
  "Wall Panel Team": ["Wall Panelling"],
  "MEP Electrical": ["Electrician"],
  "MEP Plumbing": ["Plumber"],
  Painting: ["Internal Painter", "External Painter"],
  Civil: ["Civil Mason", "Tiles Mason", "Civil Helper"],
  "General Labour": ["Helper"],
};

// Working days/month assumption to convert monthly_salary -> daily rate
const DAYS_PER_MONTH = 26;
const HOURS_PER_DAY = 8;
const OT_MULTIPLIER = 1.5;

interface TradeRow {
  trade_group: string;
  workers: number;
  hours: number;
  ot_hours: number;
}

interface Props {
  mode: "factory" | "site";
  projectId?: string | null;
  projectName?: string | null;
  userRole: string | null;
}

const SUPERVISOR_ROLES = [
  "super_admin",
  "managing_director",
  "head_operations",
  "production_head",
  "factory_floor_supervisor",
  "fabrication_foreman",
  "site_installation_mgr",
  "site_engineer",
];

export function DailyLabourLog({ mode, projectId, projectName, userRole }: Props) {
  const canSubmit = SUPERVISOR_ROLES.includes(userRole ?? "");
  const stageList = useMemo(() => (mode === "site" ? SITE_STAGES : MODULAR_STAGES), [mode]);

  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [bayNumber, setBayNumber] = useState<string>("1");
  const [stage, setStage] = useState<string>(stageList[0]);
  const [stageList2, setStageList2] = useState<readonly string[]>(stageList);
  const [rows, setRows] = useState<TradeRow[]>([
    { trade_group: TRADE_GROUPS[0], workers: 0, hours: HOURS_PER_DAY, ot_hours: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setStageList2(stageList); setStage(stageList[0]); }, [stageList]);

  // Compute average daily rate per trade group from labour_workers
  const ratesByTrade = useMemo(() => {
    const out: Record<string, number> = {};
    for (const tg of TRADE_GROUPS) {
      const skills = TRADE_TO_SKILLS[tg] ?? [];
      const matched = workers.filter((w: any) =>
        skills.some((s) => (w.skill_type ?? "").toLowerCase() === s.toLowerCase())
      );
      if (matched.length === 0) { out[tg] = 0; continue; }
      const avgMonthly = matched.reduce((s, w) => s + Number(w.monthly_salary || 0), 0) / matched.length;
      out[tg] = avgMonthly / DAYS_PER_MONTH;
    }
    return out;
  }, [workers]);

  const load = useCallback(async () => {
    setLoading(true);
    const baseLogs = (supabase as any).from("daily_labour_logs").select("*").eq("is_archived", false);
    const filtered = mode === "site"
      ? baseLogs.eq("location_type", "site").eq("project_id", projectId ?? "")
      : baseLogs.eq("location_type", "factory_bay");
    const [{ data: l }, { data: w }, { data: comp }] = await Promise.all([
      filtered.order("log_date", { ascending: false }).limit(50),
      (supabase as any).from("labour_workers").select("id,name,skill_type,department,status").eq("status", "active"),
      (supabase as any).from("labour_worker_compensation").select("worker_id, monthly_salary"),
    ]);
    const compMap = new Map<string, number>();
    for (const c of (comp as any[]) ?? []) compMap.set(c.worker_id, Number(c.monthly_salary) || 0);
    setLogs((l as any[]) ?? []);
    setWorkers(((w as any[]) ?? []).map((row) => ({ ...row, monthly_salary: compMap.get(row.id) ?? 0 })));
    setLoading(false);
  }, [mode, projectId]);

  useEffect(() => { load(); }, [load]);

  const computedRows = rows.map((r) => {
    const rate = ratesByTrade[r.trade_group] ?? 0;
    const hourlyRate = rate / HOURS_PER_DAY;
    const cost = r.workers * (r.hours * hourlyRate + r.ot_hours * hourlyRate * OT_MULTIPLIER);
    return { ...r, daily_rate: rate, hourly_rate: hourlyRate, cost };
  });
  const totalCost = computedRows.reduce((s, r) => s + r.cost, 0);

  const addRow = () => setRows((r) => [...r, { trade_group: TRADE_GROUPS[0], workers: 0, hours: HOURS_PER_DAY, ot_hours: 0 }]);
  const updateRow = (i: number, patch: Partial<TradeRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const reset = () => {
    setRows([{ trade_group: TRADE_GROUPS[0], workers: 0, hours: HOURS_PER_DAY, ot_hours: 0 }]);
    setNotes(""); setBayNumber("1"); setStage(stageList[0]);
  };

  const submit = async () => {
    if (mode === "site" && !projectId) { toast.error("Select a project first"); return; }
    if (rows.length === 0 || rows.every((r) => r.workers <= 0)) {
      toast.error("Add at least one trade row with workers"); return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const trade_entries = computedRows
        .filter((r) => r.workers > 0)
        .map((r) => ({
          trade_group: r.trade_group,
          workers: r.workers,
          hours: r.hours,
          ot_hours: r.ot_hours,
          daily_rate: Number(r.daily_rate.toFixed(2)),
          cost: Number(r.cost.toFixed(2)),
        }));

      const payload: any = {
        log_date: format(new Date(), "yyyy-MM-dd"),
        location_type: mode === "site" ? "site" : "factory_bay",
        bay_number: mode === "factory" ? Number(bayNumber) : null,
        project_id: projectId ?? null,
        stage,
        trade_entries,
        total_cost: Number(totalCost.toFixed(2)),
        notes: notes.trim() || null,
        submitted_by: user.id,
      };
      const { error } = await (supabase as any).from("daily_labour_logs").insert(payload);
      if (error) throw error;
      toast.success(`Daily labour log saved · ₹${Math.round(totalCost).toLocaleString("en-IN")}`);
      reset();
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Daily Labour Log</p>
          <p className="text-xs text-muted-foreground">
            {mode === "site" ? `Site — ${projectName ?? ""}` : "Factory bays"} · one entry per bay/site per day
          </p>
        </div>
        {canSubmit && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Log
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">{format(new Date(), "dd/MM/yyyy")} — Daily Labour Entry</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mode === "factory" ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Bay</label>
                  <Select value={bayNumber} onValueChange={setBayNumber}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n <= 10 ? `Module Bay ${n}` : `Panel Bay ${n - 10}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <Input value={`Site — ${projectName ?? ""}`} disabled className="text-sm" />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Stage</label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageList2.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Trade groups working today</label>
                <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Trade
                </Button>
              </div>

              <div className="space-y-2">
                {computedRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border border-border rounded-md p-2 bg-muted/30">
                    <div className="col-span-12 md:col-span-4 space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">Trade</label>
                      <Select value={r.trade_group} onValueChange={(v) => updateRow(i, { trade_group: v })}>
                        <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRADE_GROUPS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 md:col-span-2 space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">Workers</label>
                      <Input type="number" min={0} value={r.workers}
                        onChange={(e) => updateRow(i, { workers: Number(e.target.value) || 0 })}
                        className="text-sm h-9" />
                    </div>
                    <div className="col-span-3 md:col-span-2 space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">Hours</label>
                      <Input type="number" min={0} step={0.5} value={r.hours}
                        onChange={(e) => updateRow(i, { hours: Number(e.target.value) || 0 })}
                        className="text-sm h-9" />
                    </div>
                    <div className="col-span-3 md:col-span-2 space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground">OT</label>
                      <Input type="number" min={0} step={0.5} value={r.ot_hours}
                        onChange={(e) => updateRow(i, { ot_hours: Number(e.target.value) || 0 })}
                        className="text-sm h-9" />
                    </div>
                    <div className="col-span-2 md:col-span-1 text-right">
                      <p className="text-[10px] uppercase text-muted-foreground">Cost</p>
                      <p className="text-sm font-semibold">₹{Math.round(r.cost).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    {r.daily_rate === 0 && r.workers > 0 && (
                      <p className="col-span-12 text-[10px] text-warning-foreground">
                        ⚠ No rate found in Labour Register for this trade — cost defaulted to 0.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notes / issues (optional)</label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm" />
            </div>

            <div className="flex items-center justify-between pt-1 border-t">
              <p className="text-sm">
                Total labour cost today: <span className="font-bold text-primary">₹{Math.round(totalCost).toLocaleString("en-IN")}</span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowForm(false); reset(); }}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Log
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No labour logs yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="border border-border rounded-md p-3 bg-card space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold">{format(new Date(log.log_date), "dd/MM/yyyy")}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {log.location_type === "site"
                      ? "Site"
                      : log.bay_number != null
                        ? (log.bay_number <= 10 ? `Module Bay ${log.bay_number}` : `Panel Bay ${log.bay_number - 10}`)
                        : "—"}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary text-[10px]">{log.stage}</Badge>
                </div>
                <span className="text-xs font-semibold text-primary">
                  ₹{Math.round(Number(log.total_cost || 0)).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(log.trade_entries ?? []).map((te: any, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-muted text-foreground/80">
                    {te.trade_group}: {te.workers}×{te.hours}h{te.ot_hours ? `+${te.ot_hours}OT` : ""} · ₹{Math.round(te.cost).toLocaleString("en-IN")}
                  </span>
                ))}
              </div>
              {log.notes && <p className="text-xs text-muted-foreground italic">{log.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
