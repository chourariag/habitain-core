import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/site-report-photo", () => ({ readPhotoMeta: vi.fn(), compressPhoto: vi.fn() }));
import { computeWarnings, reasonOk, receiptPath, matchProject, daysOld } from "@/lib/expense-policy";

const today = new Date(2026, 10, 15);
describe("expense policy", () => {
  it("7 days old is fine, 8 days warns", () => {
    expect(daysOld(new Date(2026, 10, 8), today)).toBe(7);
    expect(computeWarnings({ entryDate: new Date(2026, 10, 8), today, receiptMissing: false, duplicate: false })).toEqual([]);
    expect(computeWarnings({ entryDate: new Date(2026, 10, 7), today, receiptMissing: false, duplicate: false })).toEqual(["older_than_7_days"]);
  });
  it("duplicate and missing receipt warn", () => {
    expect(computeWarnings({ entryDate: today, today, receiptMissing: true, duplicate: true })).toEqual(["duplicate", "receipt_missing"]);
  });
  it("cap only applies when defined", () => {
    expect(computeWarnings({ entryDate: today, today, receiptMissing: false, duplicate: false, categoryCap: null, amount: 99999 })).toEqual([]);
    expect(computeWarnings({ entryDate: today, today, receiptMissing: false, duplicate: false, categoryCap: 500, amount: 501 })).toEqual(["over_category_cap"]);
  });
  it("reason needs at least 5 characters", () => {
    expect(reasonOk(" abcd ")).toBe(false);
    expect(reasonOk("abcde")).toBe(true);
  });
  it("receipt path is <user>/<yyyy-mm>/<file>", () => {
    expect(receiptPath("u1", new Date(2026, 0, 3), "x")).toMatch(/^u1\/2026-01\/\d+-x\.jpg$/);
  });
  it("project code matches name or id, unknown is null", () => {
    const ps = [{ id: "abc", name: "Test project - 1" }];
    expect(matchProject("test PROJECT - 1", ps)?.id).toBe("abc");
    expect(matchProject("nope", ps)).toBeNull();
  });
});
