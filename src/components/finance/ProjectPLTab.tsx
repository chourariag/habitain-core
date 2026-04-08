import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface ProjectRow {
  id: string;
  name: string;
  division: string;
  contract_value: number;
  gfc_budget: number;
  materials_purchased: number;
  actual_consumption: number;
  labour_cost: number;
  planned_labour_cost: number;
  overhead: number;
  total_cost: number;
  gross_margin: number;
  margin_pct: number;
  status: string;
  material_overrun_pct: number | null;
  labour_overrun_pct: number | null;
}

const FULL_ACCESS_ROLES = [
  "finance_director", "managing_director", "super_admin", "finance_manager",
];
const SUMMARY_ROLES = [
  "sales_director", "architecture_director",
];

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n || 0).toFixed(2) + "%";

function marginColor(pct: number) {
  if (pct >= 30) return "#006039";
  if (pct >= 15) return "#D4860A";
  return "#F40009";
}

export function ProjectPLTab() {
  const { role } = useUserRole();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [detail, setDetail] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);

  const hasFullAccess = FULL_ACCESS_ROLES.includes(role || "");
  const hasSummaryAccess = SUMMARY_ROLES.includes(role || "");
  const hasAccess = hasFullAccess || hasSummaryAccess;

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    loadData();
  }, [hasAccess]);

  async function loadData() {
    setLoading(true);
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, status, contract_value, gfc_budget, planned_labour_cost")
      .in("status", ["active", "completed", "in_progress"]);

    // Get budget data
    const { data: budgets } = await supabase
      .from("finance_project_budgets")
      .select("project_id, sanctioned_budget, labour_budget");

    // Get material request totals per project as proxy for purchases
    const { data: mrs } = await supabase
      .from("material_requests")
      .select("project_id, quantity, unit_cost");

    // Get daily actuals for labour costs
    const { data: actuals } = await supabase
      .from("daily_actuals")
      .select("project_id, hours_worked");

    const budgetMap: Record<string, { budget: number; labour: number }> = {};
    (budgets || []).forEach((b: any) => {
      if (b.project_id) budgetMap[b.project_id] = {
        budget: b.sanctioned_budget || 0,
        labour: b.labour_budget || 0,
      };
    });

    const matMap: Record<string, number> = {};
    (mrs || []).forEach((r: any) => {
      if (r.project_id) {
        matMap[r.project_id] = (matMap[r.project_id] || 0) + ((r.quantity || 0) * (r.unit_cost || 0));
      }
    });

    const labourMap: Record<string, number> = {};
    (actuals || []).forEach((a: any) => {
      if (a.project_id) {
        // Approximate: hours × ₹250/hr average rate
        labourMap[a.project_id] = (labourMap[a.project_id] || 0) + ((a.hours_worked || 0) * 250);
      }
    });

    const built: ProjectRow[] = (projects || []).map((p: any) => {
      const contractValue = p.contract_value || 0;
      const gfcBudget = p.gfc_budget || budgetMap[p.id]?.budget || 0;
      const materialsPurchased = matMap[p.id] || 0;
      const actualConsumption = materialsPurchased * 0.85; // ~85% consumed
      const labourCost = labourMap[p.id] || 0;
      const plannedLabour = p.planned_labour_cost || budgetMap[p.id]?.labour || 0;
      const overhead = (materialsPurchased + labourCost) * 0.1;
      const totalCost = materialsPurchased + labourCost + overhead;
      const grossMargin = contractValue - totalCost;
      const marginPct = contractValue > 0 ? (grossMargin / contractValue) * 100 : 0;

      const materialOverrun = gfcBudget > 0
        ? ((actualConsumption - gfcBudget) / gfcBudget) * 100
        : null;
      const labourOverrun = plannedLabour > 0
        ? ((labourCost - plannedLabour) / plannedLabour) * 100
        : null;

      return {
        id: p.id,
        name: p.name,
        division: "Habitainer",
        contract_value: contractValue,
        gfc_budget: gfcBudget,
        materials_purchased: materialsPurchased,
        actual_consumption: actualConsumption,
        labour_cost: labourCost,
        planned_labour_cost: plannedLabour,
        overhead,
        total_cost: totalCost,
        gross_margin: grossMargin,
        margin_pct: marginPct,
        status: p.status,
        material_overrun_pct: materialOverrun !== null && materialOverrun > 10 ? materialOverrun : null,
        labour_overrun_pct: labourOverrun !== null && labourOverrun > 15 ? labourOverrun : null,
      };
    });

    built.sort((a, b) => a.margin_pct - b.margin_pct);
    setRows(built);
    setLoading(false);
  }

  if (!hasAccess) {
    return (
      <div className="text-center py-12" style={{ color: "#999999" }}>
        <p className="font-semibold">Access Restricted</p>
        <p className="text-sm mt-1">Project P&L is available to Finance Director, MD, and Finance Manager.</p>
      </div>
    );
  }

  const activeRows = rows.filter(r => r.status !== "completed");
  const avgMargin = activeRows.length > 0
    ? activeRows.reduce((s, r) => s + r.margin_pct, 0) / activeRows.length : 0;
  const totalRevenue = rows.reduce((s, r) => s + r.contract_value, 0);
  const totalCost = rows.reduce((s, r) => s + r.total_cost, 0);
  const lowMarginCount = activeRows.filter(r => r.margin_pct < 15).length;

  const tiles = [
    { label: "Avg Margin %", value: fmtPct(avgMargin), color: marginColor(avgMargin) },
    { label: "Total Revenue", value: fmt(totalRevenue), color: "#1A1A1A" },
    { label: "Total Cost", value: fmt(totalCost), color: "#1A1A1A" },
    { label: "Margin < 15%", value: String(lowMarginCount), color: lowMarginCount > 0 ? "#F40009" : "#006039" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(t => (
          <Card key={t.label} className="border" style={{ borderColor: "#E0E0E0" }}>
            <CardContent className="p-4">
              <p className="text-xs font-medium" style={{ color: "#999999" }}>{t.label}</p>
              <p className="text-xl font-bold font-display mt-1" style={{ color: t.color }}>{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg" style={{ borderColor: "#E0E0E0" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
              {["Project", "Division", "Contract Value", "GFC Budget", "Materials", "Consumption",
                "Labour", "Overhead 10%", "Total Cost", "Gross Margin", "Margin %", "Status"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap" style={{ color: "#666666" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="text-center py-8" style={{ color: "#999999" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-8" style={{ color: "#999999" }}>No project data available</td></tr>
            ) : rows.map(r => (
              <tr
                key={r.id}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid #E0E0E0" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F7F7F7")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
                onClick={() => hasFullAccess && setDetail(r)}
              >
                <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "#1A1A1A" }}>
                  <div className="flex items-center gap-2">
                    {r.name}
                    {r.material_overrun_pct !== null && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Material +{r.material_overrun_pct.toFixed(0)}%
                      </Badge>
                    )}
                    {r.labour_overrun_pct !== null && (
                      <Badge className="text-[10px] gap-1" style={{ backgroundColor: "#D4860A", color: "#fff" }}>
                        <AlertTriangle className="h-3 w-3" />
                        Labour +{r.labour_overrun_pct.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#666666" }}>{r.division}</td>
                {!hasSummaryAccess || hasFullAccess ? (
                  <>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.contract_value)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.gfc_budget)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.materials_purchased)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.actual_consumption)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.labour_cost)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.overhead)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{fmt(r.total_cost)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold" style={{ color: marginColor(r.margin_pct) }}>
                      {fmt(r.gross_margin)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(r.contract_value)}</td>
                    <td colSpan={7} className="px-3 py-2 text-center" style={{ color: "#999999" }}>
                      — Summary view —
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right whitespace-nowrap font-bold" style={{ color: marginColor(r.margin_pct) }}>
                  {fmtPct(r.margin_pct)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down drawer */}
      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{detail.name} — Cost Breakdown</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Cost composition chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Materials", value: detail.materials_purchased },
                      { name: "Labour", value: detail.labour_cost },
                      { name: "Overhead", value: detail.overhead },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="value" fill="#006039" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Key figures */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Contract Value", fmt(detail.contract_value)],
                    ["GFC Budget", fmt(detail.gfc_budget)],
                    ["Materials Purchased", fmt(detail.materials_purchased)],
                    ["Actual Consumption", fmt(detail.actual_consumption)],
                    ["Labour Cost", fmt(detail.labour_cost)],
                    ["Planned Labour", fmt(detail.planned_labour_cost)],
                    ["Overhead (10%)", fmt(detail.overhead)],
                    ["Total Cost", fmt(detail.total_cost)],
                  ].map(([label, val]) => (
                    <div key={label} className="p-2 rounded" style={{ backgroundColor: "#F7F7F7" }}>
                      <p className="text-xs" style={{ color: "#999999" }}>{label}</p>
                      <p className="font-semibold" style={{ color: "#1A1A1A" }}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Margin highlight */}
                <Card className="border-2" style={{ borderColor: marginColor(detail.margin_pct) }}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs font-medium" style={{ color: "#666666" }}>Gross Margin</p>
                    <p className="text-3xl font-bold font-display" style={{ color: marginColor(detail.margin_pct) }}>
                      {fmtPct(detail.margin_pct)}
                    </p>
                    <p className="text-sm mt-1" style={{ color: marginColor(detail.margin_pct) }}>
                      {fmt(detail.gross_margin)}
                    </p>
                  </CardContent>
                </Card>

                {/* Overhead breakdown */}
                <div className="text-xs space-y-1" style={{ color: "#666666" }}>
                  <p className="font-semibold" style={{ color: "#1A1A1A" }}>Overhead Allocation (10%)</p>
                  <p>• Indirect Site Cost (2.5%): {fmt((detail.materials_purchased + detail.labour_cost) * 0.025)}</p>
                  <p>• General Overhead (7.5%): {fmt((detail.materials_purchased + detail.labour_cost) * 0.075)}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
