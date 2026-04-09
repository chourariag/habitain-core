import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Check, Camera, ShieldCheck, Loader2 } from "lucide-react";
import { insertNotifications } from "@/lib/notifications";

const CHECKLIST_ITEMS = [
  { id: 1, label: "All modules assembled in final building layout on factory floor", photoRequired: false },
  { id: 2, label: "Floor levels verified — all modules within ±5mm of each other", photoRequired: true },
  { id: 3, label: "Alignment stoppers installed at correct positions", photoRequired: false },
  { id: 4, label: "Column and beam connections between modules checked and align correctly", photoRequired: true },
  { id: 5, label: "No gaps or misalignments at module junctions", photoRequired: false },
  { id: 6, label: "Roof levels consistent across all modules", photoRequired: true },
  { id: 7, label: "External wall faces flush within tolerance", photoRequired: false },
  { id: 8, label: "Module ID labels verified against project register", photoRequired: false },
];

interface ChecklistItem {
  item_id: number;
  label: string;
  azad_checked: boolean;
  azad_checked_at: string | null;
  tagore_checked: boolean;
  tagore_checked_at: string | null;
  photo_urls: string[];
  issues_found: boolean;
  issue_description: string;
}

interface DryAssemblyRecord {
  id: string;
  project_id: string;
  triggered_at: string;
  checklist_items: ChecklistItem[];
  issues_found: boolean;
  linked_ncr_id: string | null;
  azad_signed_by: string | null;
  azad_signed_at: string | null;
  tagore_signed_by: string | null;
  tagore_signed_at: string | null;
  stage2_unlocked_at: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
  userId: string | null;
  allStage1Complete: boolean;
  onUnlocked?: () => void;
}

