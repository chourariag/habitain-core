import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, IndianRupee, TrendingDown, TrendingUp, Wallet, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { InvoiceScanner } from "@/components/inventory/InvoiceScanner";

const BOQ_CATEGORIES = [
  "Structure", "Insulation", "Wall Boarding", "Ceiling", "Flooring",
  "Openings", "Cladding", "Painting", "Waterproofing",
  "MEP Electrical", "MEP Plumbing", "Civil", "Miscellaneous",
];

interface Props {
  projectId: string;
  contractValue: number;
  userRole: string | null;
}

interface BoqItem { category: string | null; total_amount: number | null; }
interface Grn {
  id: string; boq_category: string; vendor_name: string; invoice_no: string | null;
  invoice_date: string | null; description: string | null;
  basic_amount_excl_gst: number; remark: string | null;
}
interface ManualEntry {
  id: string; boq_category: string; vendor_name: string | null; invoice_no: string | null;
  entry_date: string; description: string | null; amount_excl_gst: number; remark: string | null;
}
type Row =
  | (Grn & { _source: "grn" })
  | (ManualEntry & { _source: "manual" });

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function BudgetTrackingTab({ projectId, contractValue, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [manuals, setManuals] = useState<ManualEntry[]>([]);
  const [grnOpen, setGrnOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const canEdit = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "procurement"].includes(userRole ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: boqs } = await supabase
      .from("project_boq").select("id").eq("project_id", projectId)
      .order("version_number", { ascending: false }).limit(1);

    let items: BoqItem[] = [];
    if (boqs && boqs.length > 0) {
      const { data } = await supabase.from("project_boq_items")
        .select("category,total_amount").eq("boq_id", boqs[0].id);
      items = (data ?? []) as any;
    }

    const [grnRes, manRes] = await Promise.all([
      (supabase.from("project_grns" as any) as any).select("*").eq("project_id", projectId).order("received_at", { ascending: false }),
      (supabase.from("project_budget_manual_entries" as any) as any).select("*").eq("project_id", projectId).order("entry_date", { ascending: false }),
    ]);

    setBoqItems(items);
    setGrns((grnRes.data ?? []) as Grn[]);
    setManuals((manRes.data ?? []) as ManualEntry[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Aggregate budget per category from BOQ
  const budgetByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    BOQ_CATEGORIES.forEach((c) => (map[c] = 0));
    boqItems.forEach((i) => {
      const cat = (i.category ?? "").trim();
      const matched = BOQ_CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? "Miscellaneous";
      map[matched] = (map[matched] ?? 0) + (Number(i.total_amount) || 0);
    });
    return map;
  }, [boqItems]);

  const rowsByCategory = useMemo(() => {
    const map: Record<string, Row[]> = {};
    BOQ_CATEGORIES.forEach((c) => (map[c] = []));
    grns.forEach((g) => {
      const c = BOQ_CATEGORIES.includes(g.boq_category) ? g.boq_category : "Miscellaneous";
      map[c].push({ ...g, _source: "grn" });
    });
    manuals.forEach((m) => {
      const c = BOQ_CATEGORIES.includes(m.boq_category) ? m.boq_category : "Miscellaneous";
      map[c].push({ ...m, _source: "manual" });
    });
    return map;
  }, [grns, manuals]);

  const totalBudget = Object.values(budgetByCategory).reduce((s, n) => s + n, 0);
  const totalSpent =
    grns.reduce((s, g) => s + Number(g.basic_amount_excl_gst || 0), 0) +
    manuals.reduce((s, m) => s + Number(m.amount_excl_gst || 0), 0);
  const balance = totalBudget - totalSpent;
  const marginPct = contractValue > 0 ? ((contractValue - totalSpent) / contractValue) * 100 : 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Top summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<IndianRupee className="h-4 w-4" />} label="Contract Value" value={fmtINR(contractValue)} />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="GFC Budget" value={fmtINR(totalBudget)} />
        <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Actually Spent" value={fmtINR(totalSpent)} />
        <SummaryCard
          icon={balance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Balance"
          value={fmtINR(balance)}
          tone={balance >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Margin vs Contract"
          value={`${marginPct.toFixed(1)}%`}
          tone={marginPct >= 20 ? "good" : marginPct >= 10 ? "warn" : "bad"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button size="sm" onClick={() => setGrnOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add GRN
            </Button>
            <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Manual Entry
            </Button>
          </>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" /> GRNs recorded here automatically update this project's budget tracking
        </span>
      </div>

      {/* Per-category tables */}
      <div className="space-y-3">
        {BOQ_CATEGORIES.map((cat) => {
          const rows = rowsByCategory[cat] ?? [];
          const budget = budgetByCategory[cat] ?? 0;
          const spent = rows.reduce(
            (s, r) => s + (r._source === "grn" ? Number(r.basic_amount_excl_gst || 0) : Number((r as ManualEntry).amount_excl_gst || 0)),
            0,
          );
          const bal = budget - spent;
          if (rows.length === 0 && budget === 0) return null;

          return (
            <Card key={cat}>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#006039", color: "white" }}>
                      <th colSpan={6} className="text-left px-3 py-2 font-display font-semibold text-sm">{cat}</th>
                    </tr>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-medium">Vendor</th>
                      <th className="text-left px-3 py-1.5 font-medium">Invoice No</th>
                      <th className="text-left px-3 py-1.5 font-medium">Date</th>
                      <th className="text-left px-3 py-1.5 font-medium">Description</th>
                      <th className="text-right px-3 py-1.5 font-medium">Amount excl GST</th>
                      <th className="text-left px-3 py-1.5 font-medium">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-3 text-center text-muted-foreground italic">No entries yet</td></tr>
                    ) : rows.map((r) => {
                      const amt = r._source === "grn" ? r.basic_amount_excl_gst : (r as ManualEntry).amount_excl_gst;
                      const date = r._source === "grn" ? r.invoice_date : (r as ManualEntry).entry_date;
                      return (
                        <tr key={r.id} className={`border-b ${r._source === "manual" ? "bg-muted/40" : ""}`}>
                          <td className="px-3 py-1.5">{r.vendor_name ?? "—"}</td>
                          <td className="px-3 py-1.5">{r.invoice_no ?? "—"}</td>
                          <td className="px-3 py-1.5">{date ? format(new Date(date), "dd MMM yy") : "—"}</td>
                          <td className="px-3 py-1.5">
                            {r.description ?? "—"}
                            {r._source === "manual" && <Badge variant="outline" className="ml-2 text-[10px]">Manual</Badge>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">{fmtINR(Number(amt) || 0)}</td>
                          <td className="px-3 py-1.5">{r.remark ?? "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/60 font-medium">
                      <td colSpan={4} className="px-3 py-1.5 text-right">Total Spent</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(spent)}</td>
                      <td />
                    </tr>
                    <tr className="font-medium">
                      <td colSpan={4} className="px-3 py-1.5 text-right">GFC Budget Allocated</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(budget)}</td>
                      <td />
                    </tr>
                    <tr className="font-semibold border-t-2">
                      <td colSpan={4} className="px-3 py-1.5 text-right">Balance</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: bal >= 0 ? "#006039" : "#F40009" }}>
                        {fmtINR(bal)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <GrnDialog open={grnOpen} onOpenChange={setGrnOpen} projectId={projectId} onSaved={fetchAll} />
      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} projectId={projectId} onSaved={fetchAll} />
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "#006039" : tone === "bad" ? "#F40009" : tone === "warn" ? "#D4860A" : "#1A1A1A";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}<span>{label}</span></div>
        <div className="text-base font-display font-bold font-mono" style={{ color }}>{value}</div>
      </CardContent>
    </Card>
  );
}

function GrnDialog({ open, onOpenChange, projectId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    boq_category: "Structure", vendor_name: "", invoice_no: "", invoice_date: format(new Date(), "yyyy-MM-dd"),
    description: "", basic_amount_excl_gst: "", gst_amount: "", remark: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.vendor_name.trim() || !form.basic_amount_excl_gst) {
      toast.error("Vendor and amount are required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let name: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? user.email ?? null;
    }
    const { error } = await (supabase.from("project_grns" as any) as any).insert({
      project_id: projectId,
      boq_category: form.boq_category,
      vendor_name: form.vendor_name.trim(),
      invoice_no: form.invoice_no.trim() || null,
      invoice_date: form.invoice_date || null,
      description: form.description.trim() || null,
      basic_amount_excl_gst: Number(form.basic_amount_excl_gst) || 0,
      gst_amount: Number(form.gst_amount) || 0,
      remark: form.remark.trim() || null,
      created_by: user?.id ?? null,
      created_by_name: name,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("GRN added");
    onOpenChange(false);
    setForm({ ...form, vendor_name: "", invoice_no: "", description: "", basic_amount_excl_gst: "", gst_amount: "", remark: "" });
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display">Add GRN (Goods Receipt Note)</SheetTitle></SheetHeader>
        <div className="space-y-3 py-4">
          <Field label="BOQ Category">
            <Select value={form.boq_category} onValueChange={(v) => setForm({ ...form, boq_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOQ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vendor *"><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice No"><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
            <Field label="Invoice Date"><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount excl GST *"><Input type="number" inputMode="decimal" value={form.basic_amount_excl_gst} onChange={(e) => setForm({ ...form, basic_amount_excl_gst: e.target.value })} /></Field>
            <Field label="GST Amount"><Input type="number" inputMode="decimal" value={form.gst_amount} onChange={(e) => setForm({ ...form, gst_amount: e.target.value })} /></Field>
          </div>
          <Field label="Remark"><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
        </div>
        <SheetFooter><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save GRN</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ManualEntryDialog({ open, onOpenChange, projectId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    boq_category: "Miscellaneous", vendor_name: "", invoice_no: "",
    entry_date: format(new Date(), "yyyy-MM-dd"), description: "", amount_excl_gst: "", remark: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.amount_excl_gst) { toast.error("Amount required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let name: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? user.email ?? null;
    }
    const { error } = await (supabase.from("project_budget_manual_entries" as any) as any).insert({
      project_id: projectId,
      boq_category: form.boq_category,
      vendor_name: form.vendor_name.trim() || null,
      invoice_no: form.invoice_no.trim() || null,
      entry_date: form.entry_date,
      description: form.description.trim() || null,
      amount_excl_gst: Number(form.amount_excl_gst) || 0,
      remark: form.remark.trim() || null,
      created_by: user?.id ?? null,
      created_by_name: name,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Manual entry added");
    onOpenChange(false);
    setForm({ ...form, vendor_name: "", invoice_no: "", description: "", amount_excl_gst: "", remark: "" });
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display">Add Manual Entry</SheetTitle></SheetHeader>
        <div className="space-y-3 py-4">
          <Field label="BOQ Category">
            <Select value={form.boq_category} onValueChange={(v) => setForm({ ...form, boq_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOQ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vendor / Payee"><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reference No"><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Amount excl GST *"><Input type="number" inputMode="decimal" value={form.amount_excl_gst} onChange={(e) => setForm({ ...form, amount_excl_gst: e.target.value })} /></Field>
          <Field label="Remark"><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
        </div>
        <SheetFooter><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Entry</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
