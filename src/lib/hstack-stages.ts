// Authoritative HStack stage list (Habitainer Hybrid).
// 15 factory stages filled by Karthik in the Project Setup Template.
// 8 site stages entered separately by Awaiz in Site Hub → Schedule.

export interface HStackStage {
  number: number;
  name: string;
  parallel?: string;        // "(runs PARALLEL to X)"
  na_eligible?: boolean;    // can be marked N/A in Notes column at template fill
  scope: "factory" | "site";
  task_summary: string;     // human-readable task ID range shown as a hint
  phase: string;            // high-level grouping
}

export const FACTORY_STAGES: HStackStage[] = [
  { number: 1,  name: "Main Frame",                 scope: "factory", phase: "Factory Production",
    task_summary: "3A.1–3A.6, 3B.1–3B.5, 3C.1–3C.5, 3E.1–3E.3, 3F.1–3F.5, 3G.1–3G.7" },
  { number: 2,  name: "Sub Frame — Panel Production", parallel: "Main Frame", scope: "factory", phase: "Panel Production",
    task_summary: "P2.1–P2.33-HY (runs in Panel Bay simultaneously with Module Bay)" },
  { number: 3,  name: "Drywall Works Completion",   scope: "factory", phase: "Factory Production",
    task_summary: "3H.1–3H.4, HY.2–HY.2.6, 3K.1–3K.4, 3L.1–3L.3, 3O.5–3O.6" },
  { number: 4,  name: "MEP Rough In",               scope: "factory", phase: "Factory Production",
    task_summary: "HY.4.1–HY.4.5" },
  { number: 5,  name: "Internal Painting",          scope: "factory", phase: "Factory Production",
    task_summary: "3L.4, 3O.1–3O.2, 3R.1–3R.3" },
  { number: 6,  name: "Tiling", parallel: "Internal Painting", scope: "factory", phase: "Factory Production",
    task_summary: "3M.1–3M.6, 3O.4" },
  { number: 7,  name: "Exterior Wall Finishing",    scope: "factory", phase: "Factory Production",
    task_summary: "3N.1–3N.2" },
  { number: 8,  name: "Internal Wall Finishing", na_eligible: true, scope: "factory", phase: "Factory Production",
    task_summary: "3N.3 (case-by-case — depends on interiors selected)" },
  { number: 9,  name: "Carpentry",                  scope: "factory", phase: "Factory Production",
    task_summary: "3O.3" },
  { number: 10, name: "MEP Final",                  scope: "factory", phase: "Factory Production",
    task_summary: "3P.2–3P.10" },
  { number: 11, name: "Windows & Doors",            scope: "factory", phase: "Factory Production",
    task_summary: "3Q.1–3Q.6" },
  { number: 12, name: "Finishing",                  scope: "factory", phase: "Factory Production",
    task_summary: "3R.4 (+ Builder Finish payment milestone)" },
  { number: 13, name: "Snagging",                   scope: "factory", phase: "Factory Production",
    task_summary: "3R.6–3R.7 — Production Head → Planning Head" },
  { number: 14, name: "QC Inspection",              scope: "factory", phase: "QC + Dispatch",
    task_summary: "4.1–4.2 — full QC + NCR closure" },
  { number: 15, name: "Dispatch",                   scope: "factory", phase: "QC + Dispatch",
    task_summary: "4.3–4.12 — 3-part delivery checklist sign-off required" },
];

export const SITE_STAGES: HStackStage[] = [
  { number: 16, name: "Erection",                       scope: "site", phase: "Site Installation", task_summary: "5.1–5.10" },
  { number: 17, name: "Marriage Line",                  scope: "site", phase: "Site Installation", task_summary: "5.11–5.12" },
  { number: 18, name: "On Site External Finishing",     scope: "site", phase: "Site Installation", task_summary: "5.13–5.15, 5.24" },
  { number: 19, name: "Steel Extensions", na_eligible: true, scope: "site", phase: "Site Installation", task_summary: "5.16–5.17 (case-by-case)" },
  { number: 20, name: "On Site MEP",                    scope: "site", phase: "Site Installation", task_summary: "5.18–5.21, 5.25, 5.30–5.31" },
  { number: 21, name: "On Site Internal Finishing",     scope: "site", phase: "Site Installation", task_summary: "5.22–5.23, 5.26–5.29" },
  { number: 22, name: "Snagging (Site)",                scope: "site", phase: "Site Installation", task_summary: "6.1–6.3" },
  { number: 23, name: "Handover",                       scope: "site", phase: "Site Installation", task_summary: "6.4–6.12" },
];

export const ALL_STAGES = [...FACTORY_STAGES, ...SITE_STAGES];
