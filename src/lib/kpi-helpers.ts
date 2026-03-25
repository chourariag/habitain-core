import type { AppRole } from "@/lib/roles";

// Roles that can see the KPI section
export const KPI_VISIBLE_ROLES: AppRole[] = [
  "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
  "head_operations", "production_head", "finance_manager",
  "factory_floor_supervisor", "qc_inspector", "planning_engineer", "costing_engineer",
  "procurement", "stores_executive", "site_installation_mgr", "delivery_rm_lead",
  "fabrication_foreman", "electrical_installer", "elec_plumbing_installer",
  "site_engineer", "accounts_executive", "hr_executive",
];

export const DIRECTORS_AND_MD: AppRole[] = [
  "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director",
];

export const HOD_ROLES: AppRole[] = [
  "production_head", "head_operations", "finance_manager", "sales_director", "architecture_director",
];

// Determine the view type for the KPI page
export function getKpiViewType(role: AppRole | null): "director" | "hod" | "individual" {
  if (!role) return "individual";
  if (DIRECTORS_AND_MD.includes(role)) return "director";
  if (HOD_ROLES.includes(role)) return "hod";
  return "individual";
}

// Department mapping for filters
export const DEPARTMENT_MAP: Record<string, AppRole[]> = {
  Production: ["factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer", "qc_inspector"],
  Operations: ["head_operations", "planning_engineer", "site_installation_mgr", "site_engineer", "delivery_rm_lead"],
  Finance: ["finance_manager", "accounts_executive", "costing_engineer"],
  Sales: ["sales_director"],
  Design: ["architecture_director", "principal_architect", "project_architect", "structural_architect"],
  HR: ["hr_executive"],
  Procurement: ["procurement", "stores_executive"],
};

// Direct reports mapping for HODs
export const HOD_DIRECT_REPORTS: Record<string, AppRole[]> = {
  production_head: ["factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer", "qc_inspector"],
  head_operations: ["planning_engineer", "site_installation_mgr", "site_engineer", "delivery_rm_lead", "costing_engineer"],
  finance_manager: ["accounts_executive"],
  sales_director: [],
  architecture_director: ["principal_architect", "project_architect", "structural_architect"],
};

export function getScoreColor(score: number | null): string {
  if (score === null) return "#999999";
  if (score >= 70) return "#006039";
  if (score >= 50) return "#D4860A";
  return "#F40009";
}

export function getStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case "on_track": return { label: "On Track", color: "#006039", bg: "#E8F2ED" };
    case "needs_attention": return { label: "Needs Attention", color: "#D4860A", bg: "#FFF8E8" };
    case "at_risk": return { label: "At Risk", color: "#F40009", bg: "#FEE2E2" };
    default: return { label: "No Data", color: "#999", bg: "#F7F7F7" };
  }
}

export function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now.getFullYear(), now.getMonth(), diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
}
