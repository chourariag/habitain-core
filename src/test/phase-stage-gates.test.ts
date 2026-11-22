import { afterEach, describe, expect, it, vi } from "vitest";
import type { GateContext } from "@/lib/stage-gates";

async function gateEvaluator(enforced: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/phase-flags", () => ({ PREPROD_GATES_ENFORCED: enforced }));
  return (await import("@/lib/stage-gates")).evaluateStageGate;
}
afterEach(() => { vi.doUnmock("@/lib/phase-flags"); vi.resetModules(); });
const context = (): GateContext => ({ approvedGfc: new Set(), projectSetupApproved: false, moduleStages: [] });

describe("reversible Phase 1 stage gates", () => {
  it("ships with pre-production enforcement off", async () => {
    vi.doUnmock("@/lib/phase-flags");
    expect((await import("@/lib/phase-flags")).PREPROD_GATES_ENFORCED).toBe(false);
  });
  for (const [code, stage] of [["H1", "Sub-Frame"], ["H2", "MEP Rough-In"], ["H3", "Interior Finishing"]] as const) {
    it(`off allows ${code} with no Setup approval or GFC sign-off`, async () => {
      expect((await gateEvaluator(false))(stage, context()).allowed).toBe(true);
    });
    it(`on restores ${code} blocking until its sign-off exists`, async () => {
      const evaluate = await gateEvaluator(true);
      const ctx = { ...context(), projectSetupApproved: true };
      expect(evaluate(stage, ctx).allowed).toBe(false);
      ctx.approvedGfc.add(code);
      expect(evaluate(stage, ctx).allowed).toBe(true);
    });
  }
  it("on restores Setup approval blocking even for a stage with no GFC mapping", async () => {
    const evaluate = await gateEvaluator(true);
    const ctx = context();
    expect(evaluate("Packing", ctx).allowed).toBe(false);
    ctx.projectSetupApproved = true;
    expect(evaluate("Packing", ctx).allowed).toBe(true);
  });
  for (const enforced of [false, true]) {
    for (const status of ["pending", "in_progress", "qc_failed", null]) {
      it(`${enforced ? "on" : "off"} keeps previous-stage QC blocking for ${status}`, async () => {
        const ctx: GateContext = { projectSetupApproved: true, approvedGfc: new Set(["H2"]), moduleStages: [
          { stage_name: "Sub-Frame", stage_order: 1, status },
          { stage_name: "MEP Rough-In", stage_order: 2, status: "pending" },
        ] };
        expect((await gateEvaluator(enforced))("MEP Rough-In", ctx).allowed).toBe(false);
      });
    }
    for (const status of ["qc_passed", "completed"]) {
      it(`${enforced ? "on" : "off"} accepts existing previous-stage completion ${status}`, async () => {
        const ctx: GateContext = { projectSetupApproved: true, approvedGfc: new Set(["H2"]), moduleStages: [
          { stage_name: "MEP Rough-In", stage_order: 2, status: "pending" },
          { stage_name: "Sub-Frame", stage_order: 1, status },
        ] };
        expect((await gateEvaluator(enforced))("MEP Rough-In", ctx).allowed).toBe(true);
      });
    }
  }
});