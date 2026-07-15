// Factory production stage-gate logic.
// Maps a stage name to the GFC sign-off it requires (H1 / H2 / H3),
// and evaluates whether a stage can be started for a given project/module.

export type GfcGate = "H1" | "H2" | "H3" | null;

/** Map a free-form stage name to the GFC drawing approval it requires. */
export function requiredGfcForStage(stageName: string | null | undefined): GfcGate {
  if (!stageName) return null;
  const s = stageName.toLowerCase();
  // H3 — interior / finishing
  if (/joinery|carpent|paint|interior|tiling|cladding|habit\s*board|sanitary fixture|finishing|finish/.test(s))
    return "H3";
  // H2 — MEP & second-fix
  if (/mep|electrical|plumb|hvac|sanitary|pressure\s*test|second\s*fix|rough[-\s]?in/.test(s))
    return "H2";
  // H1 — frame / fabrication
  if (/sub[-\s]?frame|frame\s*fab|frame\s*assembly|deck|anti[-\s]?corros|lgsf|moisture|cera\s*board|insulation|drywall/.test(s))
    return "H1";
  return null;
}

/** Map GFC code (H1/H2/H3) to the `gfc_stage` value stored in `gfc_records`. */
export function gfcRecordStage(g: Exclude<GfcGate, null>): string {
  return g === "H1" ? "advance_h1" : g === "H2" ? "final_h2" : "interior_h3";
}

export interface GateContext {
  /** Set of GFC codes (H1/H2/H3) the project has approved. */
  approvedGfc: Set<"H1" | "H2" | "H3">;
  /** Whether project setup is approved by Planning Head + HoP. */
  projectSetupApproved: boolean;
  /**
   * Ordered list of production_stages for the module with their status.
   * Required to evaluate "previous stage QC passed".
   */
  moduleStages: { stage_name: string; stage_order: number; status: string | null }[];
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
}

/** Evaluate all gates for advancing a module into `targetStage`. */
export function evaluateStageGate(targetStage: string, ctx: GateContext): GateResult {
  // Gate 5 — Project Setup approved
  if (!ctx.projectSetupApproved) {
    return {
      allowed: false,
      reason: "Project Setup not yet approved by Planning Head and Head of Projects.",
    };
  }

  // Gate 1/2/3 — GFC drawings
  const need = requiredGfcForStage(targetStage);
  if (need && !ctx.approvedGfc.has(need)) {
    const who =
      need === "H3"
        ? " by Principal Architect"
        : need === "H1"
        ? " by Principal Architect"
        : "";
    return {
      allowed: false,
      reason: `${need} drawings not yet approved.${
        need === "H1" ? " Awaiting GFC H1 sign-off" + who + "." : ""
      }`.trim(),
    };
  }

  // Gate 4 — Previous stage QC passed
  const sorted = [...ctx.moduleStages].sort((a, b) => a.stage_order - b.stage_order);
  const targetIdx = sorted.findIndex((s) => s.stage_name === targetStage);
  if (targetIdx > 0) {
    const prev = sorted[targetIdx - 1];
    if (prev.status !== "qc_passed" && prev.status !== "completed") {
      return {
        allowed: false,
        reason: `${prev.stage_name} QC inspection not yet complete. Must pass inspection before this stage can begin.`,
      };
    }
  }

  return { allowed: true };
}

// PROVISIONAL THRESHOLDS: 5%/10% wastage bands are placeholders pending Finance sign-off.
// Also disagrees with ProjectPLTab (finance/) which uses 10% overhead vs
// ProjectPLTab (projects/), WIPStatement and FactoryMeasurementSheet at 5%.
// TODO(finance): confirm and move to a single central config.
export function flagLevelForWastage(pct: number): "green" | "amber" | "red" {
  if (pct > 10) return "red";
  if (pct >= 5) return "amber";
  return "green";
}
