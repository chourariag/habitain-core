import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { differenceInDays, format, parseISO } from "date-fns";

interface Filing {
  id: string; filing_type: string; due_date: string; status: string; notes: string | null;
}

// Generate upcoming statutory dates
function getUpcomingStatutoryDates(): { filing_type: string; due_date: string }[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const entries: { filing_type: string; due_date: string }[] = [];

  // Next 3 months of recurring filings
  for (let i = 0; i < 3; i++) {
    const m = (month + i) % 12;
    const y = year + Math.floor((month + i) / 12);
    const mm = String(m + 1).padStart(2, "0");
    const nextM = String(((m + 1) % 12) + 1).padStart(2, "0");
    const nextY = m === 11 ? y + 1 : y;

    // GSTR-1 due on 8th of following month
    entries.push({ filing_type: "GSTR-1", due_date: `${nextY}-${nextM}-08` });
    // GSTR-3B due on 18th of following month
    entries.push({ filing_type: "GSTR-3B", due_date: `${nextY}-${nextM}-18` });
    // TDS Payment due on 5th of following month
    entries.push({ filing_type: "TDS Payment", due_date: `${nextY}-${nextM}-05` });
    // Professional Tax on 15th of current month
    entries.push({ filing_type: "PT (Professional Tax)", due_date: `${y}-${mm}-15` });
    // Factory Act and Shops & Establishments annual renewal — 31 Jan
    if (m === 0) {
      entries.push({ filing_type: "Factory Act Annual Return", due_date: `${y}-01-31` });
      entries.push({ filing_type: "Shops & Establishments Renewal", due_date: `${y}-01-31` });
    }
  }

  // Quarterly TDS Returns
  [{ m: "07", d: "31" }, { m: "10", d: "31" }, { m: "01", d: "31" }, { m: "05", d: "31" }].forEach(({ m, d }) => {
    const dueYear = Number(m) < 6 ? year + 1 : year;
    const due = `${dueYear}-${m}-${d}`;
    if (due >= today.toISOString().slice(0, 10)) entries.push({ filing_type: "TDS Return (Quarterly)", due_date: due });
  });

  // Annual
  entries.push({ filing_type: "GST Annual Return", due_date: `${year}-12-31` });
  entries.push({ filing_type: "Income Tax", due_date: `${year}-10-31` });

  return entries.filter(e => e.due_date >= today.toISOString().slice(0, 10)).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function StatutoryTab() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ type: "", due_date: "", notes: "" });

  const fetchData = async () => {
    const { data } = await supabase.from("finance_statutory").select("*").order("due_date");
    if (data && data.length > 0) {
      setFilings(data as Filing[]);
    } else {
      // Seed with upcoming dates for display
      const upcoming = getUpcomingStatutoryDates();
      setFilings(upcoming.map((u, i) => ({ id: `seed-${i}`, filing_type: u.filing_type, due_date: u.due_date, status: "pending", notes: null })));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    const { error } = await supabase.from("finance_statutory").insert({
      filing_type: form.type, due_date: form.due_date, notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Filing added");
    setAddOpen(false); setForm({ type: "", due_date: "", notes: "" }); fetchData();
  };

  const updateStatus = async (filing: Filing, status: string) => {
    if (filing.id.startsWith("seed-")) {
      // Insert into DB first
      const { error } = await supabase.from("finance_statutory").insert({
        filing_type: filing.filing_type, due_date: filing.due_date, status, notes: filing.notes,
      });
      if (error) { toast.error(error.message); return; }
    } else {
      await supabase.from("finance_statutory").update({ status }).eq("id", filing.id);
    }
    toast.success("Status updated");
    fetchData();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#666" }}>Statutory filing calendar & compliance tracker</p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}><Plus className="h-3 w-3 mr-1" /> Add Filing</Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}>
              <th className="text-left py-2 text-xs font-display">Filing Type</th>
              <th className="text-left py-2 text-xs font-display">Due Date</th>
              <th className="text-right py-2 text-xs font-display">Days Left</th>
              <th className="text-center py-2 text-xs font-display">Status</th>
              <th className="text-left py-2 text-xs font-display">Notes</th>
            </tr></thead>
            <tbody>{filings.map(f => {
              const daysLeft = differenceInDays(new Date(f.due_date), new Date());
              const isFiled = f.status === "filed";
              const rowBg = isFiled ? undefined : daysLeft < 7 ? "#FFF0F0" : daysLeft < 30 ? "#FFF8E8" : undefined;
              const displayDate = (() => {
                try { return format(parseISO(f.due_date), "dd/MM/yyyy"); } catch { return f.due_date; }
              })();
              return (
                <tr key={f.id} className="border-b" style={{ backgroundColor: rowBg, opacity: isFiled ? 0.6 : 1 }}>
                  <td className="py-1.5 text-xs font-medium" style={{ color: isFiled ? "#006039" : "#1A1A1A" }}>{f.filing_type}</td>
                  <td className="py-1.5 text-xs">{displayDate}</td>
                  <td className="text-right py-1.5 text-xs font-mono" style={{ color: daysLeft < 7 ? "#F40009" : daysLeft < 30 ? "#D4860A" : "#006039" }}>
                    {isFiled ? "✓" : daysLeft}
                  </td>
                  <td className="text-center py-1.5">
                    <select className="text-xs border rounded px-1 py-0.5" value={f.status} onChange={e => updateStatus(f, e.target.value)}>
                      <option value="pending">Pending</option><option value="filed">Filed</option>
                    </select>
                  </td>
                  <td className="py-1.5 text-xs" style={{ color: "#666" }}>{f.notes || "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Filing</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Filing Type</Label><Input value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd} style={{ backgroundColor: "#006039" }}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
