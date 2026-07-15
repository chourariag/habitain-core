// Source of truth for the Role Permissions matrix.
// Adding a new page here automatically adds a new row to the matrix.

export type PermissionLevel = "full" | "view" | "hidden" | "locked";

export const PERMISSION_LEVELS: {
  value: PermissionLevel;
  label: string;
  icon: string;
  bg: string; // tailwind classes
  text: string;
}[] = [
  { value: "full",   label: "Full",   icon: "✅", bg: "bg-emerald-100",  text: "text-emerald-900" },
  { value: "view",   label: "View",   icon: "👁", bg: "bg-sky-100",      text: "text-sky-900" },
  { value: "hidden", label: "Hidden", icon: "🚫", bg: "bg-muted",        text: "text-muted-foreground" },
  { value: "locked", label: "Locked", icon: "🔒", bg: "bg-amber-100",    text: "text-amber-900" },
];

export const PERMISSION_ROLES = [
  "md","director","principal_architect","planning_head","planning_engineer",
  "costing_engineer","head_of_projects","operations_architect","project_architect",
  "production_head","factory_supervisor","electrical_installer","plumbing_installer",
  "site_installation_manager","site_engineer","logistics_manager","procurement",
  "stores_manager","procurement_assistant","purchase_assistant","qc_inspector","finance_manager",
  "hr_admin","super_admin","marketing","sales_executive",
] as const;
export type PermissionRole = typeof PERMISSION_ROLES[number];

// Roles whose access cannot be edited (always Full)
export const LOCKED_ROLES: PermissionRole[] = ["md", "super_admin"];

export type PageDef = { key: string; label: string };
export type PageGroup = { section: string; pages: PageDef[] };

