import { describe, expect, it } from "vitest";
import { allocatedHours, remainingHours, workerAllocationProblems, derivedLabour, calculatedProgress, isTodaysTask } from "@/lib/site-report-task-workers";
const workers = [{worker_id:"w",name:"Worker",skill_type:"mason",contractor_name:"Other contractor",attendance_hours:8}];
describe("Daily Report task allocation and progress", () => {
  it("rejects worker over-allocation", () => expect(workerAllocationProblems(workers,[{task_id:"a",worker_id:"w",hours:5},{task_id:"b",worker_id:"w",hours:4}])).toContain("Worker: allocated hours exceed attendance hours."));
  it("rejects absent workers", () => expect(workerAllocationProblems(workers,[{task_id:"a",worker_id:"absent",hours:1}])).toContain("Worker must be present on this project and date."));
  it("rejects invalid and more than 16 hours", () => {
    expect(workerAllocationProblems(workers,[{task_id:"a",worker_id:"w",hours:0}])).toHaveLength(1);
    expect(workerAllocationProblems(workers,[{task_id:"a",worker_id:"w",hours:17}])).toHaveLength(2);
  });
  it("under-allocation is not a blocker", () => expect(workerAllocationProblems(workers,[{task_id:"a",worker_id:"w",hours:3}])).toEqual([]));
  it("selects only remaining hours and sums allocations", () => {
    const rows = [{task_id:"a",worker_id:"w",hours:5}];
    expect(remainingHours(workers[0],rows,"b")).toBe(3);
    expect(allocatedHours(rows,"w")).toBe(5);
  });
  it("derives legacy task labour as worker sum", () => expect(derivedLabour([{task_id:"a",worker_id:"w",hours:3},{task_id:"a",worker_id:"w2",hours:4}])).toEqual([{task_id:"a",hours:7}]));
  it("calculates value-weighted cumulative BOQ progress", () => expect(calculatedProgress([{cumulative:4,today:1.5,progress_weight:0.1}],null,false)).toBe(55));
  it("caps calculated progress at 100", () => expect(calculatedProgress([{cumulative:10,today:1,progress_weight:0.1}],null,false)).toBe(100));
  it("Completed forces 100", () => expect(calculatedProgress([],20,true)).toBe(100));
  it("zero BOQ value falls back to manual progress", () => expect(calculatedProgress([{cumulative:4,today:1,progress_weight:0}],35,false)).toBe(35));
  it("today's tasks include in-progress, planned-date, previous and current report tasks", () => {
    const base = {pct:0,planned_start:"2026-11-25",planned_finish:"2026-11-30"};
    expect(isTodaysTask(base,"2026-11-21")).toBe(false);
    expect(isTodaysTask({...base,pct:40},"2026-11-21")).toBe(true);
    expect(isTodaysTask(base,"2026-11-25")).toBe(true);
    expect(isTodaysTask({...base,previous_report:true},"2026-11-21")).toBe(true);
    expect(isTodaysTask({...base,in_report:true},"2026-11-21")).toBe(true);
  });
});