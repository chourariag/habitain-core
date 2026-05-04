import { FlaskConical, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { roleLabel } from "./RoleSwitcher";

export function TestingModeBanner() {
  const { isImpersonating, role, setOverrideRole } = useUserRole();
  if (!isImpersonating) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0"
      style={{ backgroundColor: "#FFF3D6", borderBottom: "1px solid #D4860A", color: "#7A4F00" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" style={{ color: "#D4860A" }} />
        <span className="truncate">
          <strong>Testing Mode</strong> — Viewing as: <strong>{roleLabel(role)}</strong>. Your actual role is MD.
        </span>
      </div>
      <button
        onClick={() => setOverrideRole(null)}
        className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-amber-200 shrink-0"
        style={{ color: "#7A4F00" }}
      >
        <X className="h-3 w-3" />
        <span className="hidden sm:inline">Exit Testing</span>
      </button>
    </div>
  );
}
