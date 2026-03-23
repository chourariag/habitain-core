import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, Download, Plus, FileDown, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { differenceInDays, format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface Payment {
  id: string; project_name: string; client_name: string; milestone_description: string;
  due_date: string; amount: number; status: string;
}

export function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ project: "", description: "", due_date: "", amount: "" });
  const [approvedExpenses, setApprovedExpenses] = useState<any[]>([]);
  const [expenseProfiles, setExpenseProfiles] = useState<any[]>([]);
  const [expensesOpen, setExpensesOpen] = useState(false);

  const fetchData = async () => {
    const [{ data }, { data: expData }, { data: profData }] = await Promise.all([
      supabase.from("finance_payments").select("*").order("due_date"),
      supabase.from("expense_entries").select("*").eq("status", "approved").order("created_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name"),
    ]);
    const rows = (data as Payment[]) || [];
    const today = new Date().toISOString().slice(0, 10);
    setPayments(rows.map(r => ({
      ...r,
      status: (r.status === "pending" || r.status === "invoiced") && r.due_date < today ? "overdue" : r.status,
    })));
    setApprovedExpenses((expData ?? []) as any[]);
    setExpenseProfiles(profData ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const getExpenseName = (uid: string) => expenseProfiles.find((p: any) => p.auth_user_id === uid)?.display_name || "—";

  const handleMarkProcessed = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("expense_reports").update({
      status: "processed",
      processed_by: user?.id,
      processed_at: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked as processed"); fetchData(); }
  };

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

  // Ageing buckets
  const today = new Date();
  const ageingBuckets = (() => {
    const buckets = [
      { name: "Current", min: -Infinity, max: 0, color: "#006039", count: 0, total: 0 },
      { name: "1–30 days", min: 1, max: 30, color: "#D4860A", count: 0, total: 0 },
      { name: "31–60 days", min: 31, max: 60, color: "#F40009B3", count: 0, total: 0 },
      { name: "60+ days", min: 61, max: Infinity, color: "#F40009", count: 0, total: 0 },
    ];
    payments.forEach(p => {
      if (p.status === "received") return;
      const days = differenceInDays(today, new Date(p.due_date));
      if (days <= 0) { buckets[0].count++; buckets[0].total += p.amount; }
      else if (days <= 30) { buckets[1].count++; buckets[1].total += p.amount; }
      else if (days <= 60) { buckets[2].count++; buckets[2].total += p.amount; }
      else { buckets[3].count++; buckets[3].total += p.amount; }
    });
    return buckets;
  })();

  const hasOverdue = ageingBuckets.slice(1).some(b => b.total > 0);

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

      {/* Ageing Chart */}
      {payments.length > 0 && (
        hasOverdue ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-display font-semibold mb-2" style={{ color: "#666" }}>Payment Ageing</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={ageingBuckets} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#666" }} tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#666" }} width={70} />
                  <Tooltip
                    formatter={(v: number, _: any, props: any) => [`₹${v.toLocaleString("en-IN")}`, `${props.payload.count} invoices`]}
                    labelFormatter={(l: string) => l}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {ageingBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
            No overdue payments ✓
          </div>
        )
      )}

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

      {/* Approved Expenses — Pending Tally Entry */}
      <Collapsible open={expensesOpen} onOpenChange={setExpensesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-semibold" style={{ color: "#1A1A1A" }}>
            <span>Approved Expenses — Pending Tally Entry {approvedExpenses.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] text-white" style={{ backgroundColor: "#F40009" }}>{approvedExpenses.length}</span>}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", expensesOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {approvedExpenses.length === 0 ? (
            <div className="rounded-lg px-4 py-3 text-sm font-semibold mt-2" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
              No expenses pending Tally entry ✓
            </div>
          ) : (
            <Card className="mt-2">
              <CardContent className="pt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b" style={{ color: "#666" }}>
                    <th className="text-left py-2 text-xs font-display">Employee</th>
                    <th className="text-left py-2 text-xs font-display">Date</th>
                    <th className="text-left py-2 text-xs font-display">Category</th>
                    <th className="text-left py-2 text-xs font-display">Project</th>
                    <th className="text-right py-2 text-xs font-display">Amount ₹</th>
                    <th className="text-left py-2 text-xs font-display">Approved By</th>
                    <th className="text-right py-2 text-xs font-display">Action</th>
                  </tr></thead>
                  <tbody>{approvedExpenses.map((e: any) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-1.5 text-xs">{getExpenseName(e.submitted_by)}</td>
                      <td className="py-1.5 text-xs font-inter">{format(new Date(e.expense_date), "dd/MM/yyyy")}</td>
                      <td className="py-1.5 text-xs">{e.category}</td>
                      <td className="py-1.5 text-xs">{e.project_id ? "Linked" : "—"}</td>
                      <td className="text-right py-1.5 text-xs font-mono font-semibold">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                      <td className="py-1.5 text-xs">{e.stage2_approved_by ? getExpenseName(e.stage2_approved_by) : "—"}</td>
                      <td className="text-right py-1.5">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => handleMarkProcessed(e.id)}
                          style={{ color: "#006039", borderColor: "#006039" }}>
                          <Check className="h-3 w-3" /> Processed
                        </Button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>

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
