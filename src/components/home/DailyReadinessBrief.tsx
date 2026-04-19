import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface BriefItem {
  label: string;
  value: string;
  route: string;
  urgent?: boolean;
}

interface DailyReadinessBriefProps {
  userRole: string | null;
  userName: string;
}

async function fetchBriefItems(role: string | null, userId: string): Promise<BriefItem[]> {
  const today = format(new Date(), "yyyy-MM-dd");

  if (role === "stores_executive") {
    // Vijay: material deliveries and PO alerts
    const [{ data: overdue }, { data: pending }] = await Promise.all([
      (supabase.from("material_plan_items") as any).select("id").in("status", ["delayed", "planned"]).lte("required_by", today),
      supabase.from("material_requests").select("id").in("status", ["pending_budget", "pending_po"]),
    ]);
    return [
      { label: "Overdue material deliveries", value: `${(overdue ?? []).length} items`, route: "/procurement", urgent: (overdue ?? []).length > 0 },
      { label: "PO actions pending", value: `${(pending ?? []).length} requests`, route: "/procurement", urgent: (pending ?? []).length > 0 },
    ];
  }

  if (role === "site_installation_mgr") {
    // Awaiz: site tasks due today + overdue
    const { data: modules } = await supabase.from("modules").select("id, module_code, current_stage").eq("is_archived", false).in("production_status", ["not_started", "in_progress"]);
    const { data: punch } = await (supabase.from("punch_list_items") as any).select("id").in("status", ["open", "in_progress"]);
    return [
      { label: "Modules in site phase", value: `${(modules ?? []).length} active`, route: "/site-hub" },
      { label: "Open punch list items", value: `${(punch ?? []).length} items`, route: "/site-hub", urgent: (punch ?? []).length > 0 },
    ];
  }

  if (role === "factory_floor_supervisor") {
    // Rakesh: bay status + today's production tasks
    const { data: mods } = await supabase.from("modules").select("id, module_code, current_stage, bay_number").eq("is_archived", false).in("production_status", ["in_progress"]);
    const occupied = (mods ?? []).filter((m: any) => m.bay_number).length;
    const { data: ncrs } = await supabase.from("ncr_register").select("id").in("status", ["open", "critical_open"]);
    return [
      { label: "Active bays in production", value: `${occupied} bays occupied`, route: "/production" },
      { label: "Open NCRs assigned to you", value: `${(ncrs ?? []).length} NCRs`, route: "/quality-control", urgent: (ncrs ?? []).length > 0 },
    ];
  }

  if (role === "finance_director") {
    // Mary: statutory dates + pending invoices
    const { data: invoices } = await (supabase.from("project_invoices") as any).select("id").in("status", ["draft", "sent"]);
    return [
      { label: "Invoices pending action", value: `${(invoices ?? []).length} invoices`, route: "/finance", urgent: (invoices ?? []).length > 0 },
      { label: "Next statutory deadline", value: "Check statutory calendar", route: "/finance" },
    ];
  }

  if (["head_operations", "sales"].includes(role ?? "") || role?.includes("sales")) {
    // John: pipeline + follow-ups
    const { data: deals } = await supabase.from("sales_deals").select("id, stage").eq("is_archived", false);
    const active = (deals ?? []).filter((d: any) => !["Won", "Lost"].includes(d.stage)).length;
    return [
      { label: "Active pipeline deals", value: `${active} deals`, route: "/sales" },
      { label: "Deals needing follow-up", value: "Check pipeline", route: "/sales" },
    ];
  }

  if (role === "qc_inspector") {
    // Tagore: QC inspections + NCRs
    const { data: inspections } = await supabase.from("qc_inspections").select("id").eq("dispatch_decision", "REWORK REQUIRED");
    const { data: ncrs } = await supabase.from("ncr_register").select("id").in("status", ["open", "critical_open"]);
    return [
      { label: "Rework decisions pending", value: `${(inspections ?? []).length} modules`, route: "/quality-control", urgent: (inspections ?? []).length > 0 },
      { label: "Open NCRs", value: `${(ncrs ?? []).length} NCRs`, route: "/quality-control", urgent: (ncrs ?? []).length > 0 },
    ];
  }

  if (["production_head"].includes(role ?? "")) {
    // Azad: production summary
    const { data: mods } = await supabase.from("modules").select("id, production_status").eq("is_archived", false);
    const inProd = (mods ?? []).filter((m: any) => m.production_status === "in_progress").length;
    const { data: ncrs } = await supabase.from("ncr_register").select("id").eq("status", "critical_open");
    return [
      { label: "Modules in production", value: `${inProd} active`, route: "/production" },
      { label: "Critical NCRs", value: `${(ncrs ?? []).length} critical`, route: "/quality-control", urgent: (ncrs ?? []).length > 0 },
    ];
  }

  // Default for MD/directors
  const [{ data: mods }, { data: deals }, { data: ncrs }] = await Promise.all([
    supabase.from("modules").select("id, production_status").eq("is_archived", false),
    supabase.from("sales_deals").select("id, stage").eq("is_archived", false),
    supabase.from("ncr_register").select("id").eq("status", "critical_open"),
  ]);
  const inProd = (mods ?? []).filter((m: any) => m.production_status === "in_progress").length;
  const active = (deals ?? []).filter((d: any) => !["Won", "Lost"].includes(d.stage)).length;
  return [
    { label: "Modules in production", value: `${inProd} active`, route: "/production" },
    { label: "Active pipeline deals", value: `${active} deals`, route: "/sales" },
    { label: "Critical NCRs", value: `${(ncrs ?? []).length} critical`, route: "/quality-control", urgent: (ncrs ?? []).length > 0 },
  ];
}

export function DailyReadinessBrief({ userRole, userName }: DailyReadinessBriefProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<BriefItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const isVisible = hour < 10 && !dismissed;

  useEffect(() => {
    const key = `brief_dismissed_${format(new Date(), "yyyy-MM-dd")}`;
    if (sessionStorage.getItem(key)) { setDismissed(true); setLoading(false); return; }
    if (hour >= 10) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      fetchBriefItems(userRole, user.id).then((res) => { setItems(res); setLoading(false); });
    });
  }, [userRole]);

  const handleDismiss = () => {
    const key = `brief_dismissed_${format(new Date(), "yyyy-MM-dd")}`;
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  };

  if (!isVisible || loading) return null;

  const greeting = hour < 12 ? "Good morning" : "Good afternoon";

  return (
    <div className="rounded-xl border border-border p-4 space-y-3 shadow-sm" style={{ backgroundColor: "#E8F2ED", borderColor: "#006039" + "30" }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4" style={{ color: "#006039" }} />
          <p className="font-display font-bold text-sm" style={{ color: "#006039" }}>
            {greeting}, {userName.split(" ")[0]} 👋
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDismiss}>
          <X className="h-3.5 w-3.5" style={{ color: "#999" }} />
        </Button>
      </div>

      <p className="text-xs" style={{ color: "#444" }}>Here's your morning summary for {format(new Date(), "EEEE, d MMMM")}:</p>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigate(item.route)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:opacity-80 transition-opacity"
            style={{ backgroundColor: item.urgent ? "#FFF8E8" : "#FFFFFF" }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "#1A1A1A" }}>{item.label}</p>
              <p className="text-[11px] font-semibold" style={{ color: item.urgent ? "#D4860A" : "#006039" }}>{item.value}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "#999" }} />
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-center py-2" style={{ color: "#666" }}>All clear — no urgent items today ✓</p>
      )}
    </div>
  );
}
