// Master list of confirmed HStack users (27 total) — used by Testing Mode role switcher
// and as reference for User Management.
import type { AppRole } from "@/lib/roles";

export interface HStackUser {
  name: string;
  role: AppRole;
  group: string;
}

export const HSTACK_USER_GROUPS = [
  "Directors & MD",
  "Planning",
  "Design",
  "Factory Production",
  "Site",
  "Procurement & Stores",
  "Quality / Material",
  "Finance & HR",
  "Sales & Marketing",
] as const;

export const HSTACK_USERS: HStackUser[] = [
  // Directors & MD
  { name: "Gaurav Chouraria", role: "managing_director" as AppRole, group: "Directors & MD" },
  { name: "John Kunnath", role: "sales_director" as AppRole, group: "Directors & MD" },
  { name: "Karan Nadig", role: "principal_architect" as AppRole, group: "Directors & MD" },
  { name: "Shiv Choudhari", role: "finance_director" as AppRole, group: "Directors & MD" },

  // Planning
  { name: "Suraj Rao", role: "planning_head" as AppRole, group: "Planning" },
  { name: "Karthik", role: "planning_engineer" as AppRole, group: "Planning" },
  { name: "Mohammed Nakeem", role: "costing_engineer" as AppRole, group: "Planning" },
  { name: "Stanley", role: "head_of_projects" as AppRole, group: "Planning" },

  // Design
  { name: "Venkat", role: "head_operations" as AppRole, group: "Design" },
  { name: "Ribunzad", role: "project_architect" as AppRole, group: "Design" },

  // Factory Production
  { name: "Azad Ali", role: "production_head" as AppRole, group: "Factory Production" },
  { name: "Rakesh", role: "factory_floor_supervisor" as AppRole, group: "Factory Production" },
  { name: "Mohan", role: "electrical_installer" as AppRole, group: "Factory Production" },
  { name: "Venugopal", role: "elec_plumbing_installer" as AppRole, group: "Factory Production" },

  // Site
  { name: "Awaiz Ahmed", role: "site_installation_mgr" as AppRole, group: "Site" },
  { name: "Nazim Raja", role: "site_engineer" as AppRole, group: "Site" },
  { name: "Bala", role: "logistics_manager" as AppRole, group: "Site" },

  // Procurement & Stores
  { name: "Vijay", role: "procurement" as AppRole, group: "Procurement & Stores" },
  { name: "Sandeep", role: "stores_executive" as AppRole, group: "Procurement & Stores" },
  { name: "Gangadhar", role: "procurement_assistant" as AppRole, group: "Procurement & Stores" },

  // Quality / Material
  { name: "Tagore", role: "qc_inspector" as AppRole, group: "Quality / Material" },

  // Finance & HR
  { name: "Mary", role: "finance_manager" as AppRole, group: "Finance & HR" },
  { name: "Sandhya", role: "hr_admin" as AppRole, group: "Finance & HR" },

  // Sales & Marketing
  { name: "Vaibhav", role: "super_admin" as AppRole, group: "Sales & Marketing" },
  { name: "Lekha", role: "marketing" as AppRole, group: "Sales & Marketing" },
  { name: "Sharan", role: "sales_executive" as AppRole, group: "Sales & Marketing" },
  { name: "George", role: "sales_executive" as AppRole, group: "Sales & Marketing" },
];
