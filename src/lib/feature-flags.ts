export type FeatureFlagDefinition = {
  key: string;
  label: string;
  wave: number;
  enabled: boolean;
};

const enabledKeys = new Set([
  "projects",
  "attendance",
  "expenses",
  "labour",
  "site_report",
  "project_setup",
  "procurement",
  "reminders",
  "exports",
  "user_admin",
]);

const waveTwoKeys = new Set([
  "inventory",
  "equipment",
  "compliance",
  "leave",
  "holidays",
  "advances",
  "training",
  "factory_feedback",
]);

const waveThreeKeys = new Set([
  "design_schedule",
  "gfc",
  "work_orders",
  "client_work_orders",
  "design_fees",
]);

const knownFlags: Array<[string, string]> = [
  ["projects", "Projects"],
  ["attendance", "Attendance"],
  ["expenses", "Expenses"],
  ["labour", "Labour"],
  ["site_report", "Site Reports"],
  ["project_setup", "Project Setup"],
  ["procurement", "Procurement"],
  ["site", "Site Hub"],
  ["reminders", "Reminders"],
  ["exports", "Exports"],
  ["user_admin", "User Administration"],
  ["production", "Production"],
  ["dispatch", "Dispatch"],
  ["design_schedule", "Design Schedule"],
  ["gfc", "GFC"],
  ["quality", "Quality Control"],
  ["finance", "Finance"],
  ["sales", "Sales"],
  ["approvals", "Approvals"],
  ["announcements", "Announcements"],
  ["reports", "Management Reports"],
  ["inventory", "Inventory"],
  ["equipment", "Equipment"],
  ["compliance", "Compliance"],
  ["leave", "Leave"],
  ["holidays", "Holidays"],
  ["advances", "Advances"],
  ["training", "Training"],
  ["factory_feedback", "Factory Feedback"],
  ["work_orders", "Work Orders"],
  ["client_work_orders", "Client Work Orders"],
  ["design_fees", "Design Fees"],
  ["payroll", "Payroll"],
  ["ai_photo", "AI Photo Review"],
  ["kpis", "KPIs"],
];

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = knownFlags.map(([key, label]) => ({
  key,
  label,
  wave: waveTwoKeys.has(key) ? 2 : waveThreeKeys.has(key) ? 3 : 4,
  enabled: enabledKeys.has(key),
}));

export const FEATURE_FLAG_LABELS = Object.fromEntries(
  FEATURE_FLAG_DEFINITIONS.map(({ key, label }) => [key, label]),
);

export const FEATURE_FLAG_BY_MODULE: Record<string, string> = {
  projects: "projects",
  factory: "production",
  site: "site_report",
  procurement: "procurement",
  finance: "finance",
  hr: "attendance",
  sales: "sales",
  design: "design_schedule",
  qc: "compliance",
  dispatch: "dispatch",
  announcements: "announcements",
  approvals: "approvals",
  admin: "user_admin",
  reports: "reports",
};

const SITE_TAB_FLAGS: Record<string, string> = {
  drawings: "gfc",
  handover: "dispatch",
  "client-visits": "sales",
  subcontractors: "labour",
  "punch-list": "compliance",
  "work-orders": "work_orders",
  "factory-feedback": "factory_feedback",
  "dispatch-packs": "dispatch",
  "site-inventory": "inventory",
  labour: "labour",
  "install-seq": "design_schedule",
  safety: "compliance",
  materials: "procurement",
};

export function featureFlagForSiteTab(tab: string | null): string | undefined {
  return tab ? SITE_TAB_FLAGS[tab] : undefined;
}

export function featureFlagForModule(module: string): string | undefined {
  return FEATURE_FLAG_BY_MODULE[module];
}