export const PAGE_GROUPS: PageGroup[] = [
  { section: "Dashboard", pages: [
    { key: "dashboard", label: "Dashboard" },
  ]},
  { section: "Approvals", pages: [
    { key: "approvals.hub", label: "Approvals Hub" },
  ]},
  { section: "Projects", pages: [
    { key: "projects.list", label: "Projects List" },
    { key: "projects.overview", label: "Project → Overview" },
    { key: "projects.schedule", label: "Project → Schedule" },
    { key: "projects.billing", label: "Project → Billing" },
    { key: "projects.materials", label: "Project → Materials" },
    { key: "projects.variations", label: "Project → Variations" },
    { key: "projects.budget", label: "Project → Budget" },
    { key: "projects.scope", label: "Project → Scope" },
    { key: "projects.handover", label: "Project → Handover" },
    { key: "projects.pl", label: "Project → P&L" },
  ]},
  { section: "Production", pages: [
    { key: "production.capacity", label: "Capacity Planning" },
    { key: "production.floor.my_tasks", label: "Factory Floor → My Tasks" },
    { key: "production.floor.module", label: "Factory Floor → Module" },
    { key: "production.floor.work_orders", label: "Factory Floor → Work Orders" },
    { key: "production.floor.drawings", label: "Factory Floor → Drawings" },
    { key: "production.floor_map", label: "Floor Map" },
    { key: "production.qc.inspections", label: "QC & NCR → Inspections" },
    { key: "production.qc.ncr", label: "QC & NCR → NCR" },
    { key: "production.qc.rework", label: "QC & NCR → Rework Summary" },
    { key: "production.qc.quality_flags", label: "QC & NCR → Quality Flags" },
    { key: "production.despatch", label: "Despatch & Delivery" },
    { key: "production.safety", label: "Safety (Production)" },
    { key: "production.people.manpower", label: "People → Manpower Plan" },
    { key: "production.people.daily_log", label: "People → Daily Labour Log" },
    { key: "production.people.log_approvals", label: "People → Labour Log Approvals" },
    { key: "production.people.registers", label: "People → Labour Registers" },
    { key: "production.people.subcontractors", label: "People → Subcontractors" },
  ]},
  { section: "On Site Works", pages: [
    { key: "site.hub", label: "Site Hub" },
    { key: "site.inventory.inventory", label: "Inventory → Inventory" },
    { key: "site.inventory.material_requests", label: "Inventory → Material Requests" },
    { key: "site.diary.daily_log", label: "Site Diary → Daily Log" },
    { key: "site.diary.punch_list", label: "Site Diary → Punch List" },
    { key: "site.handover_document", label: "Handover Document" },
    { key: "site.people.labour_log", label: "People → Labour Log" },
    { key: "site.people.subcontractors", label: "People → Subcontractors" },
    { key: "site.installation_sequence", label: "Installation Sequence" },
    { key: "site.safety", label: "Safety (Site)" },
  ]},
  { section: "Procurement", pages: [
    { key: "procurement.dashboard", label: "Procurement Dashboard" },
    { key: "procurement.material_plan", label: "Material Plan" },
    { key: "procurement.inventory_grn", label: "Inventory & GRN" },
    { key: "procurement.purchase_orders", label: "Purchase Orders" },
    { key: "procurement.transfers", label: "Transfers" },
    { key: "procurement.equipments.assets", label: "Equipments → Asset Register" },
    { key: "procurement.equipments.tools", label: "Equipments → Tools Inventory" },
    { key: "procurement.rm_amc.rm", label: "Repairs & AMC → R&M" },
    { key: "procurement.rm_amc.amc", label: "Repairs & AMC → AMC" },
  ]},
  { section: "Finance", pages: [
    { key: "finance.mgmt.mis", label: "Management → MIS" },
    { key: "finance.mgmt.pl", label: "Management → P&L" },
    { key: "finance.projects.revenue", label: "Projects → Revenue & Margin" },
    { key: "finance.projects.cashflow", label: "Projects → Cash Flow" },
    { key: "finance.gen.payments", label: "General → Payments" },
    { key: "finance.gen.invoices", label: "General → Invoices" },
    { key: "finance.gen.ledger", label: "General → Bank Ledger & Overdue" },
    { key: "finance.gen.statutory", label: "General → Statutory" },
    { key: "finance.costing.work_orders", label: "Costing & Estimation → Work Orders" },
    { key: "finance.costing.purchase_orders", label: "Costing & Estimation → Purchase Orders" },
    { key: "finance.costing.expense_approvals", label: "Costing & Estimation → Expense Approvals" },
  ]},
  { section: "Design", pages: [
    { key: "design.projects", label: "Design Projects" },
    { key: "design.queries", label: "Design Queries" },
    { key: "design.drawings", label: "Drawings" },
    { key: "design.boq", label: "BOQ" },
    { key: "design.schedule", label: "Design Schedule" },
  ]},
  { section: "Sales", pages: [
    { key: "sales.pipeline", label: "Pipeline" },
    { key: "sales.quotations", label: "Quotations" },
    { key: "sales.client_portal", label: "Client Portal" },
  ]},
  { section: "Altree — HR", pages: [
    { key: "altree.hr.my.attendance", label: "My HR → Attendance" },
    { key: "altree.hr.my.leave", label: "My HR → Leave" },
    { key: "altree.hr.my.expenses", label: "My HR → Expenses" },
    { key: "altree.hr.my.payslips", label: "My HR → Payslips" },
    { key: "altree.hr.my.documents", label: "My HR → Documents" },
    { key: "altree.hr.mgmt.attendance", label: "HR Management → Team Attendance" },
    { key: "altree.hr.mgmt.leave", label: "HR Management → Leave Requests" },
    { key: "altree.hr.mgmt.expenses", label: "HR Management → Expense Approvals" },
    { key: "altree.hr.mgmt.payroll_settings", label: "HR Management → Payroll Settings" },
    { key: "altree.hr.mgmt.payroll", label: "HR Management → Payroll" },
    { key: "altree.hr.mgmt.documents", label: "HR Management → Employee Documents" },
  ]},
  { section: "Altree — Admin", pages: [
    { key: "altree.admin.approvals_archive", label: "Approvals Archive" },
    { key: "altree.admin.user_creation", label: "User Creation" },
    { key: "altree.admin.announcements", label: "Announcements" },
    { key: "altree.admin.data_compliance", label: "Data Compliance Settings" },
  ]},
  { section: "Altree — Super Admin", pages: [
    { key: "altree.sa.role_permissions", label: "Role Permissions" },
    { key: "altree.sa.kpi_settings", label: "KPI Settings" },
    { key: "altree.sa.escalation", label: "Escalation Matrix" },
    { key: "altree.sa.approval_thresholds", label: "Approval Thresholds" },
    { key: "altree.sa.create_accounts", label: "Create All Accounts" },
  ]},
  { section: "Altree — Settings", pages: [
    { key: "altree.settings.factory_location", label: "Factory Location" },
    { key: "altree.settings.office_location", label: "Office Location" },
  ]},
];

export const ALL_PAGE_KEYS: string[] = PAGE_GROUPS.flatMap(g => g.pages.map(p => p.key));

// ----- Default matrix -----
// Returns the default permission level for (role, pageKey).
// Unspecified = "hidden" (safe default).

function startsWith(key: string, ...prefixes: string[]) {
  return prefixes.some(p => key === p || key.startsWith(p + "."));
}

