import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

type Unit = "habitainer" | "ads";
type Status = "Pending" | "Partial" | "Received" | "Overdue";
const STATUSES: Status[] = ["Pending","Partial","Received","Overdue"];

interface Row {
  id: string;
  project_id: string | null;
  project_name: string;
  business_unit: Unit;
  milestone_name: string | null;
  milestone_value_excl_gst: number;
  invoice_date: string | null;
  invoice_number: string | null;
  amount_excl_gst: number;
  amount_incl_gst: number;
  payment_received_date: string | null;
  payment_status: Status;
  remarks: string | null;
}

const ACCESS_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","head_operations"];
const EDIT_ROLES = ["super_admin","managing_director","finance_director","finance_manager"];

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  Pending: { bg: "#F0F0F0", color: "#555" },
  Partial: { bg: "#FFF3CD", color: "#D4860A" },
  Received: { bg: "#E8F2ED", color: "#006039" },
  Overdue: { bg: "#FFE8E8", color: "#F40009" },
};

export function BillingTrackerTab() {
  const { role, loading: roleLoading } = useUserRole();
  const hasAccess = ACCESS_ROLES.includes(role || "");
  const canEdit = EDIT_ROLES.includes(role || "");

  const [unit, setUnit] = useState<Unit>("habitainer");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("billing_sales_tracker" as any) as any)
      .select("*").order("invoice_date", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (hasAccess) load(); }, [hasAccess, load]);

  async function addRow() {
    const { error } = await (supabase.from("billing_sales_tracker" as any) as any).insert({
      business_unit: unit, project_name: "New Project", payment_status: "Pending",
    });
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function updateField(id: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    const { error } = await (supabase.from("billing_sales_tracker" as any) as any).update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  }

  async function removeRow(id: string) {
    if (!confirm("Delete this row?")) return;
    const { error } = await (supabase.from("billing_sales_tracker" as any) as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  }

  const filtered = useMemo(() => rows.filter(r => r.business_unit === unit), [rows, unit]);

  const tiles = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now), end = endOfMonth(now);
    let invoicedMonth = 0, collectedMonth = 0, overdueAll = 0;
    rows.forEach(r => {
      if (r.invoice_date) {
        try {
          const d = parseISO(r.invoice_date);
          if (isWithinInterval(d, { start, end })) invoicedMonth += Number(r.amount_incl_gst) || 0;
        } catch {}
      }
      if (r.payment_received_date) {
        try {
          const d = parseISO(r.payment_received_date);
          if (isWithinInterval(d, { start, end })) collectedMonth += Number(r.amount_incl_gst) || 0;
        } catch {}
      }
      if (r.payment_status === "Overdue") overdueAll += Number(r.amount_incl_gst) || 0;
    });
    const pct = invoicedMonth > 0 ? (collectedMonth / invoicedMonth) * 100 : 0;
    return { invoicedMonth, collectedMonth, overdueAll, pct };
  }, [rows]);

  if (roleLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!hasAccess) return <p className="text-sm text-muted-foreground py-8 text-center">Access restricted.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Invoiced This Month (GST)", value: fmt(tiles.invoicedMonth), color: "#006039" },
          { label: "Collected This Month (GST)", value: fmt(tiles.collectedMonth), color: "#006039" },
          { label: "Total Overdue (GST)", value: fmt(tiles.overdueAll), color: "#F40009" },
          { label: "Collection %", value: tiles.pct.toFixed(1) + "%", color: "#006039" },
        ].map(t => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-xl font-bold font-display mt-1" style={{ color: t.color }}>{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
          <TabsList>
            <TabsTrigger value="habitainer">Habitainer</TabsTrigger>
            <TabsTrigger value="ads">ADS</TabsTrigger>
          </TabsList>
        </Tabs>
        {canEdit && (
          <Button size="sm" onClick={addRow} className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-[11px] whitespace-nowrap">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-2 text-left">Project</th>
                <th className="px-2 py-2 text-left">Milestone</th>
                <th className="px-2 py-2 text-right">Milestone Value (excl)</th>
                <th className="px-2 py-2 text-left">Invoice Date</th>
                <th className="px-2 py-2 text-left">Invoice #</th>
                <th className="px-2 py-2 text-right">Amount (excl)</th>
                <th className="px-2 py-2 text-right">Amount (incl)</th>
                <th className="px-2 py-2 text-left">Payment Date</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Remarks</th>
                {canEdit && <th className="px-2 py-2 w-8" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">No invoices yet.</td></tr>
              ) : filtered.map(r => {
                const sty = STATUS_STYLE[r.payment_status];
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] min-w-[140px]" defaultValue={r.project_name}
                          onBlur={e => e.target.value !== r.project_name && updateField(r.id, { project_name: e.target.value })} />
                      ) : r.project_name}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] min-w-[120px]" defaultValue={r.milestone_name ?? ""}
                          onBlur={e => e.target.value !== (r.milestone_name ?? "") && updateField(r.id, { milestone_name: e.target.value })} />
                      ) : (r.milestone_name || "—")}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {canEdit ? (
                        <Input type="number" className="h-7 text-[11px] text-right w-24" defaultValue={r.milestone_value_excl_gst}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0;
                            if (v !== r.milestone_value_excl_gst) updateField(r.id, { milestone_value_excl_gst: v });
                          }} />
                      ) : fmt(r.milestone_value_excl_gst)}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input type="date" className="h-7 text-[11px] w-32" defaultValue={r.invoice_date ?? ""}
                          onBlur={e => updateField(r.id, { invoice_date: e.target.value || null })} />
                      ) : (r.invoice_date || "—")}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] w-28" defaultValue={r.invoice_number ?? ""}
                          onBlur={e => e.target.value !== (r.invoice_number ?? "") && updateField(r.id, { invoice_number: e.target.value })} />
                      ) : (r.invoice_number || "—")}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {canEdit ? (
                        <Input type="number" className="h-7 text-[11px] text-right w-24" defaultValue={r.amount_excl_gst}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0;
                            if (v !== r.amount_excl_gst) updateField(r.id, { amount_excl_gst: v });
                          }} />
                      ) : fmt(r.amount_excl_gst)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {canEdit ? (
                        <Input type="number" className="h-7 text-[11px] text-right w-24" defaultValue={r.amount_incl_gst}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0;
                            if (v !== r.amount_incl_gst) updateField(r.id, { amount_incl_gst: v });
                          }} />
                      ) : fmt(r.amount_incl_gst)}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input type="date" className="h-7 text-[11px] w-32" defaultValue={r.payment_received_date ?? ""}
                          onBlur={e => updateField(r.id, { payment_received_date: e.target.value || null })} />
                      ) : (r.payment_received_date || "—")}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Select value={r.payment_status} onValueChange={(v) => updateField(r.id, { payment_status: v as Status })}>
                          <SelectTrigger className="h-7 text-[11px] w-28" style={{ backgroundColor: sty.bg, color: sty.color }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{ backgroundColor: sty.bg, color: sty.color }}>{r.payment_status}</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit ? (
                        <Input className="h-7 text-[11px] min-w-[120px]" defaultValue={r.remarks ?? ""}
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
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
