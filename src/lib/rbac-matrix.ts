// HStack Role-Based Access Control — Module-Level Matrix
// Source of truth: HStack_Role_Access_Control.xlsx
//
// 15 modules × every role → one of FULL / VIEW / MANAGE / NONE.
// FULL  = view + create + edit + approve + delete + export + settings
// MANAGE= view + create + edit + approve, scoped to direct reportees (no delete/export)
// VIEW  = read-only, own records only
// NONE  = hidden from sidebar; URL access redirects to /dashboard

import type { AppRole } from "@/lib/roles";

export type AccessLevel = "FULL" | "MANAGE" | "VIEW" | "NONE";

export type ModuleKey =
  | "dashboard"
  | "projects"
  | "factory"
  | "site"
  | "procurement"
  | "finance"
  | "hr"
  | "sales"
  | "design"
  | "qc"
  | "dispatch"
  | "announcements"
  | "approvals"
  | "admin"
  | "reports";

export const MODULE_KEYS: ModuleKey[] = [
  "dashboard","projects","factory","site","procurement","finance","hr",
  "sales","design","qc","dispatch","announcements","approvals","admin","reports",
];

type ModuleAccess = Record<ModuleKey, AccessLevel>;

const FULL_ALL: ModuleAccess = {
  dashboard:"FULL",projects:"FULL",factory:"FULL",site:"FULL",procurement:"FULL",
  finance:"FULL",hr:"FULL",sales:"FULL",design:"FULL",qc:"FULL",dispatch:"FULL",
  announcements:"FULL",approvals:"FULL",admin:"FULL",reports:"FULL",
};

const m = (
  dashboard: AccessLevel, projects: AccessLevel, factory: AccessLevel, site: AccessLevel,
  procurement: AccessLevel, finance: AccessLevel, hr: AccessLevel, sales: AccessLevel,
  design: AccessLevel, qc: AccessLevel, dispatch: AccessLevel, announcements: AccessLevel,
  approvals: AccessLevel, admin: AccessLevel, reports: AccessLevel,
): ModuleAccess => ({
  dashboard,projects,factory,site,procurement,finance,hr,sales,design,qc,dispatch,
  announcements,approvals,admin,reports,
});

