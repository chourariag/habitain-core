import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ScheduleBaseline, ScheduleTask } from "@/components/projects/schedule/schedule-types";

const mocks = vi.hoisted(() => ({
  allowed: true,
  userId: "editor-id",
  from: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  tables: {} as Record<string, any[]>,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: mocks.userId } }) }));
vi.mock("@/hooks/useCanEditSchedule", () => ({ useCanEditSchedule: () => ({ allowed: mocks.allowed, loading: false }) }));
vi.mock("@/components/projects/MicroScheduleTab", () => ({ MicroScheduleTab: () => <div>Existing actuals reader</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ScheduleTab } from "@/components/projects/schedule/ScheduleTab";
import { compareSnapshots } from "@/components/projects/schedule/schedule-types";
import { SCHEDULE_LEGACY_UPLOAD_VISIBLE } from "@/lib/phase-flags";

const task: ScheduleTask = {
  id: "task-1", project_id: "project-1", task_id_in_schedule: "F01-M1", task_name: "Material receipt", phase: "factory",
  planned_start_date: "2026-11-02", planned_finish_date: "2026-11-03", actual_start_date: null, actual_finish_date: null,
  duration_days: 2, predecessor_ids: [], responsible_role: "factory_supervisor", status: "Upcoming", completion_percentage: 0,
  display_order: 1, library_task_id: "library-1", start_day: 1, unit_kind: "module", unit_label: "Module 1",
  baseline_version: null, is_removed: false, removed_at: null, removed_by: null, removed_reason: null, work_category: "process",
};

const baseline: ScheduleBaseline = {
  id: "baseline-1", project_id: "project-1", version: 1, kind: "baseline", reason: null, published_by: "editor-id",
  published_at: "2026-11-26T10:00:00Z", snapshot: [],
};

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

beforeEach(() => {
  mocks.allowed = true;
  mocks.userId = "editor-id";
  mocks.tables = {
    project_tasks: [{ ...task }],
    project_schedule_units: [{ id: "unit-1", project_id: "project-1", unit_kind: "module", unit_label: "Module 1", day1: "2026-11-02", offset_note: null }],
    schedule_library_activities: [], schedule_library_tasks: [], schedule_holidays: [], schedule_baselines: [], schedule_task_comments: [],
    profiles: [{ auth_user_id: "editor-id", display_name: "Editor" }],
  };
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.update.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.rpc.mockReset().mockResolvedValue({ data: { count: 1, warnings: [] }, error: null });
  mocks.from.mockReset().mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    for (const method of ["select", "eq", "order", "limit"]) chain[method] = vi.fn(() => chain);
    chain.insert = mocks.insert;
    chain.update = mocks.update;
    chain.upsert = mocks.upsert;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.tables[table] ?? [], error: null }).then(resolve);
    return chain;
  });
});

afterEach(cleanup);

describe("Schedule builder access modes", () => {
  it("shows an editor the desktop builder at 1440px", async () => {
    setWidth(1440);
    render(<ScheduleTab projectId="project-1" userRole="head_operations" />);
    expect(await screen.findByRole("button", { name: "Add task not in library" })).toBeVisible();
    expect(screen.getByText("2. Add tasks")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Save & recalculate" })).toHaveLength(2);
    expect(screen.queryByText("Schedules are built on a desktop. Open HStack on a computer to edit. The read-only schedule and comments remain available below.")).not.toBeInTheDocument();
  });

  it("shows an editor the exact desktop message and no schedule write controls at 900px", async () => {
    setWidth(900);
    render(<ScheduleTab projectId="project-1" userRole="head_operations" />);
    expect(await screen.findByText(/Schedules are built on a desktop/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add task not in library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & recalculate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment" })).toBeVisible();
  });

  it("keeps a phone non-editor read-only while allowing task comments", async () => {
    mocks.allowed = false;
    mocks.userId = "site-user";
    setWidth(390);
    render(<ScheduleTab projectId="project-1" userRole="site_engineer" />);
    expect(await screen.findByRole("button", { name: "Comment" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add task not in library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & recalculate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review & publish baseline" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Schedules are built on a desktop/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    fireEvent.change(screen.getByPlaceholderText("Leave schedule feedback without editing the task"), { target: { value: "Please review access at the stair opening." } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: "project-1", task_id: "task-1", author_id: "site-user", status: "open" })));
    expect(mocks.rpc).not.toHaveBeenCalledWith("schedule_revise_task", expect.anything());
    expect(mocks.rpc).not.toHaveBeenCalledWith("schedule_recalculate_dates", expect.anything());
  });

  it("uses reasoned revision and removal controls after v1", async () => {
    mocks.tables.schedule_baselines = [{ ...baseline }];
    mocks.tables.project_tasks = [{ ...task, baseline_version: 1 }];
    setWidth(1440);
    render(<ScheduleTab projectId="project-1" userRole="head_operations" />);
    expect(await screen.findByText(/Baseline v1/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Revise" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove with reason" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save & recalculate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish revision" })).toBeVisible();
  });

  it("blocks publishing when a task in a unit has no calculated dates", async () => {
    mocks.tables.project_tasks = [{ ...task, planned_start_date: null, planned_finish_date: null }];
    setWidth(1440);
    render(<ScheduleTab projectId="project-1" userRole="head_operations" />);
    const button = await screen.findByRole("button", { name: "Review & publish baseline" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Publishing is blocked: 1 task in a unit has no calculated start or finish date/)).toBeVisible();
  });
});

describe("Schedule presentation helpers and legacy switch", () => {
  it("reports an added task and a concrete duration change between snapshots", () => {
    const old = { ...task, planned_start_date: "2026-11-02", planned_finish_date: "2026-11-03" };
    const changed = { ...old, duration_days: 4, planned_finish_date: "2026-11-05" };
    const added = { ...task, id: "task-2", task_id_in_schedule: "F02-M1", task_name: "Frame assembly" };
    const result = compareSnapshots([old], [changed, added]);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.taskId === "task-1")?.changes).toContain("Duration: 2 → 4");
    expect(result.find((item) => item.taskId === "task-2")?.kind).toBe("added");
  });

  it("keeps legacy schedule uploads off by default", () => {
    expect(SCHEDULE_LEGACY_UPLOAD_VISIBLE).toBe(false);
  });
});
