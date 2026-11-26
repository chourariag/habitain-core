import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskUpdateSheet } from "@/components/tasks/TaskUpdateSheet";
import { saveTaskProgress } from "@/lib/task-progress-save";
import { TASK_UPDATE_ROLES } from "@/lib/my-tasks-roles";

const mocks = vi.hoisted(() => ({ result: { data: { id: "task" } as {id: string} | null, error: null as {message: string} | null }, update: vi.fn(), success: vi.fn(), error: vi.fn(), benchmark: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/lib/task-benchmarks", () => ({ recordTaskBenchmark: mocks.benchmark }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({
    update: (patch: unknown) => { mocks.update(patch); return { eq: () => ({ select: () => ({ maybeSingle: async () => mocks.result }) }) }; },
    select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }),
  }),
} }));

const task = { id: "task", task_id_in_schedule: "SITE", task_name: "Site installation", phase: "site", project_id: "project", planned_start_date: "2026-01-01", planned_finish_date: "2099-12-31", actual_start_date: "2026-01-01", actual_finish_date: null, duration_days: 3, predecessor_ids: [], responsible_role: "site_installation_mgr", status: "In Progress", completion_percentage: 40, delay_days: 0, remarks: null, is_locked: false };
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  cleanup(); vi.clearAllMocks(); mocks.result = { data: { id: "task" }, error: null }; mocks.benchmark.mockResolvedValue(undefined);
});

describe("SCHED-2h task actuals", () => {
  it("enables site engineers without enabling fabrication foremen", () => {
    expect(TASK_UPDATE_ROLES).toContain("site_engineer");
    expect(TASK_UPDATE_ROLES).not.toContain("fabrication_foreman");
  });
  it("returns database refusals and detects silent RLS zero-row updates", async () => {
    mocks.result = { data: null, error: { message: "Site engineers can update progress only" } };
    expect(await saveTaskProgress("task", { completion_percentage: 40 })).toBe("Site engineers can update progress only");
    mocks.result = { data: null, error: null };
    expect(await saveTaskProgress("task", { completion_percentage: 40 })).toContain("not saved");
  });
  it("saves 40% without any schedule field, actor or timestamp", async () => {
    const updated = vi.fn(), close = vi.fn();
    render(<TaskUpdateSheet task={task} open onOpenChange={close} onUpdated={updated} userRole="site_engineer" canAddSubtasks />);
    fireEvent.click(screen.getByRole("button", { name: "Save Progress" }));
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenCalledWith({ completion_percentage: 40, remarks: null, delay_cause: null, delay_resolution: null });
    expect(close).toHaveBeenCalledWith(false);
    expect(screen.queryByPlaceholderText("Add subtask...")).toBeNull();
  });
  it.each(["start", "progress", "complete"])("keeps %s refusal open without success or benchmark", async (action) => {
    mocks.result = { data: null, error: { message: "You cannot update this task" } };
    const updated = vi.fn(), close = vi.fn();
    const row = action === "start" ? { ...task, actual_start_date: null, completion_percentage: 0 } : action === "complete" ? { ...task, completion_percentage: 100 } : task;
    render(<TaskUpdateSheet task={row} open onOpenChange={close} onUpdated={updated} userRole="site_engineer" />);
    fireEvent.click(screen.getByRole("button", { name: action === "start" ? "START TASK" : "Save Progress" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("You cannot update this task"));
    expect(updated).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.benchmark).not.toHaveBeenCalled();
  });
});