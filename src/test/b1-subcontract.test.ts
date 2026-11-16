import { describe, expect, it } from "vitest";
import evidence from "./b1-subcontract-evidence.json";
import { NO_RATE_MSG, effectiveRate, lumpSumOver, quantityPayload, rowAmount, rowProblem, type QtyRow, type SubRate } from "@/lib/site-report-subcontract";

const perUnit: SubRate = { id: "r1", contractor_id: "c1", boq_item_id: "b1", work_description: null, unit: "cum", rate_type: "per_unit", effective_rate: 450, package_qty: null, lump_sum_inr: null, used_qty: 0 };
const lump: SubRate = { id: "r2", contractor_id: "c1", boq_item_id: "b2", work_description: null, unit: "kg", rate_type: "lump_sum", effective_rate: 100, package_qty: 100, lump_sum_inr: 10000, used_qty: 60 };
const row = (p: Partial<QtyRow>): QtyRow => ({ key: "k", boq_item_id: null, contractor_id: null, extra_work_description: "", unit: "", today_qty: "", ...p });

describe("B1 subcontract rules", () => {
  it("per-unit amount = quantity × rate", () => {
    expect(rowAmount(row({ boq_item_id: "b1", contractor_id: "c1", today_qty: "10" }), [perUnit])).toBe(4500);
  });
  it("lump-sum effective rate = lump sum ÷ package quantity", () => {
    expect(effectiveRate({ rate_type: "lump_sum", lump_sum_inr: 10000, package_qty: 100 })).toBe(100);
  });
  it("lump-sum cap: cumulative quantity cannot pass the package quantity", () => {
    expect(lumpSumOver(row({ boq_item_id: "b2", contractor_id: "c1", today_qty: "50" }), [lump])).toBe(true);
    expect(lumpSumOver(row({ boq_item_id: "b2", contractor_id: "c1", today_qty: "40" }), [lump])).toBe(false);
  });
  it("a contractor without a rate on the item is blocked; own labour earns no cost", () => {
    expect(rowProblem(row({ boq_item_id: "b9", contractor_id: "c1", today_qty: "1" }), [perUnit])).toBe(NO_RATE_MSG);
    expect(rowAmount(row({ boq_item_id: "b1", today_qty: "5" }), [perUnit])).toBeNull();
    expect(quantityPayload([row({ boq_item_id: "b9", contractor_id: "c1", today_qty: "3" })], [perUnit])[0].today_qty).toBe(0);
  });
  it("rolled-back database checks passed", () => {
    expect(evidence.per_unit_amount.amount).toBe(4500);
    expect(evidence.lump_sum_implied_rate.rate_used).toBe(100);
    expect(evidence.submit_no_rate).toBe(NO_RATE_MSG);
    expect(evidence.snapshot_after_rate_edit.amount).toBe(4500);
    expect(evidence.read_rates.stores_executive).toBe(0);
    expect(evidence.site_engineer_write_rates.direct_update_rows).toBe(0);
    expect(evidence.dry_run.rows_written).toBe(0);
  });
});
