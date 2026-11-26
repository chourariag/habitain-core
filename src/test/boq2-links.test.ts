import { describe, expect, it } from "vitest";
import { filterLinkLines, type LinkLine } from "@/lib/boq-links";

const line = (status: LinkLine["status"]): LinkLine => ({ id: status, sno: 1, description: "", unit: "", qty: 1, rate: 1, value: 1, linked: 0, allocated: 0, status, legacy_task_hint: null, allocations: [], links: [] });
const lines = (["complete", "skipped", "broken", "not_started", "split_incomplete", "shares_incomplete"] as const).map(line);

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
