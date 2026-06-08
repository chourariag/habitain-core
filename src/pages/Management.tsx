import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Download, BarChart3 } from "lucide-react";
import { format } from "date-fns";

type Project = {
  id: string; name: string; status: string | null; location: string | null;
  type: string | null; est_completion: string | null; start_date: string | null;
};
type Task = { project_id: string; phase: string | null; planned_start_date: string | null; planned_finish_date: string | null; actual_start_date: string | null; actual_finish_date: string | null; completion_percentage: number | null; status: string | null; };
type Milestone = { project_id: string; amount_incl_gst: number | null; amount_excl_gst: number | null; status: string | null; billed_date: string | null; received_date: string | null; description: string | null; };
type RevMargin = { project_id: string; original_valuation: number | null; expected_final_cost: number | null; tender_margin_pct: number | null; gfc_margin_pct: number | null; expected_variations: number | null; };
type BoqItem = { id: string; project_id: string; description: string; unit: string | null; boq_qty: number | null; boq_rate: number | null; stage: string | null; };
type Grn = { project_id: string; basic_amount_excl_gst: number | null; boq_category: string | null; invoice_date: string | null; vendor_name: string | null; invoice_no: string | null; description: string | null; };

const fmt = (n: number) => "₹" + (n / 100000).toFixed(2) + " L";
const fmtCr = (n: number) => "₹" + (n / 10000000).toFixed(2) + " Cr";

