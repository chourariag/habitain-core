import type { AppRole } from "@/lib/roles";
import { KPI_VISIBLE_ROLES } from "@/lib/kpi-helpers";

// Roles that see everything
const FULL_ACCESS: AppRole[] = ["super_admin", "managing_director"];
const DIRECTORS: AppRole[] = [...FULL_ACCESS, "finance_director", "sales_director", "architecture_director"];

export type NavSection = {
  label: string;
  items: { to: string; labelKey: string; icon: string; }[];
};

// Which roles can see each sidebar section
const SECTION_ROLES: Record<string, AppRole[]> = {
  dashboard: [], // everyone
  projects: [
    ...DIRECTORS, "head_operations", "production_head", "site_installation_mgr",
    "finance_manager", "planning_engineer", "costing_engineer", "quantity_surveyor",
  ],
  production: [
    ...DIRECTORS, "head_operations", "production_head", "factory_floor_supervisor",
    "fabrication_foreman", "qc_inspector", "planning_engineer", "electrical_installer",
    "elec_plumbing_installer",
  ],
  procurement: [
    ...DIRECTORS, "head_operations", "procurement", "stores_executive",
    "costing_engineer", "finance_manager",
  ],
  design: [
    ...DIRECTORS, "principal_architect", "project_architect", "structural_architect",
  ],
  business: [
    ...DIRECTORS, "sales_director", "finance_director", "finance_manager",
    "accounts_executive", "delivery_rm_lead",
  ],
  performance: KPI_VISIBLE_ROLES,
  admin: [
    ...DIRECTORS, "hr_executive", "head_operations",
  ],
};

// Roles that need the sidebar project selector
export const PROJECT_SELECTOR_ROLES: AppRole[] = [
  ...DIRECTORS, "head_operations", "production_head", "factory_floor_supervisor",
  "fabrication_foreman", "qc_inspector", "planning_engineer", "electrical_installer",
  "elec_plumbing_installer", "site_installation_mgr", "site_engineer",
  "delivery_rm_lead", "costing_engineer", "quantity_surveyor", "procurement",
  "stores_executive",
];

// Tier classification for dashboard
export function getDashboardTier(role: AppRole | null): 1 | 2 | 3 | 4 {
  if (!role) return 3;
  if (FULL_ACCESS.includes(role) || ["finance_director", "sales_director", "architecture_director"].includes(role)) return 1;
  if (["production_head", "head_operations", "site_installation_mgr", "finance_manager"].includes(role)) return 2;
  if (["principal_architect", "project_architect", "structural_architect"].includes(role)) return 4;
  return 3;
}

export function canSeeSection(role: AppRole | null, section: string): boolean {
  if (section === "dashboard") return true;
  const allowed = SECTION_ROLES[section];
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}

export function canSeeProjectSelector(role: AppRole | null): boolean {
  if (!role) return false;
  return PROJECT_SELECTOR_ROLES.includes(role);
}
