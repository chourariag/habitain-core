import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Check, Clock, Lock, Download, FileText, Shield,
  Building2, Calendar, Loader2, AlertTriangle
} from "lucide-react";

const STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch",
];

function stageIndex(s: string | null) {
  if (!s) return -1;
  return STAGES.findIndex((st) => st === s);
}

export default function ClientPortal() {
  const { projectToken } = useParams<{ projectToken: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [gfcRecords, setGfcRecords] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [handover, setHandover] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!projectToken) return;
    setLoading(true);

    // Validate token
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("client_portal_token", projectToken)
      .eq("client_portal_enabled", true)
      .maybeSingle();

    if (projErr || !proj) {
      setError("This link is invalid or has expired.");
      setLoading(false);
      return;
    }

    // Check expiry
    if (proj.client_portal_expires_at && new Date(proj.client_portal_expires_at) < new Date()) {
      setError("This link has expired. Please contact your project manager for a new link.");
      setLoading(false);
      return;
    }

    setProject(proj);

    // Log access
    supabase.from("client_portal_access_log").insert({
      project_id: proj.id,
      token_used: projectToken,
      action: "page_view",
    }).then(() => {});

    // Fetch modules, GFC records, drawings, handover
    const [modRes, gfcRes, drawRes, handRes] = await Promise.all([
      supabase.from("modules").select("id, module_code, current_stage, production_status, created_at")
        .eq("project_id", proj.id).eq("is_archived", false).order("created_at"),
      supabase.from("gfc_records").select("*").eq("project_id", proj.id).order("created_at"),
      supabase.from("drawings").select("id, drawing_id_code, drawing_title, drawing_type, approval_status, approved_at, file_url")
        .eq("project_id", proj.id).eq("is_archived", false)
        .in("approval_status", ["approved", "pending"]).order("created_at"),
      supabase.from("handover_pack").select("*").eq("project_id", proj.id).maybeSingle(),
    ]);

    setModules(modRes.data ?? []);
    setGfcRecords(gfcRes.data ?? []);
    setDrawings(drawRes.data ?? []);
    setHandover(handRes.data ?? null);
    setLoading(false);
  }, [projectToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="font-heading text-xl font-bold text-foreground">{error}</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate overall progress
  const totalStages = modules.length * STAGES.length;
  const completedStages = modules.reduce((sum, m) => {
    const idx = stageIndex(m.current_stage);
    return sum + (idx >= 0 ? idx : 0);
  }, 0);
  const overallPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const h1 = gfcRecords.find((g) => g.gfc_stage === "H1");
  const h2 = gfcRecords.find((g) => g.gfc_stage === "H2");

  const clientDrawings = drawings.filter(
    (d) => d.drawing_type === "client" || d.approval_status === "approved" || d.approval_status === "pending"
  );

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-foreground leading-tight">
              {project.name}
            </h1>
            <p className="text-sm font-body text-muted-foreground">
              {project.client_name ?? "Client Portal"}
            </p>
          </div>
          {project.division && (
            <Badge variant="outline" className="ml-auto text-xs">
              {project.division}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Project Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold">Project Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm font-body">
              <div>
                <span className="text-muted-foreground">Start Date</span>
                <p className="font-medium text-foreground">
                  {fmtDate(project.start_date) ?? "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Expected Handover</span>
                <p className="font-medium text-foreground">
                  {fmtDate(project.expected_handover_date) ?? "—"}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-body text-muted-foreground">Overall Progress</span>
                <span className="text-sm font-heading font-bold text-primary">{overallPct}%</span>
              </div>
              <Progress value={overallPct} className="h-3" />
            </div>

            {project.client_portal_status_message && (
              <div className="rounded-lg bg-accent p-3">
                <p className="text-sm font-body text-accent-foreground">
                  {project.client_portal_status_message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Production Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold">Production Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.length === 0 ? (
              <p className="text-sm font-body text-muted-foreground">
                Production stages will appear here once modules are created.
              </p>
            ) : (
              modules.map((mod) => {
                const currentIdx = stageIndex(mod.current_stage);
                return (
                  <div key={mod.id} className="space-y-2">
                    <p className="text-sm font-heading font-semibold text-foreground">
                      {mod.module_code}
                    </p>
                    {/* Horizontal stepper */}
                    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
                      {STAGES.map((stage, idx) => {
                        const isComplete = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        return (
                          <div key={stage} className="flex flex-col items-center min-w-[72px]">
                            <div
                              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isComplete
                                  ? "bg-primary text-primary-foreground"
                                  : isCurrent
                                  ? "bg-warning text-warning-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isComplete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                            </div>
                            <span
                              className={`text-[10px] font-body mt-1 text-center leading-tight ${
                                isComplete
                                  ? "text-primary font-medium"
                                  : isCurrent
                                  ? "text-warning font-medium"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {stage}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <Separator />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Design Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold">Design Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <GFCMilestone label="H1 — Advance GFC" record={h1} />
              <GFCMilestone label="H2 — Final GFC" record={h2} />
            </div>

            {clientDrawings.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground mb-2">
                    Client Sign-Off Drawings
                  </p>
                  <div className="space-y-2">
                    {clientDrawings.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          {d.approval_status === "approved" ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Clock className="h-4 w-4 text-warning" />
                          )}
                          <span className="text-sm font-body text-foreground">
                            {d.drawing_title || d.drawing_id_code}
                          </span>
                        </div>
                        {d.approval_status === "pending" ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Coming soon
                          </Badge>
                        ) : d.approved_at ? (
                          <span className="text-xs font-body text-muted-foreground">
                            {fmtDate(d.approved_at)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-bold">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <DocumentCard
                title="GFC Certificate — H1"
                available={!!h1?.issued_at}
                url={h1?.pdf_url}
                pendingText="Will be available after Advance GFC issuance."
              />
              <DocumentCard
                title="GFC Certificate — H2"
                available={!!h2?.issued_at}
                url={h2?.pdf_url}
                pendingText="Will be available after Final GFC issuance."
              />
              <DocumentCard
                title="QC Certificate"
                available={false}
                url={null}
                pendingText="Will be available after QC certification."
              />
              <DocumentCard
                title="Handover Pack"
                available={!!handover}
                url={null}
                pendingText="Will be available after project handover."
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs font-body text-muted-foreground">
            Powered by Habitainer · This portal is read-only
          </p>
        </div>
      </main>
    </div>
  );
}

function GFCMilestone({ label, record }: { label: string; record: any }) {
  const issued = record?.issued_at;
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-xs font-heading font-semibold text-foreground">{label}</p>
      {issued ? (
        <div className="flex items-center gap-1.5">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm font-body text-primary font-medium">
            Issued {format(new Date(issued), "dd/MM/yyyy")}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-warning" />
          <span className="text-sm font-body text-muted-foreground">Pending</span>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  title, available, url, pendingText,
}: {
  title: string;
  available: boolean;
  url: string | null;
  pendingText: string;
}) {
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${available ? "" : "opacity-60"}`}>
      {available ? (
        <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      ) : (
        <Lock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground">{title}</p>
        {available ? (
          url ? (
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Download className="h-3 w-3 mr-1" /> Download
              </a>
            </Button>
          ) : (
            <span className="text-xs font-body text-primary">Available</span>
          )
        ) : (
          <p className="text-xs font-body text-muted-foreground mt-1">{pendingText}</p>
        )}
      </div>
    </div>
  );
}