export default function Management() {
  const [tab, setTab] = useState("gantt");
  const [loading, setLoading] = useState(true);
  const [refreshAt, setRefreshAt] = useState<Date>(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [margins, setMargins] = useState<RevMargin[]>([]);
  const [boq, setBoq] = useState<BoqItem[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);

  async function load() {
    setLoading(true);
    const [p, t, m, rm, b, g] = await Promise.all([
      supabase.from("projects").select("id,name,status,location,type,est_completion,start_date").eq("is_archived", false),
      supabase.from("project_tasks").select("project_id,phase,planned_start_date,planned_finish_date,actual_start_date,actual_finish_date,completion_percentage,status"),
      supabase.from("project_billing_milestones").select("project_id,amount_incl_gst,amount_excl_gst,status,billed_date,received_date,description"),
      supabase.from("project_revenue_margin").select("project_id,original_valuation,expected_final_cost,tender_margin_pct,gfc_margin_pct,expected_variations"),
      supabase.from("boq_items").select("id,project_id,description,unit,boq_qty,boq_rate,stage").eq("is_archived", false),
      supabase.from("project_grns").select("project_id,basic_amount_excl_gst,boq_category,invoice_date,vendor_name,invoice_no,description"),
    ]);
    setProjects((p.data as Project[]) || []);
    setTasks((t.data as Task[]) || []);
    setMilestones((m.data as Milestone[]) || []);
    setMargins((rm.data as RevMargin[]) || []);
    setBoq((b.data as BoqItem[]) || []);
    setGrns((g.data as Grn[]) || []);
    setRefreshAt(new Date());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 bg-white min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6" style={{ color: "#006039" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>Management</h1>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: "#666666" }}>
          <span>Last updated: {format(refreshAt, "dd/MM/yyyy HH:mm")}</span>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={"h-3.5 w-3.5 mr-1 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="gantt">Master Gantt</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Forecast</TabsTrigger>
          <TabsTrigger value="orderbook">Order Book & Margins</TabsTrigger>
          <TabsTrigger value="budget">Budget vs Actuals</TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-4">
          <GanttTab projects={projects} tasks={tasks} />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <RevenueTab projects={projects} milestones={milestones} />
        </TabsContent>
        <TabsContent value="orderbook" className="mt-4">
          <OrderBookTab projects={projects} milestones={milestones} margins={margins} grns={grns} />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <BudgetTab projects={projects} boq={boq} grns={grns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────────────── Tab 1 — Master Gantt (simplified) ───────────────── */
function GanttTab({ projects, tasks }: { projects: Project[]; tasks: Task[] }) {
  const months = useMemo(() => {
    const arr: { key: string; label: string; date: Date }[] = [];
    const now = new Date();
    for (let i = -2; i <= 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), date: d });
    }
    return arr;
  }, []);

  if (!projects.length) {
    return <EmptyState text="No active projects found." />;
  }

  const byProject = new Map<string, Task[]>();
  tasks.forEach(t => {
    if (!byProject.has(t.project_id)) byProject.set(t.project_id, []);
    byProject.get(t.project_id)!.push(t);
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Project Schedule Overview</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid #E0E0E0" }}>
              <th className="text-left p-2 sticky left-0 bg-white" style={{ minWidth: 200 }}>Project</th>
              <th className="text-left p-2">Status</th>
              {months.map(m => <th key={m.key} className="text-center p-2 text-xs" style={{ minWidth: 90 }}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const pt = byProject.get(p.id) || [];
              const start = pt.map(t => t.planned_start_date).filter(Boolean).sort()[0];
              const end = pt.map(t => t.planned_finish_date).filter(Boolean).sort().reverse()[0];
              const avgPct = pt.length ? Math.round(pt.reduce((s, t) => s + (t.completion_percentage || 0), 0) / pt.length) : 0;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td className="p-2 sticky left-0 bg-white font-medium">{p.name}</td>
                  <td className="p-2"><Badge variant="outline">{p.status || "—"}</Badge></td>
                  {months.map(m => {
                    const ms = m.date.getTime();
                    const me = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0).getTime();
                    const s = start ? new Date(start).getTime() : 0;
                    const e = end ? new Date(end).getTime() : 0;
                    const overlap = s && e && s <= me && e >= ms;
                    return (
                      <td key={m.key} className="p-1">
                        {overlap ? (
                          <div className="h-5 rounded text-[10px] text-white flex items-center justify-center" style={{ background: "#006039" }}>
                            {avgPct ? `${avgPct}%` : ""}
                          </div>
                        ) : pt.length === 0 ? <div className="h-5 rounded bg-[#F0F0F0] text-[9px] text-center" style={{ color: "#999" }}>—</div> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs mt-3" style={{ color: "#999" }}>
          Showing planned schedule from project_tasks. Projects without uploaded schedules show no bars — ask Planning to upload Project Setup Templates.
        </p>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Tab 2 — Revenue Forecast ───────────────── */
function RevenueTab({ projects, milestones }: { projects: Project[]; milestones: Milestone[] }) {
  const months = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = -6; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy") });
    }
    return arr;
  }, []);

  const currentKey = format(new Date(), "yyyy-MM");
  const planned = milestones.filter(m => m.status !== "received").reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
  const received = milestones.filter(m => m.status === "received").reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
  const invoiced = milestones.filter(m => m.billed_date && format(new Date(m.billed_date), "yyyy-MM") === currentKey).reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = milestones.filter(m => m.status !== "received" && m.billed_date && m.billed_date < today);

  const byMonth = months.map(m => {
    const p = milestones.filter(x => x.billed_date && format(new Date(x.billed_date), "yyyy-MM") === m.key)
      .reduce((s, x) => s + (x.amount_incl_gst || 0), 0);
    const r = milestones.filter(x => x.status === "received" && x.received_date && format(new Date(x.received_date), "yyyy-MM") === m.key)
      .reduce((s, x) => s + (x.amount_incl_gst || 0), 0);
    return { ...m, p, r };
  });
  const max = Math.max(1, ...byMonth.map(b => Math.max(b.p, b.r)));

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <div className="rounded-md p-3 text-sm" style={{ background: "#FDE7E9", color: "#F40009" }}>
          {overdue.length} milestone(s) overdue totalling {fmt(overdue.reduce((s, m) => s + (m.amount_incl_gst || 0), 0))}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="PLANNED" value={fmtCr(planned)} sub="Open milestones" />
        <Tile label="INVOICED" value={fmtCr(invoiced)} sub="This month" />
        <Tile label="RECEIVED" value={fmtCr(received)} sub="To date" />
        <Tile label="WIP" value="—" sub="Pending Running Bill" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Planned vs Received — Rolling 12 months</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {byMonth.map(b => (
              <div key={b.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div className="flex-1 rounded-t" style={{ height: `${(b.p / max) * 100}%`, background: "#0066CC" }} title={`Planned ${fmt(b.p)}`} />
                  <div className="flex-1 rounded-t" style={{ height: `${(b.r / max) * 100}%`, background: "#006039" }} title={`Received ${fmt(b.r)}`} />
                </div>
                <span className="text-[9px]" style={{ color: "#666" }}>{b.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "#666" }}>
            <span><span className="inline-block w-3 h-3 mr-1" style={{ background: "#0066CC" }} /> Planned</span>
            <span><span className="inline-block w-3 h-3 mr-1" style={{ background: "#006039" }} /> Received</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">By Project</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: "1px solid #E0E0E0" }}>
              <th className="text-left p-2">Project</th><th className="text-right p-2">Planned</th>
              <th className="text-right p-2">Received</th><th className="text-right p-2">Variance</th>
            </tr></thead>
            <tbody>
              {projects.map(p => {
                const pm = milestones.filter(m => m.project_id === p.id);
                const pln = pm.reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
                const rcv = pm.filter(m => m.status === "received").reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                    <td className="p-2">{p.name}</td>
                    <td className="text-right p-2">{fmt(pln)}</td>
                    <td className="text-right p-2">{fmt(rcv)}</td>
                    <td className="text-right p-2">{fmt(pln - rcv)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Tab 3 — Order Book & Margins ───────────────── */
function OrderBookTab({ projects, milestones, margins, grns }: { projects: Project[]; milestones: Milestone[]; margins: RevMargin[]; grns: Grn[] }) {
  const marginMap = new Map(margins.map(m => [m.project_id, m]));
  const rows = projects.map(p => {
    const pm = milestones.filter(m => m.project_id === p.id);
    const billed = pm.filter(m => m.billed_date).reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
    const received = pm.filter(m => m.status === "received").reduce((s, m) => s + (m.amount_incl_gst || 0), 0);
    const m = marginMap.get(p.id);
    const orig = m?.original_valuation || pm.reduce((s, x) => s + (x.amount_excl_gst || 0), 0);
    const cost = grns.filter(g => g.project_id === p.id).reduce((s, g) => s + (g.basic_amount_excl_gst || 0), 0);
    const expCost = m?.expected_final_cost || cost;
    const margin = orig ? ((orig - expCost) / orig) * 100 : 0;
    const rag = margin > 25 ? "🟢" : margin > 15 ? "🟡" : "🔴";
    return { p, orig, billed, received, cost, expCost, margin, rag, m };
  });
  const totals = rows.reduce((t, r) => ({ orig: t.orig + r.orig, billed: t.billed + r.billed, received: t.received + r.received, cost: t.cost + r.cost }), { orig: 0, billed: 0, received: 0, cost: 0 });
  const wgtMargin = totals.orig ? ((totals.orig - totals.cost) / totals.orig) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="ORDER BOOK" value={fmtCr(totals.orig)} sub={`${rows.length} projects`} />
        <Tile label="BILLED" value={fmtCr(totals.billed)} sub="To date" />
        <Tile label="RECEIVED" value={fmtCr(totals.received)} sub="To date" />
        <Tile label="ANTICIPATED MARGIN" value={`${wgtMargin.toFixed(1)}%`} sub="Weighted" />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead style={{ background: "#F7F7F7" }}>
              <tr>
                <th className="text-left p-2">Project</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Order Value</th>
                <th className="text-right p-2">Billed</th>
                <th className="text-right p-2">Received</th>
                <th className="text-right p-2">Cost to date</th>
                <th className="text-right p-2">Anticipated Margin %</th>
                <th className="text-center p-2">RAG</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.p.id} style={{ borderTop: "1px solid #F0F0F0" }}>
                  <td className="p-2 font-medium">{r.p.name}</td>
                  <td className="p-2">{r.p.status || "—"}</td>
                  <td className="text-right p-2">{fmt(r.orig)}</td>
                  <td className="text-right p-2">{fmt(r.billed)}</td>
                  <td className="text-right p-2">{fmt(r.received)}</td>
                  <td className="text-right p-2">{fmt(r.cost)}</td>
                  <td className="text-right p-2">{r.margin.toFixed(1)}%</td>
                  <td className="text-center p-2">{r.rag}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #006039", fontWeight: 700, background: "#F7F7F7" }}>
                <td className="p-2" colSpan={2}>TOTAL</td>
                <td className="text-right p-2">{fmt(totals.orig)}</td>
                <td className="text-right p-2">{fmt(totals.billed)}</td>
                <td className="text-right p-2">{fmt(totals.received)}</td>
                <td className="text-right p-2">{fmt(totals.cost)}</td>
                <td className="text-right p-2">{wgtMargin.toFixed(1)}%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Tab 4 — Budget vs Actuals ───────────────── */
function BudgetTab({ projects, boq, grns }: { projects: Project[]; boq: BoqItem[]; grns: Grn[] }) {
  const [pid, setPid] = useState<string>("");
  useEffect(() => { if (!pid && projects.length) setPid(projects[0].id); }, [projects, pid]);

  const items = boq.filter(b => b.project_id === pid);
  const projectGrns = grns.filter(g => g.project_id === pid);
  const spentByCat = new Map<string, number>();
  projectGrns.forEach(g => {
    const k = (g.boq_category || "Unallocated").trim();
    spentByCat.set(k, (spentByCat.get(k) || 0) + (g.basic_amount_excl_gst || 0));
  });

  const totalBudget = items.reduce((s, b) => s + (b.boq_qty || 0) * (b.boq_rate || 0), 0);
  const totalSpent = projectGrns.reduce((s, g) => s + (g.basic_amount_excl_gst || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: "#666" }}>Project:</span>
        <Select value={pid} onValueChange={setPid}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="GFC BUDGET" value={fmt(totalBudget)} sub="From BOQ" />
        <Tile label="SPENT" value={fmt(totalSpent)} sub="From GRN" />
        <Tile label="REMAINING" value={fmt(totalBudget - totalSpent)} sub="" />
        <Tile label="% SPENT" value={totalBudget ? `${((totalSpent / totalBudget) * 100).toFixed(1)}%` : "—"} sub="" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">BOQ Line Items</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {items.length === 0 ? <p className="p-4 text-sm" style={{ color: "#999" }}>No BOQ items for this project.</p> : (
            <table className="w-full text-xs">
              <thead style={{ background: "#F7F7F7" }}>
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Rate</th>
                  <th className="text-right p-2">Budget</th>
                  <th className="text-right p-2">Spent (category)</th>
                  <th className="text-center p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map(b => {
                  const budget = (b.boq_qty || 0) * (b.boq_rate || 0);
                  const spent = spentByCat.get((b.stage || "").trim()) || 0;
                  const pct = budget ? (spent / budget) * 100 : 0;
                  const dot = !spent ? "⚪" : pct > 100 ? "🔴" : pct > 90 ? "🟡" : "🟢";
                  return (
                    <tr key={b.id} style={{ borderTop: "1px solid #F0F0F0" }}>
                      <td className="p-2">{b.description}</td>
                      <td className="p-2">{b.stage || "—"}</td>
                      <td className="text-right p-2">{b.boq_qty}</td>
                      <td className="text-right p-2">{b.boq_rate}</td>
                      <td className="text-right p-2">{fmt(budget)}</td>
                      <td className="text-right p-2">{fmt(spent)}</td>
                      <td className="text-center p-2">{dot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs" style={{ color: "#999" }}>
        Note: GRN-to-BOQ matching is by category tag on the GRN entry form. Untagged GRNs roll up under "Unallocated".
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "#F7F7F7" }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color: "#006039" }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "#999" }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm rounded-lg" style={{ background: "#F7F7F7", color: "#666" }}>{text}</div>;
}
