import { describe, expect, it } from "vitest";
import { canViewRunningBill, runningBillSheets, totalsOf, type RunningBill } from "@/lib/running-bill";

const bill: RunningBill = {
  as_of: "2026-10-31", reports: 2,
  work: [{ sno: 1, item_description: "Concrete", unit: "cum", boq_qty: 10, qty: 8, own_qty: 8, sub_qty: 0, pct_done: 80, boq_rate: 5000, value: 40000 }],
  labour_by_day: [{ work_date: "2026-10-01", workers: 2, hours: 14, amount: 1288.46, cumulative: 1288.46 }, { work_date: "2026-10-02", workers: 1, hours: 8, amount: 653.84, cumulative: 1942.3 }],
  labour_by_contractor: [{ contractor: "Direct", workers: 1, hours: 6, amount: 500 }],
  labour_by_task: [{ code: "", task: "Unallocated", task_hours: 0, amount: 653.84 }],
  subcontract: [{ contractor: "SHIV", boq_code: "2", item: "Steel", unit: "kg", rate_type: "per_unit", qty: 14, rate_used: 450, amount: 6300, lump_sum: null, package_qty: null, pct_consumed: null }],
  totals: { value_earned: 40000, own_labour_cost: 1942.3, subcontract_accrued: 6300 },
};

describe("Running Bill", () => {
  it("is visible only to the listed roles", () => {
    for (const r of ["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin", "finance_manager", "head_of_projects", "planning_head", "quantity_surveyor", "costing_engineer"]) expect(canViewRunningBill(r)).toBe(true);
    for (const r of ["site_engineer", "stores_executive", "chairman", "site_installation_mgr", null]) expect(canViewRunningBill(r)).toBe(false);
  });
  it("totals equal the section sums", () => {
    expect(totalsOf(bill)).toEqual({ value: 40000, labour: 1942.3, sub: 6300 });
  });
  it("Excel uses DD/MM/YYYY and plain numbers", () => {
    const s = runningBillSheets(bill);
    expect(s["B Own labour by day"][1][0]).toBe("01/10/2026");
    expect(s["C Subcontract"][1][7]).toBe(6300);
    expect(JSON.stringify(s)).not.toContain("₹");
  });
  it("labels exact worker allocation without changing totals", () => {
    const updated = {...bill,labour_by_task:[{code:"T1",task:"Concrete",task_hours:3,amount:300,allocation:"Exact" as const},{code:"",task:"Unallocated",task_hours:5,amount:1642.3,allocation:"Exact" as const}]};
    expect(runningBillSheets(updated)["B Approx by task"][2]).toEqual(["T1","Concrete",3,300,"Exact"]);
    expect(totalsOf(updated)).toEqual(totalsOf(bill));
  });
});
