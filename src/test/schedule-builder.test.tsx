import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import fs from "node:fs";
import path from "node:path";
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
import { boqTaskReportQueryKey } from "@/lib/boq-task-report";

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

function renderSchedule(userRole = "head_operations", client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><ScheduleTab projectId="project-1" userRole={userRole} /></QueryClientProvider>);
}

beforeEach(() => {
  mocks.allowed = true;
  mocks.userId = "editor-id";
  mocks.tables = {
    project_tasks: [{ ...task }],
    project_schedule_units: [{ id: "unit-1", project_id: "project-1", unit_kind: "module", unit_label: "Module 1", day1: "2026-11-02", offset_note: null }],
    schedule_library_activities: [], schedule_library_tasks: [], schedule_holidays: [], schedule_baselines: [], schedule_task_comments: [],
    profiles: [{ auth_user_id: "editor-id", display_name: "Editor" }],
    modules: [
      { id: "module-1", project_id: "project-1", name: "Module 1", module_code: null, is_archived: false },
      { id: "module-2", project_id: "project-1", name: "Module 2", module_code: null, is_archived: false },
    ],
  };
  vi.mocked(toast.success).mockClear();
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.update.mockReset().mockImplementation((payload: Record<string, unknown>) => ({
    eq: vi.fn().mockImplementation(async () => {
      if (payload.status) mocks.tables.schedule_task_comments = mocks.tables.schedule_task_comments.map((comment) => ({ ...comment, status: payload.status }));
      return { error: null };
    }),
  }));
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
    renderSchedule();
    expect(await screen.findByRole("button", { name: "Add task not in library" })).toBeVisible();
    expect(screen.getByText("2. Add tasks")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(2); // unit Day 1 + task row
    expect(screen.queryByText("Schedules are built on a desktop. Open HStack on a computer to edit. The read-only schedule and comments remain available below.")).not.toBeInTheDocument();
  });

  it("keeps existing schedule task controls desktop-only at 900px while module links remain available", async () => {
    setWidth(900);
    renderSchedule();
    expect(await screen.findByText(/Schedules are built on a desktop/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add task not in library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Factory module for Module 1" })).toBeVisible();
  });

  it("keeps a phone non-editor read-only while allowing task comments", async () => {
    mocks.allowed = false;
    mocks.userId = "site-user";
    setWidth(390);
    renderSchedule("site_engineer");
    expect(await screen.findByRole("button", { name: "Comment" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add task not in library" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review & publish baseline" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Schedules are built on a desktop/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Factory module for Module 1" })).not.toBeInTheDocument();
    expect(screen.getByText("Not linked")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    fireEvent.change(screen.getByPlaceholderText("Leave schedule feedback without editing the task"), { target: { value: "Please review access at the stair opening." } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ project_id: "project-1", task_id: "task-1", body: "Please review access at the stair opening." }));
    expect(mocks.rpc).not.toHaveBeenCalledWith("schedule_revise_task", expect.anything());
    expect(mocks.rpc).not.toHaveBeenCalledWith("schedule_recalculate_dates", expect.anything());
  });

  it("links a factory module at 390px, disables taken modules and refreshes the BOQ report query", async () => {
    mocks.tables.project_schedule_units = [
      ...mocks.tables.project_schedule_units,
      { id: "unit-2", project_id: "project-1", unit_kind: "module", unit_label: "Module 2", day1: "2026-11-02", offset_note: null, module_id: "module-1" },
    ];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    setWidth(390);
    renderSchedule("planning_head", client);
    const select = await screen.findByRole("combobox", { name: "Factory module for Module 1" });
    expect(select).toBeVisible();
    expect(select).toHaveClass("w-full", "min-h-[44px]");
    expect(within(select).getByRole("option", { name: "Module 1" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "module-2" } });
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("schedule_set_unit_module", { p_unit: "unit-1", p_module: "module-2" }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: boqTaskReportQueryKey("project-1") }));
  });

  it("auto-matches only on demand, lists skip reasons and refreshes the BOQ report query", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "schedule_auto_match_units"
      ? { data: { linked: 2, skipped: [{ unit_label: "M9", reason: "No exact module name or code match" }] }, error: null }
      : { data: { count: 1, warnings: [] }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    setWidth(1440);
    renderSchedule("planning_head", client);
    expect(mocks.rpc).not.toHaveBeenCalledWith("schedule_auto_match_units", expect.anything());
    fireEvent.click(await screen.findByRole("button", { name: "Auto-match by name" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Linked 2 unit(s). Skipped: M9: No exact module name or code match"));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: boqTaskReportQueryKey("project-1") }));
  });

  it("uses reasoned revision and removal controls after v1", async () => {
    mocks.tables.schedule_baselines = [{ ...baseline }];
    mocks.tables.project_tasks = [{ ...task, baseline_version: 1 }];
    setWidth(1440);
    renderSchedule();
    expect(await screen.findByText(/Baseline v1/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Revise" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove with reason" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish revision" })).toBeVisible();
  });

  it("sends only status when an editor marks a comment seen and resolved", async () => {
    mocks.tables.schedule_baselines = [{ ...baseline }];
    mocks.tables.schedule_task_comments = [{ id: "comment-1", project_id: "project-1", task_id: "task-1", author_id: "site-user", body: "Check this task", status: "open", created_at: "2026-11-26T10:00:00Z", updated_at: "2026-11-26T10:00:00Z" }];
    setWidth(1440);
    renderSchedule();
    fireEvent.click(await screen.findByRole("button", { name: "Comment (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark seen" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "seen" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark resolved" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ status: "resolved" }));
    for (const call of mocks.update.mock.calls) {
      expect(Object.keys(call[0])).not.toContain("updated_by");
      expect(Object.keys(call[0])).not.toContain("resolved_by");
      expect(Object.keys(call[0])).not.toContain("resolved_at");
    }
  });

  it("blocks publishing when a task in a unit has no calculated dates", async () => {
    mocks.tables.project_tasks = [{ ...task, planned_start_date: null, planned_finish_date: null }];
    setWidth(1440);
    renderSchedule();
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

  it("fails if schedule write payloads reintroduce client actor or timestamp fields", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "src/components/projects/schedule/ScheduleTab.tsx"), "utf8");
    for (const field of ["author_id", "created_by", "updated_by", "resolved_by", "resolved_at"]) {
      expect(source, `${field} must be set by the database`).not.toContain(`${field}:`);
    }
  });
});

describe("SCHED-2c task table", () => {
  it("shows readable role names, one legacy summary line and keeps legacy rows collapsed", async () => {
    mocks.tables.project_tasks = [
      { ...task },
      ...Array.from({ length: 3 }, (_, i) => ({ ...task, id: `legacy-${i}`, task_id_in_schedule: `L${i}`, task_name: `Legacy ${i}`, unit_kind: null, unit_label: null, planned_start_date: null, planned_finish_date: null, responsible_role: "sales_director" })),
    ];
    mocks.rpc.mockResolvedValue({ data: { warnings: ["L0 has no unit; using earliest module Day 1", "L1 has no unit; using earliest module Day 1"] }, error: null });
    setWidth(1440);
    renderSchedule("planning_head");
    expect(await screen.findByText("3 tasks have no unit and no dates.")).toBeVisible();
    expect(screen.queryByText(/has no unit; using earliest/)).not.toBeInTheDocument();
    const roleSelect = screen.getByRole("combobox", { name: "Responsible role for F01-M1" }) as HTMLSelectElement;
    expect(roleSelect.selectedOptions[0].textContent).toBe("Factory Supervisor");
    expect(screen.queryByText("factory_supervisor")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show them" }));
    expect(await screen.findByText("Legacy 0")).toBeVisible();
    expect(screen.getAllByText("Sales Director").length).toBeGreaterThan(0);
  });

  it("adds predecessors without replacing the existing selection", async () => {
    mocks.tables.project_tasks = [
      { ...task, predecessor_ids: ["F00-M1"] },
      { ...task, id: "task-0", task_id_in_schedule: "F00-M1", task_name: "Start" },
      { ...task, id: "task-2", task_id_in_schedule: "F02-M1", task_name: "Frame" },
      { ...task, id: "task-x", task_id_in_schedule: "F09-M2", task_name: "Other unit", unit_label: "Module 2" },
    ];
    setWidth(1440);
    renderSchedule("planning_head");
    fireEvent.click(await screen.findByRole("button", { name: "Predecessors for F01-M1" }));
    const list = await screen.findByRole("listbox");
    expect(within(list).queryByText("Other unit")).not.toBeInTheDocument();
    const frame = within(list).getByText("Frame");
    fireEvent.click(frame.closest("label")!.querySelector("button")!);
    const row = screen.getAllByText("Material receipt").map((el) => el.closest("tr")).find(Boolean)!;
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ start_day: 1, duration_days: 2, predecessor_ids: ["F00-M1", "F02-M1"], responsible_role: "factory_supervisor" }));
  });

  it("shows baseline scope: unit tasks in, legacy unit-less tasks out", async () => {
    mocks.tables.project_tasks = [
      task,
      ...Array.from({ length: 2 }, (_, i) => ({ ...task, id: `legacy-s-${i}`, task_id_in_schedule: `LS${i}`, unit_kind: null, unit_label: null, planned_start_date: null, planned_finish_date: null })),
    ];
    setWidth(1440);
    renderSchedule("planning_head");
    const scope = await screen.findByTestId("publish-scope");
    expect(scope).toHaveTextContent("1 scheduled task will be in the baseline");
    expect(scope).toHaveTextContent("2 legacy tasks without a unit are not part of the baseline");
    expect(screen.getByRole("button", { name: "Review & publish baseline" })).toBeEnabled();
  });

  it("lets editors pick a responsible role from valid roles before a baseline", async () => {
    mocks.tables.project_tasks = [task];
    setWidth(1440);
    renderSchedule("planning_head");
    const select = await screen.findByRole("combobox", { name: "Responsible role for F01-M1" });
    expect(within(select).queryByRole("option", { name: "site_installation_mgr" })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "site_installation_mgr" } });
    const row = select.closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ responsible_role: "site_installation_mgr" })));
  });

  it("orders library tasks by code within an activity", async () => {
    mocks.tables.schedule_library_activities = [{ id: "a1", code: "FAC", name: "Factory", phase: "factory", display_order: 1 }];
    mocks.tables.schedule_library_tasks = [
      { id: "l2", activity_id: "a1", code: "F01", name: "Second", default_days: 1, std_start_day: 1, display_order: 1 },
      { id: "l1", activity_id: "a1", code: "F00", name: "First", default_days: 1, std_start_day: 1, display_order: 2 },
    ];
    setWidth(1440);
    const { container } = renderSchedule("planning_head");
    const select = (await screen.findAllByRole("combobox")).find((el) => el.textContent?.includes("Choose unit"))!;
    fireEvent.change(select, { target: { value: "module|Module 1" } });
    const text = container.textContent ?? "";
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
    expect(screen.getByRole("button", { name: "Add selected (0)" })).toBeDisabled();
  });
});

