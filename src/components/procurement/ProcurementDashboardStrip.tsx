import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, isBefore } from "date-fns";

interface StripProps {
  userRole: string | null;
}

const PROCUREMENT_ROLES = ["procurement", "stores_executive", "super_admin", "managing_director"];

export function ProcurementDashboardStrip({ userRole }: StripProps) {
  const [counts, setCounts] = useState({ toOrder: 0, pendingConfirm: 0, pendingDirector: 0, overdue: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!PROCUREMENT_ROLES.includes(userRole || "")) return;
    setVisible(true);
    loadCounts();
  }, [userRole]);

  async function loadCounts() {
    const today = new Date();

    const [planRes, macRes, poRes] = await Promise.all([
      (supabase.from("material_plan_items") as any).select("required_by, lead_time_days, status"),
      supabase.from("material_availability_confirmations").select("status").eq("status", "pending"),
      supabase.from("purchase_orders").select("status, amount"),
    ]);

    // Materials to order today (order-by date is today or past)
    const planItems = planRes.data || [];
    const toOrder = planItems.filter((p: any) => {
      if (p.status !== "planned") return false;
      const orderBy = p.required_by ? subDays(new Date(p.required_by), Number(p.lead_time_days || 7)) : null;
      return orderBy && isBefore(orderBy, today);
    }).length;

    const pendingConfirm = (macRes.data || []).length;
    const poItems = poRes.data || [];
    const pendingDirector = poItems.filter((po: any) => po.status === "pending" && Number(po.amount) > 50000).length;
    const overdue = planItems.filter((p: any) => {
      if (p.status !== "planned") return false;
      return p.required_by && isBefore(new Date(p.required_by), today);
    }).length;

    setCounts({ toOrder, pendingConfirm, pendingDirector, overdue });
  }

  if (!visible) return null;

  const tiles = [
    { label: "Materials to order today", count: counts.toOrder, alert: counts.toOrder > 0, color: counts.toOrder > 0 ? "#F40009" : "#1A1A1A", bg: counts.toOrder > 0 ? "#FFF0F0" : "#F7F7F7" },
    { label: "Pending availability confirmations", count: counts.pendingConfirm, alert: counts.pendingConfirm > 0, color: counts.pendingConfirm > 0 ? "#D4860A" : "#1A1A1A", bg: counts.pendingConfirm > 0 ? "#FFF8E8" : "#F7F7F7" },
    { label: "POs awaiting Director approval", count: counts.pendingDirector, alert: counts.pendingDirector > 0, color: counts.pendingDirector > 0 ? "#D4860A" : "#1A1A1A", bg: counts.pendingDirector > 0 ? "#FFF8E8" : "#F7F7F7" },
    { label: "Overdue deliveries", count: counts.overdue, alert: counts.overdue > 0, color: counts.overdue > 0 ? "#F40009" : "#1A1A1A", bg: counts.overdue > 0 ? "#FFF0F0" : "#F7F7F7" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 rounded-lg" style={{ backgroundColor: "#FAFAFA", border: "1px solid #E0E0E0" }}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg p-3" style={{ backgroundColor: t.bg }}>
          <p className="text-2xl font-bold" style={{ color: t.color }}>{t.count}</p>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: "#666666" }}>{t.label}</p>
        </div>
      ))}
    </div>
  );
}
