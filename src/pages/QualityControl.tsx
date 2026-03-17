import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ClipboardCheck, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { QCInspectionWizard } from "@/components/qc/QCInspectionWizard";

export default function QualityControl() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [ncrs, setNCRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [inspRes, ncrRes, roleRes] = await Promise.all([
      supabase
        .from("qc_inspections")
        .select("*, modules(name, module_code, project_id, projects(name))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ncr_register")
        .select("*, qc_inspections(stage_name, modules(name, module_code))")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null;
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return data;
      }),
    ]);
    setInspections(inspRes.data ?? []);
    setNCRs(ncrRes.data ?? []);
    setUserRole(roleRes as string | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const canInspect = [
    "qc_inspector", "production_head", "head_operations", "super_admin", "managing_director",
  ].includes(userRole ?? "");

  const canCloseNCR = [
    "production_head", "head_operations", "super_admin", "managing_director",
  ].includes(userRole ?? "");

  const handleCloseNCR = async (ncrId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("ncr_register")
      .update({
        status: "closed",
        closed_by: user.id,
        closed_at: new Date().toISOString(),
      })
      .eq("id", ncrId);
    if (!error) fetchData();
  };

  const openNCRs = ncrs.filter((n) => n.status !== "closed");
  const closedNCRs = ncrs.filter((n) => n.status === "closed");

  const decisionBadgeClass = (decision: string | null) => {
    if (decision === "PASS STAGE") return "bg-success/20 text-success-foreground border-success/30";
    if (decision === "REWORK REQUIRED") return "bg-destructive/20 text-destructive border-destructive/30";
    return "bg-warning/20 text-warning-foreground border-warning/30";
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Quality Control</h1>
          <p className="text-muted-foreground text-sm mt-1">QC inspections & NCR register</p>
        </div>
        {canInspect && (
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Inspection
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="inspections">
          <TabsList>
            <TabsTrigger value="inspections" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" /> Inspections
            </TabsTrigger>
            <TabsTrigger value="ncrs" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" /> NCRs
              {openNCRs.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                  {openNCRs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspections" className="space-y-3 mt-4">
            {inspections.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">No inspections yet.</p>
                </CardContent>
              </Card>
            ) : (
              inspections.map((insp) => (
                <Card key={insp.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {(insp.modules as any)?.module_code || (insp.modules as any)?.name || "Module"} — {insp.stage_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(insp.modules as any)?.projects?.name || "Project"} · {insp.submitted_at ? format(new Date(insp.submitted_at), "dd MMM yyyy HH:mm") : "Draft"}
                        </p>
                      </div>
                      <Badge variant="outline" className={decisionBadgeClass(insp.dispatch_decision)}>
                        {insp.dispatch_decision || insp.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="ncrs" className="space-y-3 mt-4">
            {openNCRs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Open NCRs</h3>
                {openNCRs.map((ncr) => (
                  <Card key={ncr.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">{ncr.ncr_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {(ncr.qc_inspections as any)?.modules?.module_code || "Module"} — {(ncr.qc_inspections as any)?.stage_name || "Stage"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              ncr.status === "critical_open"
                                ? "bg-destructive/20 text-destructive border-destructive/30"
                                : "bg-warning/20 text-warning-foreground border-warning/30"
                            }
                          >
                            {ncr.status === "critical_open" ? "Critical" : "Open"}
                          </Badge>
                          {canCloseNCR && (
                            <Button size="sm" variant="outline" onClick={() => handleCloseNCR(ncr.id)}>
                              Close NCR
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {closedNCRs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Closed NCRs</h3>
                {closedNCRs.map((ncr) => (
                  <Card key={ncr.id} className="opacity-60">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm text-foreground">{ncr.ncr_number}</p>
                          <p className="text-xs text-muted-foreground">
                            Closed {ncr.closed_at ? format(new Date(ncr.closed_at), "dd MMM yyyy") : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-success/20 text-success-foreground border-success/30">
                          Closed
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {ncrs.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">No NCRs recorded yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <QCInspectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCompleted={fetchData}
      />
    </div>
  );
}
