import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, IndianRupee, TrendingDown, TrendingUp, Pencil } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";

// Categories are derived dynamically from each project's uploaded BOQ — no hardcoded list.

const EDIT_ROLES = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "costing_engineer"];

interface Props {
  projectId: string;
  contractValue: number;
}

const fmtINR = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function ProjectPLSubTab({ projectId, contractValue }: Props) {
  const { role } = useUserRole();
  const canEdit = EDIT_ROLES.includes(role ?? "");
  const [loading, setLoading] = useState(true);
  const [grns, setGrns] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [ctcEdits, setCtcEdits] = useState<Record<string, number>>({});
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: boqs } = await supabase
      .from("project_boq").select("id").eq("project_id", projectId)
      .order("version_number", { ascending: false }).limit(1);

    let items: any[] = [];
    if (boqs && boqs.length > 0) {
      const { data } = await supabase.from("project_boq_items")
        .select("category,total_amount").eq("boq_id", boqs[0].id);
      items = data ?? [];
    }

    const [grnRes, manRes] = await Promise.all([
      (supabase.from("project_grns" as any) as any).select("*").eq("project_id", projectId),
      (supabase.from("project_budget_manual_entries" as any) as any).select("*").eq("project_id", projectId),
    ]);
    setBoqItems(items);
    setGrns(grnRes.data ?? []);
    setManuals(manRes.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const rows = useMemo(() => {
    return BOQ_CATEGORIES.map((cat) => {
      const budget = boqItems
        .filter((i: any) => (i.category || "").toLowerCase() === cat.toLowerCase())
        .reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0);

      const grnSpent = grns
        .filter((g: any) => g.boq_category === cat)
        .reduce((s: number, g: any) => s + (Number(g.basic_amount_excl_gst) || 0), 0);
      const manSpent = manuals
        .filter((m: any) => m.boq_category === cat)
        .reduce((s: number, m: any) => s + (Number(m.amount_excl_gst) || 0), 0);
      const ctdActual = grnSpent + manSpent;
      const ctc = ctcEdits[cat] ?? ctdActual;
      const cac = ctc - ctdActual;
      const margin = budget - ctc;
      const clientPrice = contractValue > 0 ? (budget / boqItems.reduce((s: number, i: any) => s + (Number(i.total_amount) || 0), 0) || 0) * contractValue : 0;
      const grossMargin = clientPrice > 0 ? ((clientPrice - ctc) / clientPrice) * 100 : 0;

      return { cat, ctdActual, budget, ctc, cac, margin, clientPrice, grossMargin };
    }).filter(r => r.budget > 0 || r.ctdActual > 0);
  }, [boqItems, grns, manuals, contractValue, ctcEdits]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-base font-semibold text-foreground">Project P&L — Cost Report</h3>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "#006039", color: "white" }}>
                <th className="text-left px-3 py-2 font-display text-sm">Category</th>
                <th className="text-right px-3 py-2">CTD Actual</th>
                <th className="text-right px-3 py-2">Budgeted Cost</th>
                <th className="text-right px-3 py-2">CTC</th>
                <th className="text-right px-3 py-2">CAC</th>
                <th className="text-right px-3 py-2">Margin</th>
                <th className="text-right px-3 py-2">Client Price</th>
                <th className="text-right px-3 py-2">Gross Margin %</th>
                {canEdit && <th className="px-2 py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cat} className="border-b">
                  <td className="px-3 py-2 font-medium">{r.cat}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINR(r.ctdActual)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINR(r.budget)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINR(r.ctc)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINR(r.cac)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: r.margin >= 0 ? "#006039" : "#F40009" }}>{fmtINR(r.margin)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtINR(r.clientPrice)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: r.grossMargin >= 20 ? "#006039" : r.grossMargin >= 10 ? "#D4860A" : "#F40009" }}>
                    {r.grossMargin.toFixed(1)}%
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2">
                      <button onClick={() => { setEditOpen(r.cat); setEditValue(String(r.ctc)); }}
                        className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(rows.reduce((s, r) => s + r.ctdActual, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(rows.reduce((s, r) => s + r.budget, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(rows.reduce((s, r) => s + r.ctc, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(rows.reduce((s, r) => s + r.cac, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(rows.reduce((s, r) => s + r.margin, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtINR(contractValue)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {contractValue > 0 ? (((contractValue - rows.reduce((s, r) => s + r.ctc, 0)) / contractValue) * 100).toFixed(1) : "0.0"}%
                </td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* CTC edit modal */}
      {editOpen && (
        <Sheet open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader><SheetTitle>Edit CTC — {editOpen}</SheetTitle></SheetHeader>
            <div className="py-4">
              <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Cost to Complete" />
            </div>
            <SheetFooter>
              <Button onClick={() => {
                const v = Number(editValue);
                if (!isNaN(v) && editOpen) {
                  setCtcEdits(p => ({ ...p, [editOpen]: v }));
                }
                setEditOpen(null);
              }}>Save</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
