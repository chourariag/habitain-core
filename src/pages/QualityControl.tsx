import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { insertNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ClipboardCheck, AlertTriangle, Loader2, Camera, RotateCcw, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { QCInspectionWizard } from "@/components/qc/QCInspectionWizard";
import { PRODUCTION_STAGES } from "@/components/projects/ProductionStageTracker";
import { ReworkSummaryTab } from "@/components/qc/ReworkSummaryTab";

const FIX_TIMELINE_OPTIONS = [
  { value: "same_day", label: "Same day" },
  { value: "within_2_days", label: "Within 2 days", days: 2 },
  { value: "within_this_week", label: "Within this week", days: 7 },
  { value: "requires_materials", label: "Requires materials (link to material request)" },
  { value: "requires_specialist", label: "Requires specialist (add note)" },
];

export default function QualityControl() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "inspections";
  const [inspections, setInspections] = useState<any[]>([]);
  const [ncrs, setNCRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedNCR, setSelectedNCR] = useState<any | null>(null);
  const [ncrInspectionItems, setNcrInspectionItems] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  // NCR action state
  const [fixTimeline, setFixTimeline] = useState("");
  const [fixTimelineNote, setFixTimelineNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Regression state
  const [regressionToggle, setRegressionToggle] = useState(false);
  const [regressionToStage, setRegressionToStage] = useState("");
  const [regressionReason, setRegressionReason] = useState("");

  // Re-inspection state
  const [reinspChecks, setReinspChecks] = useState([false, false, false]);
  const [reinspNotes, setReinspNotes] = useState("");
  const [reinspPhoto, setReinspPhoto] = useState<File | null>(null);
  const [reinspPhotoPreview, setReinspPhotoPreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [inspRes, ncrRes, roleRes, profilesRes] = await Promise.all([
      supabase
        .from("qc_inspections")
        .select("*, modules(name, module_code, project_id, projects(name))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase.from("ncr_register") as any)
        .select("*, qc_inspections(id, stage_name, ai_response, module_id, modules(name, module_code, panel_id))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return { role: null, id: null };
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return { role: data, id: user.id };
      }),
      supabase.from("profiles").select("auth_user_id, display_name"),
    ]);
    setInspections(inspRes.data ?? []);
    setNCRs(ncrRes.data ?? []);
    setUserRole((roleRes as any)?.role as string | null);
    setUserId((roleRes as any)?.id as string | null);
    const pMap: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p: any) => { pMap[p.auth_user_id] = p.display_name || "Unknown"; });
    setProfilesMap(pMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedNCR?.inspection_id) { setNcrInspectionItems([]); return; }
    const inspectionId = selectedNCR.inspection_id || selectedNCR.qc_inspections?.id;
    if (!inspectionId) { setNcrInspectionItems([]); return; }
    supabase
      .from("qc_inspection_items")
      .select("*, qc_checklist_items(description, stage_name, is_critical)")
      .eq("inspection_id", inspectionId)
      .then(({ data }) => setNcrInspectionItems(data ?? []));
  }, [selectedNCR]);

  // Reset action state when NCR changes
  useEffect(() => {
    setFixTimeline(selectedNCR?.fix_timeline || "");
    setFixTimelineNote("");
    setRegressionToggle(selectedNCR?.requires_regression || false);
    setRegressionToStage("");
    setRegressionReason("");
    setReinspChecks([false, false, false]);
    setReinspNotes("");
    setReinspPhoto(null);
    setReinspPhotoPreview(null);
  }, [selectedNCR?.id]);

  const canInspect = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");
  const isQCInspector = userRole === "qc_inspector";
  const isSupervisor = userRole === "factory_supervisor";

  // NCR Actions
  const handleAcknowledgeNCR = async (ncrId: string) => {
    if (!fixTimeline) { toast.error("Please select a fix timeline"); return; }
    setActionLoading(true);
    try {
      const { client } = await getAuthedClient();
      let dueDate: string | null = null;
      const opt = FIX_TIMELINE_OPTIONS.find(o => o.value === fixTimeline);
      if (opt && 'days' in opt && opt.days) {
        const d = new Date();
        d.setDate(d.getDate() + opt.days);
        dueDate = d.toISOString();
      } else if (fixTimeline === "same_day") {
        const d = new Date();
        d.setHours(23, 59, 59);
        dueDate = d.toISOString();
      }

      const updatePayload: any = {
        status: "fix_in_progress",
        fix_timeline: fixTimeline,
        fix_timeline_set_by: userId,
        fix_timeline_set_at: new Date().toISOString(),
        fix_timeline_due_date: dueDate,
      };

      // Handle stage regression
      if (regressionToggle && regressionToStage && regressionReason.trim()) {
        const currentStageIdx = PRODUCTION_STAGES.indexOf(getNCRStage(selectedNCR) as any);
        const toIdx = parseInt(regressionToStage);
        updatePayload.requires_regression = true;
        updatePayload.regression_from_stage = currentStageIdx >= 0 ? currentStageIdx : null;
        updatePayload.regression_to_stage = toIdx;
        updatePayload.regression_reason = regressionReason.trim();
        updatePayload.regression_start_date = new Date().toISOString().split("T")[0];

        // Regress the module stage
        const moduleId = selectedNCR.qc_inspections?.module_id;
        if (moduleId && toIdx >= 0 && toIdx < PRODUCTION_STAGES.length) {
          await (client.from("modules") as any).update({
            current_stage: PRODUCTION_STAGES[toIdx],
            production_status: "hold",
          }).eq("id", moduleId);
        }

        // Notify planning engineer about schedule conflict
        const { data: planners } = await supabase.from("profiles")
          .select("auth_user_id")
          .eq("role", "planning_engineer" as any)
          .eq("is_active", true);
        for (const p of planners ?? []) {
          await insertNotifications({
            recipient_id: p.auth_user_id,
            title: "Stage Regression — Schedule Impact",
            body: `${selectedNCR?.ncr_number}: Module regressed from ${PRODUCTION_STAGES[currentStageIdx] || "?"} to ${PRODUCTION_STAGES[toIdx]}. Update production schedule.`,
            category: "production",
            related_table: "ncr_register",
            related_id: ncrId,
          });
        }
      }

      await (client.from("ncr_register") as any).update(updatePayload).eq("id", ncrId);

      // Notify QC inspector + production head
      const { data: notifyProfiles } = await supabase.from("profiles")
        .select("auth_user_id")
        .in("role", ["qc_inspector", "production_head"] as any[])
        .eq("is_active", true);
      for (const p of notifyProfiles ?? []) {
        await insertNotifications({
          recipient_id: p.auth_user_id,
          title: "NCR Acknowledged",
          body: `${selectedNCR?.ncr_number} acknowledged by ${profilesMap[userId!] || "Supervisor"}. Fix timeline: ${opt?.label || fixTimeline}.`,
          category: "production",
          related_table: "ncr_register",
          related_id: ncrId,
        });
      }

      toast.success("NCR acknowledged — fix in progress");
      setSelectedNCR(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge NCR");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkFixed = async (ncrId: string) => {
    setActionLoading(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("ncr_register") as any).update({
        status: "awaiting_reinspection",
      }).eq("id", ncrId);

      // Notify QC inspector
      const { data: qcProfiles } = await supabase.from("profiles")
        .select("auth_user_id")
        .eq("role", "qc_inspector" as any)
        .eq("is_active", true);
      for (const p of qcProfiles ?? []) {
        await insertNotifications({
          recipient_id: p.auth_user_id,
          title: "NCR Fixed — Re-inspection Required",
          body: `${selectedNCR?.ncr_number} has been fixed by ${profilesMap[userId!] || "Supervisor"}. Please re-inspect and confirm closure.`,
          category: "production",
          related_table: "ncr_register",
          related_id: ncrId,
        });
      }

      toast.success("NCR marked as fixed — awaiting re-inspection");
      setSelectedNCR(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReinspection = async (ncrId: string, passed: boolean) => {
    if (passed && !reinspPhoto) { toast.error("Please upload a photo of the rectified area"); return; }
    if (passed && !reinspChecks.every(Boolean)) { toast.error("Please complete all re-inspection checks"); return; }
    setActionLoading(true);
    try {
      const { client } = await getAuthedClient();
      let photoUrl: string | null = null;
      if (reinspPhoto) {
        const path = `reinspection/${Date.now()}-${ncrId}.jpg`;
        await supabase.storage.from("qc-photos").upload(path, reinspPhoto);
        const { data: urlData } = supabase.storage.from("qc-photos").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      if (passed) {
        await (client.from("ncr_register") as any).update({
          status: "closed",
          closed_by: userId,
          closed_at: new Date().toISOString(),
          reinspection_photo_url: photoUrl,
          reinspection_notes: reinspNotes || null,
          reinspection_completed_by: userId,
          reinspection_completed_at: new Date().toISOString(),
          reinspection_failed: false,
        }).eq("id", ncrId);

        // Notify production head
        const { data: prodHeads } = await supabase.from("profiles")
          .select("auth_user_id")
          .eq("role", "production_head" as any)
          .eq("is_active", true);
        for (const p of prodHeads ?? []) {
          await insertNotifications({
            recipient_id: p.auth_user_id,
            title: "NCR Closed",
            body: `${selectedNCR?.ncr_number} closed by ${profilesMap[userId!] || "QC Inspector"} after successful re-inspection.`,
            category: "production",
            related_table: "ncr_register",
            related_id: ncrId,
          });
        }
        toast.success("NCR closed after re-inspection");
      } else {
        // Failed re-inspection — send back
        await (client.from("ncr_register") as any).update({
          status: "fix_in_progress",
          reinspection_notes: reinspNotes || null,
          reinspection_photo_url: photoUrl,
          reinspection_failed: true,
        }).eq("id", ncrId);

        // Notify supervisor
        if (selectedNCR?.assigned_to) {
          await insertNotifications({
            recipient_id: selectedNCR.assigned_to,
            title: "Re-inspection Failed",
            body: `${selectedNCR?.ncr_number} re-inspection failed. ${reinspNotes || "Please re-fix."}`,
            category: "production",
            related_table: "ncr_register",
            related_id: ncrId,
          });
        }
        toast.warning("NCR sent back for re-fix");
      }

      setSelectedNCR(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openNCRs = ncrs.filter((n) => n.status !== "closed");
  const closedNCRs = ncrs.filter((n) => n.status === "closed");

  const sortedOpenNCRs = [...openNCRs].sort((a, b) => {
    if (a.status === "critical_open" && b.status !== "critical_open") return -1;
    if (a.status !== "critical_open" && b.status === "critical_open") return 1;
    if (a.status === "awaiting_reinspection") return -1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const decisionBadgeClass = (decision: string | null) => {
    if (decision === "PASS STAGE") return "bg-primary text-primary-foreground";
    if (decision === "REWORK REQUIRED") return "bg-destructive text-destructive-foreground";
    return "bg-warning text-warning-foreground";
  };

  const ncrStatusBadge = (status: string) => {
    switch (status) {
      case "critical_open": return { label: "Critical", className: "bg-destructive text-destructive-foreground" };
      case "open": return { label: "Open", className: "bg-warning text-warning-foreground" };
      case "fix_in_progress": return { label: "Fix In Progress", className: "bg-amber-100 text-amber-800" };
      case "awaiting_reinspection": return { label: "Awaiting Re-inspection", className: "bg-blue-100 text-blue-800" };
      case "closed": return { label: "Closed", className: "bg-muted text-muted-foreground" };
      default: return { label: status, className: "bg-muted text-muted-foreground" };
    }
  };

  const getNCRModule = (ncr: any) => ncr.qc_inspections?.modules;
  const getNCRStage = (ncr: any) => ncr.qc_inspections?.stage_name || "—";
  const getAIResponse = (ncr: any) => {
    const ai = ncr.qc_inspections?.ai_response;
    if (!ai) return null;
    if (typeof ai === "string") try { return JSON.parse(ai); } catch { return null; }
    return ai;
  };

  const getFailedItems = () => ncrInspectionItems.filter((item: any) => item.result === "fail" || item.ai_severity);

  const renderNCRCard = (ncr: any, isClosed: boolean) => {
    const mod = getNCRModule(ncr);
    const sev = ncrStatusBadge(ncr.status);
    const isAwaitingReinspection = ncr.status === "awaiting_reinspection";
    return (
      <Card
        key={ncr.id}
        className={`cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${isClosed ? "opacity-80" : ""} ${isAwaitingReinspection && isQCInspector ? "ring-1 ring-amber-400" : ""}`}
        onClick={() => setSelectedNCR(ncr)}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-card-foreground">{ncr.ncr_number}</p>
              <p className="text-xs text-card-foreground/70 mt-0.5">
                {mod?.module_code || mod?.name || "Module"} · {getNCRStage(ncr)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Raised: {ncr.created_at ? format(new Date(ncr.created_at), "dd MMM yyyy") : "—"}
                {ncr.assigned_to && ` · Assigned: ${profilesMap[ncr.assigned_to] || "—"}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={sev.className}>{sev.label}</Badge>
              {isAwaitingReinspection && isQCInspector && (
                <Badge className="bg-amber-500 text-white animate-pulse">Re-inspect</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Quality Control</h1>
          <p className="text-muted-foreground text-sm mt-1">QC inspections & NCR register</p>
        </div>
        {canInspect && (
          <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Inspection</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <ScrollableTabsWrapper>
            <TabsList>
              <TabsTrigger value="inspections" className="gap-1.5"><ClipboardCheck className="h-4 w-4" /> Inspections</TabsTrigger>
              <TabsTrigger value="ncrs" className="gap-1.5">
                <AlertTriangle className="h-4 w-4" /> NCRs
                {openNCRs.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{openNCRs.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </ScrollableTabsWrapper>

          <TabsContent value="inspections" className="space-y-3 mt-4">
            {inspections.length === 0 ? (
              <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground text-sm">No inspections yet.</p></CardContent></Card>
            ) : (
              inspections.map((insp) => (
                <Card key={insp.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm text-card-foreground">
                          {(insp.modules as any)?.module_code || (insp.modules as any)?.name || "Module"} — {insp.stage_name}
                          {(insp as any).stage_type && (
                            <span className="text-muted-foreground font-normal"> · {(insp as any).stage_type === "shell_and_core" ? "Shell & Core" : (insp as any).stage_type === "builder_finish" ? "Builder Finish" : "Interiors"}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(insp.modules as any)?.projects?.name || "Project"} · {insp.submitted_at ? format(new Date(insp.submitted_at), "dd MMM yyyy HH:mm") : "Draft"}
                        </p>
                      </div>
                      <Badge className={decisionBadgeClass(insp.dispatch_decision)}>
                        {insp.dispatch_decision || insp.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="ncrs" className="space-y-3 mt-4">
            {sortedOpenNCRs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Open NCRs ({sortedOpenNCRs.length})</h3>
                {sortedOpenNCRs.map((ncr) => renderNCRCard(ncr, false))}
              </div>
            )}
            {closedNCRs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Closed NCRs ({closedNCRs.length})</h3>
                {closedNCRs.map((ncr) => renderNCRCard(ncr, true))}
              </div>
            )}
            {ncrs.length === 0 && (
              <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground text-sm">No NCRs recorded yet.</p></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* NCR Detail Modal */}
      <Dialog open={!!selectedNCR} onOpenChange={(o) => { if (!o) setSelectedNCR(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>NCR Detail</DialogTitle></DialogHeader>
          {selectedNCR && (() => {
            const mod = getNCRModule(selectedNCR);
            const ai = getAIResponse(selectedNCR);
            const isClosed = selectedNCR.status === "closed";
            const sev = ncrStatusBadge(selectedNCR.status);
            const failedItems = getFailedItems();
            const isOpen = selectedNCR.status === "open" || selectedNCR.status === "critical_open";
            const isFixInProgress = selectedNCR.status === "fix_in_progress";
            const isAwaitingReinsp = selectedNCR.status === "awaiting_reinspection";
            const isAssignedToMe = selectedNCR.assigned_to === userId;

            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground text-xs">NCR Number</p><p className="font-mono font-semibold text-card-foreground">{selectedNCR.ncr_number}</p></div>
                  <div><p className="text-muted-foreground text-xs">Status</p><Badge className={sev.className}>{sev.label}</Badge></div>
                  <div><p className="text-muted-foreground text-xs">Module</p><p className="text-card-foreground">{mod?.module_code || mod?.name || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Assigned To</p><p className="text-card-foreground">{selectedNCR.assigned_to ? (profilesMap[selectedNCR.assigned_to] || "—") : "Unassigned"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Production Stage</p><p className="text-card-foreground">{getNCRStage(selectedNCR)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Date Raised</p><p className="text-card-foreground">{selectedNCR.created_at ? format(new Date(selectedNCR.created_at), "dd MMM yyyy HH:mm") : "—"}</p></div>
                  {selectedNCR.fix_timeline && (
                    <div><p className="text-muted-foreground text-xs">Fix Timeline</p><p className="text-card-foreground">{FIX_TIMELINE_OPTIONS.find(o => o.value === selectedNCR.fix_timeline)?.label || selectedNCR.fix_timeline}</p></div>
                  )}
                  {isClosed && (
                    <>
                      <div><p className="text-muted-foreground text-xs">Closed Date</p><p className="text-card-foreground">{selectedNCR.closed_at ? format(new Date(selectedNCR.closed_at), "dd MMM yyyy") : "—"}</p></div>
                      <div><p className="text-muted-foreground text-xs">Closed By</p><p className="text-card-foreground">{(selectedNCR.closed_by && profilesMap[selectedNCR.closed_by]) || "—"}</p></div>
                    </>
                  )}
                </div>

                {/* Re-inspection result if closed */}
                {isClosed && selectedNCR.reinspection_photo_url && (
                  <div className="border-t pt-3 space-y-2">
                    <h4 className="font-semibold text-card-foreground">Re-inspection Evidence</h4>
                    <img src={selectedNCR.reinspection_photo_url} alt="Re-inspection" className="rounded-lg max-h-40 object-cover" />
                    {selectedNCR.reinspection_notes && <p className="text-xs text-muted-foreground">{selectedNCR.reinspection_notes}</p>}
                  </div>
                )}

                {/* AI Analysis */}
                {ai && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">AI Analysis</h4>
                    {!Array.isArray(ai) && ai.root_cause && <div><p className="text-muted-foreground text-xs">Root Cause</p><p className="text-card-foreground">{ai.root_cause}</p></div>}
                    {!Array.isArray(ai) && ai.immediate_action && <div><p className="text-muted-foreground text-xs">Immediate Action</p><p className="text-card-foreground">{ai.immediate_action}</p></div>}
                    {!Array.isArray(ai) && ai.corrective_action && <div><p className="text-muted-foreground text-xs">Corrective Action</p><p className="text-card-foreground">{ai.corrective_action}</p></div>}
                    {Array.isArray(ai) && ai.map((item: any, idx: number) => (
                      <div key={idx} className="border rounded-md p-3 space-y-2">
                        {item.severity && <Badge className={item.severity === "Critical" ? "bg-destructive text-destructive-foreground" : item.severity === "Major" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}>{item.severity}</Badge>}
                        {item.root_cause && <div><p className="text-muted-foreground text-xs">Root Cause</p><p className="text-card-foreground">{item.root_cause}</p></div>}
                        {item.immediate_action && <div><p className="text-muted-foreground text-xs">Immediate Action</p><p className="text-card-foreground">{item.immediate_action}</p></div>}
                        {item.corrective_action && <div><p className="text-muted-foreground text-xs">Corrective Action</p><p className="text-card-foreground">{item.corrective_action}</p></div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Failed items */}
                {failedItems.length > 0 && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">Failed Checklist Items</h4>
                    {failedItems.map((item: any) => (
                      <div key={item.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-card-foreground font-medium text-xs">{item.qc_checklist_items?.description || "Checklist Item"}</p>
                          {item.ai_severity && <Badge className={item.ai_severity === "Critical" ? "bg-destructive text-destructive-foreground" : item.ai_severity === "Major" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}>{item.ai_severity}</Badge>}
                        </div>
                        {item.notes && <div><p className="text-muted-foreground text-xs">Notes</p><p className="text-card-foreground">{item.notes}</p></div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* ACTION: Supervisor acknowledges open NCR */}
                {isOpen && isSupervisor && isAssignedToMe && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">Acknowledge & Set Fix Timeline</h4>
                    <Select value={fixTimeline} onValueChange={setFixTimeline}>
                      <SelectTrigger><SelectValue placeholder="When can this be fixed?" /></SelectTrigger>
                      <SelectContent>
                        {FIX_TIMELINE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(fixTimeline === "requires_specialist" || fixTimeline === "requires_materials") && (
                      <Textarea
                        placeholder={fixTimeline === "requires_specialist" ? "Describe specialist needed..." : "List materials needed..."}
                        value={fixTimelineNote}
                        onChange={(e) => setFixTimelineNote(e.target.value)}
                        className="text-sm"
                      />
                    )}

                    {/* Regression toggle */}
                    <div className="border border-border rounded-md p-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={regressionToggle} onCheckedChange={(v) => setRegressionToggle(!!v)} />
                        <span className="font-medium">Does this fix require stage regression?</span>
                      </label>
                      {regressionToggle && (
                        <div className="space-y-2 ml-6">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Regressing from: <span className="font-medium text-foreground">{getNCRStage(selectedNCR)}</span></p>
                          </div>
                          <Select value={regressionToStage} onValueChange={setRegressionToStage}>
                            <SelectTrigger className="text-sm"><SelectValue placeholder="Regress to stage..." /></SelectTrigger>
                            <SelectContent>
                              {PRODUCTION_STAGES.map((s, idx) => {
                                const currentIdx = PRODUCTION_STAGES.indexOf(getNCRStage(selectedNCR) as any);
                                if (idx >= currentIdx) return null;
                                return <SelectItem key={s} value={String(idx)}>{s}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                          <Textarea
                            placeholder="Reason for regression (required)..."
                            value={regressionReason}
                            onChange={(e) => setRegressionReason(e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleAcknowledgeNCR(selectedNCR.id)}
                      disabled={!fixTimeline || actionLoading || (regressionToggle && (!regressionToStage || !regressionReason.trim()))}
                      className="w-full"
                      style={{ backgroundColor: "#006039" }}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {regressionToggle ? "Acknowledge — Regress & Start Fix" : "Acknowledge — Start Fix"}
                    </Button>
                  </div>
                )}

                {/* ACTION: Supervisor marks fix as done */}
                {isFixInProgress && isSupervisor && isAssignedToMe && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">Mark Fix Complete</h4>
                    {selectedNCR.reinspection_failed && (
                      <div className="rounded-lg p-2.5 flex items-center gap-2" style={{ backgroundColor: "#FDE8E8" }}>
                        <RotateCcw className="h-4 w-4 shrink-0" style={{ color: "#F40009" }} />
                        <div>
                          <p className="text-xs font-medium" style={{ color: "#F40009" }}>Previous re-inspection failed</p>
                          {selectedNCR.reinspection_notes && <p className="text-xs mt-0.5">{selectedNCR.reinspection_notes}</p>}
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={() => handleMarkFixed(selectedNCR.id)}
                      disabled={actionLoading}
                      className="w-full"
                      style={{ backgroundColor: "#006039" }}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Mark as Fixed — Send for Re-inspection
                    </Button>
                  </div>
                )}

                {/* ACTION: QC Inspector re-inspects */}
                {isAwaitingReinsp && isQCInspector && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">Re-inspection Checklist</h4>
                    {[
                      "Defect has been physically rectified",
                      "Area is clean and no secondary damage",
                      "Module is ready to proceed to next stage",
                    ].map((text, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <Checkbox
                          checked={reinspChecks[idx]}
                          onCheckedChange={(checked) => {
                            const next = [...reinspChecks];
                            next[idx] = !!checked;
                            setReinspChecks(next);
                          }}
                        />
                        <span className="text-sm">{text}</span>
                      </div>
                    ))}
                    <Textarea
                      placeholder="Re-inspection notes (optional)..."
                      value={reinspNotes}
                      onChange={(e) => setReinspNotes(e.target.value)}
                      className="text-sm"
                    />
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        <Camera className="h-3.5 w-3.5" />
                        {reinspPhoto ? "Change photo" : "Upload photo of rectified area *"}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setReinspPhoto(f);
                              setReinspPhotoPreview(URL.createObjectURL(f));
                            }
                          }}
                        />
                      </label>
                      {reinspPhotoPreview && (
                        <img src={reinspPhotoPreview} alt="Reinspection" className="mt-2 h-20 w-20 rounded object-cover border border-border" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleReinspection(selectedNCR.id, true)}
                        disabled={actionLoading || !reinspChecks.every(Boolean) || !reinspPhoto}
                        className="flex-1"
                        style={{ backgroundColor: "#006039" }}
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Close NCR — Pass
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReinspection(selectedNCR.id, false)}
                        disabled={actionLoading || !reinspNotes.trim()}
                        className="flex-1"
                        style={{ color: "#F40009", borderColor: "#F40009" }}
                      >
                        Send Back — Fail
                      </Button>
                    </div>
                  </div>
                )}

                {/* View-only for non-action users */}
                {!ai && failedItems.length === 0 && (
                  <div className="border-t pt-3">
                    <p className="text-muted-foreground text-xs">No AI analysis data available for this NCR.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <QCInspectionWizard open={wizardOpen} onOpenChange={setWizardOpen} onCompleted={fetchData} />
    </div>
  );
}
