import { afterEach, describe, expect, it, vi } from "vitest";
import { createReportAutosave, reportTaskStatus } from "@/lib/site-report-autosave";
import { calculatedProgress } from "@/lib/site-report-task-workers";
afterEach(() => vi.useRealTimers());
describe("report scope autosave", () => {
  it("flushes the current date edit before loading the next date", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const saver = createReportAutosave();
    saver.schedule(async () => { events.push("save:21/11/2026:edited notes"); });
    await saver.flush(); events.push("load:20/11/2026");
    await vi.advanceTimersByTimeAsync(900);
    expect(events).toEqual(["save:21/11/2026:edited notes", "load:20/11/2026"]);
  });
  it("waits for an in-flight save and saves newer edits before project switch", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    let finish: (() => void) | undefined;
    const saver = createReportAutosave();
    saver.schedule(() => new Promise<void>(resolve => { events.push("start:project A"); finish = () => { events.push("saved:project A"); resolve(); }; }));
    await vi.advanceTimersByTimeAsync(900);
    saver.schedule(async () => { events.push("latest:project A"); });
    const switchProject = saver.flush().then(() => events.push("load:project B"));
    expect(events).toEqual(["start:project A"]);
    finish?.(); await switchProject;
    expect(events).toEqual(["start:project A", "saved:project A", "latest:project A", "load:project B"]);
  });
  it("propagates a failed flush instead of loading another scope", async () => {
    const saver = createReportAutosave();
    saver.schedule(async () => { throw new Error("Save failed"); });
    await expect(saver.flush()).rejects.toThrow("Save failed");
  });
});
describe("calculated task status", () => {
  it("100% is Completed automatically", () => expect(reportTaskStatus(calculatedProgress([{ cumulative: 12, today: 3, progress_weight: 1/12 }], null, false))).toBe("completed"));
  it("falling below 100% returns to Ongoing", () => expect(reportTaskStatus(calculatedProgress([{ cumulative: 0, today: 11, progress_weight: 1/12 }], null, false))).toBe("ongoing"));
  it("choosing Completed forces 100%", () => expect(calculatedProgress([], 20, true)).toBe(100));
});