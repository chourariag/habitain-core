import { describe, expect, it } from "vitest";
import { boqLockedLinkNotice, filterLinkLines, type LinkLine, type LinkState } from "@/lib/boq-links";

const line = (status: LinkLine["status"]): LinkLine => ({ id: status, sno: 1, description: "", unit: "", qty: 1, rate: 1, value: 1, linked: 0, allocated: 0, status, legacy_task_hint: null, allocations: [], links: [] });
const lines = (["complete", "skipped", "broken", "not_started", "split_incomplete", "shares_incomplete"] as const).map(line);

const lockedState = (revisionNeeded: boolean): Pick<LinkState, "set" | "revision_needed" | "lines"> => ({
  set: { status: "locked", version: 1 },
  revision_needed: revisionNeeded,
  lines: [line("broken"), line("shares_incomplete"), line("complete"), line("skipped")],
});

describe("BOQ locked-link notices", () => {
  it("gives the revision instruction and affected line count for a locked broken set", () => {
    expect(boqLockedLinkNotice(lockedState(true))).toBe("Revision needed: 2 line(s) have broken or incomplete links. Open each line below, fix it, then Submit revision.");
  });
  it("keeps the already-locked message only for a locked complete set", () => {
    expect(boqLockedLinkNotice(lockedState(false))).toBe("Links are already locked.");
    expect(boqLockedLinkNotice({ ...lockedState(false), set: { status: "draft", version: 0 } })).toBeNull();
  });
});

describe("BOQ link line filters", () => {
  it("needs work excludes complete and zero-quantity lines", () => {
    expect(filterLinkLines(lines, "needs_work").map(l => l.status)).toEqual(["broken", "not_started", "split_incomplete", "shares_incomplete"]);
  });
  it("broken shows only broken lines", () => {
    expect(filterLinkLines(lines, "broken").map(l => l.status)).toEqual(["broken"]);
  });
  it("all keeps every line", () => {
    expect(filterLinkLines(lines, "all")).toHaveLength(6);
  });
});
