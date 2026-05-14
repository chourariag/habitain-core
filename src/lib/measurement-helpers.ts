// Helpers for the daily measurement entry sheet.
import { supabase } from "@/integrations/supabase/client";

export type BoqItem = {
  id: string;
  project_id: string;
  item_code: string | null;
  description: string;
  unit: string;
  boq_qty: number;
  boq_rate: number;
  stage: string | null;
  trade: string;
};

export type MeasurementRow = BoqItem & {
  previously_recorded: number;
  today_qty: number;
  cumulative: number;
  pct_complete: number;
  value_today: number;
};

export type MeasurementLocation = "factory" | "site";

export async function fetchBoqItems(opts: {
  projectId: string;
  stage?: string | null;
  trade?: string | null;
}): Promise<BoqItem[]> {
  let q = supabase
    .from("boq_items" as any)
    .select("id, project_id, item_code, description, unit, boq_qty, boq_rate, stage, trade")
    .eq("project_id", opts.projectId)
    .eq("is_archived", false);
  if (opts.stage) q = q.eq("stage", opts.stage);
  if (opts.trade && opts.trade !== "general") q = q.eq("trade", opts.trade);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as BoqItem[];
}

export async function fetchPreviouslyRecordedMap(boqItemIds: string[]): Promise<Record<string, number>> {
  if (boqItemIds.length === 0) return {};
  const { data, error } = await supabase
    .from("measurement_line_items" as any)
    .select("boq_item_id, today_qty, daily_measurements!inner(is_archived)")
    .in("boq_item_id", boqItemIds);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (row.daily_measurements?.is_archived) continue;
    map[row.boq_item_id] = (map[row.boq_item_id] ?? 0) + Number(row.today_qty || 0);
  }
  return map;
}

export function buildMeasurementRows(items: BoqItem[], prev: Record<string, number>): MeasurementRow[] {
  return items.map((b) => {
    const previously_recorded = prev[b.id] ?? 0;
    return {
      ...b,
      previously_recorded,
      today_qty: 0,
      cumulative: previously_recorded,
      pct_complete: b.boq_qty > 0 ? Math.min(100, (previously_recorded / b.boq_qty) * 100) : 0,
      value_today: 0,
    };
  });
}

export function recomputeRow(row: MeasurementRow, todayQty: number): MeasurementRow {
  const cumulative = row.previously_recorded + (todayQty || 0);
  const pct = row.boq_qty > 0 ? Math.min(100, (cumulative / row.boq_qty) * 100) : 0;
  const value_today = (todayQty || 0) * Number(row.boq_rate || 0);
  return { ...row, today_qty: todayQty, cumulative, pct_complete: pct, value_today };
}

export async function submitMeasurement(args: {
  projectId: string;
  moduleId: string | null;
  stage: string | null;
  location: MeasurementLocation;
  trade: string;
  teamLabel: string | null;
  notes: string | null;
  rows: MeasurementRow[];
  submittedBy: string;
  anomalyFlags?: any[];
}) {
  const filled = args.rows.filter((r) => Number(r.today_qty) > 0);
  if (filled.length === 0) throw new Error("Enter at least one quantity to submit.");
  const { data: header, error: hErr } = await supabase
    .from("daily_measurements" as any)
    .insert({
      project_id: args.projectId,
      module_id: args.moduleId,
      stage: args.stage,
      location: args.location,
      trade: args.trade,
      team_label: args.teamLabel,
      notes: args.notes,
      submitted_by: args.submittedBy,
      created_by: args.submittedBy,
      updated_by: args.submittedBy,
      is_locked: true,
      anomaly_flags: args.anomalyFlags ?? [],
    } as any)
    .select("id")
    .single();
  if (hErr) throw hErr;

  const lineRows = filled.map((r) => ({
    measurement_id: (header as any).id,
    boq_item_id: r.id,
    today_qty: r.today_qty,
    cumulative_qty_snapshot: r.cumulative,
    value_today_snapshot: r.value_today,
    pct_complete_snapshot: r.pct_complete,
  }));
  const { error: lErr } = await supabase.from("measurement_line_items" as any).insert(lineRows as any);
  if (lErr) throw lErr;
  return (header as any).id as string;
}

export async function fetchRunningBill(projectId: string) {
  const { data, error } = await supabase.rpc("recalc_running_bill" as any, { _project_id: projectId } as any);
  if (error) throw error;
  return (data ?? []) as Array<{
    boq_item_id: string;
    description: string;
    unit: string;
    stage: string | null;
    trade: string;
    boq_qty: number;
    boq_rate: number;
    boq_value: number;
    qty_done_factory: number;
    qty_done_site: number;
    total_qty_done: number;
    pct_complete: number;
    value_earned: number;
  }>;
}
