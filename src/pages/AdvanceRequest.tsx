import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, ArrowLeft, AlertTriangle, Upload, Zap } from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface LineItem {
  category: string;
  qty: number;
  days: number;
  rate: number;
  amount: number;
  policy_amount: number;
  above_policy: boolean;
  justification: string;
  supporting_doc_url: string;
}

const CATEGORIES = [
  { key: "food_labour", label: "Food — Labour", autoCalc: true, defaultRate: 250 },
  { key: "food_staff", label: "Food — Staff", autoCalc: true, defaultRate: 400 },
  { key: "labour_stay", label: "Labour Stay / Accommodation", autoCalc: true, defaultRate: 300 },
  { key: "staff_stay", label: "Site Personnel Stay", autoCalc: true, defaultRate: 800 },
  { key: "local_transport", label: "Local Transport on Site", autoCalc: false, defaultRate: 0 },
  { key: "tools_consumables", label: "Tools and Consumables", autoCalc: false, defaultRate: 0 },
  { key: "subcontractor_advance", label: "Sub-contractor Advance", autoCalc: false, defaultRate: 0 },
  { key: "other", label: "Other", autoCalc: false, defaultRate: 0 },
];

export default function AdvanceRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";
  const projectName = searchParams.get("projectName") ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dispatchDate, setDispatchDate] = useState("");
  const [daysOnSite, setDaysOnSite] = useState(3);
  const [staffCount, setStaffCount] = useState(1);
  const [labourCount, setLabourCount] = useState(2);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [timingWarning, setTimingWarning] = useState<string | null>(null);
  const [carryForwardBalance, setCarryForwardBalance] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      setUserProfile(profile);

      // Check carry-forward balance
      const { data: cfData } = await supabase
        .from("advance_requests")
        .select("carried_forward_amount")
        .eq("employee_id", profile?.id ?? "")
        .gt("carried_forward_amount", 0)
        .is("settled_at", null);
      const cfTotal = (cfData ?? []).reduce((sum, r) => sum + Number(r.carried_forward_amount ?? 0), 0);
      setCarryForwardBalance(cfTotal);

      setLoading(false);
    })();
  }, []);

  // Initialize line items
  useEffect(() => {
    const items: LineItem[] = CATEGORIES.map((cat) => {
      let qty = 0, days = daysOnSite, rate = cat.defaultRate, amount = 0, policyAmount = 0;
      if (cat.key === "food_labour") { qty = labourCount; policyAmount = qty * days * rate; amount = policyAmount; }
      else if (cat.key === "food_staff") { qty = staffCount; policyAmount = qty * days * rate; amount = policyAmount; }
      else if (cat.key === "labour_stay") { qty = labourCount; policyAmount = qty * days * rate; amount = policyAmount; }
      else if (cat.key === "staff_stay") { qty = staffCount; policyAmount = qty * days * rate; amount = policyAmount; }
      return {
        category: cat.label, qty, days, rate, amount, policy_amount: policyAmount,
        above_policy: false, justification: "", supporting_doc_url: "",
      };
    });
    setLineItems(items);
  }, [daysOnSite, staffCount, labourCount]);

  // Check dispatch timing
  useEffect(() => {
    if (!dispatchDate) { setTimingWarning(null); setIsEmergency(false); return; }
    const dispatch = new Date(dispatchDate);
    const now = new Date();
    const hoursUntil = differenceInHours(dispatch, now);
    const daysUntil = differenceInDays(dispatch, now);

    if (hoursUntil < 24) {
      setIsEmergency(true);
      setTimingWarning(`EMERGENCY: Dispatch is in ${hoursUntil} hours. This will bypass HOD and go directly to MD.`);
    } else if (daysUntil < 3) {
      setIsEmergency(false);
      setTimingWarning("This request is within 3 days of dispatch. Standard approval may not be in time.");
    } else {
      setIsEmergency(false);
      setTimingWarning(null);
    }
  }, [dispatchDate]);

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      // Recalculate above_policy
      if (field === "amount") {
        item.above_policy = Number(value) > item.policy_amount && item.policy_amount > 0;
      }
      updated[index] = item;
      return updated;
    });
  };

  const totalAmount = lineItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const withinPolicy = lineItems.reduce((s, i) => s + Math.min(Number(i.amount || 0), i.policy_amount || Number(i.amount || 0)), 0);
  const abovePolicy = totalAmount - withinPolicy;
  const netTotal = totalAmount - carryForwardBalance;

  const handleSubmit = async () => {
    if (!dispatchDate) { toast.error("Please enter dispatch date"); return; }
    if (totalAmount <= 0) { toast.error("Total amount must be greater than 0"); return; }
    // Check above-policy items have justification
    const missingJustification = lineItems.find((i) => i.above_policy && !i.justification.trim());
    if (missingJustification) { toast.error(`Please provide justification for ${missingJustification.category}`); return; }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userProfile) { setSubmitting(false); return; }

    const advanceId = `ADV-${format(new Date(), "yyyyMMdd")}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`;

    const { error } = await supabase.from("advance_requests").insert({
      advance_id: advanceId,
      employee_id: userProfile.id,
      employee_name: userProfile.display_name || userProfile.email,
      project_id: projectId || null,
      project_name: projectName,
      dispatch_date: dispatchDate,
      days_on_site: daysOnSite,
      staff_count: staffCount,
      labour_count: labourCount,
      line_items: lineItems as any,
      amount: netTotal > 0 ? netTotal : totalAmount,
      total_amount: totalAmount,
      within_policy_amount: withinPolicy,
      above_policy_amount: abovePolicy,
      is_emergency: isEmergency,
      status: isEmergency ? "pending_md" : "pending",
      purpose: `Advance for ${projectName} dispatch on ${format(new Date(dispatchDate), "dd/MM/yyyy")}`,
      bank_account_name: userProfile.display_name,
      payment_method: "bank_transfer",
    } as any);

    if (error) {
      toast.error("Failed to submit: " + error.message);
      setSubmitting(false);
      return;
    }

    // Send notification
    const notifTitle = isEmergency
      ? `EMERGENCY: Advance request for ${projectName}`
      : `Advance request from ${userProfile.display_name || "SIM"} for ${projectName}`;
    const notifBody = isEmergency
      ? `Advance of ₹${totalAmount.toLocaleString("en-IN")} for ${projectName} dispatching within 24 hours. Immediate approval required.`
      : `₹${totalAmount.toLocaleString("en-IN")}. ${abovePolicy > 0 ? `${lineItems.filter((i) => i.above_policy).length} items above policy.` : ""} Please review and approve.`;

    // Notify HOD (production_head) or MD for emergency
    const targetRoles = isEmergency ? ["managing_director"] : ["production_head", "head_operations"];
    const { data: targets } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", targetRoles)
      .eq("is_active", true);

    if (targets?.length) {
      await insertNotifications(
        targets.map((t) => ({
          user_id: t.auth_user_id!,
          title: notifTitle,
          body: notifBody,
          category: "finance",
          link: "/finance",
        }))
      );
    }

    toast.success("Advance request submitted");
    navigate("/site-hub");
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">
            {isEmergency && <Zap className="h-5 w-5 inline mr-1 text-destructive" />}
            {isEmergency ? "Emergency Advance Request" : "Advance Request"}
          </h1>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
      </div>

      {timingWarning && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${isEmergency ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30 text-foreground"}`}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm">{timingWarning}</p>
        </div>
      )}

      {carryForwardBalance > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
          <p className="text-sm text-foreground">
            You have a carry-forward balance of <span className="font-bold">₹{carryForwardBalance.toLocaleString("en-IN")}</span> which will be auto-deducted from this request.
          </p>
        </div>
      )}

      {/* Section 1: Trip Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Project</Label>
              <p className="text-sm font-medium text-foreground">{projectName || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Site Installation Manager</Label>
              <p className="text-sm font-medium text-foreground">{userProfile?.display_name || userProfile?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dispatch Date *</Label>
              <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Days on Site *</Label>
              <Input type="number" min={1} max={30} value={daysOnSite} onChange={(e) => setDaysOnSite(parseInt(e.target.value) || 1)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Team */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team on Site</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Staff Members (Habitainer)</Label>
              <Input type="number" min={0} value={staffCount} onChange={(e) => setStaffCount(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label>Labour (Contractor)</Label>
              <Input type="number" min={0} value={labourCount} onChange={(e) => setLabourCount(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Expense Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineItems.map((item, idx) => {
            const cat = CATEGORIES[idx];
            return (
              <div key={idx} className={`rounded-lg border p-3 space-y-2 ${item.above_policy ? "border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/5" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.category}</p>
                  {item.above_policy && (
                    <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FFF3CD", color: "#D4860A", border: "none" }}>
                      Above Policy
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {cat?.autoCalc ? (
                    <>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Qty</Label>
                        <p className="text-sm text-foreground">{item.qty}</p>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Days</Label>
                        <p className="text-sm text-foreground">{item.days}</p>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Rate (₹)</Label>
                        <p className="text-sm text-foreground">₹{item.rate}</p>
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] text-muted-foreground">Policy (₹)</Label>
                        <p className="text-sm font-medium text-foreground">₹{item.policy_amount.toLocaleString("en-IN")}</p>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (₹) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.amount || ""}
                    onChange={(e) => updateLineItem(idx, "amount", parseFloat(e.target.value) || 0)}
                    placeholder={cat?.autoCalc ? `Policy: ₹${item.policy_amount.toLocaleString("en-IN")}` : "Enter amount"}
                  />
                </div>
                {(cat?.key === "subcontractor_advance" || cat?.key === "other") && (
                  <div className="space-y-1">
                    <Label className="text-xs">{cat.key === "other" ? "Explanation (required)" : "Justification"} *</Label>
                    <Textarea
                      value={item.justification}
                      onChange={(e) => updateLineItem(idx, "justification", e.target.value)}
                      placeholder={cat.key === "other" ? "Explain the expense..." : "Justification required"}
                      rows={2}
                    />
                  </div>
                )}
                {item.above_policy && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-destructive">This exceeds policy. Please explain and attach supporting document.</Label>
                    <Textarea
                      value={item.justification}
                      onChange={(e) => updateLineItem(idx, "justification", e.target.value)}
                      placeholder="Justification for exceeding policy..."
                      rows={2}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Section 4: Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Requested</span>
            <span className="font-bold text-foreground">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Within Policy</span>
            <span className="font-medium" style={{ color: "#006039" }}>₹{withinPolicy.toLocaleString("en-IN")}</span>
          </div>
          {abovePolicy > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Above Policy</span>
              <span className="font-medium" style={{ color: "#D4860A" }}>₹{abovePolicy.toLocaleString("en-IN")}</span>
            </div>
          )}
          {carryForwardBalance > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carry-forward deduction</span>
                <span className="font-medium text-destructive">-₹{carryForwardBalance.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Net Amount</span>
                <span>₹{Math.max(0, netTotal).toLocaleString("en-IN")}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="text-foreground">Bank Transfer</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Account Holder</span>
            <span className="text-foreground">{userProfile?.display_name || "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4 -mx-4 md:-mx-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>Cancel</Button>
        <Button
          className="flex-1"
          style={{ backgroundColor: isEmergency ? "#F40009" : "#006039" }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEmergency ? "Submit Emergency Request" : "Submit Advance Request"}
        </Button>
      </div>
    </div>
  );
}
