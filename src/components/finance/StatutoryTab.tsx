import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { differenceInDays, format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Filing {
  id: string;
  filing_type: string;
  due_date: string;
  status: string;
  notes: string | null;
  reminder_days: number | null;
  recipient_roles: string[] | null;
}

// Statutory reminder configuration
const STATUTORY_CONFIG: { type: string; dayOfMonth: number; reminderDays: number; message: string }[] = [
  { type: "TDS Payment", dayOfMonth: 5, reminderDays: 2, message: "TDS payment due on 5th. Please upload challan and send for Director approval." },
  { type: "GSTR-1", dayOfMonth: 11, reminderDays: 2, message: "GSTR-1 filing due on 11th. Alert at 4th and 9th. Please send workings to CA." },
  { type: "GSTR-3B", dayOfMonth: 20, reminderDays: 2, message: "GSTR-3B filing due on 20th. Alert at 13th and 18th. Please send workings to CA." },
];

function getUpcomingStatutoryDates(): { filing_type: string; due_date: string; reminder_days: number }[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const entries: { filing_type: string; due_date: string; reminder_days: number }[] = [];

  // Next 3 months of monthly recurring filings
  for (let i = 0; i < 3; i++) {
    const m = (month + i) % 12;
    const y = year + Math.floor((month + i) / 12);
    const mm = String(m + 1).padStart(2, "0");

    // TDS — 5th of each month
    entries.push({ filing_type: "TDS Payment", due_date: `${y}-${mm}-05`, reminder_days: 2 });
    // GSTR-1 — 11th of each month (alerts at 4th and 9th)
    entries.push({ filing_type: "GSTR-1", due_date: `${y}-${mm}-11`, reminder_days: 7 });
    // GSTR-3B — 20th of each month (alerts at 13th and 18th)
    entries.push({ filing_type: "GSTR-3B", due_date: `${y}-${mm}-20`, reminder_days: 7 });
  }

  // Quarterly TDS Returns — 15th of last month of quarter, 15 days reminder
  const quarterEnds = [
    { m: "06", d: "15" }, // Q1 — June 15
    { m: "09", d: "15" }, // Q2 — Sep 15
    { m: "12", d: "15" }, // Q3 — Dec 15
    { m: "03", d: "15" }, // Q4 — Mar 15 (next year)
  ];
  quarterEnds.forEach(({ m, d }) => {
    const dueYear = Number(m) <= 3 ? year + 1 : year;
    const due = `${dueYear}-${m}-${d}`;
    if (due >= today.toISOString().slice(0, 10)) {
      entries.push({ filing_type: "Quarterly TDS Return", due_date: due, reminder_days: 15 });
    }
  });

  // Annual Income Tax Filing — Oct 31, alerts at 30 days and 7 days before
  const itDue = `${year}-10-31`;
  if (itDue >= today.toISOString().slice(0, 10)) {
    entries.push({ filing_type: "Annual Income Tax Filing", due_date: itDue, reminder_days: 30 });
  } else {
    entries.push({ filing_type: "Annual Income Tax Filing", due_date: `${year + 1}-10-31`, reminder_days: 30 });
  }

  // Factory Act Renewal — annual, alert 30 days before expiry (Mar 31 default)
  const factoryDue = `${year}-03-31`;
  if (factoryDue >= today.toISOString().slice(0, 10)) {
    entries.push({ filing_type: "Factory Act Renewal", due_date: factoryDue, reminder_days: 30 });
  } else {
    entries.push({ filing_type: "Factory Act Renewal", due_date: `${year + 1}-03-31`, reminder_days: 30 });
  }

  // Shops & Establishment Renewal — annual, alert 30 days before expiry (Mar 31 default)
  const shopsDue = `${year}-03-31`;
  if (shopsDue >= today.toISOString().slice(0, 10)) {
    entries.push({ filing_type: "Shops & Establishment Renewal", due_date: shopsDue, reminder_days: 30 });
  } else {
    entries.push({ filing_type: "Shops & Establishment Renewal", due_date: `${year + 1}-03-31`, reminder_days: 30 });
  }

  return entries
    .filter((e) => e.due_date >= today.toISOString().slice(0, 10))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function StatutoryTab() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ type: "", due_date: "", notes: "", reminder_days: "7" });

  const fetchData = async () => {
    const { data } = await supabase.from("finance_statutory").select("*").order("due_date");
    if (data && data.length > 0) {
      setFilings(data as Filing[]);
    } else {
      const upcoming = getUpcomingStatutoryDates();
      setFilings(
        upcoming.map((u, i) => ({
          id: `seed-${i}`,
          filing_type: u.filing_type,
          due_date: u.due_date,
          status: "pending",
          notes: null,
          reminder_days: u.reminder_days,
          recipient_roles: ["finance_manager"],
        }))
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Send reminders on load
  useEffect(() => {
    const sendReminders = async () => {
      const today = new Date();
      for (const f of filings) {
        if (f.status === "filed" || f.id.startsWith("seed-")) continue;
        const daysLeft = differenceInDays(new Date(f.due_date), today);
        const reminderThreshold = f.reminder_days ?? 7;

        if (daysLeft <= reminderThreshold && daysLeft >= 0) {
          // Find config for this type
          const config = STATUTORY_CONFIG.find((c) => c.type === f.filing_type);
          const message = config?.message ?? `${f.filing_type} is due on ${format(new Date(f.due_date), "dd/MM/yyyy")}. Please action.`;

          const { data: recipients } = await supabase
            .from("profiles")
            .select("auth_user_id")
            .in("role", (f.recipient_roles ?? ["finance_manager"]) as any)
            .eq("is_active", true);

          if (recipients?.length) {
            await insertNotifications(
              recipients.map((r: any) => ({
                recipient_id: r.auth_user_id,
                title: `Statutory Reminder: ${f.filing_type}`,
                body: message,
                category: "Finance",
                related_table: "finance_statutory",
                related_id: f.id,
                navigate_to: "/finance",
              }))
            );
          }
        }
      }
    };
    if (filings.length > 0 && !filings[0].id.startsWith("seed-")) {
      sendReminders();
    }
  }, [filings]);

  const handleAdd = async () => {
    const { error } = await supabase.from("finance_statutory").insert({
      filing_type: form.type,
      due_date: form.due_date,
      notes: form.notes || null,
      reminder_days: parseInt(form.reminder_days) || 7,
      recipient_roles: ["finance_manager"],
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Filing added");
    setAddOpen(false);
    setForm({ type: "", due_date: "", notes: "", reminder_days: "7" });
    fetchData();
  };

  const updateStatus = async (filing: Filing, status: string) => {
    if (filing.id.startsWith("seed-")) {
      const { error } = await supabase.from("finance_statutory").insert({
        filing_type: filing.filing_type,
        due_date: filing.due_date,
        status,
        notes: filing.notes,
        reminder_days: filing.reminder_days ?? 7,
        recipient_roles: filing.recipient_roles ?? ["finance_manager"],
      } as any);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      await supabase.from("finance_statutory").update({ status }).eq("id", filing.id);
    }
    toast.success("Status updated");
    fetchData();
  };

  const isCritical = (type: string) => ["Factory Act Renewal", "Shops & Establishment Renewal", "Annual Income Tax Filing"].includes(type);

  return (
    <div className="space-y-4 mt-2">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#666" }}>
          Statutory filing calendar & compliance tracker
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3 w-3 mr-1" /> Add Filing
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ color: "#666" }}>
                <th className="text-left py-2 text-xs font-display">Filing Type</th>
                <th className="text-left py-2 text-xs font-display">Due Date</th>
                <th className="text-right py-2 text-xs font-display">Days Left</th>
                <th className="text-center py-2 text-xs font-display">Reminder</th>
                <th className="text-center py-2 text-xs font-display">Status</th>
                <th className="text-left py-2 text-xs font-display">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => {
                const daysLeft = differenceInDays(new Date(f.due_date), new Date());
                const isFiled = f.status === "filed";
                const critical = isCritical(f.filing_type);
                const rowBg = isFiled
                  ? undefined
                  : daysLeft < 7
                  ? "#FFF0F0"
                  : daysLeft < 30
                  ? "#FFF8E8"
                  : undefined;
                return (
                  <tr key={f.id} className="border-b" style={{ backgroundColor: rowBg, opacity: isFiled ? 0.6 : 1 }}>
                    <td className="py-1.5 text-xs font-medium" style={{ color: isFiled ? "#006039" : "#1A1A1A" }}>
                      <span className="flex items-center gap-1.5">
                        {f.filing_type}
                        {critical && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>
                            Critical
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 text-xs">{format(new Date(f.due_date), "dd/MM/yyyy")}</td>
                    <td
                      className="text-right py-1.5 text-xs font-mono"
                      style={{ color: daysLeft < 7 ? "#F40009" : daysLeft < 30 ? "#D4860A" : "#006039" }}
                    >
                      {isFiled ? "✓" : daysLeft}
                    </td>
                    <td className="text-center py-1.5">
                      <span className="text-[10px] flex items-center justify-center gap-0.5" style={{ color: "#666" }}>
                        <Bell className="h-3 w-3" /> {f.reminder_days ?? 7}d
                      </span>
                    </td>
                    <td className="text-center py-1.5">
                      <select
                        className="text-xs border rounded px-1 py-0.5"
                        value={f.status}
                        onChange={(e) => updateStatus(f, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="filed">Filed</option>
                      </select>
                    </td>
                    <td className="py-1.5 text-xs" style={{ color: "#666" }}>
                      {f.notes || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add Filing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Filing Type</Label>
              <Input value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Reminder (days before)</Label>
              <Input type="number" value={form.reminder_days} onChange={(e) => setForm((p) => ({ ...p, reminder_days: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} style={{ backgroundColor: "#006039" }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
