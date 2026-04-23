import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Plus, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { InvoiceScanner } from "@/components/inventory/InvoiceScanner";

const BOQ_CATEGORIES = [
  "Structure", "Insulation", "Wall Boarding", "Ceiling", "Flooring",
  "Openings", "Cladding", "Painting", "Waterproofing",
  "MEP Electrical", "MEP Plumbing", "Civil", "Miscellaneous",
];

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface Grn {
  id: string; boq_category: string; vendor_name: string; invoice_no: string | null;
  invoice_date: string | null; description: string | null;
  basic_amount_excl_gst: number; remark: string | null; project_id: string;
}

interface GRNTabProps {
  filterProjectId?: string | null;
}

export function GRNTab({ filterProjectId }: GRNTabProps) {
  const { projects, selectedProjectId } = useProjectContext();
  const [grns, setGrns] = useState<Grn[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>(filterProjectId ?? "all");

  const fetchGrns = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from("project_grns" as any) as any).select("*").order("received_at", { ascending: false });
    if (projectFilter && projectFilter !== "all") {
      query = query.eq("project_id", projectFilter);
    }
    const { data } = await query;
    setGrns((data ?? []) as Grn[]);
    setLoading(false);
  }, [projectFilter]);

  useEffect(() => { fetchGrns(); }, [fetchGrns]);

  useEffect(() => {
    if (filterProjectId) setProjectFilter(filterProjectId);
  }, [filterProjectId]);

  const projectMap: Record<string, string> = {};
  projects.forEach(p => { projectMap[p.id] = p.name; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-4 w-4 mr-1" /> Add GRN
        </Button>
        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : grns.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No GRNs recorded yet</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "#006039", color: "white" }}>
                  <th className="text-left px-3 py-2 font-display font-semibold">Project</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Category</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Vendor</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Invoice No</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Description</th>
                  <th className="text-right px-3 py-2 font-display font-semibold">Amount excl GST</th>
                  <th className="text-left px-3 py-2 font-display font-semibold">Remark</th>
                </tr>
              </thead>
              <tbody>
                {grns.map(g => (
                  <tr key={g.id} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-medium">{projectMap[g.project_id] ?? "—"}</td>
                    <td className="px-3 py-1.5"><Badge variant="outline" className="text-[10px]">{g.boq_category}</Badge></td>
                    <td className="px-3 py-1.5">{g.vendor_name}</td>
                    <td className="px-3 py-1.5">{g.invoice_no ?? "—"}</td>
                    <td className="px-3 py-1.5">{g.invoice_date ? format(new Date(g.invoice_date), "dd MMM yy") : "—"}</td>
                    <td className="px-3 py-1.5">{g.description ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtINR(Number(g.basic_amount_excl_gst))}</td>
                    <td className="px-3 py-1.5">{g.remark ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <GrnCreateSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        projects={projects}
        defaultProjectId={selectedProjectId}
        onSaved={fetchGrns}
      />
    </div>
  );
}

function GrnCreateSheet({ open, onOpenChange, projects, defaultProjectId, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string }[];
  defaultProjectId: string | null;
  onSaved: () => void;
}) {
  const [scanSkipped, setScanSkipped] = useState(false);
  const [form, setForm] = useState({
    project_id: defaultProjectId ?? "",
    boq_category: "Structure", vendor_name: "", invoice_no: "",
    invoice_date: format(new Date(), "yyyy-MM-dd"),
    description: "", basic_amount_excl_gst: "", gst_amount: "", remark: "",
  });
  const [saving, setSaving] = useState(false);

  // Update project_id when defaultProjectId changes
  useEffect(() => {
    if (defaultProjectId && !form.project_id) {
      setForm(prev => ({ ...prev, project_id: defaultProjectId }));
    }
  }, [defaultProjectId]);

  const submit = async () => {
    if (!form.project_id) { toast.error("Project is required"); return; }
    if (!form.vendor_name.trim() || !form.basic_amount_excl_gst) {
      toast.error("Vendor and amount are required"); return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let name: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? user.email ?? null;
    }
    const { error } = await (supabase.from("project_grns" as any) as any).insert({
      project_id: form.project_id,
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
    setForm(prev => ({ ...prev, vendor_name: "", invoice_no: "", description: "", basic_amount_excl_gst: "", gst_amount: "", remark: "" }));
    setScanSkipped(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display">Add GRN (Goods Receipt Note)</SheetTitle></SheetHeader>
        <div className="space-y-3 py-4">
          {!scanSkipped && (
            <InvoiceScanner
              onExtracted={(data) => {
                setForm(prev => ({
                  ...prev,
                  vendor_name: data.vendor_name || prev.vendor_name,
                  invoice_no: data.invoice_number || prev.invoice_no,
                  invoice_date: data.invoice_date
                    ? (() => {
                        const parts = data.invoice_date.split("/");
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : prev.invoice_date;
                      })()
                    : prev.invoice_date,
                  basic_amount_excl_gst: data.subtotal != null ? String(data.subtotal) : prev.basic_amount_excl_gst,
                  gst_amount: data.gst_amount != null ? String(data.gst_amount) : prev.gst_amount,
                  description: data.line_items?.map((i: any) => `${i.description} x${i.quantity}`).join(", ") || prev.description,
                }));
                setScanSkipped(true);
              }}
              onSkip={() => setScanSkipped(true)}
            />
          )}
          <Field label="Project *">
            <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
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
        <SheetFooter>
          <Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save GRN
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
