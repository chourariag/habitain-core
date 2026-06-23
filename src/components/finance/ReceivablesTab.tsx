import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Section = "habitainer" | "ads" | "ads_design";

interface Row {
  id: string;
  project_id: string | null;
  project_name: string;
  section: Section;
  total_amount_incl_gst: number;
  received_amount_incl_gst: number;
  basic_amount_this_bill: number;
  current_receivables_incl_gst: number;
  cumulative_received_incl_gst: number;
  retention_percent: number;
  retention_amount: number;
  pending_amount_excl_retention: number;
  remarks: string | null;
}

const ACCESS_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","head_operations"];
const EDIT_ROLES = ["super_admin","managing_director","finance_director","finance_manager"];

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const NUM_FIELDS = [
  "total_amount_incl_gst","received_amount_incl_gst","basic_amount_this_bill",
  "current_receivables_incl_gst","cumulative_received_incl_gst",
  "retention_percent","retention_amount","pending_amount_excl_retention",
] as const;

export function ReceivablesTab() {
  const { role, loading: roleLoading } = useUserRole();
  const hasAccess = ACCESS_ROLES.includes(role || "");
  const canEdit = EDIT_ROLES.includes(role || "");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("receivables_tracker" as any) as any)
      .select("*").order("section", { ascending: true }).order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (hasAccess) load(); }, [hasAccess, load]);

  async function addRow(section: Section) {
    const { error } = await (supabase.from("receivables_tracker" as any) as any).insert({
      section, project_name: "New Project",
    });
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function updateField(id: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const { error } = await (supabase.from("receivables_tracker" as any) as any).update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this row?")) return;
    const { error } = await (supabase.from("receivables_tracker" as any) as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  }

  const grouped = useMemo(() => ({
    habitainer: rows.filter(r => r.section === "habitainer"),
    ads: rows.filter(r => r.section === "ads"),
    ads_design: rows.filter(r => r.section === "ads_design"),
  }), [rows]);

  function totals(list: Row[]) {
    const init: Record<string, number> = {};
    NUM_FIELDS.forEach(k => init[k] = 0);
    list.forEach(r => NUM_FIELDS.forEach(k => init[k] += Number(r[k]) || 0));
    return init;
  }

  function exportExcel() {
    const headers = [
      "Sl. No.","Project Name","Total (incl GST)","Received (incl GST)","Basic This Bill (excl GST)",
      "Current Receivables (incl GST)","Cumulative Received (incl GST)",
      "Retention %","Retention Amount","Pending (excl retention)","Remarks",
    ];
    const lines: string[] = [];
    const dump = (title: string, list: Row[]) => {
      lines.push(`"${title}"`);
      lines.push(headers.join(","));
      list.forEach((r, i) => {
        lines.push([
          i+1, `"${r.project_name}"`, r.total_amount_incl_gst, r.received_amount_incl_gst,
          r.basic_amount_this_bill, r.current_receivables_incl_gst, r.cumulative_received_incl_gst,
          r.retention_percent, r.retention_amount, r.pending_amount_excl_retention,
          `"${r.remarks || ""}"`,
        ].join(","));
      });
      const t = totals(list);
      lines.push([
        "","Total", t.total_amount_incl_gst, t.received_amount_incl_gst, t.basic_amount_this_bill,
        t.current_receivables_incl_gst, t.cumulative_received_incl_gst,
        "", t.retention_amount, t.pending_amount_excl_retention, "",
      ].join(","));
      lines.push("");
    };
    dump("SECTION A — Habitainer Projects", grouped.habitainer);
    dump("SECTION B — ADS / Design Projects", grouped.ads);
    dump("SECTION B (Design Receivables) — ADS Design-Only", grouped.ads_design);

    const gt = totals(rows);
    lines.push(["","GRAND TOTAL", gt.total_amount_incl_gst, gt.received_amount_incl_gst, gt.basic_amount_this_bill,
      gt.current_receivables_incl_gst, gt.cumulative_received_incl_gst,
      "", gt.retention_amount, gt.pending_amount_excl_retention, ""].join(","));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Receivables_${format(new Date(),"yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  }

  if (roleLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!hasAccess) return <p className="text-sm text-muted-foreground py-8 text-center">Access restricted.</p>;

  function SectionTable({ title, section, list }: { title: string; section: Section; list: Row[] }) {
    const t = totals(list);
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold" style={{ color: "#006039" }}>{title}</h3>
            {canEdit && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addRow(section)}>
                <Plus className="h-3 w-3 mr-1" /> Add Row
              </Button>
            )}
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">Project Name</th>
                  <th className="px-2 py-1 text-right">Total (GST)</th>
                  <th className="px-2 py-1 text-right">Received (GST)</th>
                  <th className="px-2 py-1 text-right">Basic This Bill (excl)</th>
                  <th className="px-2 py-1 text-right">Current Receivables (GST)</th>
                  <th className="px-2 py-1 text-right">Cumulative Received (GST)</th>
                  <th className="px-2 py-1 text-right">Ret. %</th>
                  <th className="px-2 py-1 text-right">Ret. Amt</th>
                  <th className="px-2 py-1 text-right">Pending (excl ret.)</th>
                  <th className="px-2 py-1 text-left">Remarks</th>
                  {canEdit && <th className="px-2 py-1 w-8" />}
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-3 text-muted-foreground">No rows.</td></tr>
                ) : list.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">{i+1}</td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] min-w-[150px]" defaultValue={r.project_name}
                          onBlur={e => e.target.value !== r.project_name && updateField(r.id, { project_name: e.target.value })} />
                      ) : r.project_name}
                    </td>
                    {NUM_FIELDS.map(k => (
                      <td key={k} className="px-2 py-1 text-right">
                        {canEdit ? (
                          <Input type="number" className="h-7 text-[11px] text-right w-24"
                            defaultValue={r[k]}
                            onBlur={e => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== r[k]) updateField(r.id, { [k]: v } as any);
                            }} />
                        ) : (k === "retention_percent" ? (r[k] || 0).toFixed(1) + "%" : fmt(r[k]))}
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] min-w-[140px]" defaultValue={r.remarks ?? ""}
                          onBlur={e => e.target.value !== (r.remarks ?? "") && updateField(r.id, { remarks: e.target.value })} />
                      ) : (r.remarks || "—")}
                    </td>
                    {canEdit && (
                      <td className="px-2 py-1">
                        <button onClick={() => removeRow(r.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {list.length > 0 && (
                <tfoot className="bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-2 py-1" colSpan={2}>Section Total</td>
                    <td className="px-2 py-1 text-right">{fmt(t.total_amount_incl_gst)}</td>
                    <td className="px-2 py-1 text-right">{fmt(t.received_amount_incl_gst)}</td>
                    <td className="px-2 py-1 text-right">{fmt(t.basic_amount_this_bill)}</td>
                    <td className="px-2 py-1 text-right">{fmt(t.current_receivables_incl_gst)}</td>
                    <td className="px-2 py-1 text-right">{fmt(t.cumulative_received_incl_gst)}</td>
                    <td className="px-2 py-1" />
                    <td className="px-2 py-1 text-right">{fmt(t.retention_amount)}</td>
                    <td className="px-2 py-1 text-right">{fmt(t.pending_amount_excl_retention)}</td>
                    <td colSpan={canEdit ? 2 : 1} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  const gt = totals(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Receivables Tracker</h2>
        <Button size="sm" variant="outline" onClick={exportExcel} className="h-9">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <SectionTable title="Section A — Habitainer Projects" section="habitainer" list={grouped.habitainer} />
          <SectionTable title="Section B — ADS / Design Projects" section="ads" list={grouped.ads} />
          <SectionTable title="Section B — Design Receivables (ADS Design-Only)" section="ads_design" list={grouped.ads_design} />

          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-6 text-sm">
                <div><span className="text-muted-foreground">Grand Total Receivables: </span><span className="font-bold" style={{ color: "#006039" }}>{fmt(gt.total_amount_incl_gst)}</span></div>
                <div><span className="text-muted-foreground">Cumulative Received: </span><span className="font-bold" style={{ color: "#006039" }}>{fmt(gt.cumulative_received_incl_gst)}</span></div>
                <div><span className="text-muted-foreground">Pending (excl retention): </span><span className="font-bold" style={{ color: "#F40009" }}>{fmt(gt.pending_amount_excl_retention)}</span></div>
                <div><span className="text-muted-foreground">Retention Held: </span><span className="font-bold" style={{ color: "#D4860A" }}>{fmt(gt.retention_amount)}</span></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
