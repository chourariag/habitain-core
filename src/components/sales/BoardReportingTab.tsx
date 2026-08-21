import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const inr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const crore = (n: number | null | undefined) =>
  n == null ? "—" : `₹${(Number(n) / 10000000).toFixed(2)} Cr`;
const ddmmyyyy = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const monthLabel = (d: string) =>
  new Date(d).toLocaleString("en-IN", { month: "short", year: "numeric" });

const ACTIVE_STAGES = ["Outbound", "Qualified", "Meeting", "Proposal Sent"];

export function BoardReportingTab() {
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [recon, setRecon] = useState<any[]>([]);
  const [marketing, setMarketing] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [econ, setEcon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [l, r, m, c, e, p] = await Promise.all([
      supabase.from("sales_pipeline_leads").select("*").eq("is_archived", false).order("value", { ascending: false }),
      supabase.from("v_sales_segment_reconciliation").select("*"),
      supabase.from("marketing_funnel_monthly").select("*").order("month", { ascending: false }),
      supabase.from("call_funnel_monthly").select("*").order("month", { ascending: false }),
      supabase.from("v_unit_economics_monthly").select("*"),
      supabase.from("projects").select("id,name"),
    ]);
    setLeads(l.data || []);
    setRecon(r.data || []);
    setMarketing(m.data || []);
    setCalls(c.data || []);
    setEcon(e.data || []);
    setProjects(Object.fromEntries((p.data || []).map((x: any) => [x.id, x.name])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-12 text-center" style={{ color: "#999" }}>Loading…</div>;

  const active = leads.filter(l => ACTIVE_STAGES.includes(l.stage));
  const paused = leads.filter(l => l.stage === "Paused");
  const lost = leads.filter(l => l.stage === "Lost");
  const sum = (rows: any[]) => rows.reduce((s, r) => s + Number(r.value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Pipeline", v: sum(active), n: active.length },
          { label: "Won (linked to projects)", v: sum(leads.filter(l => l.stage === "Won")), n: leads.filter(l => l.stage === "Won").length },
          { label: "Paused", v: sum(paused), n: paused.length },
          { label: "Lost", v: sum(lost), n: lost.length },
        ].map(t => (
          <Card key={t.label} style={{ background: "#F7F7F7" }}>
            <CardContent className="p-4">
              <div className="text-xs" style={{ color: "#666" }}>{t.label}</div>
              <div className="text-lg font-bold" style={{ color: "#006039" }}>{crore(t.v)}</div>
              <div className="text-xs" style={{ color: "#999" }}>{t.n} deals</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reconciliation */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Reconciliation Check</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recon.length === 0 && <div className="text-sm" style={{ color: "#999" }}>No stated totals recorded.</div>}
          {recon.map((r: any) => {
            const gap = Number(r.gap || 0);
            const ok = Math.abs(gap) < 1;
            return (
              <div key={r.total_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                   style={{ borderColor: ok ? "#e5e5e5" : "#F40009", background: ok ? "#F7F7F7" : "#FFF5F5" }}>
                <div className="flex items-center gap-2">
                  {ok ? <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />
                      : <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />}
                  <div>
                    <div className="text-sm font-semibold">{r.label}</div>
                    <div className="text-xs" style={{ color: "#666" }}>
                      Stated {crore(r.stated_total)} vs computed {crore(r.computed_total)} · as of {ddmmyyyy(r.as_of_date)}
                    </div>
                  </div>
                </div>
                <Badge style={{ background: ok ? "#006039" : "#F40009", color: "#fff" }}>
                  {ok ? "Reconciled" : `Gap ${crore(gap)}`}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pipeline (pre-won leads &amp; linked wins)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead style={{ background: "#F7F7F7" }}>
              <tr className="text-left">
                {["Client", "Segment", "Location", "Size", "Value", "Source", "Stage", "Temp", "Project / Reason", "Last Activity"].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-semibold" style={{ color: "#666" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{l.client_name}</td>
                  <td className="px-3 py-2">{l.segment}</td>
                  <td className="px-3 py-2">{l.location || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.size_sqft ? `${Number(l.size_sqft).toLocaleString("en-IN")} sqft` : l.module_count ? `${l.module_count} modules` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{crore(l.value)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.source || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant="outline" style={{
                      borderColor: l.stage === "Lost" ? "#F40009" : l.stage === "Paused" ? "#D4860A" : "#006039",
                      color: l.stage === "Lost" ? "#F40009" : l.stage === "Paused" ? "#D4860A" : "#006039",
                    }}>{l.stage}</Badge>
                  </td>
                  <td className="px-3 py-2">{l.temperature || "—"}</td>
                  <td className="px-3 py-2">
                    {l.project_id ? (
                      <Link to={`/projects/${l.project_id}`} className="inline-flex items-center gap-1 underline" style={{ color: "#006039" }}>
                        {projects[l.project_id] || "Linked project"} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (l.status_reason || "—")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{ddmmyyyy(l.last_activity_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Marketing funnel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Marketing Funnel (monthly)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead style={{ background: "#F7F7F7" }}>
              <tr className="text-left">
                {["Month", "Leads", "Qualified", "Visits", "Proposals", "Meta Spend", "Webinar Spend", "Cost / Qualified Lead", "IG / YT / Web / Webinar / Direct"].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-semibold" style={{ color: "#666" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marketing.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{monthLabel(m.month)}</td>
                  <td className="px-3 py-2">{m.total_leads}</td>
                  <td className="px-3 py-2">{m.qualified_leads}</td>
                  <td className="px-3 py-2">{m.model_home_visits}</td>
                  <td className="px-3 py-2">{m.proposals_shared}</td>
                  <td className="whitespace-nowrap px-3 py-2">{inr(m.meta_ad_spend)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{inr(m.webinar_spend)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold" style={{ color: "#006039" }}>
                    {inr(m.cost_per_qualified_lead)} <span className="text-xs font-normal" style={{ color: "#999" }}>(calculated)</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2" style={{ color: "#666" }}>
                    {m.leads_instagram} / {m.leads_youtube} / {m.leads_website} / {m.leads_webinar} / {m.leads_direct}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Call funnel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Call / Conversion Funnel (monthly)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead style={{ background: "#F7F7F7" }}>
              <tr className="text-left">
                {["Month", "Leads", "Calls Made", "Answered", "RNR", "Qualified", "Visits", "Loss Reason", "Data Check"].map(h => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-semibold" style={{ color: "#666" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} className="border-t" style={{ background: c.data_quality_flag ? "#FFF8EC" : undefined }}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{monthLabel(c.month)}</td>
                  <td className="px-3 py-2">{c.leads_total}</td>
                  <td className="px-3 py-2">{c.calls_made}</td>
                  <td className="px-3 py-2">{c.calls_answered}</td>
                  <td className="px-3 py-2">{c.calls_rnr}</td>
                  <td className="px-3 py-2">{c.calls_qualified}</td>
                  <td className="px-3 py-2">{c.visits_from_qualified}</td>
                  <td className="px-3 py-2">{c.loss_reason || <span style={{ color: "#F40009" }}>Not captured</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {c.data_quality_flag ? (
                      <Badge style={{ background: "#D4860A", color: "#fff" }}>
                        <AlertTriangle className="mr-1 h-3 w-3" /> 100% answered, 0 RNR — review
                      </Badge>
                    ) : <span style={{ color: "#999" }}>OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Unit economics */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Unit Economics (derived — Budget vs Forecast)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {econ.length === 0 ? (
            <div className="px-3 py-6 text-sm" style={{ color: "#999" }}>
              No period plan entered yet. Add Budget and Forecast rows per month in Finance to compute CAC.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ background: "#F7F7F7" }}>
                <tr className="text-left">
                  {["Period", "Scenario", "S&M + Media", "Orders Closed", "CAC", "Contribution %", "Contribution / ₹ CAC"].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-semibold" style={{ color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {econ.map((e, i) => (
                  <tr key={i} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2">{String(e.month).padStart(2, "0")}/{e.year}</td>
                    <td className="px-3 py-2 capitalize">{e.scenario}</td>
                    <td className="whitespace-nowrap px-3 py-2">{inr(e.sm_plus_media)}</td>
                    <td className="px-3 py-2">{e.orders_closed}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{inr(e.cac)}</td>
                    <td className="px-3 py-2">{e.contribution_pct == null ? "—" : `${e.contribution_pct}%`}</td>
                    <td className="px-3 py-2">{e.contribution_per_rupee_cac ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
