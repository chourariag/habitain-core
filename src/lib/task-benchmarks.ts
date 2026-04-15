import { supabase } from "@/integrations/supabase/client";

export function getModuleCountBand(count: number): string {
  if (count <= 4) return "1-4";
  if (count <= 8) return "5-8";
  if (count <= 15) return "9-15";
  return "16+";
}

/**
 * Record a benchmark data point when a task is completed.
 * Called from TaskUpdateSheet on MARK COMPLETE.
 */
export async function recordTaskBenchmark(task: {
  id: string;
  project_id: string;
  task_name: string;
  phase: string;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  planned_start_date: string | null;
  planned_finish_date: string | null;
  delay_cause?: string | null;
}) {
  if (!task.actual_start_date || !task.actual_finish_date) return;

  // Get module count for the project
  const { count } = await supabase
    .from("modules")
    .select("*", { count: "exact", head: true })
    .eq("project_id", task.project_id);

  const moduleCount = count ?? 0;
  const band = getModuleCountBand(moduleCount);

  const actualDuration = Math.max(
    1,
    Math.ceil(
      (new Date(task.actual_finish_date).getTime() - new Date(task.actual_start_date).getTime()) /
        86400000
    )
  );

  let delayDays = 0;
  if (task.planned_finish_date && task.actual_finish_date) {
    delayDays = Math.ceil(
      (new Date(task.actual_finish_date).getTime() - new Date(task.planned_finish_date).getTime()) /
        86400000
    );
  }

  // Use task_name as category (e.g. "Wall Framing")
  const taskCategory = task.task_name.trim();

  await (supabase.from("task_benchmarks") as any).insert({
    project_id: task.project_id,
    task_id: task.id,
    task_category: taskCategory,
    module_count: moduleCount,
    module_count_band: band,
    actual_duration_days: actualDuration,
    delay_days: delayDays,
    cause_category: task.delay_cause || null,
  });
}

export interface BenchmarkStats {
  task_category: string;
  module_count_band: string;
  data_points: number;
  avg_duration: number;
  fastest: number;
  slowest: number;
  avg_delay: number;
  most_common_cause: string | null;
}

/**
 * Compute aggregated benchmarks from the task_benchmarks table.
 */
export async function fetchBenchmarkStats(): Promise<BenchmarkStats[]> {
  const { data } = await (supabase.from("task_benchmarks") as any)
    .select("*")
    .order("task_category");

  if (!data || data.length === 0) return [];

  // Group by category + band
  const groups: Record<string, any[]> = {};
  for (const row of data) {
    const key = `${row.task_category}||${row.module_count_band}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  const stats: BenchmarkStats[] = [];
  for (const [key, rows] of Object.entries(groups)) {
    const [category, band] = key.split("||");
    const durations = rows.map((r: any) => r.actual_duration_days);
    const delays = rows.map((r: any) => r.delay_days);
    const causes = rows.map((r: any) => r.cause_category).filter(Boolean);

    // Mode of causes
    let modeCause: string | null = null;
    if (causes.length > 0) {
      const freq: Record<string, number> = {};
      causes.forEach((c: string) => { freq[c] = (freq[c] || 0) + 1; });
      modeCause = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }

    stats.push({
      task_category: category,
      module_count_band: band,
      data_points: rows.length,
      avg_duration: Math.round((durations.reduce((a: number, b: number) => a + b, 0) / durations.length) * 10) / 10,
      fastest: Math.min(...durations),
      slowest: Math.max(...durations),
      avg_delay: Math.round((delays.reduce((a: number, b: number) => a + b, 0) / delays.length) * 10) / 10,
      most_common_cause: modeCause,
    });
  }

  return stats;
}

/**
 * Get benchmark for a specific task category + band (if ≥3 data points).
 */
export async function getBenchmarkForTask(taskCategory: string, moduleCountBand: string): Promise<BenchmarkStats | null> {
  const all = await fetchBenchmarkStats();
  const match = all.find(
    (s) => s.task_category === taskCategory && s.module_count_band === moduleCountBand && s.data_points >= 3
  );
  return match ?? null;
}
