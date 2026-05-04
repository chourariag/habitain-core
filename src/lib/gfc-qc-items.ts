// Fix 5: Karan/Venkat 18-point GFC QC checklist items
export const GFC_QC_ITEMS: string[] = [
  "All drawing sheets complete and indexed",
  "Module dimensions confirmed vs factory standard",
  "Structural calculations reviewed and signed",
  "MEP routing confirmed — no clashes",
  "BOQ aligned with drawings",
  "All DQs from previous designs addressed",
  "Client brief fully reflected in drawings",
  "Floor plans complete — all levels",
  "Elevations complete — all four sides",
  "Sections complete — minimum 2",
  "Structural drawings complete and stamped",
  "MEP drawings complete — electrical",
  "MEP drawings complete — plumbing",
  "MEP drawings complete — HVAC",
  "Module cutting list issued",
  "Finish schedule issued",
  "Door and window schedule issued",
  "Installation sequence drawing complete",
];

// Fix 1: Design stage progression (Brief → ... → As-Builts)
export const DESIGN_STAGE_ORDER = [
  "brief",
  "concept",
  "schematic",
  "design_dev",
  "gfc",
  "h1_issued",
  "h2_issued",
  "as_builts",
] as const;

export type DesignStageKey = (typeof DESIGN_STAGE_ORDER)[number];

export const DESIGN_STAGE_LABELS: Record<DesignStageKey, string> = {
  brief: "Brief",
  concept: "Concept",
  schematic: "Schematic",
  design_dev: "Design Dev",
  gfc: "GFC",
  h1_issued: "H1 Issued",
  h2_issued: "H2 Issued",
  as_builts: "As-Builts",
};
