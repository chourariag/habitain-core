import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const INFLOW_CATS = ["Client Payment", "Advance", "Retention Release", "Other"];
const OUTFLOW_CATS = ["Materials", "Logistics", "Labour Contract", "Vendor Payment", "Admin", "Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface CashEntry {
  id: string; entry_date: string; type: string; description: string; project_name: string;
  amount: number; category: string;
}

export function CashFlowTab() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [openingBalance, setOpeningBalance] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"inflow" | "outflow">("inflow");
  const [form, setForm] = useState({ date: "", amount: "", category: "", description: "", project: "" });

  const fetchData = async () => {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endMonth = month === 11 ? 0 : month + 1;
    const endYear = month === 11 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-01`;

    const [{ data: cf }, { data: bal }] = await Promise.all([
      supabase.from("finance_cashflow").select("*").gte("entry_date", startDate).lt("entry_date", endDate).order("entry_date"),
      supabase.from("finance_cashflow_balances").select("*").eq("month", month + 1).eq("year", year).limit(1),
    ]);
    setEntries((cf as CashEntry[]) || []);
    setOpeningBalance(bal?.[0]?.opening_balance || 0);
  };

  useEffect(() => { fetchData(); }, [month, year]);

  const inflows = entries.filter(e => e.type === "inflow");
  const outflows = entries.filter(e => e.type === "outflow");
  const totalIn = inflows.reduce((s, e) => s + e.amount, 0);
  const totalOut = outflows.reduce((s, e) => s + e.amount, 0);
  const closing = openingBalance + totalIn - totalOut;

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("finance_cashflow").insert({
      entry_date: form.date || new Date().toISOString().slice(0, 10),
      type: addType, amount: Number(form.amount) || 0, category: form.category || "Other",
      description: form.description || null, project_name: form.project || null,
      entered_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${addType === "inflow" ? "Inflow" : "Outflow"} added`);
    setAddOpen(false);
    setForm({ date: "", amount: "", category: "", description: "", project: "" });
    fetchData();
  };

  const saveOpeningBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("finance_cashflow_balances").upsert({
      month: month + 1, year, opening_balance: openingBalance, updated_by: user?.id,
    }, { onConflict: "month,year" });
    toast.success("Opening balance saved");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const { data: { user } } = await supabase.auth.getUser();
      for (const r of rows) {
        await supabase.from("finance_cashflow").insert({
          entry_date: r.Date || new Date().toISOString().slice(0, 10),
          type: String(r.Type || "inflow").toLowerCase(),
          description: r.Description || null, project_name: r.Project_Name || null,
          amount: Number(r.Amount) || 0, category: r.Category || "Other",
          entered_by: user?.id,
        });
      }
      toast.success("Cash flow data uploaded");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const t = TEMPLATES.cashflow;
    downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample);
  };

  const openAdd = (type: "inflow" | "outflow") => { setAddType(type); setForm({ date: "", amount: "", category: "", description: "", project: "" }); setAddOpen(true); };

  // Chart data: group entries by week
  const getWeekNum = (dateStr: string) => {
    const d = new Date(dateStr);
    return Math.min(Math.ceil(d.getDate() / 7), 4);
  };

  const weekData = [1, 2, 3, 4].map(w => {
    const wIn = entries.filter(e => e.type === "inflow" && getWeekNum(e.entry_date) === w).reduce((s, e) => s + e.amount, 0);
    const wOut = entries.filter(e => e.type === "outflow" && getWeekNum(e.entry_date) === w).reduce((s, e) => s + e.amount, 0);
    return { week: `Week ${w}`, Inflows: wIn, Outflows: wOut, Net: wIn - wOut };
  });

  const hasChartData = entries.length > 0;
  const fmtLakh = (v: number) => `₹${(v / 100000).toFixed(0)}L`;

  return (
    <div className="space-y-4 mt-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <select className="text-sm border rounded px-2 py-1.5" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <Input type="number" className="w-20" value={year} onChange={e => setYear(Number(e.target.value))} />
        </div>
        <div className="flex gap-2">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Cash Flow</span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate} style={{ borderColor: "#006039", color: "#006039" }}><Download className="h-4 w-4 mr-2" /> Template</Button>
        </div>
      </div>

      {/* Weekly Cash Flow Chart */}
      {hasChartData ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-display font-semibold mb-2" style={{ color: "#666" }}>Weekly Cash Position — {MONTHS[month]} {year}</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weekData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis tick={{ fontSize: 10, fill: "#666" }} tickFormatter={fmtLakh} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Area type="monotone" dataKey="Inflows" fill="#006039" fillOpacity={0.3} stroke="#006039" />
                <Area type="monotone" dataKey="Outflows" fill="#F40009" fillOpacity={0.2} stroke="#F40009" />
                <Line type="monotone" dataKey="Net" stroke="#1A1A1A" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-6"><CardContent className="text-center"><p className="text-xs" style={{ color: "#999" }}>No cash flow data for {MONTHS[month]} {year}</p></CardContent></Card>
      )}

      {/* Running Balance */}
      <Card style={{ backgroundColor: closing >= 0 ? "#E8F2ED" : "#FFF0F0" }}>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 items-center">
            <div>
              <Label className="text-xs" style={{ color: "#666" }}>Opening Balance ₹</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input type="number" className="w-32" value={openingBalance} onChange={e => setOpeningBalance(Number(e.target.value))} />
                <Button variant="outline" size="sm" onClick={saveOpeningBalance}>Save</Button>
              </div>
            </div>
            <div className="text-center"><p className="text-xs" style={{ color: "#666" }}>+ Inflows</p><p className="font-bold font-mono" style={{ color: "#006039" }}>₹{totalIn.toLocaleString("en-IN")}</p></div>
            <div className="text-center"><p className="text-xs" style={{ color: "#666" }}>− Outflows</p><p className="font-bold font-mono" style={{ color: "#F40009" }}>₹{totalOut.toLocaleString("en-IN")}</p></div>
            <div className="text-center"><p className="text-xs" style={{ color: "#666" }}>= Closing Balance</p><p className="text-lg font-bold font-mono" style={{ color: closing >= 0 ? "#006039" : "#F40009" }}>₹{closing.toLocaleString("en-IN")}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Inflows */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-display" style={{ color: "#006039" }}>Inflows</CardTitle>
          <Button size="sm" onClick={() => openAdd("inflow")} style={{ backgroundColor: "#006039" }}><Plus className="h-3 w-3 mr-1" /> Add Inflow</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}><th className="text-left py-1.5 text-xs font-display">Date</th><th className="text-left py-1.5 text-xs font-display">Description</th><th className="text-left py-1.5 text-xs font-display">Project</th><th className="text-right py-1.5 text-xs font-display">Amount ₹</th><th className="text-left py-1.5 text-xs font-display">Category</th></tr></thead>
            <tbody>{inflows.map(e => (
              <tr key={e.id} className="border-b"><td className="py-1 text-xs">{e.entry_date}</td><td className="py-1 text-xs">{e.description || "—"}</td><td className="py-1 text-xs">{e.project_name || "—"}</td><td className="py-1 text-xs font-mono text-right" style={{ color: "#006039" }}>₹{e.amount.toLocaleString("en-IN")}</td><td className="py-1 text-xs">{e.category}</td></tr>
            ))}</tbody>
          </table>
          {inflows.length === 0 && <p className="text-center text-xs py-4" style={{ color: "#999" }}>No inflows this month</p>}
        </CardContent>
      </Card>

      {/* Outflows */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-display" style={{ color: "#F40009" }}>Outflows</CardTitle>
          <Button size="sm" onClick={() => openAdd("outflow")} style={{ backgroundColor: "#006039" }}><Plus className="h-3 w-3 mr-1" /> Add Outflow</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}><th className="text-left py-1.5 text-xs font-display">Date</th><th className="text-left py-1.5 text-xs font-display">Description</th><th className="text-left py-1.5 text-xs font-display">Project</th><th className="text-right py-1.5 text-xs font-display">Amount ₹</th><th className="text-left py-1.5 text-xs font-display">Category</th></tr></thead>
            <tbody>{outflows.map(e => (
              <tr key={e.id} className="border-b"><td className="py-1 text-xs">{e.entry_date}</td><td className="py-1 text-xs">{e.description || "—"}</td><td className="py-1 text-xs">{e.project_name || "—"}</td><td className="py-1 text-xs font-mono text-right" style={{ color: "#F40009" }}>₹{e.amount.toLocaleString("en-IN")}</td><td className="py-1 text-xs">{e.category}</td></tr>
            ))}</tbody>
          </table>
          {outflows.length === 0 && <p className="text-center text-xs py-4" style={{ color: "#999" }}>No outflows this month</p>}
        </CardContent>
      </Card>

      <p className="text-xs px-1" style={{ color: "#999" }}>When Tally cost centres are configured, this data will sync automatically.</p>

      {/* Add Entry Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add {addType === "inflow" ? "Inflow" : "Outflow"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Amount ₹</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="mt-1" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <select className="w-full mt-1 text-sm border rounded px-2 py-1.5" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                <option value="">Select</option>
                {(addType === "inflow" ? INFLOW_CATS : OUTFLOW_CATS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Description (optional)</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Project (optional)</Label><Input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd} style={{ backgroundColor: "#006039" }}>Save Entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
