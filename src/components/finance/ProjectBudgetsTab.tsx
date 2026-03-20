import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from "recharts";

interface Budget {
  id: string; project_name: string; sanctioned_budget: number;
  labour_budget: number; logistics_budget: number; project_id: string | null;
}

export function ProjectBudgetsTab() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [materialSpent, setMaterialSpent] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<Budget | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("finance_project_budgets").select("*").order("project_name");
      setBudgets((data as Budget[]) || []);

      // Get material_requests totals per project
      const { data: mrs } = await supabase.from("material_requests").select("project_id, quantity");
      const map: Record<string, number> = {};
      (mrs || []).forEach((r: any) => { if (r.project_id) map[r.project_id] = (map[r.project_id] || 0) + (r.quantity || 0); });
      setMaterialSpent(map);
    })();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const { data: { user } } = await supabase.auth.getUser();
      for (const r of rows) {
        await supabase.from("finance_project_budgets").insert({
          project_name: r.Project_Name, sanctioned_budget: Number(r.Sanctioned_Budget) || 0,
          labour_budget: Number(r.Labour_Budget) || 0, logistics_budget: Number(r.Logistics_Budget) || 0,
          uploaded_by: user?.id,
        });
      }
      toast.success("Budgets uploaded");
      const { data } = await supabase.from("finance_project_budgets").select("*").order("project_name");
      setBudgets((data as Budget[]) || []);
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const csv = "Project_Name,Sanctioned_Budget,Labour_Budget,Logistics_Budget\nProject Alpha,5000000,800000,300000";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Budget_Template.csv"; a.click();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="flex flex-wrap gap-2">
        <label>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
            <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Budgets</span>
          </Button>
        </label>
        <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Download Template</Button>
      </div>

      {/* Budget Comparison Chart */}
      {budgets.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-display font-semibold mb-2" style={{ color: "#666" }}>Budget vs Spent</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={budgets.map(b => {
                  const matCommitted = b.project_id ? (materialSpent[b.project_id] || 0) : 0;
                  const totalSpent = matCommitted + b.labour_budget + b.logistics_budget;
                  const util = b.sanctioned_budget ? (totalSpent / b.sanctioned_budget) * 100 : 0;
                  return {
                    name: b.project_name.length > 12 ? b.project_name.slice(0, 12) + "…" : b.project_name,
                    fullName: b.project_name,
                    Budget: b.sanctioned_budget / 100000,
                    Spent: totalSpent / 100000,
                    util,
                    variance: (b.sanctioned_budget - totalSpent) / 100000,
                  };
                })}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#666" }} />
                <YAxis tick={{ fontSize: 10, fill: "#666" }} tickFormatter={(v: number) => `₹${v}L`} />
                <Tooltip
                  formatter={(v: number, name: string) => [`₹${v.toFixed(1)}L`, name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Budget" fill="#E5E7EB" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Spent" radius={[3, 3, 0, 0]}>
                  {budgets.map((b, i) => {
                    const matCommitted = b.project_id ? (materialSpent[b.project_id] || 0) : 0;
                    const totalSpent = matCommitted + b.labour_budget + b.logistics_budget;
                    const util = b.sanctioned_budget ? (totalSpent / b.sanctioned_budget) * 100 : 0;
                    const color = util < 80 ? "#006039" : util < 95 ? "#D4860A" : "#F40009";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ color: "#666" }}>
                <th className="text-left py-2 text-xs font-display">Project</th>
                <th className="text-right py-2 text-xs font-display">Sanctioned ₹</th>
                <th className="text-right py-2 text-xs font-display">Materials ₹</th>
                <th className="text-right py-2 text-xs font-display">Labour ₹</th>
                <th className="text-right py-2 text-xs font-display">Logistics ₹</th>
                <th className="text-right py-2 text-xs font-display">Total Spent ₹</th>
                <th className="text-center py-2 text-xs font-display">Utilisation</th>
                <th className="text-right py-2 text-xs font-display">Variance ₹</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map(b => {
                const matCommitted = b.project_id ? (materialSpent[b.project_id] || 0) : 0;
                const totalSpent = matCommitted + b.labour_budget + b.logistics_budget;
                const util = b.sanctioned_budget ? (totalSpent / b.sanctioned_budget) * 100 : 0;
                const variance = b.sanctioned_budget - totalSpent;
                const utilColor = util < 80 ? "#006039" : util < 95 ? "#D4860A" : "#F40009";
                return (
                  <tr key={b.id} className="border-b cursor-pointer hover:bg-gray-50" onClick={() => setDetail(b)}>
                    <td className="py-1.5 text-xs font-medium" style={{ color: "#1A1A1A" }}>{b.project_name}</td>
                    <td className="text-right py-1.5 text-xs font-mono">₹{b.sanctioned_budget.toLocaleString("en-IN")}</td>
                    <td className="text-right py-1.5 text-xs font-mono">₹{matCommitted.toLocaleString("en-IN")}</td>
                    <td className="text-right py-1.5 text-xs font-mono">₹{b.labour_budget.toLocaleString("en-IN")}</td>
                    <td className="text-right py-1.5 text-xs font-mono">₹{b.logistics_budget.toLocaleString("en-IN")}</td>
                    <td className="text-right py-1.5 text-xs font-mono">₹{totalSpent.toLocaleString("en-IN")}</td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, backgroundColor: utilColor }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: utilColor }}>{util.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-right py-1.5 text-xs font-mono" style={{ color: variance >= 0 ? "#006039" : "#F40009" }}>
                      ₹{Math.abs(variance).toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {budgets.length === 0 && <p className="text-center text-xs py-8" style={{ color: "#999" }}>Upload budget data to view project budgets</p>}
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent><SheetHeader><SheetTitle className="font-display">{detail?.project_name}</SheetTitle></SheetHeader>
          {detail && (
            <div className="space-y-3 py-4 text-sm">
              <div><span style={{ color: "#666" }}>Sanctioned Budget:</span> <span className="font-mono font-bold">₹{detail.sanctioned_budget.toLocaleString("en-IN")}</span></div>
              <div><span style={{ color: "#666" }}>Labour Budget:</span> <span className="font-mono">₹{detail.labour_budget.toLocaleString("en-IN")}</span></div>
              <div><span style={{ color: "#666" }}>Logistics Budget:</span> <span className="font-mono">₹{detail.logistics_budget.toLocaleString("en-IN")}</span></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
