import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Upload, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { insertNotifications } from "@/lib/notifications";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  projectName: string;
  designStages: any[];
  consultants: any[];
  dqs: any[];
  designFile: any;
  isPrincipal: boolean;
  userId: string | null;
  userName: string;
  onRefresh: () => void;
}

export function GFCChecklist({ projectId, projectName, designStages, consultants, dqs, designFile, isPrincipal, userId, userName, onRefresh }: Props) {
  const [uploading, setUploading] = useState<number | null>(null);
  const [issuing, setIssuing] = useState(false);
  const isGfcIssued = designFile?.design_stage === "gfc_issued";

  const projStages = designStages.filter((s: any) => s.project_id === projectId);
  const projConsultants = consultants.filter((c: any) => c.project_id === projectId);
  const openDqs = dqs.filter((d: any) => d.project_id === projectId && d.status !== "resolved" && d.status !== "closed");

  const archApproved = projStages.find((s: any) => s.stage_name === "Working Drawings")?.status === "client_approved";
  const structConsultant = projConsultants.find((c: any) => c.consultant_type === "Structural Engineer");
  const structOk = structConsultant?.review_complete && structConsultant?.approved;
  const mepConsultant = projConsultants.find((c: any) => c.consultant_type === "MEP Consultant");
  const mepOk = mepConsultant?.review_complete && mepConsultant?.approved;

  // Match checklist items to design_stages for evidence storage
  const gfcStage = projStages.find((s: any) => s.stage_name === "GFC Issue");

  const items = [
    { label: "Architectural drawings Client Approved", met: !!archApproved, auto: true, stageIdx: 0 },
    { label: "Structural drawings received and reviewed", met: !!structOk, auto: true, stageIdx: 1 },
    { label: "MEP drawings received and reviewed", met: !!mepOk, auto: true, stageIdx: 2 },
    { label: "All consultant comments incorporated", met: false, auto: false, stageIdx: 3 },
    { label: "Internal QC review complete", met: false, auto: false, stageIdx: 4 },
    { label: "No open Design Queries on this project", met: openDqs.length === 0, auto: true, stageIdx: 5 },
  ];

  // For manual items (3,4): check if gfcStage has evidence for this index
  // We store evidence per-item as JSON in the gfcStage or use stage columns
  const evidenceData = gfcStage ? (() => {
    try { return JSON.parse(gfcStage.revision_comments || "{}"); } catch { return {}; }
  })() : {};

  const getItemEvidence = (idx: number) => evidenceData[`item_${idx}`] || null;
  const isItemTicked = (idx: number) => {
    const ev = getItemEvidence(idx);
    return ev?.ticked || false;
  };

  // For non-auto items, check if manually ticked
  const resolvedItems = items.map((item, i) => ({
    ...item,
    met: item.auto ? item.met : isItemTicked(i),
    evidence: getItemEvidence(i),
  }));

  const allMet = resolvedItems.every((i) => i.met);
  const allHaveEvidence = resolvedItems.every((i) => i.evidence?.url || i.auto);

  const handleUploadEvidence = async (idx: number, file: File) => {
    if (!gfcStage) return;
    setUploading(idx);
    try {
      const path = `gfc-evidence/${projectId}/${idx}-${Date.now()}.${file.name.split(".").pop()}`;
      await supabase.storage.from("design-files").upload(path, file);
      const url = supabase.storage.from("design-files").getPublicUrl(path).data.publicUrl;

      const newEvidence = {
        ...evidenceData,
        [`item_${idx}`]: { url, ticked: true, ticked_by: userId, ticked_at: new Date().toISOString(), ticked_by_name: userName },
      };

      const { client } = await getAuthedClient();
      await (client.from("design_stages") as any).update({
        revision_comments: JSON.stringify(newEvidence),
      }).eq("id", gfcStage.id);

      toast.success("Evidence uploaded");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleTickItem = async (idx: number) => {
    if (!gfcStage || !isPrincipal) return;
    const newEvidence = {
      ...evidenceData,
      [`item_${idx}`]: { ...getItemEvidence(idx), ticked: true, ticked_by: userId, ticked_at: new Date().toISOString(), ticked_by_name: userName },
    };
    const { client } = await getAuthedClient();
    await (client.from("design_stages") as any).update({
      revision_comments: JSON.stringify(newEvidence),
    }).eq("id", gfcStage.id);
    onRefresh();
  };

  const handleIssueGFC = async () => {
    setIssuing(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("project_design_files") as any).update({
        design_stage: "gfc_issued",
        gfc_issued_at: new Date().toISOString(),
        gfc_issued_by: userId,
        gfc_issuer_name: userName,
      }).eq("project_id", projectId);

      const { data: prodProfiles } = await supabase.from("profiles")
        .select("auth_user_id").in("role", ["production_head", "head_operations", "managing_director"] as any[]).eq("is_active", true);

      if (prodProfiles?.length) {
        await insertNotifications(
          prodProfiles.map((p: any) => ({
            recipient_id: p.auth_user_id,
            title: "GFC Issued",
            body: `GFC issued for ${projectName} by ${userName}. Production can proceed.`,
            category: "design",
            related_table: "project",
            related_id: projectId,
            navigate_to: "/design",
          }))
        );
      }

      toast.success(`GFC issued for ${projectName}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue GFC");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">D — GFC Checklist</CardTitle>
          {isGfcIssued && <Lock className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />}
        </div>
        {isGfcIssued && designFile?.gfc_issued_at && (
          <p className="text-xs mt-1" style={{ color: "hsl(var(--primary))" }}>
            GFC issued on {format(new Date(designFile.gfc_issued_at), "dd MMM yyyy")} by {designFile.gfc_issuer_name || "—"}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {resolvedItems.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded-lg border border-border">
            <div className="mt-0.5">
              {item.met
                ? <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                : <XCircle className="h-5 w-5" style={{ color: "hsl(var(--destructive))" }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: item.met ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                {item.label}
              </p>
              {item.auto && <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>(auto-checked)</span>}
              {item.evidence?.ticked_at && (
                <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Ticked by {item.evidence.ticked_by_name} on {format(new Date(item.evidence.ticked_at), "dd MMM yyyy")}
                </p>
              )}
              {item.evidence?.url && (
                <a href={item.evidence.url} target="_blank" rel="noopener noreferrer" className="text-[10px] underline" style={{ color: "hsl(var(--primary))" }}>
                  View Evidence
                </a>
              )}
            </div>
            {!isGfcIssued && isPrincipal && (
              <div className="flex items-center gap-1 shrink-0">
                {!item.auto && !item.met && (
                  <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={() => handleTickItem(i)}>
                    ✓ Tick
                  </Button>
                )}
                <Label className="cursor-pointer">
                  <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border hover:bg-muted transition-colors">
                    {uploading === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Evidence
                  </div>
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadEvidence(i, f);
                    }}
                  />
                </Label>
              </div>
            )}
          </div>
        ))}

        {!isGfcIssued && isPrincipal && (
          <Button
            className="mt-3 w-full"
            style={{ backgroundColor: "hsl(var(--primary))" }}
            disabled={!allMet || issuing}
            onClick={handleIssueGFC}
          >
            {issuing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Issue GFC
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
