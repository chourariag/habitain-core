import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays, format } from "date-fns";

interface CalendarRule {
  id: string;
  filing_name: string;
  due_day: number | null;
  due_month: number | null;
  due_months: number[] | null;
  last_day_of_month: boolean;
  recurrence: string;
  applies_to: string | null;
  notes: string | null;
  active: boolean;
  needs_confirmation: boolean;
}

interface Occurrence {
  key: string;
  rule: CalendarRule;
  due_date: string; // yyyy-MM-dd
  status: string;
  statusRowId: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const lastDay = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

const iso = (y: number, m0: number, day: number) =>
  `${y}-${String(m0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Expand a recurring rule into concrete due dates over the next 12 months. */
function expandRule(rule: CalendarRule, from: Date, monthsAhead = 12): string[] {
  const dates: string[] = [];
  const dayFor = (y: number, m0: number) =>
    rule.last_day_of_month ? lastDay(y, m0) : Math.min(rule.due_day ?? 1, lastDay(y, m0));

  for (let i = 0; i <= monthsAhead; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const y = d.getFullYear();
    const m0 = d.getMonth();

    let matches = false;
    if (rule.recurrence === "monthly") matches = true;
    else if (rule.recurrence === "multi_annual") matches = (rule.due_months ?? []).includes(m0 + 1);
    else matches = rule.due_month === m0 + 1;

    if (matches) dates.push(iso(y, m0, dayFor(y, m0)));
  }
  return dates;
}

export function StatutoryTab() {
  const [rules, setRules] = useState<CalendarRule[]>([]);
  const [statusRows, setStatusRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    filing_name: "",
    recurrence: "monthly",
    due_day: "1",
    due_month: "1",
    due_months: "",
    last_day_of_month: false,
    applies_to: "Finance",
    notes: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: cal, error }, { data: st }] = await Promise.all([
      supabase.from("statutory_calendar").select("*").order("filing_name"),
      supabase.from("finance_statutory").select("id, filing_type, due_date, status"),
    ]);
    if (error) toast.error(error.message);
    setRules((cal ?? []) as unknown as CalendarRule[]);
    setStatusRows(st ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const occurrences: Occurrence[] = useMemo(() => {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const out: Occurrence[] = [];
    rules
      .filter((r) => r.active)
      .forEach((r) => {
        expandRule(r, today).forEach((due_date) => {
          if (due_date < todayIso) return;
          const match = statusRows.find(
            (s) => s.filing_type === r.filing_name && String(s.due_date).slice(0, 10) === due_date
          );
          out.push({
            key: `${r.id}-${due_date}`,
            rule: r,
            due_date,
            status: match?.status ?? "pending",
            statusRowId: match?.id ?? null,
          });
        });
      });
    return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [rules, statusRows]);

  const pendingConfirmation = rules.filter((r) => r.needs_confirmation);

  const updateStatus = async (occ: Occurrence, status: string) => {
    if (occ.statusRowId) {
      const { error } = await supabase.from("finance_statutory").update({ status }).eq("id", occ.statusRowId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("finance_statutory").insert({
        filing_type: occ.rule.filing_name,
        due_date: occ.due_date,
        status,
        notes: occ.rule.notes,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Status updated");
    fetchData();
  };

  const handleAdd = async () => {
    if (!form.filing_name.trim()) return toast.error("Filing name is required");
    const payload: any = {
      filing_name: form.filing_name.trim(),
      recurrence: form.recurrence,
      due_day: form.last_day_of_month ? null : parseInt(form.due_day) || 1,
      due_month: form.recurrence === "annual" ? parseInt(form.due_month) || 1 : null,
      due_months:
        form.recurrence === "multi_annual"
          ? form.due_months
              .split(",")
              .map((m) => parseInt(m.trim()))
              .filter((m) => m >= 1 && m <= 12)
          : null,
      last_day_of_month: form.last_day_of_month,
      applies_to: form.applies_to || null,
      notes: form.notes || null,
      active: true,
    };
    const { error } = await supabase.from("statutory_calendar").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Filing added to calendar");
    setAddOpen(false);
    setForm({
      filing_name: "",
      recurrence: "monthly",
      due_day: "1",
      due_month: "1",
      due_months: "",
      last_day_of_month: false,
      applies_to: "Finance",
      notes: "",
    });
    fetchData();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: "#666" }}>
          Statutory filing calendar &amp; compliance tracker — driven by the Statutory Calendar table
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3 w-3 mr-1" /> Add Filing
        </Button>
      </div>

      {pendingConfirmation.length > 0 && (
        <Card style={{ backgroundColor: "#FFF8E8", borderColor: "#D4860A" }}>
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: "#D4860A" }} />
            <div className="text-xs" style={{ color: "#7A5300" }}>
              <span className="font-medium">Awaiting confirmation (not shown in calendar):</span>
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {pendingConfirmation.map((r) => (
                  <li key={r.id}>
                    {r.filing_name} — {r.notes}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ color: "#666" }}>
                <th className="text-left py-2 text-xs font-display">Filing</th>
                <th className="text-left py-2 text-xs font-display">Applies To</th>
                <th className="text-left py-2 text-xs font-display">Due Date</th>
                <th className="text-right py-2 text-xs font-display">Days Left</th>
                <th className="text-center py-2 text-xs font-display">Recurrence</th>
                <th className="text-center py-2 text-xs font-display">Status</th>
                <th className="text-left py-2 text-xs font-display">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs" style={{ color: "#666" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && occurrences.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs" style={{ color: "#666" }}>
                    No statutory filings configured.
                  </td>
                </tr>
              )}
              {occurrences.map((o) => {
                const daysLeft = differenceInDays(new Date(o.due_date), new Date());
                const isFiled = o.status === "filed";
                const rowBg = isFiled ? undefined : daysLeft < 7 ? "#FFF0F0" : daysLeft < 30 ? "#FFF8E8" : undefined;
                return (
                  <tr key={o.key} className="border-b" style={{ backgroundColor: rowBg, opacity: isFiled ? 0.6 : 1 }}>
                    <td className="py-1.5 text-xs font-medium" style={{ color: isFiled ? "#006039" : "#1A1A1A" }}>
                      {o.rule.filing_name}
                    </td>
                    <td className="py-1.5 text-xs" style={{ color: "#666" }}>
                      {o.rule.applies_to && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {o.rule.applies_to}
                        </Badge>
                      )}
                    </td>
                    <td className="py-1.5 text-xs">{format(new Date(o.due_date), "dd/MM/yyyy")}</td>
                    <td
                      className="text-right py-1.5 text-xs font-mono"
                      style={{ color: daysLeft < 7 ? "#F40009" : daysLeft < 30 ? "#D4860A" : "#006039" }}
                    >
                      {isFiled ? "✓" : daysLeft}
                    </td>
                    <td className="text-center py-1.5">
                      <span className="text-[10px] flex items-center justify-center gap-0.5" style={{ color: "#666" }}>
                        <Bell className="h-3 w-3" />
                        {o.rule.recurrence === "monthly"
                          ? "Monthly"
                          : o.rule.recurrence === "multi_annual"
                          ? "Half-yearly"
                          : "Annual"}
                      </span>
                    </td>
                    <td className="text-center py-1.5">
                      <select
                        className="text-xs border rounded px-1 py-0.5"
                        value={o.status}
                        onChange={(e) => updateStatus(o, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="filed">Filed</option>
                      </select>
                    </td>
                    <td className="py-1.5 text-xs" style={{ color: "#666" }}>
                      {o.rule.notes || "—"}
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
            <DialogTitle className="font-display">Add Filing to Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Filing Name</Label>
              <Input
                value={form.filing_name}
                onChange={(e) => setForm((p) => ({ ...p, filing_name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Recurrence</Label>
              <Select value={form.recurrence} onValueChange={(v) => setForm((p) => ({ ...p, recurrence: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="multi_annual">Multiple months per year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.recurrence === "annual" && (
              <div>
                <Label className="text-xs">Month</Label>
                <Select value={form.due_month} onValueChange={(v) => setForm((p) => ({ ...p, due_month: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.recurrence === "multi_annual" && (
              <div>
                <Label className="text-xs">Months (comma separated, 1-12)</Label>
                <Input
                  value={form.due_months}
                  placeholder="4, 10"
                  onChange={(e) => setForm((p) => ({ ...p, due_months: e.target.value }))}
                  className="mt-1"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="lastday"
                type="checkbox"
                checked={form.last_day_of_month}
                onChange={(e) => setForm((p) => ({ ...p, last_day_of_month: e.target.checked }))}
              />
              <Label htmlFor="lastday" className="text-xs">
                Due on last day of month
              </Label>
            </div>
            {!form.last_day_of_month && (
              <div>
                <Label className="text-xs">Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.due_day}
                  onChange={(e) => setForm((p) => ({ ...p, due_day: e.target.value }))}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Applies To</Label>
              <Input
                value={form.applies_to}
                onChange={(e) => setForm((p) => ({ ...p, applies_to: e.target.value }))}
                className="mt-1"
              />
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
