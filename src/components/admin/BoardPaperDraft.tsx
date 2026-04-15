import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BoardPaperDraftProps {
  data: {
    sections: any;
    reportDate: string;
    periodType: string;
    id?: string;
  };
  onBack: () => void;
  onSaveDraft: (sections: any) => void;
}

const formatCurrency = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const SECTION_TITLES = [
  { key: "executive_summary", title: "1. Executive Summary" },
  { key: "project_portfolio", title: "2. Project Portfolio Overview" },
  { key: "revenue_collections", title: "3. Revenue & Collections" },
  { key: "cost_margin", title: "4. Cost & Margin Analysis" },
  { key: "operational_metrics", title: "5. Operational Metrics" },
  { key: "sales_pipeline", title: "6. Sales Pipeline" },
  { key: "cashflow", title: "7. Cashflow Position" },
  { key: "risks", title: "8. Key Risks and Actions" },
  { key: "upcoming_milestones", title: "9. Upcoming Milestones" },
];

export function BoardPaperDraft({ data, onBack, onSaveDraft }: BoardPaperDraftProps) {
  const [sections, setSections] = useState(data.sections);
  const [commentary, setCommentary] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const updateCommentary = (key: string, value: string) => {
    setCommentary((prev) => ({ ...prev, [key]: value }));
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-board-paper`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sections,
            commentary,
            reportDate: data.reportDate,
            periodType: data.periodType,
          }),
        }
      );
      if (!resp.ok) throw new Error("Failed to generate PDF");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Board_Paper_${data.reportDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Board paper PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onSaveDraft({ ...sections, commentary })}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="gap-1.5 bg-[hsl(var(--brand))] text-white hover:bg-[hsl(var(--brand))]/90"
          >
            <Download className="h-4 w-4" />
            {generatingPdf ? "Generating…" : "Generate PDF"}
          </Button>
        </div>
      </div>

      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-foreground">
          ALTREE — Habitainer Division
        </h2>
        <p className="text-muted-foreground text-sm">
          Board Paper · {sections.executive_summary?.period} · Prepared {sections.executive_summary?.date_prepared}
        </p>
      </div>

      {/* Section 1 — Executive Summary */}
      <SectionCard title={SECTION_TITLES[0].title}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <InfoRow label="Company" value={sections.executive_summary?.company} />
          <InfoRow label="Division" value={sections.executive_summary?.division} />
          <InfoRow label="Period" value={sections.executive_summary?.period} />
          <InfoRow label="Date Prepared" value={sections.executive_summary?.date_prepared} />
          <InfoRow label="Prepared by" value={sections.executive_summary?.prepared_by} />
        </div>
        <CommentaryBox value={commentary.executive_summary} onChange={(v) => updateCommentary("executive_summary", v)} />
      </SectionCard>

      {/* Section 2 — Project Portfolio */}
      <SectionCard title={SECTION_TITLES[1].title}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-left">
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Modules</th>
                <th className="px-3 py-2">Contract Value</th>
                <th className="px-3 py-2">% Complete</th>
                <th className="px-3 py-2">Margin %</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Handover</th>
              </tr>
            </thead>
            <tbody>
              {(sections.project_portfolio?.projects || []).map((p: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                  <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                  <td className="px-3 py-2 text-foreground">{p.module_count}</td>
                  <td className="px-3 py-2 text-foreground">{formatCurrency(p.contract_value)}</td>
                  <td className="px-3 py-2 text-foreground">{p.pct_complete}%</td>
                  <td className={`px-3 py-2 ${(p.margin_pct || 0) < 20 ? "text-destructive font-semibold" : "text-foreground"}`}>
                    {p.margin_pct || 0}%
                  </td>
                  <td className="px-3 py-2 text-foreground capitalize">{p.status}</td>
                  <td className="px-3 py-2 text-foreground">{p.handover_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <MiniStat label="Active" value={sections.project_portfolio?.summary?.total_active} />
          <MiniStat label="Total Value" value={formatCurrency(sections.project_portfolio?.summary?.total_contract_value)} />
          <MiniStat label="Avg Margin" value={`${sections.project_portfolio?.summary?.avg_margin}%`} />
          <MiniStat label="On Track" value={sections.project_portfolio?.summary?.on_track} />
          <MiniStat label="Delayed" value={sections.project_portfolio?.summary?.delayed} color="destructive" />
        </div>
        <CommentaryBox value={commentary.project_portfolio} onChange={(v) => updateCommentary("project_portfolio", v)} />
      </SectionCard>

      {/* Section 3 — Revenue & Collections */}
      <SectionCard title={SECTION_TITLES[2].title}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MiniStat label="Revenue (Invoiced)" value={formatCurrency(sections.revenue_collections?.total_revenue)} />
          <MiniStat label="Collections" value={formatCurrency(sections.revenue_collections?.total_collections)} />
          <MiniStat label="Outstanding" value={formatCurrency(sections.revenue_collections?.outstanding_receivables)} />
          <MiniStat label="Pipeline (90d)" value={formatCurrency(sections.revenue_collections?.revenue_pipeline_90d)} />
          <MiniStat
            label="vs Previous"
            value={sections.revenue_collections?.change_pct != null
              ? `${sections.revenue_collections.change_pct > 0 ? "↑" : "↓"} ${Math.abs(sections.revenue_collections.change_pct)}%`
              : "N/A"
            }
          />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Aged Receivables:</p>
          <div className="flex gap-4">
            <span>0–30 days: {formatCurrency(sections.revenue_collections?.aged_receivables?.["0_30"])}</span>
            <span>31–60 days: {formatCurrency(sections.revenue_collections?.aged_receivables?.["31_60"])}</span>
            <span>60+ days: {formatCurrency(sections.revenue_collections?.aged_receivables?.["60_plus"])}</span>
          </div>
        </div>
        <CommentaryBox value={commentary.revenue_collections} onChange={(v) => updateCommentary("revenue_collections", v)} />
      </SectionCard>

      {/* Section 4 — Cost & Margin */}
      <SectionCard title={SECTION_TITLES[3].title}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Total Costs" value={formatCurrency(sections.cost_margin?.total_costs)} />
          <MiniStat label="Blended Margin" value={`${sections.cost_margin?.blended_margin}%`} />
          <MiniStat label="Labour Cost" value={formatCurrency(sections.cost_margin?.labour_cost)} />
          <MiniStat label="Material Cost" value={formatCurrency(sections.cost_margin?.material_cost)} />
        </div>
        {sections.cost_margin?.flagged_projects?.length > 0 && (
          <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
            <p className="font-medium">⚠ Projects below 20% margin:</p>
            {sections.cost_margin.flagged_projects.map((p: any, i: number) => (
              <p key={i}>{p.name} — {p.margin_pct || 0}%</p>
            ))}
          </div>
        )}
        <CommentaryBox value={commentary.cost_margin} onChange={(v) => updateCommentary("cost_margin", v)} />
      </SectionCard>

      {/* Section 5 — Operations */}
      <SectionCard title={SECTION_TITLES[4].title}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MiniStat label="In Production" value={sections.operational_metrics?.modules_in_production} />
          <MiniStat label="Dispatched" value={sections.operational_metrics?.modules_dispatched} />
          <MiniStat label="Total Modules" value={sections.operational_metrics?.total_modules} />
          <MiniStat label="NCRs Raised" value={sections.operational_metrics?.ncr_raised} />
          <MiniStat label="NCRs Closed" value={sections.operational_metrics?.ncr_closed} />
          <MiniStat label="NCRs Pending" value={sections.operational_metrics?.ncr_pending} color={sections.operational_metrics?.ncr_pending > 0 ? "destructive" : undefined} />
        </div>
        <CommentaryBox value={commentary.operational_metrics} onChange={(v) => updateCommentary("operational_metrics", v)} />
      </SectionCard>

      {/* Section 6 — Sales */}
      <SectionCard title={SECTION_TITLES[5].title}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="New Leads" value={sections.sales_pipeline?.new_leads} />
          <MiniStat label="Won" value={`${sections.sales_pipeline?.deals_won} (${formatCurrency(sections.sales_pipeline?.deals_won_value)})`} />
          <MiniStat label="Lost" value={`${sections.sales_pipeline?.deals_lost} (${formatCurrency(sections.sales_pipeline?.deals_lost_value)})`} />
          <MiniStat label="Win Rate" value={`${sections.sales_pipeline?.win_rate}%`} />
          <MiniStat label="Pipeline Value" value={formatCurrency(sections.sales_pipeline?.pipeline_value)} />
          <MiniStat label="Active Deals" value={sections.sales_pipeline?.active_deals} />
        </div>
        <CommentaryBox value={commentary.sales_pipeline} onChange={(v) => updateCommentary("sales_pipeline", v)} />
      </SectionCard>

      {/* Section 7 — Cashflow */}
      <SectionCard title={SECTION_TITLES[6].title}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Bank Balance" value={formatCurrency(sections.cashflow?.bank_balance)} />
          <MiniStat label="Payables" value={formatCurrency(sections.cashflow?.payables)} />
          <MiniStat label="Receivables" value={formatCurrency(sections.cashflow?.receivables)} />
          <MiniStat label="Net Cash" value={formatCurrency(sections.cashflow?.net_cash)} color={sections.cashflow?.net_cash < 0 ? "destructive" : undefined} />
        </div>
        <CommentaryBox value={commentary.cashflow} onChange={(v) => updateCommentary("cashflow", v)} />
      </SectionCard>

      {/* Section 8 — Risks */}
      <SectionCard title={SECTION_TITLES[7].title}>
        {sections.risks?.alerts?.length > 0 ? (
          <div className="space-y-2">
            {sections.risks.alerts.map((a: any, i: number) => (
              <div key={i} className="p-2 bg-destructive/5 rounded text-sm border border-destructive/20">
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No critical risks active.</p>
        )}
        <CommentaryBox value={commentary.risks} onChange={(v) => updateCommentary("risks", v)} placeholder="Add action notes for each risk…" />
      </SectionCard>

      {/* Section 9 — Upcoming */}
      <SectionCard title={SECTION_TITLES[8].title}>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Planned Dispatches</p>
            {sections.upcoming_milestones?.dispatches?.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {sections.upcoming_milestones.dispatches.map((d: any, i: number) => (
                  <li key={i}>• {d.project_name} — {d.date} ({d.status})</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Billing Milestones Due</p>
            {sections.upcoming_milestones?.billing?.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {sections.upcoming_milestones.billing.map((b: any, i: number) => (
                  <li key={i}>• {b.project_name} — {b.milestone} — {formatCurrency(b.amount)}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Statutory Filings Due</p>
            {sections.upcoming_milestones?.statutory?.length > 0 ? (
              <ul className="text-sm text-muted-foreground space-y-1">
                {sections.upcoming_milestones.statutory.map((s: any, i: number) => (
                  <li key={i}>• {s.filing_name} — Due: {s.due_date}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None</p>}
          </div>
        </div>
        <CommentaryBox value={commentary.upcoming_milestones} onChange={(v) => updateCommentary("upcoming_milestones", v)} />
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[hsl(var(--brand))]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground font-medium">{value || "—"}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value?: string | number; color?: string }) {
  return (
    <div className="bg-muted/40 rounded-md p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${color === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function CommentaryBox({
  value,
  onChange,
  placeholder = "Add commentary…",
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-2 bg-background border-border text-foreground text-sm min-h-[60px]"
    />
  );
}
