export type DesignStageStatus = "Not Started" | "In Progress" | "Completed" | "Blocked" | "Skipped";

export const STAGE_STATUSES: DesignStageStatus[] = ["Not Started", "In Progress", "Completed", "Blocked", "Skipped"];

export const STATUS_STYLES: Record<DesignStageStatus, { bg: string; fg: string; cell: string }> = {
  "Not Started": { bg: "#F2F2F2", fg: "#666", cell: "#F7F7F7" },
  "In Progress": { bg: "#E8F0FE", fg: "#1A73E8", cell: "#E8F0FE" },
  "Completed":   { bg: "#E8F2ED", fg: "#006039", cell: "#C9E5D5" },
  "Blocked":     { bg: "#FFE9EA", fg: "#F40009", cell: "#FFCDD2" },
  "Skipped":     { bg: "#F2F2F2", fg: "#999",   cell: "#F2F2F2" },
};

export const EDIT_ROLES = [
  "super_admin", "managing_director", "finance_director", "sales_director",
  "architecture_director", "principal_architect", "project_architect",
  "planning_head", "planning_engineer", "head_operations", "operations_architect",
];

export const QUOTATION_STATUSES = ["Pending", "Released", "Won", "Lost", "On Hold"] as const;
export type QuotationStatus = typeof QUOTATION_STATUSES[number];
