import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Check, Loader2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  moduleId: string;
  moduleName: string;
  userRole: string | null;
  onComplete?: () => void;
}

export function SiteReceiptChecklist({ projectId, moduleId, moduleName, userRole, onComplete }: Props) {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Checklist state
  const [physicalCondition, setPhysicalCondition] = useState(false);
  const [conditionPhotoUrl, setConditionPhotoUrl] = useState("");
  const [moduleIdsVerified, setModuleIdsVerified] = useState(false);
  const [dispatchDocsChecked, setDispatchDocsChecked] = useState(false);
  const [transportDamage, setTransportDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const canManage = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => { loadRecord(); }, [moduleId]);

  const loadRecord = async () => {
    setLoading(true);
    const { data } = await (supabase.from("site_receipt_checklist") as any)
      .select("*").eq("module_id", moduleId).order("created_at", { ascending: false }).limit(1);
    const rec = (data as any[])?.[0] ?? null;
    if (rec) {
      setRecord(rec);
      setPhysicalCondition(rec.physical_condition_checked ?? false);
      setConditionPhotoUrl(rec.physical_condition_photo_url ?? "");
      setModuleIdsVerified(rec.module_ids_verified ?? false);
      setDispatchDocsChecked(rec.dispatch_docs_checked ?? false);
      setTransportDamage(rec.transport_damage_found ?? false);
      setDamageDescription(rec.transport_damage_description ?? "");
      setDamagePhotos(rec.transport_damage_photos ?? []);
    }
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDamage = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `site-receipts/${projectId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("site-photos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
      if (isDamage) {
        setDamagePhotos((prev) => [...prev, urlData.publicUrl]);
      } else {
        setConditionPhotoUrl(urlData.publicUrl);
      }
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!conditionPhotoUrl) { toast.error("Photo of physical condition is required"); return; }
    if (!physicalCondition) { toast.error("Please verify physical condition first"); return; }
    if (transportDamage && !damageDescription.trim()) { toast.error("Please describe the transport damage"); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();

      const payload = {
        project_id: projectId,
        module_id: moduleId,
        physical_condition_checked: physicalCondition,
        physical_condition_photo_url: conditionPhotoUrl,
        module_ids_verified: moduleIdsVerified,
        dispatch_docs_checked: dispatchDocsChecked,
        transport_damage_found: transportDamage,
        transport_damage_description: transportDamage ? damageDescription.trim() : null,
        transport_damage_photos: damagePhotos,
        submitted_by: user.id,
        is_complete: physicalCondition && moduleIdsVerified && dispatchDocsChecked,
      };

      if (record) {
        await (client.from("site_receipt_checklist") as any).update(payload).eq("id", record.id);
      } else {
        await (client.from("site_receipt_checklist") as any).insert(payload);
      }

      // If transport damage, notify Azad (head_operations) and Gaurav (managing_director)
      if (transportDamage) {
        const { data: projData } = await supabase.from("projects").select("name").eq("id", projectId).single();
        const pName = projData?.name ?? "this project";
        const { data: recipients } = await supabase
          .from("profiles")
          .select("auth_user_id")
          .in("role", ["head_operations", "managing_director"] as any)
          .eq("is_active", true);

        if (recipients?.length) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Transport Damage Reported",
            body: `Transport damage reported on delivery to ${pName}. ${damageDescription.trim()}. Photos attached.`,
            category: "Production",
            related_table: "site_receipt_checklist",
            related_id: moduleId,
            navigate_to: "/site-hub",
          })));
        }
      }

      toast.success("Site receipt checklist saved");
      onComplete?.();
      await loadRecord();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (record?.is_complete) {
    return (
      <Card className="border-primary/30" style={{ backgroundColor: "#E8F2ED" }}>
        <CardContent className="p-3 flex items-center gap-2">
          <Check className="h-4 w-4" style={{ color: "#006039" }} />
          <span className="text-xs font-medium" style={{ color: "#006039" }}>
            Site receipt verified — {record.submitted_at ? format(new Date(record.submitted_at), "dd/MM/yyyy HH:mm") : ""}
          </span>
          {record.transport_damage_found && (
            <Badge variant="outline" className="ml-auto text-[10px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>
              Transport Damage
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!canManage) return null;

  const checkedCount = [physicalCondition, moduleIdsVerified, dispatchDocsChecked].filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-xs flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} />
          Site Receipt Checklist — {moduleName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <p className="text-xs" style={{ color: "#666666" }}>{checkedCount} of 3 items verified</p>

        {/* Item 1: Physical condition */}
        <div className="border rounded-md p-3 space-y-2" style={{ borderColor: "#E5E5E5" }}>
          <div className="flex items-start gap-2">
            <Checkbox
              checked={physicalCondition}
              onCheckedChange={(v) => {
                if (!conditionPhotoUrl) { toast.error("Upload a photo of the module condition first"); return; }
                setPhysicalCondition(!!v);
              }}
              disabled={!conditionPhotoUrl}
            />
            <div className="flex-1">
              <span className="text-sm font-medium" style={{ color: "#1A1A1A" }}>
                1. Physical condition inspected — no damage, dents, or scratches
              </span>
              <p className="text-xs mt-0.5" style={{ color: "#666666" }}>
                Photo required before this can be checked off
              </p>
            </div>
          </div>
          {conditionPhotoUrl ? (
            <img src={conditionPhotoUrl} alt="Condition" className="h-20 w-20 rounded object-cover border" />
          ) : (
            <label className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e)} />
            </label>
          )}

          {/* Transport damage flag */}
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>Was any transport damage found?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTransportDamage(true)}
                  className="text-xs px-3 py-1 rounded-full border font-medium"
                  style={{ backgroundColor: transportDamage ? "#FDE8E8" : "transparent", color: transportDamage ? "#F40009" : "#666", borderColor: transportDamage ? "#F40009" : "#E5E5E5" }}>
                  Yes
                </button>
                <button type="button" onClick={() => setTransportDamage(false)}
                  className="text-xs px-3 py-1 rounded-full border font-medium"
                  style={{ backgroundColor: !transportDamage ? "#E8F2ED" : "transparent", color: !transportDamage ? "#006039" : "#666", borderColor: !transportDamage ? "#006039" : "#E5E5E5" }}>
                  No
                </button>
              </div>
            </div>
            {transportDamage && (
              <div className="space-y-2 pl-2 border-l-2" style={{ borderColor: "#F40009" }}>
                <Textarea
                  value={damageDescription}
                  onChange={(e) => setDamageDescription(e.target.value)}
                  placeholder="Describe the transport damage..."
                  rows={2}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {damagePhotos.map((url, i) => (
                    <img key={i} src={url} alt={`Damage ${i + 1}`} className="h-16 w-16 rounded object-cover border" />
                  ))}
                  <label className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-destructive/50">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, true)} />
                  </label>
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#F40009" }}>
                  <AlertTriangle className="h-3 w-3" /> Azad and Gaurav will be notified immediately
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Item 2: Module IDs verified */}
        <label className="flex items-center gap-3 cursor-pointer border rounded-md p-3" style={{ borderColor: "#E5E5E5" }}>
          <Checkbox checked={moduleIdsVerified} onCheckedChange={(v) => setModuleIdsVerified(!!v)} />
          <span className="text-sm" style={{ color: "#1A1A1A" }}>2. Module IDs verified against delivery order</span>
        </label>

        {/* Item 3: Dispatch docs checked */}
        <label className="flex items-center gap-3 cursor-pointer border rounded-md p-3" style={{ borderColor: "#E5E5E5" }}>
          <Checkbox checked={dispatchDocsChecked} onCheckedChange={(v) => setDispatchDocsChecked(!!v)} />
          <span className="text-sm" style={{ color: "#1A1A1A" }}>3. Dispatch documents cross-checked — quantities match</span>
        </label>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || uploading} className="flex-1"
            style={checkedCount === 3 ? { backgroundColor: "#006039", color: "#fff" } : {}}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {record ? "Update Checklist" : "Save Checklist"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