export function DryAssemblyCheck({ projectId, projectName, userRole, userId, allStage1Complete, onUnlocked }: Props) {
  const [record, setRecord] = useState<DryAssemblyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOff, setSigningOff] = useState(false);

  const isProductionHead = userRole === "production_head";
  const isQcInspector = userRole === "qc_inspector";
  const canEdit = isProductionHead || isQcInspector;
  const isSuperUser = ["super_admin", "managing_director", "head_operations"].includes(userRole ?? "");

  const fetchRecord = useCallback(async () => {
    const { data } = await supabase
      .from("dry_assembly_checks")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    setRecord(data as unknown as DryAssemblyRecord | null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);

  const triggerCheck = async () => {
    const items: ChecklistItem[] = CHECKLIST_ITEMS.map(ci => ({
      item_id: ci.id,
      label: ci.label,
      azad_checked: false,
      azad_checked_at: null,
      tagore_checked: false,
      tagore_checked_at: null,
      photo_urls: [],
      issues_found: false,
      issue_description: "",
    }));
    try {
      const { client } = await getAuthedClient();
      const { error } = await client.from("dry_assembly_checks").insert({
        project_id: projectId,
        checklist_items: items as any,
      } as any);
      if (error) throw error;

      // Notify production head and QC inspector
      const { data: targets } = await supabase
        .from("profiles")
        .select("auth_user_id, role")
        .in("role", ["production_head", "qc_inspector"])
        .eq("is_active", true);
      if (targets?.length) {
        await insertNotifications(targets.map(t => ({
          recipient_id: t.auth_user_id,
          title: "Dry Assembly Check Ready",
          body: `All modules for ${projectName} have completed Sub-Frame. Please complete the Dry Assembly Check before Stage 2 begins. Expected duration: 4 hours.`,
          category: "production",
          related_table: "projects",
          related_id: projectId,
          navigate_to: "/production",
        })));
      }
      toast.success("Dry Assembly Check triggered");
      fetchRecord();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger check");
    }
  };

  const updateItem = async (itemId: number, field: "azad_checked" | "tagore_checked", value: boolean) => {
    if (!record) return;
    const updated = record.checklist_items.map(ci => {
      if (ci.item_id !== itemId) return ci;
      return {
        ...ci,
        [field]: value,
        [`${field.replace("_checked", "")}_checked_at`]: value ? new Date().toISOString() : null,
      };
    });
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      const { error } = await client.from("dry_assembly_checks")
        .update({ checklist_items: updated as any } as any)
        .eq("id", record.id);
      if (error) throw error;
      setRecord({ ...record, checklist_items: updated });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  };

  const updateItemIssue = async (itemId: number, issuesFound: boolean, description: string) => {
    if (!record) return;
    const updated = record.checklist_items.map(ci =>
      ci.item_id === itemId ? { ...ci, issues_found: issuesFound, issue_description: description } : ci
    );
    const anyIssues = updated.some(ci => ci.issues_found);
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      const { error } = await client.from("dry_assembly_checks")
        .update({ checklist_items: updated as any, issues_found: anyIssues } as any)
        .eq("id", record.id);
      if (error) throw error;
      setRecord({ ...record, checklist_items: updated, issues_found: anyIssues });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(false);
  };

  const uploadPhoto = async (itemId: number, file: File) => {
    if (!record) return;
    const path = `dry-assembly/${record.id}/${itemId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("qc-photos").upload(path, file);
    if (upErr) { toast.error("Upload failed"); return; }
    const { data: urlData } = supabase.storage.from("qc-photos").getPublicUrl(path);
    const updated = record.checklist_items.map(ci =>
      ci.item_id === itemId ? { ...ci, photo_urls: [...ci.photo_urls, urlData.publicUrl] } : ci
    );
    try {
      const { client } = await getAuthedClient();
      await client.from("dry_assembly_checks")
        .update({ checklist_items: updated as any } as any)
        .eq("id", record.id);
      setRecord({ ...record, checklist_items: updated });
      toast.success("Photo uploaded");
    } catch {
      toast.error("Failed to save photo");
    }
  };

  const handleSignOff = async (role: "azad" | "tagore") => {
    if (!record || !userId) return;
    const items = record.checklist_items;

    // Validate all items checked by this role
    const field = role === "azad" ? "azad_checked" : "tagore_checked";
    const allChecked = items.every(ci => ci[field]);
    if (!allChecked) {
      toast.error("Please check all items before signing off.");
      return;
    }

    // Validate photos for required items
    const photoRequired = [2, 4, 6];
    const missingPhotos = items.filter(ci => photoRequired.includes(ci.item_id) && ci.photo_urls.length === 0);
    if (missingPhotos.length > 0) {
      toast.error(`Photos required for items: ${missingPhotos.map(p => p.item_id).join(", ")}`);
      return;
    }

    // Check for open issues
    if (record.issues_found) {
      toast.error("Issues found — resolve all issues and close linked NCRs before signing off.");
      return;
    }

    setSigningOff(true);
    try {
      const { client } = await getAuthedClient();
      const updates: any = {};
      if (role === "azad") {
        updates.azad_signed_by = userId;
        updates.azad_signed_at = new Date().toISOString();
      } else {
        updates.tagore_signed_by = userId;
        updates.tagore_signed_at = new Date().toISOString();
      }

      // Check if both will be signed after this
      const otherSigned = role === "azad" ? record.tagore_signed_at : record.azad_signed_at;
      if (otherSigned) {
        updates.stage2_unlocked_at = new Date().toISOString();
      }

      const { error } = await client.from("dry_assembly_checks")
        .update(updates)
        .eq("id", record.id);
      if (error) throw error;

      // If both signed, send unlock notifications
      if (otherSigned) {
        const { data: targets } = await supabase
          .from("profiles")
          .select("auth_user_id, role")
          .in("role", ["factory_floor_supervisor", "planning_engineer"])
          .eq("is_active", true);
        if (targets?.length) {
          await insertNotifications(targets.map(t => ({
            recipient_id: t.auth_user_id,
            title: "Stage 2 Unlocked",
            body: t.role === "planning_engineer" as string
              ? `Dry Assembly Check signed off for ${projectName}. Update production schedule — Stage 2 can begin.`
              : `Dry Assembly Check complete for ${projectName}. Stage 2 — MEP Rough-In is now unlocked for all modules. Proceed as per weekly plan.`,
            category: "production",
            related_table: "projects",
            related_id: projectId,
            navigate_to: "/production",
          })));
        }
        onUnlocked?.();
      }

      toast.success(`Sign-off recorded — ${role === "azad" ? "Production Head" : "QC Inspector"}`);
      fetchRecord();
    } catch (err: any) {
      toast.error(err.message || "Sign-off failed");
    }
    setSigningOff(false);
  };

  // Determine button state
  const isTriggered = !!record;
  const isFullySigned = !!record?.azad_signed_at && !!record?.tagore_signed_at;
  const showTriggerOption = allStage1Complete && !isTriggered && (isProductionHead || isQcInspector || isSuperUser);

  if (loading) return null;

  return (
    <>
      {/* Trigger button when not yet created */}
      {showTriggerOption && (
        <Button size="sm" variant="outline" onClick={triggerCheck} className="text-xs border-amber-400 text-amber-700 hover:bg-amber-50">
          <ShieldCheck className="h-4 w-4 mr-1" /> Trigger Dry Assembly Check
        </Button>
      )}

      {/* Main button to open checklist */}
      {isTriggered && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={isFullySigned ? "default" : "outline"}
              className={isFullySigned
                ? "text-xs bg-primary text-primary-foreground"
                : "text-xs border-amber-400 text-amber-700 hover:bg-amber-50"}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Dry Assembly Check
              {isFullySigned && <Check className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Dry Assembly Check — {projectName}
              </DialogTitle>
            </DialogHeader>

            {isFullySigned && (
              <div className="bg-primary/10 border border-primary/30 rounded-md p-3 text-sm text-primary flex items-center gap-2">
                <Check className="h-4 w-4" /> Both sign-offs recorded. Stage 2 is unlocked.
              </div>
            )}

            {record!.issues_found && !isFullySigned && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Issues found — resolve before sign-off.
              </div>
            )}

            <div className="space-y-4 mt-2">
              {record!.checklist_items.map((ci, idx) => {
                const meta = CHECKLIST_ITEMS[idx];
                return (
                  <div key={ci.item_id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">{ci.item_id}.</span>
                      <span className="text-sm font-medium">{ci.label}</span>
                      {meta.photoRequired && (
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-auto">📷 Required</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-6 ml-5">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={ci.azad_checked}
                          disabled={!isProductionHead || isFullySigned || !!record!.azad_signed_at}
                          onCheckedChange={(v) => updateItem(ci.item_id, "azad_checked", !!v)}
                        />
                        <span>Production Head</span>
                        {ci.azad_checked && <Check className="h-3 w-3 text-primary" />}
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={ci.tagore_checked}
                          disabled={!isQcInspector || isFullySigned || !!record!.tagore_signed_at}
                          onCheckedChange={(v) => updateItem(ci.item_id, "tagore_checked", !!v)}
                        />
                        <span>QC Inspector</span>
                        {ci.tagore_checked && <Check className="h-3 w-3 text-primary" />}
                      </label>
                    </div>

                    {/* Photo upload */}
                    <div className="ml-5 flex items-center gap-2 flex-wrap">
                      {ci.photo_urls.map((url, pi) => (
                        <a key={pi} href={url} target="_blank" rel="noreferrer"
                          className="w-12 h-12 rounded border border-border overflow-hidden">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                      {canEdit && !isFullySigned && (
                        <label className="w-12 h-12 rounded border border-dashed border-muted-foreground flex items-center justify-center cursor-pointer hover:bg-accent/50">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          <input type="file" accept="image/*" className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) uploadPhoto(ci.item_id, e.target.files[0]); }} />
                        </label>
                      )}
                    </div>

                    {/* Issues toggle */}
                    {canEdit && !isFullySigned && (
                      <div className="ml-5 space-y-1">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={ci.issues_found}
                            onCheckedChange={(v) => updateItemIssue(ci.item_id, !!v, ci.issue_description)}
                          />
                          <span className="text-destructive font-medium">Issues Found</span>
                        </label>
                        {ci.issues_found && (
                          <Textarea
                            placeholder="Describe the issue..."
                            value={ci.issue_description}
                            onChange={(e) => updateItemIssue(ci.item_id, true, e.target.value)}
                            className="text-xs min-h-[60px]"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sign-off buttons */}
            {!isFullySigned && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                {isProductionHead && !record!.azad_signed_at && (
                  <Button onClick={() => handleSignOff("azad")} disabled={signingOff} className="flex-1">
                    {signingOff ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                    Sign Off — Production Head
                  </Button>
                )}
                {record!.azad_signed_at && (
                  <Badge variant="outline" className="text-xs text-primary">✓ Production Head signed</Badge>
                )}
                {isQcInspector && !record!.tagore_signed_at && (
                  <Button onClick={() => handleSignOff("tagore")} disabled={signingOff} className="flex-1">
                    {signingOff ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                    Sign Off — QC Inspector
                  </Button>
                )}
                {record!.tagore_signed_at && (
                  <Badge variant="outline" className="text-xs text-primary">✓ QC Inspector signed</Badge>
                )}
              </div>
            )}

            {saving && <p className="text-xs text-muted-foreground text-center">Saving…</p>}
          </DialogContent>
        </Dialog>
      )}

      {/* Stage 2 locked banner */}
      {isTriggered && !isFullySigned && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-2 flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Stage 2 locked — Dry Assembly Check pending.
        </div>
      )}
    </>
  );
}
