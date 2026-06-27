import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StorageManagementSection } from "@/components/StorageManagementSection";

type AnyRow = Record<string, any>;

interface ArchiveData {
  project: AnyRow | null;
  archive: AnyRow | null;
  designStages: AnyRow[];
  qcInspections: AnyRow[];
  ncrs: AnyRow[];
  designQueries: AnyRow[];
  siteDiary: AnyRow[];
  punchList: AnyRow[];
  variations: AnyRow[];
  boq: AnyRow[];
  billingMilestones: AnyRow[];
  invoices: AnyRow[];
}

const inr = (n: any) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));
const dt = (s: any) => (s ? format(new Date(s), "dd/MM/yyyy") : "—");

export default function ProjectArchive() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<ArchiveData | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const sb = supabase as any;
    const [project, archive, designStages, qcInspections, ncrs, designQueries, siteDiary, punchList, variations, boq, billingMilestones, invoices] =
      await Promise.all([
        sb.from("projects").select("*").eq("id", id).maybeSingle(),
        sb.from("project_archives").select("*").eq("project_id", id).maybeSingle(),
        sb.from("design_stages").select("*").eq("project_id", id).order("stage_number"),
        sb.from("qc_inspections").select("*").eq("project_id", id).order("created_at"),
        sb.from("ncr_register").select("*").eq("project_id", id).order("created_at"),
        sb.from("design_queries").select("*").eq("project_id", id).order("created_at"),
        sb.from("site_diary").select("*").eq("project_id", id).order("created_at"),
        sb.from("punch_list_items").select("*").eq("project_id", id).order("created_at"),
        sb.from("variation_register").select("*").eq("project_id", id).order("created_at"),
        sb.from("project_boq_items").select("*").eq("project_id", id),
        sb.from("project_billing_milestones").select("*").eq("project_id", id).order("created_at"),
        sb.from("project_invoices").select("*").eq("project_id", id).order("created_at"),
      ]);
    setData({
      project: project.data,
      archive: archive.data,
      designStages: designStages.data || [],
      qcInspections: qcInspections.data || [],
      ncrs: ncrs.data || [],
      designQueries: designQueries.data || [],
      siteDiary: siteDiary.data || [],
      punchList: punchList.data || [],
      variations: variations.data || [],
      boq: boq.data || [],
      billingMilestones: billingMilestones.data || [],
      invoices: invoices.data || [],
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const generateZip = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("generate-project-archive", {
        body: { project_id: id },
      });
      if (error) throw error;
      toast.success("Archive ZIP generated");
      if (res?.signed_url) window.open(res.signed_url, "_blank");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate ZIP");
    } finally {
      setGenerating(false);
    }
  };

  const downloadExisting = async () => {
    if (!data?.archive?.zip_download_url) return;
    const path = data.archive.zip_download_url;
    const { data: signed } = await supabase.storage.from("project-archives").createSignedUrl(path, 60 * 60);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading archive…</div>;
  if (!data?.project) return <div className="p-8">Project not found.</div>;

  const p = data.project;
  const billed = data.invoices.reduce((s, i) => s + Number(i.amount || i.total_amount || 0), 0);
  const received = data.invoices.reduce((s, i) => s + Number(i.amount_received || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to={`/projects/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>
        <div className="flex items-center gap-2">
          {data.archive?.zip_download_url ? (
            <Button onClick={downloadExisting} variant="outline">
              <Download className="h-4 w-4 mr-2" /> Download ZIP
            </Button>
          ) : null}
          <Button onClick={generateZip} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileArchive className="h-4 w-4 mr-2" />}
            {data.archive?.zip_download_url ? "Regenerate ZIP" : "Generate ZIP"}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{p.name} — Project Archive</h1>
        <p className="text-sm text-muted-foreground">
          Permanent cloud report. Status: <Badge variant="outline">{p.status}</Badge>
          {data.archive?.archive_generated_at && <> · Generated {dt(data.archive.archive_generated_at)}</>}
          {data.archive?.storage_cleanup_eligible && <> · <Badge>Uploaded to Zoho</Badge></>}
        </p>
      </div>

      <Section title="1. Project Summary">
        <KV k="Client" v={p.client_name} />
        <KV k="Project Code" v={p.project_code} />
        <KV k="Contract Value" v={inr(p.contract_value)} />
        <KV k="Start Date" v={dt(p.start_date)} />
        <KV k="Closed At" v={dt(p.closed_at)} />
        <KV k="Site Address" v={p.site_address} />
      </Section>

      <Section title="2. Financial Summary">
        <KV k="Contract Value" v={inr(p.contract_value)} />
        <KV k="Total Billed" v={inr(billed)} />
        <KV k="Total Received" v={inr(received)} />
        <KV k="Outstanding" v={inr(billed - received)} />
      </Section>

      <Section title={`3. Design Stage History (${data.designStages.length})`}>
        <Table cols={["#", "Stage", "Status", "Planned", "Actual"]} rows={data.designStages.map(s => [
          s.stage_number, s.stage_name, s.status, dt(s.planned_finish_date), dt(s.actual_finish_date)
        ])} />
      </Section>

      <Section title={`4. QC Inspection Reports (${data.qcInspections.length})`}>
        <Table cols={["Date", "Type", "Status", "Notes"]} rows={data.qcInspections.map(q => [
          dt(q.created_at), q.inspection_type, q.status, q.notes || "—"
        ])} />
      </Section>

      <Section title={`5. NCR Register (${data.ncrs.length})`}>
        <Table cols={["NCR #", "Issue", "Status", "Closed At"]} rows={data.ncrs.map(n => [
          n.ncr_number || n.id?.slice(0,8), n.description || n.issue, n.status, dt(n.closed_at)
        ])} />
      </Section>

      <Section title={`6. Design Query Log (${data.designQueries.length})`}>
        <Table cols={["Raised", "Query", "Status", "Resolved"]} rows={data.designQueries.map(d => [
          dt(d.created_at), d.query_text || d.title, d.status, dt(d.resolved_at)
        ])} />
      </Section>

      <Section title={`7. Site Diary Timeline (${data.siteDiary.length} entries)`}>
        <Table cols={["Date", "Zone", "Notes"]} rows={data.siteDiary.slice(0, 50).map(s => [
          dt(s.entry_date || s.created_at), s.zone || "—", (s.notes || s.summary || "").slice(0, 120)
        ])} />
      </Section>

      <Section title={`8. Snagging / Punch List (${data.punchList.length})`}>
        <Table cols={["Item", "Status", "Closed"]} rows={data.punchList.map(s => [
          s.description, s.status, dt(s.closed_at)
        ])} />
      </Section>

      <Section title={`9. Variation Register (${data.variations.length})`}>
        <Table cols={["#", "Description", "Status", "Valuation"]} rows={data.variations.map(v => [
          v.sequence_no, v.description, v.status, inr(v.valuation)
        ])} />
      </Section>

      <Section title={`10. Final BOQ vs Actuals (${data.boq.length} items)`}>
        <Table cols={["Item", "Planned Qty", "Actual Qty", "Planned Cost", "Actual Cost"]} rows={data.boq.map(b => [
          b.description || b.item_name, b.planned_quantity ?? b.quantity, b.actual_quantity, inr(b.planned_cost), inr(b.actual_cost)
        ])} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between border-b py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v ?? "—"}</span>
    </div>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: any[][] }) {
  if (!rows.length) return <div className="col-span-2 text-sm text-muted-foreground">No records.</div>;
  return (
    <div className="col-span-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b">{cols.map(c => <th key={c} className="text-left py-2 px-2 font-medium">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((cell, j) => <td key={j} className="py-2 px-2 align-top">{cell ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
