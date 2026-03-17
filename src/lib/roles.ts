import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  managing_director: "Managing Director",
  finance_director: "Finance Director",
  sales_director: "Sales Director",
  architecture_director: "Architecture Director",
  head_operations: "Head of Operations",
  production_head: "Production Head",
  finance_manager: "Finance Manager",
  planning_engineer: "Planning Engineer",
  costing_engineer: "Costing Engineer",
  quantity_surveyor: "Quantity Surveyor",
  site_installation_mgr: "Site Installation Manager",
  delivery_rm_lead: "Delivery & R&M Lead",
  site_engineer: "Site Engineer",
  qc_inspector: "QC Inspector",
  factory_floor_supervisor: "Factory Floor Supervisor",
  fabrication_foreman: "Fabrication Foreman",
  electrical_installer: "Electrical Installer",
  elec_plumbing_installer: "Elec/Plumbing Installer",
  procurement: "Procurement",
  stores_executive: "Stores Executive",
  accounts_executive: "Accounts Executive",
  hr_executive: "HR Executive",
  project_architect: "Project Architect",
  structural_architect: "Structural Architect",
};

export const ROLE_TIERS: Record<string, AppRole[]> = {
  "Tier 0 — Super Admin": ["super_admin"],
  "Tier 1 — Directors": ["managing_director", "finance_director", "sales_director", "architecture_director"],
  "Tier 2 — Functional Heads": ["head_operations", "production_head", "finance_manager", "planning_engineer", "costing_engineer", "quantity_surveyor"],
  "Tier 3 — Site & Delivery": ["site_installation_mgr", "delivery_rm_lead", "site_engineer"],
  "Tier 4 — Factory Floor": ["qc_inspector", "factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer"],
  "Tier 5 — Procurement & Finance": ["procurement", "stores_executive", "accounts_executive"],
  "Tier 6 — HR": ["hr_executive"],
  "Architects": ["project_architect", "structural_architect"],
};

export const KIOSK_ROLES: AppRole[] = ["fabrication_foreman", "electrical_installer", "elec_plumbing_installer"];
