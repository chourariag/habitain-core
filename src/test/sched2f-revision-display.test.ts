import { describe, expect, it } from "vitest";
import { compareSnapshots, displayDateTime } from "@/components/projects/schedule/schedule-types";

describe("SCHED-2f display", () => {
  it("shows timestamps in IST, not the device zone", () => {
    expect(displayDateTime("2026-11-26T18:51:52.107Z")).toBe("27/11/2026 00:21");
  });
  it("history shows planned date changes as DD/MM/YYYY", () => {
    const base = { id: "t1", task_id_in_schedule: "F01", task_name: "Receipt", start_day: 2, duration_days: 3, planned_start_date: "2026-12-01", planned_finish_date: "2026-12-03" } as any;
    const changes = compareSnapshots([base], [{ ...base, duration_days: 5, planned_finish_date: "2026-12-05" }]);
    expect(changes[0].changes).toContain("Duration: 3 → 5");
    expect(changes[0].changes).toContain("Finish date: 03/12/2026 → 05/12/2026");
  });
});
