import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { EditRecordButton, EditedIndicator } from "@/components/shared/EditWithReason";

/** Roles that may submit the two monthly funnel entries (narrow scope, funnel tables only). */
const FUNNEL_SUBMIT_ROLES = [
  "sales_executive",
  "sales_director",
  "marketing",
  "managing_director",
  "super_admin",
  "chairman",
];

const LOSS_REASONS = [
  { value: "budget", label: "Budget mismatch" },
  { value: "timeline", label: "Timeline mismatch" },
  { value: "location_not_served", label: "Location not served" },
  { value: "went_with_competitor", label: "Went with competitor" },
  { value: "not_reachable", label: "Not reachable / RNR" },
  { value: "just_exploring", label: "Just exploring" },
  { value: "other", label: "Other" },
];

const MARKETING_FIELDS: { name: string; label: string }[] = [
  { name: "total_leads", label: "Total leads" },
  { name: "qualified_leads", label: "Qualified leads" },
  { name: "model_home_visits", label: "Model home visits" },
  { name: "proposals_shared", label: "Proposals shared" },
  { name: "meta_ad_spend", label: "Meta ad spend (₹)" },
  { name: "webinar_spend", label: "Webinar spend (₹)" },
  { name: "leads_instagram", label: "Leads — Instagram" },
  { name: "leads_youtube", label: "Leads — YouTube" },
  { name: "leads_website", label: "Leads — Website" },
  { name: "leads_webinar", label: "Leads — Webinar" },
  { name: "leads_direct", label: "Leads — Direct" },
  { name: "instagram_followers", label: "Instagram followers" },
  { name: "instagram_views", label: "Instagram views" },
  { name: "instagram_reach", label: "Instagram reach" },
  { name: "youtube_subscribers", label: "YouTube subscribers" },
  { name: "youtube_views", label: "YouTube views" },
  { name: "webinar_attendees", label: "Webinar attendees" },
];

const CALL_FIELDS: { name: string; label: string }[] = [
  { name: "leads_total", label: "Leads total" },
  { name: "calls_made", label: "Calls made" },
  { name: "calls_answered", label: "Calls answered" },
  { name: "calls_rnr", label: "Calls RNR" },
  { name: "calls_qualified", label: "Calls qualified" },
  { name: "visits_from_qualified", label: "Visits from qualified" },
];

const inr = (n: any) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const monthLabel = (d: string) =>
  new Date(d).toLocaleString("en-IN", { month: "short", year: "numeric" });
const thisMonth = () => new Date().toISOString().slice(0, 7);

