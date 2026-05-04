import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { insertNotifications } from "@/lib/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  projectName: string;
  isPrincipal: boolean;
  userId: string | null;
  userName: string;
  modules: { id: string; name: string; module_code: string | null }[];
  designFile: any;
  qcStats?: { checked: number; total: number; allChecked: boolean };
  onRefresh: () => void;
}

type GfcRecord = {
  id: string;
  gfc_stage: string;
  module_group: string[];
  issued_by: string | null;
  issued_at: string;
  sections_complete: number;
  sections_total: number;
  notes: string | null;
};

export function GFCStatusCard({ projectId, projectName, isPrincipal, userId, userName, modules, designFile, onRefresh }: Props) {
  const [records, setRecords] = useState<GfcRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; stage: "advance_h1" | "final_h2" } | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gfc_records")
        .select("*")
        .eq("project_id", projectId);
      setRecords((data as GfcRecord[] | null) ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  const h1 = records.find((r) => r.gfc_stage === "advance_h1");
  const h2 = records.find((r) => r.gfc_stage === "final_h2");

  const openIssueDialog = (stage: "advance_h1" | "final_h2") => {
    setSelectedModules(modules.map((m) => m.id));
    setIssueDialog({ open: true, stage });
  };

  const handleIssue = async () => {
    if (!issueDialog || !userId) return;
    setIssuing(true);
    try {
      const { client } = await getAuthedClient();
      const { error } = await (client.from("gfc_records") as any).insert({
        project_id: projectId,
        gfc_stage: issueDialog.stage,
        module_group: selectedModules,
        issued_by: userId,
        issued_at: new Date().toISOString(),
        sections_complete: 0,
        sections_total: 0,
      });
      if (error) throw error;

      // Notify production
      const { data: prodProfiles } = await supabase.from("profiles")
        .select("auth_user_id").in("role", ["production_head", "head_operations", "managing_director", "planning_engineer"] as any[]).eq("is_active", true);

      const stageLabel = issueDialog.stage === "advance_h1" ? "Advance GFC (H1)" : "Final GFC (H2)";
      const bodyMsg = issueDialog.stage === "advance_h1"
        ? `${stageLabel} issued for ${projectName} by ${userName}. Sub-Frame stage unlocked — factory can begin fabrication.`
        : `${stageLabel} issued for ${projectName} by ${userName}. Full production unlocked.`;

      if (prodProfiles?.length) {
        await insertNotifications(
          prodProfiles.map((p: any) => ({
            recipient_id: p.auth_user_id,
            title: `${stageLabel} Issued`,
            body: bodyMsg,
            category: "design",
            related_table: "project",
            related_id: projectId,
            navigate_to: "/design",
          }))
        );
      }

      toast.success(`${stageLabel} issued for ${projectName}`);
      setIssueDialog(null);
      // Refresh
      const { data: updated } = await supabase.from("gfc_records").select("*").eq("project_id", projectId);
      setRecords((updated as GfcRecord[] | null) ?? []);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue GFC");
    } finally {
      setIssuing(false);
    }
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  if (loading) return null;

  const gfcStatus = h2 ? "full" : h1 ? "advance" : "none";

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg" style={{ fontFamily: "var(--font-heading)" }}>GFC Status</CardTitle>
            <Badge
              className="text-xs"
              style={
                gfcStatus === "full" ? { backgroundColor: "#E8F2ED", color: "#006039", border: "none" }
                  : gfcStatus === "advance" ? { backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }
                  : { backgroundColor: "#F5F5F5", color: "#666", border: "none" }
              }
            >
              {gfcStatus === "full" ? "Final GFC Issued" : gfcStatus === "advance" ? "Advance GFC Only" : "No GFC"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual flow */}
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1" style={{ fontFamily: "var(--font-input)" }}>
            <span className="px-2 py-1 rounded" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>Design</span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "#999" }} />
            <span className={`px-2 py-1 rounded ${h1 ? "font-bold" : ""}`} style={{ backgroundColor: h1 ? "#FFF8E8" : "#F5F5F5", color: h1 ? "#D4860A" : "#999" }}>
              H1 — Advance GFC
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "#999" }} />
            <span className="px-2 py-1 rounded" style={{ backgroundColor: h1 ? "#E8F2ED" : "#F5F5F5", color: h1 ? "#006039" : "#999" }}>
              Production Start
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "#999" }} />
            <span className={`px-2 py-1 rounded ${h2 ? "font-bold" : ""}`} style={{ backgroundColor: h2 ? "#E8F2ED" : "#F5F5F5", color: h2 ? "#006039" : "#999" }}>
              H2 — Final GFC
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "#999" }} />
            <span className="px-2 py-1 rounded" style={{ backgroundColor: h2 ? "#E8F2ED" : "#F5F5F5", color: h2 ? "#006039" : "#999" }}>
              Full Production
            </span>
          </div>

          {/* H1 / H2 rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* H1 */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>H1 — Advance GFC</span>
                {h1 ? <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> : <Lock className="h-4 w-4" style={{ color: "#999" }} />}
              </div>
              <p className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
                Architectural, Structural, Site Layout drawings
              </p>
              {h1 ? (
                <p className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#006039" }}>
                  Issued on {format(new Date(h1.issued_at), "dd MMM yyyy")}
                  {h1.module_group?.length > 0 && ` · ${h1.module_group.length} modules`}
                </p>
              ) : (
                isPrincipal && (
                  <Button size="sm" variant="outline" className="text-xs mt-1" onClick={() => openIssueDialog("advance_h1")}>
                    Issue Advance GFC
                  </Button>
                )
              )}
            </div>

            {/* H2 */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>H2 — Final GFC</span>
                {h2 ? <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> : <Lock className="h-4 w-4" style={{ color: "#999" }} />}
              </div>
              <p className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
                MEP, HVAC, Material specs, Client final sign-off
              </p>
              {h2 ? (
                <p className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#006039" }}>
                  Issued on {format(new Date(h2.issued_at), "dd MMM yyyy")}
                  {h2.module_group?.length > 0 && ` · ${h2.module_group.length} modules`}
                </p>
              ) : h1 ? (
                isPrincipal && (
                  <Button size="sm" variant="outline" className="text-xs mt-1" onClick={() => openIssueDialog("final_h2")}>
                    Issue Final GFC
                  </Button>
                )
              ) : (
                <p className="text-[11px]" style={{ color: "#999" }}>Issue H1 first</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issue Dialog with module selector */}
      <Dialog open={!!issueDialog?.open} onOpenChange={() => setIssueDialog(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Issue {issueDialog?.stage === "advance_h1" ? "Advance GFC (H1)" : "Final GFC (H2)"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            Select which modules this GFC applies to:
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto border border-border rounded-md p-2">
            {modules.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#999" }}>No modules found for this project</p>
            ) : (
              modules.map((m) => (
                <label key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/30 cursor-pointer">
                  <Checkbox
                    checked={selectedModules.includes(m.id)}
                    onCheckedChange={() => toggleModule(m.id)}
                  />
                  <span className="text-sm" style={{ fontFamily: "var(--font-input)" }}>
                    {m.module_code || m.name}
                  </span>
                </label>
              ))
            )}
          </div>
          <p className="text-[11px]" style={{ color: "#999" }}>
            {selectedModules.length} of {modules.length} modules selected
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog(null)}>Cancel</Button>
            <Button onClick={handleIssue} disabled={issuing || selectedModules.length === 0}>
              {issuing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm & Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
