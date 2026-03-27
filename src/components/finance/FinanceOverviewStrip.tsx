import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Tile {
  label: string;
  value: string;
  subtitle?: string;
  color: string;
}

export function FinanceOverviewStrip() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;
      const today = now.toISOString().slice(0, 10);

      const [cfRes, paymentsRes, budgetsRes] = await Promise.all([
        supabase.from("finance_cashflow").select("type, amount, category, entry_date")
          .gte("entry_date", monthStart).lt("entry_date", monthEnd),
        supabase.from("finance_payments").select("status, amount, due_date"),
        supabase.from("finance_project_budgets").select("sanctioned_budget, labour_budget, logistics_budget, project_id"),
      ]);

      const cfEntries = cfRes.data || [];
      const clientInflows = cfEntries
        .filter((e: any) => e.type === "inflow" && e.category === "Client Payment")
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const totalInflows = cfEntries
        .filter((e: any) => e.type === "inflow")
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const totalOutflows = cfEntries
        .filter((e: any) => e.type === "outflow")
        .reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const ebitda = totalInflows - totalOutflows;
      const ebitdaPct = totalInflows > 0 ? ((ebitda / totalInflows) * 100).toFixed(1) : "—";

      const balRes = await supabase.from("finance_cashflow_balances")
        .select("opening_balance").eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).limit(1);
      const opening = (balRes.data as any)?.[0]?.opening_balance || 0;
      const cashBalance = opening + totalInflows - totalOutflows;

      const payments = paymentsRes.data || [];
      const overdue = payments.filter((p: any) =>
        (p.status === "pending" || p.status === "invoiced" || p.status === "overdue") && p.due_date < today
      );
      const overdueCount = overdue.length;
      const overdueAmount = overdue.reduce((s: number, p: any) => s + (p.amount || 0), 0);

      const budgets = budgetsRes.data || [];
      const overrunCount = budgets.filter((b: any) => {
        const spent = (b.labour_budget || 0) + (b.logistics_budget || 0);
        const sanctioned = b.sanctioned_budget || 0;
        return sanctioned > 0 && (spent / sanctioned) * 100 > 95;
      }).length;

      const fmt = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN")}`;

      setTiles([
        { label: "REVENUE MTD", value: fmt(clientInflows), color: clientInflows > 0 ? "#006039" : "#666666" },
        { label: "EBITDA MTD", value: fmt(ebitda), subtitle: ebitdaPct !== "—" ? `${ebitdaPct}%` : undefined, color: ebitda >= 0 ? "#006039" : "#F40009" },
        { label: "CASH BALANCE", value: fmt(cashBalance), color: cashBalance >= 0 ? "#006039" : "#F40009" },
        { label: "OVERDUE PAYMENTS", value: overdueCount > 0 ? `${overdueCount} · ${fmt(overdueAmount)}` : "0", color: overdueCount > 0 ? "#F40009" : "#006039" },
        { label: "BUDGET OVERRUNS", value: String(overrunCount), color: overrunCount > 0 ? "#F40009" : "#006039" },
      ]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[10px] bg-white p-3 animate-pulse" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div className="h-2 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      {tiles.map((t, i) => (
        <div key={i} className="rounded-[10px] bg-white p-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `3px solid ${t.color}` }}>
          <p className="text-[10px] uppercase tracking-wider font-display font-semibold" style={{ color: "#444444" }}>{t.label}</p>
          <p className="text-lg font-bold font-mono mt-1" style={{ color: t.color }}>{t.value}</p>
          {t.subtitle && <p className="text-xs font-mono" style={{ color: t.color }}>{t.subtitle}</p>}
        </div>
      ))}
    </div>
  );
}