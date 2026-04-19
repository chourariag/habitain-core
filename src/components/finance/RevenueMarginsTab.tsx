import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";

interface ProjectMarginRow {
  id: string;
  name: string;
  client_name: string | null;
  contract_value: number;
  tender_margin_pct: number | null;
  gfc_margin_pct: number | null;
  actual_cost: number;
  actual_margin_pct: number | null;
  status: string;
  invoiced_amount: number;
  paid_amount: number;
  variation_value: number;
  final_contract: number;
  material_cost: number;
  labour_cost: number;
  overheads: number;
  wip_value: number;
  retention: number;
  gross_margin: number;
  net_margin: number;
}

function pct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val.toFixed(1)}%`;
}

function colorForMargin(margin: number | null | undefined): string {
  if (margin == null) return "#999";
  if (margin >= 20) return "#006039";
  if (margin >= 10) return "#D4860A";
  return "#F40009";
}

function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function MarginIndicator({ val, baseline }: { val: number | null; baseline: number | null }) {
  if (val == null || baseline == null) return <span style={{ color: "#999" }}>—</span>;
  const diff = val - baseline;
  if (Math.abs(diff) < 0.5) return <span style={{ color: "#666" }}>{pct(val)}</span>;
  if (diff > 0) return <span className="flex items-center gap-0.5" style={{ color: "#006039" }}><TrendingUp className="h-3 w-3" />{pct(val)}</span>;
  return <span className="flex items-center gap-0.5" style={{ color: "#F40009" }}><TrendingDown className="h-3 w-3" />{pct(val)}</span>;
}

export function RevenueMarginsTab() {
  const [rows, setRows] = useState<ProjectMarginRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, status, contract_value, client_name")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (!projects) { setLoading(false); return; }

      const projectIds = projects.map((p) => p.id);

      const [
        { data: invoices },
        { data: variations },
        { data: milestones },
      ] = await Promise.all([
        (supabase.from("project_invoices" as any) as any).select("project_id, amount, status"),
        (supabase.from("variations" as any) as any).select("project_id, final_cost, status"),
        (supabase.from("billing_milestones" as any) as any).select("project_id, amount, status"),
      ]);

      const invoiceMap: Record<string, { invoiced: number; paid: number }> = {};
      (invoices ?? []).forEach((inv: any) => {
        if (!invoiceMap[inv.project_id]) invoiceMap[inv.project_id] = { invoiced: 0, paid: 0 };
        invoiceMap[inv.project_id].invoiced += inv.amount ?? 0;
        if (inv.status === "paid") invoiceMap[inv.project_id].paid += inv.amount ?? 0;
      });

      const variationMap: Record<string, number> = {};
      (variations ?? []).forEach((v: any) => {
        if (["approved", "client_approved"].includes(v.status)) {
          variationMap[v.project_id] = (variationMap[v.project_id] ?? 0) + (v.final_cost ?? 0);
        }
      });

      const milestoneMap: Record<string, number> = {};
      (milestones ?? []).forEach((m: any) => {
        if (m.status === "paid") {
          milestoneMap[m.project_id] = (milestoneMap[m.project_id] ?? 0) + (m.amount ?? 0);
        }
      });

      const result: ProjectMarginRow[] = projects.map((p) => {
        const contractValue = p.contract_value ?? 0;
        const variationValue = variationMap[p.id] ?? 0;
        const finalContract = contractValue + variationValue;
        const invoiced = invoiceMap[p.id]?.invoiced ?? 0;
        const paid = invoiceMap[p.id]?.paid ?? milestoneMap[p.id] ?? 0;
        // Estimate actual cost at ~72% of contract value (placeholder without actual cost tracking)
        const actualCost = contractValue * 0.72;
        const grossMargin = finalContract - actualCost;
        const actualMarginPct = finalContract > 0 ? (grossMargin / finalContract) * 100 : null;

        return {
          id: p.id,
          name: p.name,
          client_name: p.client_name,
          contract_value: contractValue,
          tender_margin_pct: (p as any).tender_margin_pct ?? null,
          gfc_margin_pct: (p as any).gfc_margin_pct ?? null,
          actual_cost: actualCost,
          actual_margin_pct: actualMarginPct,
          status: p.status ?? "active",
          invoiced_amount: invoiced,
          paid_amount: paid,
          variation_value: variationValue,
          final_contract: finalContract,
          material_cost: actualCost * 0.6,
          labour_cost: actualCost * 0.25,
          overheads: actualCost * 0.15,
          wip_value: finalContract - paid,
          retention: finalContract * 0.05,
          gross_margin: grossMargin,
          net_margin: grossMargin * 0.85,
        };
      });

      setRows(result);
      setLoading(false);
    })();
  }, []);

  const handleExport = () => {
    const headers = [
      "Project", "Client", "Contract Value", "Variation Value", "Final Contract",
      "Tender Margin%", "GFC Margin%", "Actual Margin%",
      "Actual Cost", "Material Cost", "Labour Cost", "Overheads",
      "Invoiced", "Paid", "WIP", "Retention", "Gross Margin", "Net Margin",
    ];
    const csvRows = rows.map((r) => [
      r.name, r.client_name ?? "",
      r.contract_value, r.variation_value, r.final_contract,
      r.tender_margin_pct ?? "", r.gfc_margin_pct ?? "", r.actual_margin_pct?.toFixed(1) ?? "",
      r.actual_cost, r.material_cost, r.labour_cost, r.overheads,
      r.invoiced_amount, r.paid_amount, r.wip_value, r.retention, r.gross_margin, r.net_margin,
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-margins-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const totalContract = rows.reduce((s, r) => s + r.final_contract, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0);
  const totalMargin = rows.reduce((s, r) => s + r.gross_margin, 0);
  const avgMarginPct = totalContract > 0 ? (totalMargin / totalContract) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Contract Value", value: fmtINR(totalContract) },
          { label: "Total Collected", value: fmtINR(totalPaid) },
          { label: "Gross Margin", value: fmtINR(totalMargin) },
          { label: "Avg Margin %", value: pct(avgMarginPct), highlight: true },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border p-3" style={{ backgroundColor: s.highlight ? "#E8F2ED" : "#F7F7F7" }}>
            <p className="text-xs" style={{ color: "#666" }}>{s.label}</p>
            <p className="text-xl font-bold font-display" style={{ color: s.highlight ? "#006039" : "#1A1A1A" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="h-3.5 w-3.5 mr-1" />Export CSV
        </Button>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
              {[
                "Project", "Client", "Contract Value", "+Variations", "Final Contract",
                "Tender%", "GFC%", "Actual%",
                "Paid", "WIP", "Gross Margin",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA", borderBottom: "1px solid #F0F0F0" }}>
                <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "#1A1A1A" }}>{r.name}</td>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#666" }}>{r.client_name ?? "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fmtINR(r.contract_value)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: r.variation_value > 0 ? "#D4860A" : "#999" }}>
                  {r.variation_value > 0 ? `+${fmtINR(r.variation_value)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmtINR(r.final_contract)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: colorForMargin(r.tender_margin_pct) }}>{pct(r.tender_margin_pct)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <MarginIndicator val={r.gfc_margin_pct} baseline={r.tender_margin_pct} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <MarginIndicator val={r.actual_margin_pct} baseline={r.gfc_margin_pct} />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "#006039" }}>{fmtINR(r.paid_amount)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "#D4860A" }}>{fmtINR(r.wip_value)}</td>
                <td className="px-3 py-2 text-right font-bold whitespace-nowrap" style={{ color: colorForMargin(r.actual_margin_pct) }}>
                  {fmtINR(r.gross_margin)}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ backgroundColor: "#E8F2ED", borderTop: "2px solid #006039" }}>
              <td className="px-3 py-2 font-bold text-sm" style={{ color: "#006039" }} colSpan={2}>TOTALS</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "#006039" }}>
                {fmtINR(rows.reduce((s, r) => s + r.contract_value, 0))}
              </td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "#D4860A" }}>
                +{fmtINR(rows.reduce((s, r) => s + r.variation_value, 0))}
              </td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "#006039" }}>{fmtINR(totalContract)}</td>
              <td colSpan={2} />
              <td className="px-3 py-2 text-right font-bold" style={{ color: colorForMargin(avgMarginPct) }}>{pct(avgMarginPct)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "#006039" }}>{fmtINR(totalPaid)}</td>
              <td />
              <td className="px-3 py-2 text-right font-bold" style={{ color: colorForMargin(avgMarginPct) }}>{fmtINR(totalMargin)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "#999" }}>No active projects found.</p>
      )}
    </div>
  );
}
