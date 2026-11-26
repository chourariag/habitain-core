import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const tables: Record<string, any[]> = {};
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: vi.fn().mockResolvedValue({ data: { warnings: [] }, error: null }),
  from: (table: string) => { const c: any = {}; for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c; c.then = (r: any) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(r); return c; },
} }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: "editor-id" } }) }));
vi.mock("@/hooks/useCanEditSchedule", () => ({ useCanEditSchedule: () => ({ allowed: true, loading: false }) }));
vi.mock("@/components/projects/MicroScheduleTab", () => ({ MicroScheduleTab: () => <div /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ScheduleTab } from "@/components/projects/schedule/ScheduleTab";

/** 200 tasks: 13 in Module 1 with dates, 187 legacy rows with no unit and no dates (the Test project - 1 shape). */
function seed() {
  const base = { project_id: "p", actual_start_date: null, actual_finish_date: null, status: "Upcoming", completion_percentage: 0, baseline_version: null, is_removed: false, removed_at: null, removed_by: null, removed_reason: null, work_category: "process", responsible_role: "sales_director" };
  tables.project_tasks = Array.from({ length: 200 }, (_, i) => i < 13
    ? { ...base, id: `t${i}`, task_id_in_schedule: `F${String(i).padStart(2, "0")}-M1`, task_name: `Factory task ${i}`, phase: "factory", planned_start_date: "2026-11-02", planned_finish_date: "2026-11-04", duration_days: 3, predecessor_ids: i ? [`F${String(i - 1).padStart(2, "0")}-M1`] : [], display_order: i, library_task_id: null, start_day: 1 + i, unit_kind: "module", unit_label: "Module 1" }
    : { ...base, id: `t${i}`, task_id_in_schedule: `${i}`, task_name: `Legacy template task ${i}`, phase: "Pre-Production", planned_start_date: null, planned_finish_date: null, duration_days: 1, predecessor_ids: [], display_order: i, library_task_id: null, start_day: null, unit_kind: null, unit_label: null });
  tables.project_schedule_units = [{ id: "u1", project_id: "p", unit_kind: "module", unit_label: "Module 1", day1: "2026-11-02", offset_note: null }];
  tables.profiles = [];
}

describe("Schedule tab DOM size with 200 tasks", () => {
  it("measures elements and render time", async () => {
    seed();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    const t0 = performance.now();
    const { container } = render(<ScheduleTab projectId="p" userRole="planning_head" />);
    await screen.findByText(/Task table/);
    const ms = Math.round(performance.now() - t0);
    const count = container.querySelectorAll("*").length;
    console.log(`SCHEDULE_DOM elements=${count} render_ms=${ms}`);
    // Before SCHED-2c this was 44,071 elements; keep it far lower.
    expect(count).toBeLessThan(5000);
  });
});
