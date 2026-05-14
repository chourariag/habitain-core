// Client-side anomaly checks for measurement entries.
// Returns a list of {severity, message} flags to surface in the UI
// and persist on the daily_measurements row.
import { supabase } from "@/integrations/supabase/client";
import type { MeasurementRow, MeasurementLocation } from "./measurement-helpers";

export type AnomalyFlag = { severity: "warn" | "critical"; rule: string; message: string };

const EXPECTED_OUTPUT_PER_WORKER: Record<string, number> = {
  // unit -> expected qty per worker per day, very rough heuristics
  sqft: 100,
  kg: 80,
  nos: 4,
  points: 12,
};

export async function computeMeasurementAnomalies(args: {
  projectId: string;
  moduleId: string | null;
  location: MeasurementLocation;
  rows: MeasurementRow[];
  measurementDate: string;
}): Promise<AnomalyFlag[]> {
  const flags: AnomalyFlag[] = [];

  // Rule 1: output vs labour count
  let workersToday = 0;
  try {
    const { data } = await supabase
      .from("daily_labour_logs" as any)
      .select("workers_count")
      .eq("project_id", args.projectId)
      .eq("log_date", args.measurementDate);
    workersToday = ((data ?? []) as any[]).reduce((a, r: any) => a + Number(r.workers_count || 0), 0);
  } catch { /* table may not exist in all envs; skip */ }

  if (workersToday > 0) {
    for (const r of args.rows) {
      if (!r.today_qty) continue;
      const expected = EXPECTED_OUTPUT_PER_WORKER[r.unit?.toLowerCase()] ?? 0;
      if (expected > 0 && r.today_qty > expected * workersToday) {
        flags.push({
          severity: "warn",
          rule: "output_vs_labour",
          message: `${r.description}: ${r.today_qty} ${r.unit} recorded with only ${workersToday} workers logged (expected ≤ ${expected * workersToday}).`,
        });
      }
    }
  }

  // Rule 2: 100% complete with no QC inspection
  for (const r of args.rows) {
    if (r.pct_complete >= 100) {
      try {
        const { count } = await supabase
          .from("qc_inspections" as any)
          .select("id", { count: "exact", head: true })
          .eq("project_id", args.projectId)
          .eq("stage", r.stage ?? "");
        if (!count || count === 0) {
          flags.push({
            severity: "warn",
            rule: "complete_no_qc",
            message: `${r.description} reached 100% but no QC inspection on record for stage ${r.stage ?? "—"}.`,
          });
        }
      } catch { /* ignore if table absent */ }
    }
  }

  // Rule 3 (site only): material consumption with no GRN
  if (args.location === "site") {
    for (const r of args.rows) {
      if (!r.today_qty) continue;
      try {
        const { count } = await supabase
          .from("grn" as any)
          .select("id", { count: "exact", head: true })
          .eq("project_id", args.projectId)
          .ilike("material_description", `%${r.description.split(" ")[0]}%`);
        if (!count || count === 0) {
          flags.push({
            severity: "warn",
            rule: "site_no_grn",
            message: `${r.description}: site qty recorded but no matching GRN found for this project.`,
          });
        }
      } catch { /* ignore */ }
    }
  }

  return flags;
}
