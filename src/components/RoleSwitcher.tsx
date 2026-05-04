import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { FlaskConical } from "lucide-react";

// Role keys must match the values returned by public.get_user_role / app_role enum
export const TESTING_ROLES: { value: string; label: string }[] = [
  { value: "managing_director", label: "Managing Director (your actual role)" },
  { value: "planning_engineer", label: "Planning Engineer (Karthik)" },
  { value: "production_head", label: "Production Head (Azad)" },
  { value: "costing_engineer", label: "Costing Engineer (Nakeem)" },
  { value: "site_installation_mgr", label: "Site Installation Manager (Awaiz)" },
  { value: "factory_floor_supervisor", label: "Factory Supervisor (Rakesh)" },
  { value: "procurement", label: "Procurement (Vijay)" },
  { value: "finance_manager", label: "Finance Manager (Mary)" },
  { value: "qc_inspector", label: "QC Inspector (Tagore)" },
  { value: "sales_director", label: "Sales (John)" },
  { value: "head_operations", label: "Operations Architect (Venkat)" },
  { value: "stores_executive", label: "Stores Manager (Sandeep)" },
];

export function roleLabel(roleValue: string | null): string {
  if (!roleValue) return "Unknown";
  return TESTING_ROLES.find((r) => r.value === roleValue)?.label ?? roleValue;
}

interface Props {
  collapsed?: boolean;
}

export function RoleSwitcher({ collapsed }: Props) {
  const { actualRole, role, canImpersonate, setOverrideRole } = useUserRole();

  if (!canImpersonate) return null;

  const current = role ?? actualRole ?? "managing_director";

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2" title="Testing Mode">
        <FlaskConical className="h-4 w-4" style={{ color: "#D4860A" }} />
      </div>
    );
  }

  return (
    <div
      className="px-3 py-2 mx-2 my-2 rounded-md"
      style={{ backgroundColor: "#FFF8EC", border: "1px solid #F4D58A" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <FlaskConical className="h-3 w-3" style={{ color: "#D4860A" }} />
        <span
          className="text-[10px] uppercase tracking-wider font-semibold"
          style={{ color: "#D4860A" }}
        >
          Testing Mode
        </span>
      </div>
      <label
        className="text-[10px] block mb-1"
        style={{ color: "#666666" }}
      >
        View as Role:
      </label>
      <Select
        value={current}
        onValueChange={(v) => {
          // Selecting your actual role clears the override
          if (v === actualRole) setOverrideRole(null);
          else setOverrideRole(v);
        }}
      >
        <SelectTrigger
          className="w-full h-8 text-xs"
          style={{ borderColor: "#F4D58A", backgroundColor: "white" }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TESTING_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value} className="text-xs">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