export function defaultPermission(role: PermissionRole, pageKey: string): PermissionLevel {
  // Always-full roles (principal_architect is MD-equivalent per org policy)
  if (role === "md" || role === "super_admin" || role === "director" || role === "principal_architect") return "full";

  switch (role) {

    case "planning_head":
      if (startsWith(pageKey, "projects", "production", "procurement")) return "full";
      if (startsWith(pageKey, "finance")) return "view";
      if (startsWith(pageKey, "altree.hr.mgmt.payroll", "altree.hr.mgmt.payroll_settings")) return "hidden";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "planning_engineer":
      if (pageKey === "projects.schedule" || pageKey === "procurement.material_plan") return "full";
      if (startsWith(pageKey, "production", "procurement", "projects")) return "view";
      if (startsWith(pageKey, "finance")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "costing_engineer":
      if (startsWith(pageKey, "finance.costing")) return "full";
      if (pageKey === "projects.variations" || pageKey === "projects.budget") return "full";
      if (startsWith(pageKey, "procurement")) return "view";
      if (startsWith(pageKey, "altree.hr")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "head_of_projects":
      if (startsWith(pageKey, "projects", "production", "site", "procurement")) return "full";
      if (startsWith(pageKey, "finance")) return "view";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "operations_architect":
      if (startsWith(pageKey, "design")) return "full";
      if (startsWith(pageKey, "projects")) return "view";
      if (startsWith(pageKey, "finance")) return "hidden";
      if (startsWith(pageKey, "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "project_architect":
      if (pageKey === "design.queries" || pageKey === "design.drawings") return "full";
      if (startsWith(pageKey, "design")) return "view";
      if (startsWith(pageKey, "projects")) return "view";
      if (startsWith(pageKey, "finance", "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "production_head":
      if (startsWith(pageKey, "production")) return "full";
      if (startsWith(pageKey, "projects")) return "view";
      if (startsWith(pageKey, "procurement")) return "view";
      if (startsWith(pageKey, "altree.hr.mgmt.payroll")) return "hidden";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "factory_supervisor":
      if (startsWith(pageKey, "production.floor", "production.qc")) return "full";
      if (pageKey === "projects.schedule") return "view";
      if (startsWith(pageKey, "finance", "altree.hr", "sales")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "electrical_installer":
    case "plumbing_installer":
      if (pageKey === "production.floor.my_tasks") return "full";
      if (pageKey === "production.floor.drawings") return "view";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "site_installation_manager":
      if (startsWith(pageKey, "site")) return "full";
      if (startsWith(pageKey, "projects")) return "view";
      if (pageKey === "procurement.transfers") return "view";
      if (startsWith(pageKey, "finance", "altree.hr")) return "hidden";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "site_engineer":
      if (pageKey === "site.hub") return "full";
      if (startsWith(pageKey, "site.diary")) return "full";
      if (pageKey === "site.people.labour_log") return "full";
      if (pageKey === "projects.schedule") return "view";
      if (startsWith(pageKey, "finance", "altree.hr", "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "logistics_manager":
      if (startsWith(pageKey, "procurement.rm_amc")) return "full";
      if (startsWith(pageKey, "procurement")) return "view";
      if (startsWith(pageKey, "site")) return "view";
      if (startsWith(pageKey, "finance", "altree.hr")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "procurement":
    case "purchase_assistant":
      if (startsWith(pageKey, "procurement")) return "full";
      if (pageKey === "projects.materials") return "view";
      if (startsWith(pageKey, "altree.hr", "finance.gen.payments")) return "hidden";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "stores_manager":
      if (pageKey === "procurement.inventory_grn" || pageKey === "procurement.transfers") return "full";
      if (pageKey === "site.inventory.inventory") return "full";
      if (startsWith(pageKey, "procurement")) return "view";
      if (startsWith(pageKey, "finance", "altree.hr")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "procurement_assistant":
      if (startsWith(pageKey, "procurement")) return "view";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "qc_inspector":
      if (startsWith(pageKey, "production.qc")) return "full";
      if (pageKey === "production.floor.drawings") return "view";
      if (pageKey === "projects.schedule") return "view";
      if (startsWith(pageKey, "finance", "altree.hr", "sales")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "finance_manager":
      if (startsWith(pageKey, "finance")) return "full";
      if (startsWith(pageKey, "altree.hr.mgmt.payroll")) return "full";
      if (startsWith(pageKey, "projects")) return "view";
      if (startsWith(pageKey, "production")) return "hidden";
      if (pageKey === "dashboard" || pageKey === "approvals.hub") return "full";
      return "hidden";

    case "hr_admin":
      if (startsWith(pageKey, "altree.hr")) return "full";
      if (pageKey === "altree.admin.announcements") return "view";
      if (startsWith(pageKey, "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "marketing":
      if (pageKey === "sales.pipeline") return "view";
      if (pageKey === "sales.quotations") return "full";
      if (startsWith(pageKey, "finance", "altree.hr", "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";

    case "sales_executive":
      if (startsWith(pageKey, "sales")) return "full";
      if (startsWith(pageKey, "projects")) return "view";
      if (startsWith(pageKey, "finance", "altree.hr", "production")) return "hidden";
      if (pageKey === "dashboard") return "view";
      return "hidden";
  }
  return "hidden";
}
