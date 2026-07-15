import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Props {
  projectId: string;
  contractValue: number;
}

const fmtINR = (n: number) =>
  `₹${(Math.round(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`;
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

type Tone = "green" | "amber" | "red" | "neutral";
const toneClass: Record<Tone, string> = {
  green: "text-[hsl(155_100%_19%)]",
  amber: "text-[hsl(35_92%_43%)]",
  red: "text-[hsl(354_99%_50%)]",
  neutral: "text-foreground",
};

function Row({ label, value, tone = "neutral", strong }: { label: string; value: string; tone?: Tone; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "border-t pt-2 mt-1 font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${toneClass[tone]} ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const bg = {
    green: "bg-[hsl(155_100%_19%/0.08)] border-[hsl(155_100%_19%/0.25)]",
    amber: "bg-[hsl(35_92%_43%/0.08)] border-[hsl(35_92%_43%/0.25)]",
    red: "bg-[hsl(354_99%_50%/0.08)] border-[hsl(354_99%_50%/0.25)]",
    neutral: "bg-card border-border",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${toneClass[tone]}`}>{value}</div>
    </div>
  );
}

export function ProjectPLTab({ projectId, contractValue }: Props) {
  const [loading, setLoading] = useState(true);
  const [variations, setVariations] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [boq, setBoq] = useState<any[]>([]);
  const [running, setRunning] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [labour, setLabour] = useState<{ cost: number }>({ cost: 0 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [varRes, msRes, boqRes, rbRes, grnRes, poRes] = await Promise.all([
      supabase.from("project_variations").select("*").eq("project_id", projectId),
      supabase.from("project_billing_milestones").select("*").eq("project_id", projectId),
      supabase.from("boq_items").select("boq_qty,boq_rate").eq("project_id", projectId).eq("is_archived", false),
      supabase.rpc("recalc_running_bill", { _project_id: projectId }),
      supabase.from("project_grns").select("basic_amount_excl_gst").eq("project_id", projectId),
      supabase.from("purchase_orders").select("amount,status").eq("project_id", projectId).eq("is_archived", false),
    ]);

    // Labour cost from daily_measurements joined with line items × rates is non-trivial here.
    // We approximate via measurement_line_items.value_today_snapshot — labour-specific cost is stored in
    // labour_team_assignments if present; fall back to 0 when not available.
    let labourCost = 0;
    try {
      const { data: lab } = await (supabase as any)
        .from("labour_team_assignments")
        .select("daily_cost")
        .eq("project_id", projectId);
      labourCost = (lab ?? []).reduce((s: number, r: any) => s + (Number(r.daily_cost) || 0), 0);
    } catch {
      labourCost = 0;
    }

    setVariations(varRes.data ?? []);
    setMilestones(msRes.data ?? []);
    setBoq(boqRes.data ?? []);
    setRunning((rbRes.data as any[]) ?? []);
    setGrns(grnRes.data ?? []);
    setPos(poRes.data ?? []);
    setLabour({ cost: labourCost });
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const m = useMemo(() => {
    const approvedVar = variations
      .filter((v) => String(v.status).toLowerCase() === "approved")
      .reduce((s, v) => s + (Number(v.final_cost) || 0), 0);
    const pendingVars = variations.filter((v) => String(v.status).toLowerCase() === "pending");

    const revisedContract = (Number(contractValue) || 0) + approvedVar;
    const valueEarned = running.reduce((s, r: any) => s + (Number(r.value_earned) || 0), 0);
    const pctComplete = revisedContract > 0 ? (valueEarned / revisedContract) * 100 : 0;

    const invoiced = milestones
      .filter((x) => ["invoiced", "billed", "received"].includes(String(x.status).toLowerCase()))
      .reduce((s, x) => s + (Number(x.amount_incl_gst ?? x.amount_excl_gst) || 0), 0);
    const received = milestones
      .filter((x) => String(x.status).toLowerCase() === "received")
      .reduce((s, x) => s + (Number(x.amount_incl_gst ?? x.amount_excl_gst) || 0), 0);
    const outstanding = invoiced - received;

    const materialCost = grns.reduce((s, g) => s + (Number(g.basic_amount_excl_gst) || 0), 0);
    const labourCost = labour.cost;
    // PROVISIONAL: 5% overhead is a placeholder pending Finance sign-off.
    // Note: finance/ProjectPLTab.tsx uses 10% for the same figure — the two components disagree.
    const overhead = (materialCost + labourCost) * 0.05;
    const totalCost = materialCost + labourCost + overhead;

    const budgetedCost = boq.reduce((s, b: any) => s + (Number(b.boq_qty) || 0) * (Number(b.boq_rate) || 0), 0);
    const costVariance = budgetedCost - totalCost;
    const costVariancePct = budgetedCost > 0 ? (costVariance / budgetedCost) * 100 : 0;

    const grossProfit = valueEarned - totalCost;
    const grossMarginPct = valueEarned > 0 ? (grossProfit / valueEarned) * 100 : 0;
    const projectedMarginPct = revisedContract > 0 ? ((revisedContract - budgetedCost) / revisedContract) * 100 : 0;

    const cashIn = received;
    const cashOutPO = pos
      .filter((p) => String(p.status).toLowerCase() === "paid")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const cashOut = cashOutPO + labourCost;
    const netCash = cashIn - cashOut;

    const today = new Date(); today.setHours(0,0,0,0);
    const nextMs = milestones
      .filter((x) => String(x.status).toLowerCase() === "pending")
      .map((x) => ({ ...x, due: x.billed_date ?? x.received_date ?? null }))
      .filter((x) => x.due && new Date(x.due) >= today)
      .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime())[0] ?? null;

    return {
      approvedVar, revisedContract, valueEarned, pctComplete, invoiced, received, outstanding,
      materialCost, labourCost, overhead, totalCost, budgetedCost, costVariance, costVariancePct,
      grossProfit, grossMarginPct, projectedMarginPct, cashIn, cashOut, netCash, nextMs, pendingVars,
    };
  }, [variations, milestones, boq, running, grns, pos, labour, contractValue]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (boq.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Upload Project Setup to see P&amp;L.
      </CardContent></Card>
    );
  }

  const marginTone: Tone = m.grossMarginPct > 20 ? "green" : m.grossMarginPct >= 10 ? "amber" : "red";
  const varianceTone: Tone =
    m.costVariance >= 0 ? "green" : m.costVariancePct >= -5 ? "amber" : "red";
  const cashTone: Tone = m.netCash >= 0 ? "green" : "red";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Revised Contract Value" value={fmtINR(m.revisedContract)} tone="green" />
        <Tile label="Value Earned %" value={fmtPct(m.pctComplete)} tone="neutral" />
        <Tile label="Gross Margin %" value={fmtPct(m.grossMarginPct)} tone={marginTone} />
        <Tile label="Net Cash Position" value={fmtINR(m.netCash)} tone={cashTone} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Row label="Contract Value" value={fmtINR(Number(contractValue) || 0)} />
            <Row label="Approved Variations" value={fmtINR(m.approvedVar)} />
            <Row label="Revised Contract Value" value={fmtINR(m.revisedContract)} strong />
            <Row label="Value Earned to Date" value={running.length === 0 ? "No measurements recorded yet." : fmtINR(m.valueEarned)} />
            <Row label="% Complete" value={fmtPct(m.pctComplete)} />
            <Row label="Amount Invoiced" value={fmtINR(m.invoiced)} />
            <Row label="Amount Received" value={fmtINR(m.received)} />
            <Row label="Outstanding Receivable" value={fmtINR(m.outstanding)} tone={m.outstanding > 0 ? "amber" : "neutral"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Costs</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Row label="Material Cost (Actual)" value={grns.length === 0 ? "No GRN data recorded yet." : fmtINR(m.materialCost)} />
            <Row label="Labour Cost (Actual)" value={fmtINR(m.labourCost)} />
            <Row label="Overhead (5%)" value={fmtINR(m.overhead)} />
            <Row label="Total Cost to Date" value={fmtINR(m.totalCost)} strong />
            <Row label="Budgeted Cost (BOQ)" value={fmtINR(m.budgetedCost)} />
            <Row label="Cost Variance" value={`${fmtINR(m.costVariance)} (${fmtPct(m.costVariancePct)})`} tone={varianceTone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Margin &amp; Cash Flow</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Row label="Gross Profit to Date" value={fmtINR(m.grossProfit)} tone={m.grossProfit >= 0 ? "green" : "red"} />
            <Row label="Gross Margin %" value={fmtPct(m.grossMarginPct)} tone={marginTone} strong />
            <Row label="Projected Final Margin" value={fmtPct(m.projectedMarginPct)} />
            <div className="mt-3 pt-3 border-t" />
            <Row label="Cash In (Received)" value={fmtINR(m.cashIn)} tone="green" />
            <Row label="Cash Out (Paid)" value={fmtINR(m.cashOut)} tone="red" />
            <Row label="Net Cash Position" value={fmtINR(m.netCash)} tone={cashTone} strong />
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Next Milestone Due</div>
              {m.nextMs ? (
                <div className="text-sm">
                  <div className="font-medium">{m.nextMs.description}</div>
                  <div className="text-muted-foreground text-xs">
                    {fmtDate(m.nextMs.due)} · {fmtINR(Number(m.nextMs.amount_incl_gst ?? m.nextMs.amount_excl_gst) || 0)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No upcoming pending milestones.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pending Variations</CardTitle>
        </CardHeader>
        <CardContent>
          {m.pendingVars.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending variations.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-3">V.No</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Submitted</th>
                    <th className="py-2 pr-3 text-right">Days Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {m.pendingVars.map((v: any) => {
                    const days = v.date_raised ? differenceInDays(new Date(), new Date(v.date_raised)) : 0;
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{v.variation_number}</td>
                        <td className="py-2 pr-3">{v.description}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtINR(Number(v.final_cost) || 0)}</td>
                        <td className="py-2 pr-3">{fmtDate(v.date_raised)}</td>
                        <td className="py-2 pr-3 text-right">
                          <Badge variant={days > 14 ? "destructive" : "secondary"}>{days}d</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground italic">
            Pending variations not included in revenue or margin calculations above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
