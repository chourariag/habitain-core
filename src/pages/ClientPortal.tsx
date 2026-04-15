import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Check, Clock, Lock, Download, FileText,
  Building2, Loader2, AlertTriangle, MessageSquare,
  ThumbsUp, ThumbsDown, HelpCircle, PenLine, IndianRupee
} from "lucide-react";
import { MilestoneTimeline } from "@/components/portal/MilestoneTimeline";
import { ConstructionJournal } from "@/components/portal/ConstructionJournal";
import { VariationApproval } from "@/components/portal/VariationApproval";
import { ClientPaymentsInvoices } from "@/components/portal/ClientPaymentsInvoices";
import { ClientDocuments } from "@/components/portal/ClientDocuments";
import { ClientPostHandover } from "@/components/portal/ClientPostHandover";

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
  const [variationOrders, setVariationOrders] = useState<any[]>([]);
  const [billingMilestones, setBillingMilestones] = useState<any[]>([]);
  const [milestonePhotos, setMilestonePhotos] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [portalDocuments, setPortalDocuments] = useState<any[]>([]);
  const [amcContract, setAmcContract] = useState<any>(null);

  // Action states
  const [queryDrawingId, setQueryDrawingId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [voResponseId, setVoResponseId] = useState<string | null>(null);
  const [voResponseNote, setVoResponseNote] = useState("");
  const [handoverSignName, setHandoverSignName] = useState("");
  const [showHandoverConfirm, setShowHandoverConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectToken) return;
    setLoading(true);

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

    if (proj.client_portal_expires_at && new Date(proj.client_portal_expires_at) < new Date()) {
      setError("This link has expired. Please contact your project manager for a new link.");
      setLoading(false);
      return;
    }

    setProject(proj);

    supabase.from("client_portal_access_log").insert({
      project_id: proj.id,
      token_used: projectToken,
      action: "page_view",
    }).then(() => {});

    const [modRes, gfcRes, drawRes, handRes, voRes, msRes, mpRes, cjRes, docRes, amcRes] = await Promise.all([
      supabase.from("modules").select("id, module_code, current_stage, production_status, created_at")
        .eq("project_id", proj.id).eq("is_archived", false).order("created_at"),
      supabase.from("gfc_records").select("*").eq("project_id", proj.id).order("created_at"),
      supabase.from("drawings").select("id, drawing_id_code, drawing_title, drawing_type, approval_status, approved_at, file_url, created_at, client_approved_at, client_approved_name, client_query_text")
        .eq("project_id", proj.id).eq("is_archived", false)
        .in("approval_status", ["approved", "pending"]).order("created_at"),
      supabase.from("handover_pack").select("*").eq("project_id", proj.id).maybeSingle(),
      supabase.from("variation_orders" as any).select("*").eq("project_id", proj.id).order("created_at"),
      supabase.from("project_billing_milestones").select("*").eq("project_id", proj.id).order("milestone_number"),
      supabase.from("client_milestone_photos" as any).select("*").eq("project_id", proj.id).order("created_at"),
      supabase.from("construction_journal" as any).select("*").eq("project_id", proj.id).eq("is_approved", true).order("entry_date", { ascending: false }).limit(20),
      supabase.from("client_portal_documents").select("*").eq("project_id", proj.id).order("uploaded_at", { ascending: false }),
      supabase.from("amc_contracts").select("*").eq("project_id", proj.id).eq("is_archived", false).maybeSingle(),
    ]);

    setModules(modRes.data ?? []);
    setGfcRecords(gfcRes.data ?? []);
    setDrawings(drawRes.data ?? []);
    setHandover(handRes.data ?? null);
    setVariationOrders((voRes.data as any[]) ?? []);
    setBillingMilestones((msRes.data as any[]) ?? []);
    setMilestonePhotos((mpRes.data as any[]) ?? []);
    setJournalEntries((cjRes.data as any[]) ?? []);
    setPortalDocuments(docRes.data ?? []);
    setAmcContract(amcRes.data ?? null);
    setLoading(false);
  }, [projectToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Actions ---

  const handleApproveDrawing = async (drawingId: string) => {
    setSubmittingAction(drawingId);
    const clientName = project?.client_name || "Client";
    const { error } = await supabase.from("drawings").update({
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      client_approved_at: new Date().toISOString(),
      client_approved_name: clientName,
    } as any).eq("id", drawingId);

    if (error) { toast.error("Failed to approve drawing"); }
    else { toast.success("Drawing approved"); await fetchData(); }
    setSubmittingAction(null);
  };

  const handleSubmitDrawingQuery = async (drawingId: string) => {
    if (queryText.trim().length < 5) { toast.error("Please enter your question"); return; }
    setSubmittingAction(drawingId);

    const drawing = drawings.find((d) => d.id === drawingId);
    const dqCode = `DQ-CLIENT-${Date.now()}`;

    await Promise.all([
      supabase.from("drawings").update({ client_query_text: queryText } as any).eq("id", drawingId),
      supabase.from("design_queries").insert({
        dq_code: dqCode,
        project_id: project.id,
        drawing_id: drawingId,
        description: queryText,
        query_type: "client_query",
        raised_by: "client",
        raised_by_name: project.client_name || "Client",
        status: "open",
        urgency: "medium",
      }),
    ]);

    toast.success("Your query has been sent to the design team. You will receive a response within 24 hours.");
    setQueryDrawingId(null);
    setQueryText("");
    await fetchData();
    setSubmittingAction(null);
  };

  const handleVOAction = async (voId: string, action: "approved" | "discussion_requested" | "rejected") => {
    setSubmittingAction(voId);
    const updateData: any = {
      status: action,
      client_approved_at: action === "approved" ? new Date().toISOString() : null,
      client_response_note: voResponseNote || null,
    };

    await (supabase.from("variation_orders" as any) as any).update(updateData).eq("id", voId);

    const labels = { approved: "Variation approved", discussion_requested: "Discussion requested", rejected: "Variation rejected" };
    toast.success(labels[action]);
    setVoResponseId(null);
    setVoResponseNote("");
    await fetchData();
    setSubmittingAction(null);
  };

  const handleSignHandover = async () => {
    if (handoverSignName.trim().length < 2) { toast.error("Please type your name to sign"); return; }
    setSubmittingAction("handover");

    const now = new Date();
    await supabase.from("handover_pack").update({
      client_signed_at: now.toISOString(),
      client_signed_name: handoverSignName.trim(),
      dlp_start_date: now.toISOString().split("T")[0],
    } as any).eq("id", handover.id);

    // Update project status
    await supabase.from("projects").update({
      status: "handed_over",
    } as any).eq("id", project.id);

    // Start AMC timer if contract exists
    if (amcContract && amcContract.status !== "active") {
      await supabase.from("amc_contracts").update({
        status: "active",
        start_date: now.toISOString().split("T")[0],
      }).eq("id", amcContract.id);
    }

    // Log action
    supabase.from("client_portal_access_log").insert({
      project_id: project.id,
      token_used: projectToken!,
      action: "handover_signed",
    }).then(() => {});

    toast.success("Handover certificate signed. Thank you!");
    setShowHandoverConfirm(false);
    setHandoverSignName("");
    await fetchData();
    setSubmittingAction(null);
  };

  // --- Render ---

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

  const totalStages = modules.length * STAGES.length;
  const completedStages = modules.reduce((sum, m) => sum + Math.max(0, stageIndex(m.current_stage)), 0);
  const overallPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const h1 = gfcRecords.find((g) => g.gfc_stage === "H1");
  const h2 = gfcRecords.find((g) => g.gfc_stage === "H2");
  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : null;

  const pendingDrawings = drawings.filter((d) => d.approval_status === "pending" && !d.client_approved_at);
  const approvedDrawings = drawings.filter((d) => d.approval_status === "approved" || d.client_approved_at);
  const pendingVOs = variationOrders.filter((v: any) => v.status === "pending");
  const handoverReady = handover && !(handover as any).client_signed_at;
  const handoverSigned = handover && (handover as any).client_signed_at;
  const isHandedOver = handoverSigned || project.status === "handed_over";

  const totalActions = pendingDrawings.length + pendingVOs.length + (handoverReady ? 1 : 0);

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
            <Badge variant="outline" className="ml-auto text-xs">{project.division}</Badge>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Action Required Banner */}
        {totalActions > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="font-heading font-bold text-destructive text-sm">
                Action Required: {totalActions} item{totalActions > 1 ? "s" : ""} awaiting your response
              </p>
            </div>
            <ul className="mt-2 space-y-1 text-sm font-body text-foreground ml-7">
              {pendingDrawings.length > 0 && (
                <li>{pendingDrawings.length} drawing{pendingDrawings.length > 1 ? "s" : ""} awaiting approval</li>
              )}
              {pendingVOs.length > 0 && (
                <li>{pendingVOs.length} variation order{pendingVOs.length > 1 ? "s" : ""} pending</li>
              )}
              {handoverReady && <li>Handover certificate ready for sign-off</li>}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {isHandedOver && <TabsTrigger value="post-handover">Post-Handover</TabsTrigger>}
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Milestone Photo Timeline */}
            {milestonePhotos.length > 0 && (
              <MilestoneTimeline photos={milestonePhotos} projectStartDate={project.start_date} />
            )}

            {/* Construction Journal */}
            <ConstructionJournal entries={journalEntries} />

            {/* Variation Approval (Phase C) */}
            <VariationApproval
              variations={variationOrders}
              projectId={project.id}
              projectName={project.name}
              clientName={project.client_name || "Client"}
              portalToken={projectToken!}
              onRefresh={fetchData}
            />

            {/* Drawing Approvals */}
            {pendingDrawings.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-destructive" /> Drawings Awaiting Approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingDrawings.map((d) => (
                    <div key={d.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-heading font-semibold text-foreground">
                            {d.drawing_title || d.drawing_id_code}
                          </p>
                          <p className="text-xs font-body text-muted-foreground mt-0.5">
                            Uploaded {fmtDate(d.created_at)}
                          </p>
                        </div>
                        {d.file_url && (
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" asChild>
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3 mr-1" /> View
                            </a>
                          </Button>
                        )}
                      </div>

                      {queryDrawingId === d.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="What is your question about this drawing?"
                            value={queryText}
                            onChange={(e) => setQueryText(e.target.value)}
                            className="text-sm h-20"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSubmitDrawingQuery(d.id)}
                              disabled={submittingAction === d.id}>
                              <MessageSquare className="h-3 w-3 mr-1" /> Submit Query
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setQueryDrawingId(null); setQueryText(""); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-primary" onClick={() => handleApproveDrawing(d.id)}
                            disabled={submittingAction === d.id}>
                            <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setQueryDrawingId(d.id)}>
                            <HelpCircle className="h-3 w-3 mr-1" /> Raise a Query
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Variation Orders */}
            {pendingVOs.length > 0 && (
              <Card className="border-warning/30">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-warning" /> Variation Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingVOs.map((vo: any) => (
                    <div key={vo.id} className="rounded-lg border p-4 space-y-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-heading font-bold text-foreground">{vo.vo_code}</p>
                          <Badge variant="outline" className="text-xs">Pending</Badge>
                        </div>
                        <p className="text-sm font-body text-foreground mt-1">{vo.description}</p>
                        <p className="text-base font-heading font-bold text-foreground mt-2">
                          ₹{Number(vo.value).toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs font-body text-muted-foreground mt-1">
                          This is additional work outside your original scope. Your approval is required.
                        </p>
                      </div>

                      {voResponseId === vo.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Add a note (optional)"
                            value={voResponseNote}
                            onChange={(e) => setVoResponseNote(e.target.value)}
                            className="text-sm h-16"
                          />
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" className="bg-primary" onClick={() => handleVOAction(vo.id, "approved")}
                              disabled={submittingAction === vo.id}>
                              <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleVOAction(vo.id, "discussion_requested")}
                              disabled={submittingAction === vo.id}>
                              <MessageSquare className="h-3 w-3 mr-1" /> Request Discussion
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleVOAction(vo.id, "rejected")}
                              disabled={submittingAction === vo.id}>
                              <ThumbsDown className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setVoResponseId(vo.id)}>
                          Respond
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Handover Sign-Off */}
            {handoverReady && (
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-primary" /> Handover Certificate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm font-body">
                    <p className="text-foreground"><strong>Project:</strong> {project.name}</p>
                    <p className="text-foreground"><strong>Modules delivered:</strong> {modules.length}</p>
                    {handover.snag_list && (
                      <p className="text-foreground"><strong>Punch list:</strong> All items closed</p>
                    )}
                  </div>

                  {showHandoverConfirm ? (
                    <div className="rounded-lg bg-accent p-4 space-y-3">
                      <p className="text-sm font-body text-accent-foreground">
                        By signing, you confirm that <strong>{project.name}</strong> has been
                        handed over to your satisfaction on {format(new Date(), "dd/MM/yyyy")}.
                      </p>
                      <div>
                        <label className="text-xs font-body text-muted-foreground block mb-1">
                          Type your full name to sign
                        </label>
                        <Input
                          value={handoverSignName}
                          onChange={(e) => setHandoverSignName(e.target.value)}
                          placeholder="Your full name"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-primary" onClick={handleSignHandover}
                          disabled={submittingAction === "handover" || handoverSignName.trim().length < 2}>
                          <PenLine className="h-3 w-3 mr-1" /> Confirm &amp; Sign
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowHandoverConfirm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setShowHandoverConfirm(true)}>
                      <PenLine className="h-4 w-4 mr-1" /> Sign Handover Certificate
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {handoverSigned && (
              <Card className="border-primary/30 bg-accent/30">
                <CardContent className="pt-6 text-center space-y-2">
                  <Check className="h-8 w-8 text-primary mx-auto" />
                  <p className="font-heading font-bold text-foreground">Handover Complete</p>
                  <p className="text-sm font-body text-muted-foreground">
                    Signed by {(handover as any).client_signed_name} on {fmtDate((handover as any).client_signed_at)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Project Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">Project Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm font-body">
                  <div>
                    <span className="text-muted-foreground">Start Date</span>
                    <p className="font-medium text-foreground">{fmtDate(project.start_date) ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expected Handover</span>
                    <p className="font-medium text-foreground">{fmtDate(project.expected_handover_date) ?? "—"}</p>
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
                    <p className="text-sm font-body text-accent-foreground">{project.client_portal_status_message}</p>
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
                        <p className="text-sm font-heading font-semibold text-foreground">{mod.module_code}</p>
                        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
                          {STAGES.map((stage, idx) => {
                            const isComplete = idx < currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                              <div key={stage} className="flex flex-col items-center min-w-[72px]">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isComplete ? "bg-primary text-primary-foreground"
                                    : isCurrent ? "bg-warning text-warning-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {isComplete ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                                </div>
                                <span className={`text-[10px] font-body mt-1 text-center leading-tight ${
                                  isComplete ? "text-primary font-medium"
                                    : isCurrent ? "text-warning font-medium"
                                    : "text-muted-foreground"
                                }`}>{stage}</span>
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

                {approvedDrawings.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-heading font-semibold text-foreground mb-2">
                        Approved Drawings
                      </p>
                      <div className="space-y-2">
                        {approvedDrawings.map((d) => (
                          <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-primary" />
                              <span className="text-sm font-body text-foreground">
                                {d.drawing_title || d.drawing_id_code}
                              </span>
                            </div>
                            <span className="text-xs font-body text-muted-foreground">
                              {fmtDate(d.client_approved_at || d.approved_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Variation Orders History */}
            {variationOrders.filter((v: any) => v.status !== "pending").length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-bold">Variation Orders</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {variationOrders.filter((v: any) => v.status !== "pending").map((vo: any) => (
                    <div key={vo.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <span className="text-sm font-heading font-semibold text-foreground">{vo.vo_code}</span>
                        <span className="text-sm font-body text-muted-foreground ml-2">
                          ₹{Number(vo.value).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <Badge variant={vo.status === "approved" ? "default" : "outline"}
                        className={vo.status === "approved" ? "bg-primary text-primary-foreground" : vo.status === "rejected" ? "text-destructive" : ""}>
                        {vo.status === "approved" ? "Approved" : vo.status === "rejected" ? "Rejected" : "Discussion"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PAYMENTS TAB */}
          <TabsContent value="payments" className="mt-4">
            <ClientPaymentsInvoices
              milestones={billingMilestones}
              projectName={project.name}
            />
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="mt-4">
            <ClientDocuments
              documents={portalDocuments}
              gfcRecords={gfcRecords}
              handover={handover}
            />
          </TabsContent>

          {/* POST-HANDOVER TAB */}
          {isHandedOver && (
            <TabsContent value="post-handover" className="mt-4">
              <ClientPostHandover
                projectId={project.id}
                projectName={project.name}
                clientName={project.client_name || "Client"}
                handover={handover}
                amcContract={amcContract}
              />
            </TabsContent>
          )}
        </Tabs>

        <div className="text-center py-6">
          <p className="text-xs font-body text-muted-foreground">
            Powered by Habitainer
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