// Per-role access. Roles missing here fall back to a safe minimal default.
// Order matches the Excel matrix columns: Dash | Proj | Fact | Site | Proc | Fin | HR | Sales | Design | QC | Disp | Ann | Appr | Admin | Reports
export const ROLE_ACCESS_MATRIX: Partial<Record<AppRole, ModuleAccess>> = {
  // Tier 0 / 1 — full access
  super_admin: FULL_ALL,
  managing_director: FULL_ALL,

  // Chairman — view-only across the board, announcements full
  chairman:
    m("FULL","VIEW","VIEW","VIEW","VIEW","VIEW","VIEW","VIEW","VIEW","VIEW","VIEW","FULL","VIEW","VIEW","VIEW"),

  // Directors (matrix has separate values, but role enum only carries one per dept)
  sales_director:
    m("FULL","VIEW","VIEW","VIEW","VIEW","VIEW","FULL","FULL","VIEW","VIEW","VIEW","FULL","FULL","NONE","VIEW"),
  architecture_director:
    m("FULL","VIEW","VIEW","VIEW","VIEW","VIEW","FULL","VIEW","FULL","VIEW","VIEW","FULL","FULL","NONE","VIEW"),
  finance_director:
    m("FULL","VIEW","VIEW","VIEW","VIEW","FULL","FULL","VIEW","VIEW","VIEW","VIEW","FULL","FULL","NONE","FULL"),

  // Heads
  head_of_projects:
    m("FULL","FULL","FULL","FULL","FULL","VIEW","MANAGE","VIEW","VIEW","FULL","FULL","FULL","FULL","NONE","FULL"),
  planning_head:
    m("FULL","FULL","FULL","FULL","FULL","VIEW","MANAGE","VIEW","VIEW","VIEW","VIEW","FULL","FULL","NONE","FULL"),
  head_operations:
    m("VIEW","VIEW","VIEW","VIEW","NONE","NONE","MANAGE","NONE","FULL","VIEW","VIEW","FULL","VIEW","NONE","VIEW"),

  production_head:
    m("VIEW","VIEW","FULL","FULL","VIEW","NONE","MANAGE","NONE","VIEW","FULL","FULL","FULL","VIEW","NONE","VIEW"),
  site_installation_mgr:
    m("VIEW","VIEW","VIEW","FULL","VIEW","NONE","MANAGE","NONE","VIEW","FULL","VIEW","FULL","VIEW","NONE","VIEW"),
  factory_supervisor:
    m("VIEW","VIEW","FULL","VIEW","VIEW","NONE","MANAGE","NONE","VIEW","FULL","VIEW","FULL","VIEW","NONE","NONE"),
  factory_floor_supervisor:
    m("VIEW","NONE","FULL","VIEW","NONE","NONE","VIEW","NONE","NONE","VIEW","VIEW","FULL","NONE","NONE","NONE"),
  fabrication_foreman:
    m("VIEW","NONE","FULL","VIEW","NONE","NONE","VIEW","NONE","NONE","VIEW","VIEW","FULL","NONE","NONE","NONE"),

  planning_engineer:
    m("VIEW","FULL","VIEW","VIEW","VIEW","NONE","VIEW","NONE","VIEW","VIEW","VIEW","FULL","NONE","NONE","VIEW"),
  costing_engineer:
    m("VIEW","FULL","NONE","NONE","VIEW","VIEW","VIEW","NONE","VIEW","NONE","NONE","FULL","NONE","NONE","VIEW"),
  quantity_surveyor:
    m("VIEW","VIEW","NONE","NONE","NONE","NONE","VIEW","NONE","FULL","NONE","NONE","FULL","NONE","NONE","NONE"),

  senior_architect:
    m("VIEW","VIEW","VIEW","VIEW","NONE","NONE","VIEW","NONE","FULL","VIEW","NONE","FULL","NONE","NONE","NONE"),
  project_architect:
    m("VIEW","VIEW","VIEW","VIEW","NONE","NONE","VIEW","NONE","FULL","VIEW","NONE","FULL","NONE","NONE","NONE"),
  structural_architect:
    m("VIEW","VIEW","VIEW","VIEW","NONE","NONE","VIEW","NONE","FULL","VIEW","NONE","FULL","NONE","NONE","NONE"),
  principal_architect:
    m("VIEW","VIEW","VIEW","VIEW","NONE","NONE","VIEW","NONE","FULL","VIEW","NONE","FULL","NONE","NONE","NONE"),

  accounts_executive:
    m("VIEW","NONE","NONE","NONE","VIEW","FULL","VIEW","NONE","NONE","NONE","NONE","FULL","NONE","NONE","VIEW"),
  finance_manager:
    m("VIEW","VIEW","NONE","NONE","VIEW","FULL","VIEW","NONE","NONE","NONE","VIEW","FULL","VIEW","NONE","FULL"),

  hr_admin:
    m("VIEW","NONE","NONE","NONE","NONE","NONE","FULL","NONE","NONE","NONE","NONE","FULL","NONE","NONE","VIEW"),
  hr_executive:
    m("VIEW","NONE","NONE","NONE","NONE","NONE","FULL","NONE","NONE","NONE","NONE","FULL","NONE","NONE","VIEW"),

  marketing:
    m("VIEW","NONE","NONE","NONE","NONE","NONE","VIEW","FULL","NONE","NONE","NONE","FULL","NONE","NONE","NONE"),
  sales_executive:
    m("VIEW","NONE","NONE","NONE","NONE","NONE","VIEW","FULL","NONE","NONE","NONE","FULL","NONE","NONE","NONE"),

  qc_inspector:
    m("VIEW","NONE","VIEW","VIEW","NONE","NONE","VIEW","NONE","VIEW","FULL","VIEW","FULL","NONE","NONE","NONE"),

  electrical_installer:
    m("VIEW","NONE","FULL","FULL","NONE","NONE","VIEW","NONE","NONE","NONE","VIEW","FULL","NONE","NONE","NONE"),
  elec_plumbing_installer:
    m("VIEW","NONE","FULL","FULL","NONE","NONE","VIEW","NONE","NONE","NONE","NONE","FULL","NONE","NONE","NONE"),

  logistics_manager:
    m("VIEW","NONE","NONE","FULL","NONE","NONE","VIEW","NONE","VIEW","VIEW","FULL","FULL","NONE","NONE","NONE"),
  delivery_rm_lead:
    m("VIEW","NONE","NONE","FULL","NONE","NONE","VIEW","NONE","VIEW","VIEW","FULL","FULL","NONE","NONE","NONE"),
  site_engineer:
    m("VIEW","NONE","NONE","FULL","NONE","NONE","VIEW","NONE","VIEW","VIEW","FULL","FULL","VIEW","NONE","VIEW"),

  procurement:
    m("VIEW","VIEW","NONE","NONE","FULL","VIEW","VIEW","NONE","NONE","NONE","VIEW","FULL","VIEW","NONE","VIEW"),
  stores_executive:
    m("VIEW","NONE","NONE","NONE","FULL","NONE","VIEW","NONE","NONE","NONE","VIEW","FULL","VIEW","NONE","VIEW"),
  procurement_assistant:
    m("VIEW","NONE","NONE","NONE","FULL","NONE","VIEW","NONE","NONE","NONE","NONE","FULL","NONE","NONE","NONE"),
};

// Safe default for any role that hasn't been explicitly mapped.
const DEFAULT_ACCESS: ModuleAccess =
  m("VIEW","NONE","NONE","NONE","NONE","NONE","VIEW","NONE","NONE","NONE","NONE","VIEW","NONE","NONE","NONE");

export function getAccessLevel(role: AppRole | null | undefined, mod: ModuleKey): AccessLevel {
  if (!role) return "NONE";
  const row = ROLE_ACCESS_MATRIX[role] ?? DEFAULT_ACCESS;
  return row[mod];
}

// Admin Panel (Employee Management) — explicit allow-list per matrix.
const ADMIN_PANEL_ROLES: AppRole[] = [
  "super_admin" as AppRole,
  "managing_director" as AppRole,
];

export function canAccessAdminPanel(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_PANEL_ROLES.includes(role);
}
