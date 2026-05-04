import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  managing_director: "Managing Director",
  finance_director: "Finance Director",
  sales_director: "Sales Director",
  architecture_director: "Architecture Director",
  head_operations: "Head of Operations",
  head_of_projects: "Head of Projects",
  production_head: "Production Head",
  finance_manager: "Finance Manager",
  planning_engineer: "Planning Engineer",
  planning_head: "Planning & Operations Head",
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
  procurement: "Purchase Head",
  procurement_assistant: "Procurement Assistant",
  stores_executive: "Stores Manager",
  accounts_executive: "Accounts Executive",
  hr_executive: "HR Executive",
  hr_admin: "HR Admin",
  marketing: "Marketing",
  sales_executive: "Sales Executive",
  logistics_manager: "Logistics & Facilities Manager",
  principal_architect: "Principal Architect",
  project_architect: "Project Architect",
  structural_architect: "Structural Architect",
};

export const ROLE_TIERS: Record<string, AppRole[]> = {
  "Tier 0 — Super Admin": ["super_admin" as AppRole],
  "Tier 1 — Directors & MD": ["managing_director", "finance_director", "sales_director", "architecture_director"] as AppRole[],
  "Tier 2 — Functional Heads": ["head_operations", "head_of_projects" as AppRole, "planning_head" as AppRole, "production_head", "finance_manager", "planning_engineer", "costing_engineer", "quantity_surveyor"] as AppRole[],
  "Tier 3 — Site & Delivery": ["site_installation_mgr", "delivery_rm_lead", "site_engineer", "logistics_manager" as AppRole] as AppRole[],
  "Tier 4 — Factory Floor": ["qc_inspector", "factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer"] as AppRole[],
  "Tier 5 — Procurement & Finance": ["procurement", "procurement_assistant" as AppRole, "stores_executive", "accounts_executive"] as AppRole[],
  "Tier 6 — HR & Marketing": ["hr_executive", "hr_admin" as AppRole, "marketing" as AppRole, "sales_executive" as AppRole] as AppRole[],
  "Architects": ["principal_architect", "project_architect", "structural_architect"] as AppRole[],
};

export const KIOSK_ROLES: AppRole[] = ["fabrication_foreman", "electrical_installer", "elec_plumbing_installer"];
