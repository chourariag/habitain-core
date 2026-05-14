// KPI metric metadata used by the overview grid.
import type { AppRole } from "@/lib/roles";

export type RagStatus = "on_track" | "needs_attention" | "at_risk" | "no_data";

export const KPI_EMPLOYEES: { name: string; role: AppRole; subtitle: string }[] = [
  { name: "Suraj Rao",       role: "head_operations",        subtitle: "Planning & Ops Head" },
  { name: "Azad Ali",        role: "production_head",        subtitle: "Production Head" },
  { name: "Awaiz Ahmed",     role: "site_installation_mgr",  subtitle: "Site Installation Manager" },
  { name: "Karthik",         role: "planning_engineer",      subtitle: "Planning Engineer" },
  { name: "Mohammed Nakeem", role: "costing_engineer",       subtitle: "Costing Engineer" },
  { name: "Vijay",           role: "procurement",            subtitle: "Procurement" },
  { name: "Tagore",          role: "qc_inspector",           subtitle: "QC Inspector" },
  { name: "Bala",            role: "delivery_rm_lead",       subtitle: "Logistics & Facilities" },
  { name: "Rakesh",          role: "factory_floor_supervisor", subtitle: "Factory Supervisor" },
  { name: "Sandeep",         role: "stores_executive",       subtitle: "Stores Manager" },
  { name: "Mary",            role: "finance_manager",        subtitle: "Finance Manager" },
  { name: "Venkat",          role: "principal_architect",    subtitle: "Operations Architect" },
];

export function ragColor(status: RagStatus): string {
  if (status === "on_track") return "#006039";
  if (status === "needs_attention") return "#D4860A";
  if (status === "at_risk") return "#F40009";
  return "#9CA3AF";
}

export function ragLabel(status: RagStatus): string {
  if (status === "on_track") return "On Track";
  if (status === "needs_attention") return "Watch";
  if (status === "at_risk") return "At Risk";
  return "Insufficient Data";
}

export function rollUpStatus(statuses: RagStatus[]): RagStatus {
  const real = statuses.filter((s) => s !== "no_data");
  if (real.length === 0) return "no_data";
  if (real.includes("at_risk")) return "at_risk";
  if (real.includes("needs_attention")) return "needs_attention";
  return "on_track";
}
