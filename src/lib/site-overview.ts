import { TIER1_OR_SUPER_ROLES } from "@/lib/roles";

export const SITE_OVERVIEW_ROLES = [...TIER1_OR_SUPER_ROLES, "head_of_projects", "planning_head", "finance_manager", "quantity_surveyor", "costing_engineer", "site_installation_mgr", "head_operations", "production_head"] as const;
export const OVERVIEW_POLL_MS = 60_000;
export const FACTORY_REST_ISO_DAY = 7;
export const canOpenSiteOverview = (role: string | null | undefined) => !!role && (SITE_OVERVIEW_ROLES as readonly string[]).includes(role);
export function overviewToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const overviewTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value)) : "—";
export type OverviewCost = { attendance: number; subcontract: number; consumables: number; expenses: number };
export const overviewCostTotal = (cost: OverviewCost) => cost.attendance + cost.subcontract + cost.consumables + cost.expenses;
export type OverviewActivity = { code: string | null; name: string; stage: string | null; progress: number; status: string | null; remarks: string | null; hours: number };
export type OverviewRow = {
  kind: "site" | "factory"; project_id: string | null; name: string; report_id: string | null;
  expected?: boolean; status: "Not started" | "Draft" | "Submitted"; who: string | null;
  last_update: string | null; activities: number; people: number; hours: number; cost?: OverviewCost;
  report: { notes: string | null; activities: OverviewActivity[]; workers: { name: string; hours: number }[];
    quantities: { item: string; qty: number; unit: string | null }[]; expenses: { kind: string; description: string; amount?: number }[] };
};
export type SiteOverviewData = {
  date: string; kpis: { sites_expected: number; sites_submitted: number; sites_draft: number; factory_status: string | null;
    activities: number; people_working: number; labour_hours: number; cost?: { site?: number; factory?: number } };
  sites: OverviewRow[]; factory: OverviewRow | null; rows: OverviewRow[];
  feed: { time: string; who: string | null; location: string; kind: string; project_id: string | null;
    code: string | null; name: string | null; stage: string | null; hours: number; quantities: string[] }[];
};