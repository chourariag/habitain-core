import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogExpenseDrawer } from "./LogExpenseDrawer";
import type { AppRole } from "@/lib/roles";

const ARCHITECT_ROLES: AppRole[] = ["principal_architect", "project_architect", "structural_architect"];

interface Props {
  userRole: AppRole | null;
}

export function LogExpenseButton({ userRole }: Props) {
  const [open, setOpen] = useState(false);

  if (!userRole || ARCHITECT_ROLES.includes(userRole)) return null;

  return (
    <>
      <div
        className="rounded-lg border border-border p-4 flex items-center justify-between flex-wrap gap-3"
        style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E8F2ED" }}>
            <Receipt className="h-5 w-5" style={{ color: "#006039" }} />
          </div>
          <div>
            <p className="text-sm font-semibold font-display" style={{ color: "#1A1A1A" }}>Log Expense</p>
            <p className="text-xs" style={{ color: "#666" }}>Log daily expenses & conveyance claims</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white">
          Log Expense
        </Button>
      </div>
      <LogExpenseDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
