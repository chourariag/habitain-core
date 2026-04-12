import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#666", bg: "#F7F7F7" },
  sent: { color: "#D4860A", bg: "#FFF8E8" },
  paid: { color: "#006039", bg: "#E8F2ED" },
  overdue: { color: "#F40009", bg: "#FEE2E2" },
  cancelled: { color: "#999", bg: "#F7F7F7" },
};

export function InvoiceTracker() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", amount: "", invoice_type: "milestone", due_date: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: invs }, { data: projs }] = await Promise.all([
      (supabase.from("project_invoices" as any) as any).select("*, projects(name, client_name)").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, client_name").eq("is_archived", false).order("name"),
    ]);
    setInvoices(invs ?? []);
    setProjects(projs ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.project_id || !form.amount) { toast.error("Project and amount are required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Generate INV-YYYY-SEQ number
    const year = new Date().getFullYear();
    const { count } = await (supabase.from("project_invoices" as any) as any)
      .select("id", { count: "exact", head: true })
      .like("invoice_number", `INV-${year}-%`);
    const seq = String((count ?? 0) + 1).padStart(3, "0");
    const invoiceNumber = `INV-${year}-${seq}`;

    const { error } = await (supabase.from("project_invoices" as any) as any).insert({
      project_id: form.project_id,
      invoice_number: invoiceNumber,
      amount: parseFloat(form.amount),
      invoice_type: form.invoice_type,
      due_date: form.due_date || null,
      status: "draft",
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); } else {
      toast.success(`Invoice ${invoiceNumber} created`);
      setAddOpen(false);
      setForm({ project_id: "", amount: "", invoice_type: "milestone", due_date: "" });
      fetchData();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await (supabase.from("project_invoices" as any) as any).update({ status }).eq("id", id);
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const totalOutstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s: number, i: any) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "#666" }}>Project invoices in INV-YYYY-SEQ format</p>
          <p className="text-xs mt-0.5" style={{ color: "#D4860A" }}>Outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Invoice
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm" style={{ color: "#999" }}>No invoices yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv: any) => {
            const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.draft;
            return (
              <Card key={inv.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-mono text-sm font-semibold" style={{ color: "#1A1A1A" }}>{inv.invoice_number}</p>
                      <p className="text-xs" style={{ color: "#666" }}>{inv.projects?.name} · {inv.projects?.client_name}</p>
                      {inv.due_date && <p className="text-xs" style={{ color: "#999" }}>Due: {format(parseISO(inv.due_date), "dd/MM/yyyy")}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold" style={{ color: "#006039" }}>₹{Number(inv.amount).toLocaleString("en-IN")}</p>
                      <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                      <Select value={inv.status} onValueChange={(v) => updateStatus(inv.id, v)}>
                        <SelectTrigger className="h-6 w-20 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Invoice Type</Label>
              <Select value={form.invoice_type} onValueChange={(v) => setForm((f) => ({ ...f, invoice_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="dispatch">Dispatch</SelectItem>
                  <SelectItem value="handover">Handover</SelectItem>
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="retention_release">Retention Release</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
