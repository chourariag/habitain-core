import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ClipboardCheck, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { QCInspectionWizard } from "@/components/qc/QCInspectionWizard";

export default function QualityControl() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "inspections";
  const [inspections, setInspections] = useState<any[]>([]);
  const [ncrs, setNCRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedNCR, setSelectedNCR] = useState<any | null>(null);
  const [ncrInspectionItems, setNcrInspectionItems] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [inspRes, ncrRes, roleRes, profilesRes] = await Promise.all([
      supabase
        .from("qc_inspections")
        .select("*, modules(name, module_code, project_id, projects(name))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ncr_register")
        .select("*, qc_inspections(id, stage_name, ai_response, module_id, modules(name, module_code, panel_id))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null;
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return data;
      }),
      supabase.from("profiles").select("auth_user_id, display_name"),
    ]);
    setInspections(inspRes.data ?? []);
    setNCRs(ncrRes.data ?? []);
    setUserRole(roleRes as string | null);
    const pMap: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p: any) => { pMap[p.auth_user_id] = p.display_name || "Unknown"; });
    setProfilesMap(pMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // When an NCR is selected, fetch its inspection items for AI analysis data
  useEffect(() => {
    if (!selectedNCR?.inspection_id) {
      setNcrInspectionItems([]);
      return;
    }
    const inspectionId = selectedNCR.inspection_id || selectedNCR.qc_inspections?.id;
    if (!inspectionId) { setNcrInspectionItems([]); return; }

    supabase
      .from("qc_inspection_items")
      .select("*, qc_checklist_items(description, stage_name, is_critical)")
      .eq("inspection_id", inspectionId)
      .then(({ data }) => {
        setNcrInspectionItems(data ?? []);
      });
  }, [selectedNCR]);

  const canInspect = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");
  const canCloseNCR = ["production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");

  const handleCloseNCR = async (ncrId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("ncr_register").update({ status: "closed", closed_by: user.id, closed_at: new Date().toISOString() }).eq("id", ncrId);
    if (!error) { setSelectedNCR(null); fetchData(); }
  };

  const openNCRs = ncrs.filter((n) => n.status !== "closed");
  const closedNCRs = ncrs.filter((n) => n.status === "closed");

  const sortedOpenNCRs = [...openNCRs].sort((a, b) => {
    if (a.status === "critical_open" && b.status !== "critical_open") return -1;
    if (a.status !== "critical_open" && b.status === "critical_open") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const decisionBadgeClass = (decision: string | null) => {
    if (decision === "PASS STAGE") return "bg-primary text-primary-foreground";
    if (decision === "REWORK REQUIRED") return "bg-destructive text-destructive-foreground";
    return "bg-warning text-warning-foreground";
  };

  const severityBadge = (status: string) => {
    if (status === "critical_open") return { label: "Critical", class: "bg-destructive text-destructive-foreground" };
    return { label: "Open", class: "bg-warning text-warning-foreground" };
  };

  const getNCRModule = (ncr: any) => ncr.qc_inspections?.modules;
  const getNCRStage = (ncr: any) => ncr.qc_inspections?.stage_name || "—";
  const getAIResponse = (ncr: any) => {
    const ai = ncr.qc_inspections?.ai_response;
    if (!ai) return null;
    if (typeof ai === "string") try { return JSON.parse(ai); } catch { return null; }
    return ai;
  };

  const renderNCRCard = (ncr: any, isClosed: boolean) => {
    const mod = getNCRModule(ncr);
    const sev = isClosed ? { label: "Closed", class: "bg-muted text-muted-foreground" } : severityBadge(ncr.status);
    return (
      <Card
        key={ncr.id}
        className={`cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all ${isClosed ? "opacity-80" : ""}`}
        onClick={() => setSelectedNCR(ncr)}
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-card-foreground">{ncr.ncr_number}</p>
              <p className="text-xs text-card-foreground/70 mt-0.5">
                {mod?.module_code || mod?.name || "Module"} · {getNCRStage(ncr)}
                {mod?.panel_id ? ` · Panel: ${mod.panel_id}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Raised: {ncr.created_at ? format(new Date(ncr.created_at), "dd MMM yyyy") : "—"}
                {isClosed && ncr.closed_at ? ` · Closed: ${format(new Date(ncr.closed_at), "dd MMM yyyy")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={sev.class}>{sev.label}</Badge>
              {!isClosed && canCloseNCR && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCloseNCR(ncr.id); }}>Close NCR</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Get failed inspection items (the ones that generated this NCR)
  const getFailedItems = () => {
    return ncrInspectionItems.filter((item: any) => item.result === "fail" || item.ai_severity);
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
            const sev = isClosed ? { label: "Closed", class: "bg-muted text-muted-foreground" } : severityBadge(selectedNCR.status);
            const failedItems = getFailedItems();
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground text-xs">NCR Number</p><p className="font-mono font-semibold text-card-foreground">{selectedNCR.ncr_number}</p></div>
                  <div><p className="text-muted-foreground text-xs">Severity</p><Badge className={sev.class}>{sev.label}</Badge></div>
                  <div><p className="text-muted-foreground text-xs">Module</p><p className="text-card-foreground">{mod?.module_code || mod?.name || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Panel</p><p className="text-card-foreground">{mod?.panel_id || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Production Stage</p><p className="text-card-foreground">{getNCRStage(selectedNCR)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Date Raised</p><p className="text-card-foreground">{selectedNCR.created_at ? format(new Date(selectedNCR.created_at), "dd MMM yyyy HH:mm") : "—"}</p></div>
                  {isClosed && (
                    <>
                      <div><p className="text-muted-foreground text-xs">Closed Date</p><p className="text-card-foreground">{selectedNCR.closed_at ? format(new Date(selectedNCR.closed_at), "dd MMM yyyy") : "—"}</p></div>
                      <div><p className="text-muted-foreground text-xs">Closed By</p><p className="text-card-foreground">{(selectedNCR.closed_by && profilesMap[selectedNCR.closed_by]) || "—"}</p></div>
                    </>
                  )}
                </div>

                {/* AI Analysis from inspection-level ai_response */}
                {ai && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">AI Analysis (Inspection)</h4>
                    {!Array.isArray(ai) && ai.root_cause && (
                      <div><p className="text-muted-foreground text-xs">Root Cause</p><p className="text-card-foreground">{ai.root_cause}</p></div>
                    )}
                    {!Array.isArray(ai) && ai.immediate_action && (
                      <div><p className="text-muted-foreground text-xs">Immediate Action</p><p className="text-card-foreground">{ai.immediate_action}</p></div>
                    )}
                    {!Array.isArray(ai) && ai.corrective_action && (
                      <div><p className="text-muted-foreground text-xs">Corrective Action</p><p className="text-card-foreground">{ai.corrective_action}</p></div>
                    )}
                    {!Array.isArray(ai) && ai.severity && (
                      <div><p className="text-muted-foreground text-xs">AI Severity</p><p className="text-card-foreground font-medium">{ai.severity}</p></div>
                    )}
                    {Array.isArray(ai) && ai.map((item: any, idx: number) => (
                      <div key={idx} className="border rounded-md p-3 space-y-2">
                        {item.severity && <Badge className={item.severity === "Critical" ? "bg-destructive text-destructive-foreground" : item.severity === "Major" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}>{item.severity}</Badge>}
                        {item.checklist_item && <div><p className="text-muted-foreground text-xs">Checklist Item</p><p className="text-card-foreground">{item.checklist_item}</p></div>}
                        {item.root_cause && <div><p className="text-muted-foreground text-xs">Root Cause</p><p className="text-card-foreground">{item.root_cause}</p></div>}
                        {item.immediate_action && <div><p className="text-muted-foreground text-xs">Immediate Action</p><p className="text-card-foreground">{item.immediate_action}</p></div>}
                        {item.corrective_action && <div><p className="text-muted-foreground text-xs">Corrective Action</p><p className="text-card-foreground">{item.corrective_action}</p></div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-item AI analysis from qc_inspection_items */}
                {failedItems.length > 0 && (
                  <div className="border-t pt-3 space-y-3">
                    <h4 className="font-semibold text-card-foreground">Failed Checklist Items</h4>
                    {failedItems.map((item: any) => (
                      <div key={item.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-card-foreground font-medium text-xs">
                            {item.qc_checklist_items?.description || "Checklist Item"}
                          </p>
                          {item.ai_severity && (
                            <Badge className={
                              item.ai_severity === "Critical" ? "bg-destructive text-destructive-foreground" :
                              item.ai_severity === "Major" ? "bg-warning text-warning-foreground" :
                              "bg-muted text-muted-foreground"
                            }>{item.ai_severity}</Badge>
                          )}
                        </div>
                        {item.notes && (
                          <div><p className="text-muted-foreground text-xs">Notes</p><p className="text-card-foreground">{item.notes}</p></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!ai && failedItems.length === 0 && (
                  <div className="border-t pt-3">
                    <p className="text-muted-foreground text-xs">No AI analysis data available for this NCR.</p>
                  </div>
                )}

                {!isClosed && canCloseNCR && (
                  <div className="border-t pt-3">
                    <Button onClick={() => handleCloseNCR(selectedNCR.id)}>Close NCR</Button>
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
