import type { AppRole } from "@/lib/roles";

export type NavSection = {
  label: string;
  items: { to: string; labelKey: string; icon: string; }[];
};

// Which roles can see each sidebar section (derived from HStack_Role_Access_Control Excel matrix)
const SECTION_ROLES: Record<string, AppRole[]> = {
  dashboard: [], // everyone
  approvals: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "site_engineer",
    "factory_floor_supervisor", "finance_manager", "accounts_executive", "hr_executive",
    "project_architect", "structural_architect", "principal_architect",
    "procurement", "stores_executive", "quantity_surveyor",
  ],
  projects: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "factory_floor_supervisor",
    "planning_engineer", "costing_engineer", "quantity_surveyor",
    "finance_manager", "procurement",
    "project_architect", "structural_architect", "principal_architect",
  ],
  production: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "site_engineer",
    "factory_floor_supervisor", "fabrication_foreman", "qc_inspector",
    "electrical_installer", "elec_plumbing_installer", "planning_engineer",
    "project_architect", "structural_architect", "principal_architect",
  ],
  site: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "site_engineer",
    "delivery_rm_lead", "factory_floor_supervisor", "fabrication_foreman",
    "qc_inspector", "electrical_installer", "elec_plumbing_installer",
    "planning_engineer", "project_architect", "structural_architect", "principal_architect",
    "procurement", "stores_executive",
  ],
  procurement: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "factory_floor_supervisor",
    "planning_engineer", "costing_engineer",
    "finance_manager", "accounts_executive",
    "procurement", "stores_executive", "principal_architect",
  ],
  finance: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head",
    "finance_manager", "accounts_executive", "costing_engineer",
    "procurement", "principal_architect",
  ],
  design: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "site_installation_mgr", "site_engineer",
    "factory_floor_supervisor", "qc_inspector", "delivery_rm_lead",
    "planning_engineer", "costing_engineer", "quantity_surveyor",
    "project_architect", "structural_architect", "principal_architect",
  ],
  sales: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head", "principal_architect",
    "sales_executive", "marketing_executive",
  ],
  business: [
    "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
    "head_operations", "production_head",
    "finance_manager", "accounts_executive", "hr_executive",
    "planning_engineer", "costing_engineer", "site_engineer",
    "procurement", "stores_executive",
    "project_architect", "structural_architect", "principal_architect",
  ],
  performance: [], // everyone sees own KPIs
  admin: [],      // everyone — HR & Attendance accessible to all; User Management filtered at item level
  system: [],     // everyone
};

// Roles that need the sidebar project selector
export const PROJECT_SELECTOR_ROLES: AppRole[] = [
  "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
  "head_operations", "production_head", "factory_floor_supervisor",
  "fabrication_foreman", "qc_inspector", "planning_engineer", "electrical_installer",
  "elec_plumbing_installer", "site_installation_mgr", "site_engineer",
  "delivery_rm_lead", "costing_engineer", "quantity_surveyor", "procurement",
  "stores_executive", "project_architect", "structural_architect", "principal_architect",
];

// Tier classification for dashboard widget layout
export function getDashboardTier(role: AppRole | null): 1 | 2 | 3 | 4 {
  if (!role) return 3;
  if (["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "principal_architect"].includes(role)) return 1;
  if (["head_operations", "production_head", "site_installation_mgr", "finance_manager"].includes(role)) return 2;
  return 3;
}

export function canSeeSection(role: AppRole | null, section: string): boolean {
  if (section === "dashboard") return true;
  const allowed = SECTION_ROLES[section];
  if (!allowed) return true;
  if (allowed.length === 0) return true; // empty array = everyone
  if (!role) return false;
  return allowed.includes(role);
}

export function canSeeProjectSelector(role: AppRole | null): boolean {
  if (!role) return false;
  return PROJECT_SELECTOR_ROLES.includes(role);
}