export function FunnelEntryTab() {
  const [role, setRole] = useState<string | null>(null);
  const [month, setMonth] = useState(thisMonth());
  const [marketing, setMarketing] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [mForm, setMForm] = useState<Record<string, string>>({});
  const [cForm, setCForm] = useState<Record<string, string>>({});
  const [lossReason, setLossReason] = useState("");
  const [lossDetail, setLossDetail] = useState("");
  const [saving, setSaving] = useState<"m" | "c" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const [p, m, c] = await Promise.all([
      user
        ? supabase.from("profiles").select("role").eq("auth_user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from("marketing_funnel_monthly").select("*").order("month", { ascending: false }),
      supabase.from("call_funnel_monthly").select("*").order("month", { ascending: false }),
    ]);
    setRole((p as any)?.data?.role ?? null);
    setMarketing(m.data || []);
    setCalls(c.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const canSubmit = role ? FUNNEL_SUBMIT_ROLES.includes(role) : false;
  const monthDate = `${month}-01`;

  const existingM = useMemo(
    () => marketing.find((r) => String(r.month).slice(0, 7) === month),
    [marketing, month]
  );
  const existingC = useMemo(
    () => calls.find((r) => String(r.month).slice(0, 7) === month),
    [calls, month]
  );

  useEffect(() => {
    const seed = (fields: { name: string }[], row: any) =>
      Object.fromEntries(fields.map((f) => [f.name, row?.[f.name] == null ? "" : String(row[f.name])]));
    setMForm(seed(MARKETING_FIELDS, existingM));
    setCForm(seed(CALL_FIELDS, existingC));
    setLossReason(existingC?.loss_reason || "");
    setLossDetail(existingC?.loss_reason_detail || "");
  }, [existingM, existingC]);

  const num = (v: string) => (v === "" ? null : Number(v));

  const costPerQualifiedLead = useMemo(() => {
    const q = Number(mForm.qualified_leads || 0);
    if (!q) return null;
    return (Number(mForm.meta_ad_spend || 0) + Number(mForm.webinar_spend || 0)) / q;
  }, [mForm]);

  const callAnomaly =
    Number(cForm.calls_made || 0) > 0 &&
    Number(cForm.calls_answered || 0) === Number(cForm.calls_made || 0) &&
    Number(cForm.calls_rnr || 0) === 0;

  const saveMarketing = async () => {
    if (existingM) {
      toast.info("This month is already submitted — use Edit (with reason) to correct it.");
      return;
    }
    setSaving("m");
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = { month: monthDate, created_by: user?.id, updated_by: user?.id };
    MARKETING_FIELDS.forEach((f) => { payload[f.name] = num(mForm[f.name] ?? ""); });
    const { error } = await supabase.from("marketing_funnel_monthly").insert(payload);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marketing funnel saved for ${monthLabel(monthDate)}`);
    load();
  };

  const saveCalls = async () => {
    if (existingC) {
      toast.info("This month is already submitted — use Edit (with reason) to correct it.");
      return;
    }
    if (!lossReason) { toast.error("Select a loss reason category"); return; }
    setSaving("c");
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      month: monthDate,
      loss_reason: lossReason,
      loss_reason_detail: lossDetail.trim() || null,
      created_by: user?.id,
      updated_by: user?.id,
    };
    CALL_FIELDS.forEach((f) => { payload[f.name] = num(cForm[f.name] ?? ""); });
    const { error } = await supabase.from("call_funnel_monthly").insert(payload);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(
      callAnomaly
        ? "Saved — flagged for review and the Sales Director has been notified."
        : `Call funnel saved for ${monthLabel(monthDate)}`
    );
    load();
  };

  if (loading) return <div className="py-12 text-center" style={{ color: "#999" }}>Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <Label className="text-xs">Reporting month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-44" />
        </div>
        {!canSubmit && (
          <Badge variant="outline" style={{ color: "#D4860A", borderColor: "#D4860A" }}>
            View only — you are not a funnel data owner
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Marketing funnel */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Marketing Funnel — {monthLabel(monthDate)}</CardTitle>
            {existingM && (
              <div className="flex items-center gap-1">
                <EditedIndicator table="marketing_funnel_monthly" recordId={existingM.id} />
                <EditRecordButton
                  table="marketing_funnel_monthly"
                  recordId={existingM.id}
                  record={existingM}
                  title={`Correct Marketing Funnel — ${monthLabel(monthDate)}`}
                  fields={MARKETING_FIELDS.map((f) => ({ ...f, type: "number" as const }))}
                  onSaved={load}
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {MARKETING_FIELDS.map((f) => (
                <div key={f.name}>
                  <Label className="text-xs" style={{ color: "#666" }}>{f.label}</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={mForm[f.name] ?? ""}
                    disabled={!canSubmit || !!existingM}
                    onChange={(e) => setMForm((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="rounded p-2 text-sm" style={{ background: "#F7F7F7" }}>
              Cost per qualified lead (calculated):{" "}
              <span className="font-bold" style={{ color: "#006039" }}>
                {existingM ? inr(existingM.cost_per_qualified_lead) : inr(costPerQualifiedLead)}
              </span>
            </div>
            {existingM ? (
              <p className="text-xs" style={{ color: "#666" }}>
                Submitted for this month. Corrections go through Edit (with reason).
              </p>
            ) : (
              <Button onClick={saveMarketing} disabled={!canSubmit || saving === "m"} style={{ background: "#006039", color: "#fff" }}>
                {saving === "m" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Submit month
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Call funnel */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Call / Conversion Funnel — {monthLabel(monthDate)}</CardTitle>
            {existingC && (
              <div className="flex items-center gap-1">
                <EditedIndicator table="call_funnel_monthly" recordId={existingC.id} />
                <EditRecordButton
                  table="call_funnel_monthly"
                  recordId={existingC.id}
                  record={existingC}
                  title={`Correct Call Funnel — ${monthLabel(monthDate)}`}
                  fields={[
                    ...CALL_FIELDS.map((f) => ({ ...f, type: "number" as const })),
                    { name: "loss_reason", label: "Loss reason", type: "select" as const, options: LOSS_REASONS },
                    { name: "loss_reason_detail", label: "Loss reason detail", type: "textarea" as const },
                  ]}
                  onSaved={load}
                />
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {CALL_FIELDS.map((f) => (
                <div key={f.name}>
                  <Label className="text-xs" style={{ color: "#666" }}>{f.label}</Label>
                  <Input
                    type="number"
                    className="mt-1 h-8 text-sm"
                    value={cForm[f.name] ?? ""}
                    disabled={!canSubmit || !!existingC}
                    onChange={(e) => setCForm((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs" style={{ color: "#666" }}>Primary loss reason (mandatory)</Label>
              <Select value={lossReason} onValueChange={setLossReason} disabled={!canSubmit || !!existingC}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs" style={{ color: "#666" }}>Detail (optional)</Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={lossDetail}
                disabled={!canSubmit || !!existingC}
                onChange={(e) => setLossDetail(e.target.value)}
              />
            </div>

            {(existingC?.data_quality_flag || (!existingC && callAnomaly)) && (
              <div className="flex items-start gap-2 rounded p-2 text-xs" style={{ background: "#FDF2F2", color: "#F40009" }}>
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  Every call answered with zero RNR — this pattern is flagged as a likely data-capture
                  artefact and notifies the Sales Director on submission.
                </span>
              </div>
            )}

            {existingC ? (
              <p className="text-xs" style={{ color: "#666" }}>
                Submitted for this month. Corrections go through Edit (with reason).
              </p>
            ) : (
              <Button onClick={saveCalls} disabled={!canSubmit || saving === "c"} style={{ background: "#006039", color: "#fff" }}>
                {saving === "c" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Submit month
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
