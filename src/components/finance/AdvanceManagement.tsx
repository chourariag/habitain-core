import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Wallet, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface AdvanceRequest {
  id: string;
  employee_id: string;
  employee_name: string | null;
  project_name: string | null;
  amount: number;
  purpose: string | null;
  status: string;
  settlement_method: string | null;
  settled_amount: number;
  carried_forward_amount: number;
  carried_forward_date: string | null;
  next_trip_expected_date: string | null;
  carry_forward_reminder_sent: boolean;
  created_at: string;
}

interface Props {
  canManage: boolean;
}

export function AdvanceManagement({ canManage }: Props) {
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ employee: "", project: "", amount: "", purpose: "" });
  const [employees, setEmployees] = useState<any[]>([]);

  // Settlement form state
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlementMethod, setSettlementMethod] = useState("returned");
  const [settledAmount, setSettledAmount] = useState("");
  const [nextTripDate, setNextTripDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: empData }] = await Promise.all([
      (supabase.from("advance_requests") as any).select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name, role").eq("is_active", true),
    ]);
    setRequests((data ?? []) as AdvanceRequest[]);
    setEmployees(empData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Check for 30-day carry-forward reminders
  useEffect(() => {
    const checkCarryForward = async () => {
      const today = new Date();
      for (const r of requests) {
        if (r.settlement_method !== "carried_forward" || r.carry_forward_reminder_sent) continue;
        if (!r.carried_forward_date) continue;
        const daysSince = differenceInDays(today, new Date(r.carried_forward_date));
        if (daysSince >= 30) {
          // Send reminder to finance manager and employee's HOD
          const { data: finRecipients } = await supabase
            .from("profiles")
            .select("auth_user_id")
            .eq("role", "finance_manager" as any)
            .eq("is_active", true);

          if (finRecipients?.length) {
            await insertNotifications(finRecipients.map((rec: any) => ({
              recipient_id: rec.auth_user_id,
              title: "Carry-Forward Advance Overdue",
              body: `${r.employee_name || "Employee"} has ₹${Number(r.carried_forward_amount).toLocaleString("en-IN")} carry-forward advance outstanding for 30+ days. Please follow up.`,
              category: "Finance",
              related_table: "advance_requests",
              related_id: r.id,
              navigate_to: "/finance",
            })));
          }

          const { client } = await getAuthedClient();
          await (client.from("advance_requests") as any).update({ carry_forward_reminder_sent: true }).eq("id", r.id);
        }
      }
    };
    if (requests.length > 0) checkCarryForward();
  }, [requests.length]);

  const handleAdd = async () => {
    if (!form.employee || !form.amount) { toast.error("Employee and amount required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const emp = employees.find((e) => e.auth_user_id === form.employee);

      // Check carry-forward balance
      const existingCF = requests.find((r) =>
        r.employee_id === form.employee && r.settlement_method === "carried_forward" && r.carried_forward_amount > 0
      );

      let adjustedAmount = Number(form.amount);
      if (existingCF) {
        adjustedAmount = Math.max(0, adjustedAmount - existingCF.carried_forward_amount);
        toast.info(`₹${existingCF.carried_forward_amount.toLocaleString("en-IN")} carry-forward deducted. Net advance: ₹${adjustedAmount.toLocaleString("en-IN")}`);
      }

      const { client } = await getAuthedClient();
      await (client.from("advance_requests") as any).insert({
        employee_id: form.employee,
        employee_name: emp?.display_name || null,
        project_name: form.project || null,
        amount: adjustedAmount,
        purpose: form.purpose || null,
      });

      // Clear carry-forward if used
      if (existingCF) {
        await (client.from("advance_requests") as any).update({
          carried_forward_amount: 0,
          settlement_method: "returned",
        }).eq("id", existingCF.id);
      }

      toast.success("Advance request created");
      setForm({ employee: "", project: "", amount: "", purpose: "" });
      setShowAdd(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create");
    } finally {
      setAdding(false);
    }
  };

  const handleSettle = async (id: string) => {
    try {
      const { client } = await getAuthedClient();
      const request = requests.find((r) => r.id === id);
      if (!request) return;

      const settled = Number(settledAmount) || 0;
      const carryForward = settlementMethod === "carried_forward" ? Math.max(0, request.amount - settled) : 0;

      await (client.from("advance_requests") as any).update({
        status: "settled",
        settlement_method: settlementMethod,
        settled_amount: settled,
        settled_at: new Date().toISOString(),
        carried_forward_amount: carryForward,
        carried_forward_date: settlementMethod === "carried_forward" ? new Date().toISOString().split("T")[0] : null,
        next_trip_expected_date: nextTripDate || null,
      }).eq("id", id);

      toast.success(settlementMethod === "carried_forward"
        ? `₹${carryForward.toLocaleString("en-IN")} carried forward`
        : "Advance settled");
      setSettlingId(null);
      setSettlementMethod("returned");
      setSettledAmount("");
      setNextTripDate("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to settle");
    }
  };

  const totalCarryForward = requests
    .filter((r) => r.settlement_method === "carried_forward" && r.carried_forward_amount > 0)
    .reduce((s, r) => s + r.carried_forward_amount, 0);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <Wallet className="h-4 w-4" style={{ color: "#006039" }} />
            Advance Requests & Settlement
            {totalCarryForward > 0 && (
              <Badge variant="outline" className="text-[10px] ml-2" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>
                CF: ₹{totalCarryForward.toLocaleString("en-IN")}
              </Badge>
            )}
          </CardTitle>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)} className="text-xs h-6">
              <Plus className="h-3 w-3 mr-1" /> New Advance
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {showAdd && (
          <div className="border rounded-md p-3 space-y-2" style={{ borderColor: "#E5E5E5", backgroundColor: "#FAFAFA" }}>
            <Select value={form.employee} onValueChange={(v) => setForm((p) => ({ ...p, employee: v }))}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select employee..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.auth_user_id} value={e.auth_user_id}>{e.display_name} ({e.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input placeholder="Amount ₹" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="text-sm flex-1" />
              <Input placeholder="Project name" value={form.project} onChange={(e) => setForm((p) => ({ ...p, project: e.target.value }))} className="text-sm flex-1" />
            </div>
            <Input placeholder="Purpose" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding} className="flex-1" style={{ backgroundColor: "#006039", color: "#fff" }}>
                {adding && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Create
              </Button>
            </div>
          </div>
        )}

        {loading ? null : requests.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: "#999" }}>No advance requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ color: "#666" }}>
                  <th className="text-left py-1.5 font-display">Employee</th>
                  <th className="text-left py-1.5 font-display">Project</th>
                  <th className="text-right py-1.5 font-display">Amount ₹</th>
                  <th className="text-center py-1.5 font-display">Status</th>
                  <th className="text-right py-1.5 font-display">Carry Fwd ₹</th>
                  <th className="text-right py-1.5 font-display">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b" style={{ backgroundColor: r.carried_forward_amount > 0 ? "#FFF8E8" : undefined }}>
                    <td className="py-1.5">{r.employee_name || "—"}</td>
                    <td className="py-1.5">{r.project_name || "—"}</td>
                    <td className="text-right py-1.5 font-mono">₹{Number(r.amount).toLocaleString("en-IN")}</td>
                    <td className="text-center py-1.5">
                      {r.status === "settled" ? (
                        <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
                          {r.settlement_method === "carried_forward" ? "Carried Fwd" : r.settlement_method === "claimed" ? "Claimed" : "Returned"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>
                          {r.status}
                        </Badge>
                      )}
                    </td>
                    <td className="text-right py-1.5 font-mono" style={{ color: r.carried_forward_amount > 0 ? "#D4860A" : "#666" }}>
                      {r.carried_forward_amount > 0 ? `₹${Number(r.carried_forward_amount).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="text-right py-1.5">
                      {r.status === "pending" && canManage && (
                        <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={() => setSettlingId(r.id)}>
                          Settle
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Settlement dialog inline */}
        {settlingId && (
          <div className="border rounded-md p-3 space-y-2" style={{ borderColor: "#006039", backgroundColor: "#F0FFF4" }}>
            <p className="text-xs font-semibold" style={{ color: "#006039" }}>Settle Advance</p>
            <div className="flex gap-2">
              <Input type="number" placeholder="Amount settled ₹" value={settledAmount} onChange={(e) => setSettledAmount(e.target.value)} className="text-sm flex-1" />
              <Select value={settlementMethod} onValueChange={setSettlementMethod}>
                <SelectTrigger className="text-sm w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="returned">Return Unused</SelectItem>
                  <SelectItem value="claimed">Claim Shortfall</SelectItem>
                  <SelectItem value="carried_forward">Carry Forward</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settlementMethod === "carried_forward" && (
              <div className="space-y-1">
                <Input type="date" placeholder="Expected next trip date" value={nextTripDate} onChange={(e) => setNextTripDate(e.target.value)} className="text-sm" />
                <p className="text-[10px] flex items-center gap-1" style={{ color: "#D4860A" }}>
                  <AlertTriangle className="h-3 w-3" /> Carry-forward outstanding for 30+ days will trigger a reminder
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSettlingId(null)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={() => handleSettle(settlingId)} className="flex-1" style={{ backgroundColor: "#006039", color: "#fff" }}>
                Confirm Settlement
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
