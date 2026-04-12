import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, HardHat } from "lucide-react";

interface WIPRow {
  projectId: string;
  projectName: string;
  materialCost: number;
  labourCost: number;
  overhead: number;
  totalWIP: number;
}

export function WIPStatement() {
  const [rows, setRows] = useState<WIPRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWIP();
  }, []);

  const fetchWIP = async () => {
    setLoading(true);
    // Fetch active projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_archived", false)
      .order("name");

    if (!projects) { setLoading(false); return; }

    const wipRows: WIPRow[] = [];

    for (const p of projects) {
      // Material cost: sum of GRN items for this project
      const { data: grnItems } = await (supabase.from("grn_items" as any) as any)
        .select("total_cost")
        .eq("project_id", p.id);
      const materialCost = (grnItems ?? []).reduce((s: number, r: any) => s + (Number(r.total_cost) || 0), 0);

      // Labour cost: sum of payroll / expense entries tagged as labour
      const { data: labourExpenses } = await supabase
        .from("expense_entries")
        .select("amount")
        .eq("project_id", p.id)
        .in("category", ["Labour", "Contractor Payment", "Wages"]);
      const labourCost = (labourExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

      // Overhead: 5% of (material + labour)
      const overhead = (materialCost + labourCost) * 0.05;
      const totalWIP = materialCost + labourCost + overhead;

      if (totalWIP > 0) {
        wipRows.push({ projectId: p.id, projectName: p.name, materialCost, labourCost, overhead, totalWIP });
      }
    }

    setRows(wipRows);
    setLoading(false);
  };

  const totalWIP = rows.reduce((s, r) => s + r.totalWIP, 0);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#666" }}>WIP = Material Cost + Labour Cost + 5% Overhead</p>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#666" }}>Total WIP</p>
          <p className="text-xl font-bold font-mono" style={{ color: "#006039" }}>₹{totalWIP.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <HardHat className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm" style={{ color: "#999" }}>No active project WIP data found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs" style={{ color: "#666" }}>
                  <th className="text-left py-2">Project</th>
                  <th className="text-right py-2">Material</th>
                  <th className="text-right py-2">Labour</th>
                  <th className="text-right py-2">Overhead (5%)</th>
                  <th className="text-right py-2 font-semibold">Total WIP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.projectId} className="border-b hover:bg-muted/20">
                    <td className="py-2 font-medium" style={{ color: "#1A1A1A" }}>{r.projectName}</td>
                    <td className="py-2 text-right font-mono text-xs" style={{ color: "#666" }}>₹{r.materialCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right font-mono text-xs" style={{ color: "#666" }}>₹{r.labourCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right font-mono text-xs" style={{ color: "#D4860A" }}>₹{r.overhead.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 text-right font-mono font-bold" style={{ color: "#006039" }}>₹{r.totalWIP.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
                <tr className="border-t-2" style={{ borderColor: "#006039" }}>
                  <td className="py-2 font-bold text-xs uppercase" style={{ color: "#1A1A1A" }}>Total</td>
                  <td colSpan={3}></td>
                  <td className="py-2 text-right font-mono font-bold" style={{ color: "#006039" }}>₹{totalWIP.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
