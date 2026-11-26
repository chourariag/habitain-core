import { TIER1_OR_SUPER_ROLES } from "@/lib/roles";

// Presentation for View As only; the caller-bound database permission is always required.
export const BOQ_WRITER_ROLES = [...TIER1_OR_SUPER_ROLES, "finance_manager", "planning_engineer", "project_architect", "principal_architect", "planning_head", "costing_engineer", "quantity_surveyor", "head_operations"] as const;
export function canShowBoqEntry(serverAllows: boolean, role: string | null, isImpersonating: boolean): boolean {
  return serverAllows && (!isImpersonating || BOQ_WRITER_ROLES.some(candidate => candidate === role));
}