import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { fetchRunningBill } from "@/lib/measurement-helpers";

const INR = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function RunningBillTable({ projectId }: { projectId: string | null }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchRunningBill>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) { setRows([]); return; }
    (async () => {
      setLoading(true);
      try { setRows(await fetchRunningBill(projectId)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [projectId]);

  if (!projectId) return <p className="text-sm text-muted-foreground p-4">Select a project to view the running bill.</p>;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (rows.length === 0) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No BOQ items yet for this project.</CardContent></Card>;

  const totalBoq = rows.reduce((a, r) => a + Number(r.boq_value || 0), 0);
  const totalEarned = rows.reduce((a, r) => a + Number(r.value_earned || 0), 0);
  const pct = totalBoq > 0 ? (totalEarned / totalBoq) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total BOQ Value</p><p className="text-xl font-bold">{INR(totalBoq)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Value Earned</p><p className="text-xl font-bold" style={{ color: "#006039" }}>{INR(totalEarned)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">% Complete</p><p className="text-xl font-bold">{pct.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Remaining</p><p className="text-xl font-bold">{INR(totalBoq - totalEarned)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Running Bill</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead style={{ backgroundColor: "#F7F7F7" }}>
              <tr className="text-left">
                <th className="px-3 py-2">Item</th><th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">BOQ Qty</th><th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">BOQ Value</th>
                <th className="px-3 py-2 text-right">Factory</th><th className="px-3 py-2 text-right">Site</th>
                <th className="px-3 py-2 text-right">Total Done</th>
                <th className="px-3 py-2 text-right">% Complete</th><th className="px-3 py-2 text-right">Earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.boq_item_id} className="border-t">
                  <td className="px-3 py-2">{r.description}</td><td className="px-3 py-2">{r.unit}</td>
                  <td className="px-3 py-2 text-right">{r.boq_qty}</td>
                  <td className="px-3 py-2 text-right">{INR(Number(r.boq_rate))}</td>
                  <td className="px-3 py-2 text-right">{INR(Number(r.boq_value))}</td>
                  <td className="px-3 py-2 text-right">{Number(r.qty_done_factory).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{Number(r.qty_done_site).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{Number(r.total_qty_done).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{Number(r.pct_complete).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right" style={{ color: "#006039" }}>{INR(Number(r.value_earned))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
