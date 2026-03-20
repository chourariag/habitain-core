import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Download, Plus, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { differenceInDays } from "date-fns";

interface Payment {
  id: string; project_name: string; client_name: string; milestone_description: string;
  due_date: string; amount: number; status: string;
}

export function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ project: "", description: "", due_date: "", amount: "" });

  const fetchData = async () => {
    const { data } = await supabase.from("finance_payments").select("*").order("due_date");
    const rows = (data as Payment[]) || [];
    // Auto-set overdue
    const today = new Date().toISOString().slice(0, 10);
    setPayments(rows.map(r => ({
      ...r,
      status: (r.status === "pending" || r.status === "invoiced") && r.due_date < today ? "overdue" : r.status,
    })));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("finance_payments").insert({
      project_name: form.project, client_name: form.project,
      milestone_description: form.description, due_date: form.due_date,
      amount: Number(form.amount) || 0, entered_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Payment milestone added");
    setAddOpen(false);
    setForm({ project: "", description: "", due_date: "", amount: "" });
    fetchData();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const { data: { user } } = await supabase.auth.getUser();
      for (const r of rows) {
        await supabase.from("finance_payments").insert({
          project_name: r.Project_Name, client_name: r.Client_Name || r.Project_Name,
          milestone_description: r.Milestone_Description, due_date: r.Due_Date,
          amount: Number(r.Amount) || 0, entered_by: user?.id,
        });
      }
      toast.success("Payment milestones uploaded");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const csv = "Project_Name,Client_Name,Milestone_Description,Due_Date,Amount\nProject Alpha,Client A,Foundation Complete,2026-04-15,500000";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Payments_Template.csv"; a.click();
  };

  const exportCSV = () => {
    const header = "Project,Client,Milestone,Due Date,Amount,Status,Days Overdue\n";
    const rows = payments.map(p => {
      const days = p.status === "overdue" ? differenceInDays(new Date(), new Date(p.due_date)) : 0;
      return `${p.project_name},${p.client_name},${p.milestone_description},${p.due_date},${p.amount},${p.status},${days || "—"}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Payments_Export.csv"; a.click();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("finance_payments").update({ status }).eq("id", id);
    fetchData();
  };

  const totalExpected = payments.reduce((s, p) => s + p.amount, 0);
  const totalReceived = payments.filter(p => p.status === "received").reduce((s, p) => s + p.amount, 0);
  const outstanding = totalExpected - totalReceived;

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: "#F7F7F7", color: "#666" },
      invoiced: { bg: "#E8F2ED", color: "#006039" },
      received: { bg: "#E8F2ED", color: "#006039" },
      overdue: { bg: "#FFF0F0", color: "#F40009" },
    };
    const style = map[s] || map.pending;
    return <span className="text-xs px-2 py-0.5 rounded font-semibold capitalize" style={{ backgroundColor: style.bg, color: style.color }}>{s}</span>;
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Milestones</span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Template</Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-3 w-3 mr-1" /> Quick Add</Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><FileDown className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}>
              <th className="text-left py-2 text-xs font-display">Project</th>
              <th className="text-left py-2 text-xs font-display">Client</th>
              <th className="text-left py-2 text-xs font-display">Milestone</th>
              <th className="text-left py-2 text-xs font-display">Due Date</th>
              <th className="text-right py-2 text-xs font-display">Amount ₹</th>
              <th className="text-center py-2 text-xs font-display">Status</th>
              <th className="text-right py-2 text-xs font-display">Days Overdue</th>
            </tr></thead>
            <tbody>{payments.map(p => {
              const days = p.status === "overdue" ? differenceInDays(new Date(), new Date(p.due_date)) : 0;
              return (
                <tr key={p.id} className="border-b" style={{ backgroundColor: p.status === "overdue" ? "#FFF8E8" : undefined }}>
                  <td className="py-1.5 text-xs">{p.project_name}</td>
                  <td className="py-1.5 text-xs">{p.client_name}</td>
                  <td className="py-1.5 text-xs">{p.milestone_description}</td>
                  <td className="py-1.5 text-xs">{p.due_date}</td>
                  <td className="text-right py-1.5 text-xs font-mono">₹{p.amount.toLocaleString("en-IN")}</td>
                  <td className="text-center py-1.5">
                    <select className="text-xs border rounded px-1 py-0.5" value={p.status} onChange={e => updateStatus(p.id, e.target.value)}>
                      <option value="pending">Pending</option><option value="invoiced">Invoiced</option>
                      <option value="received">Received</option><option value="overdue">Overdue</option>
                    </select>
                  </td>
                  <td className="text-right py-1.5 text-xs font-mono" style={{ color: days > 0 ? "#F40009" : "#666" }}>{days > 0 ? days : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {payments.length === 0 && <p className="text-center text-xs py-8" style={{ color: "#999" }}>Upload or add payment milestones</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm px-1">
        <div><span style={{ color: "#666" }}>Total Expected:</span> <span className="font-mono font-bold">₹{totalExpected.toLocaleString("en-IN")}</span></div>
        <div><span style={{ color: "#666" }}>Total Received:</span> <span className="font-mono font-bold" style={{ color: "#006039" }}>₹{totalReceived.toLocaleString("en-IN")}</span></div>
        <div><span style={{ color: "#666" }}>Outstanding:</span> <span className="font-mono font-bold" style={{ color: outstanding > 0 ? "#D4860A" : "#006039" }}>₹{outstanding.toLocaleString("en-IN")}</span></div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Quick Add Payment Milestone</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Project</Label><Input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Amount ₹</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd} style={{ backgroundColor: "#006039" }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
