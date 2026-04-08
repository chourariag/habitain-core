import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Upload, Check, Loader2, Video, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
}

export function InstallationSequenceDoc({ projectId, projectName, userRole }: Props) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [signing, setSigning] = useState(false);

  const canUpload = ["site_installation_mgr", "head_operations", "production_head", "super_admin", "managing_director", "site_engineer"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("installation_sequence_docs") as any)
      .select("*").eq("project_id", projectId).maybeSingle();
    setDoc(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const path = `installation-sequence/${projectId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("drawings").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(path);

      const { client } = await getAuthedClient();
      if (doc) {
        await (client.from("installation_sequence_docs") as any).update({
          document_url: urlData.publicUrl,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
        }).eq("id", doc.id);
      } else {
        await (client.from("installation_sequence_docs") as any).insert({
          project_id: projectId,
          document_url: urlData.publicUrl,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
        });
      }
      toast.success("Document uploaded");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const path = `dry-run/${projectId}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadErr } = await supabase.storage.from("dry-run-videos").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("dry-run-videos").getPublicUrl(path);

      const { client } = await getAuthedClient();
      await (client.from("installation_sequence_docs") as any).update({
        video_url: urlData.publicUrl,
      }).eq("id", doc.id);
      toast.success("Video uploaded");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Video upload failed");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSignOff = async (role: "azad" | "awaiz" | "karthik") => {
    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();

      const updateData: any = {};
      updateData[`${role}_signed_at`] = new Date().toISOString();
      updateData[`${role}_signed_by`] = user.id;

      await (client.from("installation_sequence_docs") as any).update(updateData).eq("id", doc.id);

      // Check if all 3 signed
      const updatedDoc = { ...doc, ...updateData };
      if (updatedDoc.azad_signed_at && updatedDoc.awaiz_signed_at && updatedDoc.karthik_signed_at) {
        // Notify relevant stakeholders
        const { data: recipients } = await supabase.from("profiles").select("auth_user_id")
          .in("role", ["production_head", "site_installation_mgr", "head_operations"] as any).eq("is_active", true);
        if (recipients?.length) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Installation Sequence Approved",
            body: `All three sign-offs completed for ${projectName}. Dispatch can now proceed.`,
            category: "Production",
            related_table: "installation_sequence_docs",
            related_id: doc.id,
            navigate_to: "/site-hub",
          })));
        }
      }

      toast.success("Sign-off recorded");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Sign-off failed");
    } finally {
      setSigning(false);
    }
  };

  const isFullyApproved = doc?.document_url && doc?.azad_signed_at && doc?.awaiz_signed_at && doc?.karthik_signed_at;

  if (loading) return null;

  const signoffs = [
    { key: "azad" as const, label: "Azad — Factory sequence correct", signed: doc?.azad_signed_at },
    { key: "awaiz" as const, label: "Awaiz — Site ready for sequence", signed: doc?.awaiz_signed_at },
    { key: "karthik" as const, label: "Karthik — Matches production plan", signed: doc?.karthik_signed_at },
  ];

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <FileText className="h-4 w-4" style={{ color: "#006039" }} />
            Installation Sequence Document
          </CardTitle>
          {isFullyApproved ? (
            <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
              <Check className="h-3 w-3 mr-0.5" /> Approved
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>
              <AlertTriangle className="h-3 w-3 mr-0.5" /> Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Document upload */}
        {!doc?.document_url ? (
          <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2" style={{ borderColor: "#D4860A" }}>
            <p className="text-xs" style={{ color: "#666666" }}>No document uploaded yet.</p>
            {canUpload && (
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" className="text-xs gap-1" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload Document (PDF, DWG, Image)
                  </span>
                </Button>
                <input type="file" accept=".pdf,.dwg,.jpg,.jpeg,.png" className="hidden" onChange={handleDocUpload} />
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4" style={{ color: "#006039" }} />
              <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#006039" }}>
                View Document
              </a>
              {doc.uploaded_at && (
                <span style={{ color: "#666666" }}>Uploaded {format(new Date(doc.uploaded_at), "dd/MM/yyyy HH:mm")}</span>
              )}
              {canUpload && (
                <label className="cursor-pointer ml-auto">
                  <Button size="sm" variant="ghost" className="text-[10px] h-6" disabled={uploading} asChild>
                    <span>{uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Replace"}</span>
                  </Button>
                  <input type="file" accept=".pdf,.dwg,.jpg,.jpeg,.png" className="hidden" onChange={handleDocUpload} />
                </label>
              )}
            </div>

            {/* Sign-offs */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: "#1A1A1A" }}>Required Sign-offs:</p>
              {signoffs.map(({ key, label, signed }) => (
                <div key={key} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" style={{ borderColor: "#F0F0F0" }}>
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    {signed ? (
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#006039" }} />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border shrink-0" style={{ borderColor: "#D4860A" }} />
                    )}
                    <span style={{ color: signed ? "#006039" : "#1A1A1A" }}>{label}</span>
                  </div>
                  {signed ? (
                    <span className="text-[10px] shrink-0" style={{ color: "#666666" }}>
                      {format(new Date(signed), "dd/MM/yyyy HH:mm")}
                    </span>
                  ) : (
                    canUpload && (
                      <Button size="sm" variant="outline" className="text-[10px] h-6 shrink-0" onClick={() => handleSignOff(key)} disabled={signing}>
                        {signing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sign Off"}
                      </Button>
                    )
                  )}
                </div>
              ))}
            </div>

            {/* Dry run video */}
            <div className="pt-2 border-t" style={{ borderColor: "#F0F0F0" }}>
              <div className="flex items-center gap-2 text-xs">
                <Video className="h-3.5 w-3.5" style={{ color: "#666666" }} />
                <span style={{ color: "#666666" }}>Dry run video (optional but recommended)</span>
              </div>
              {doc.video_url ? (
                <a href={doc.video_url} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 block" style={{ color: "#006039" }}>
                  View Video
                </a>
              ) : (
                canUpload && (
                  <label className="cursor-pointer mt-1 block">
                    <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" disabled={uploadingVideo} asChild>
                      <span>
                        {uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Upload Video
                      </span>
                    </Button>
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  </label>
                )
              )}
            </div>
          </div>
        )}

        {/* Dispatch gate warning */}
        {!isFullyApproved && (
          <div className="flex items-start gap-2 p-2 rounded text-xs" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Dispatch requires completed Installation Sequence Document with all three approvals.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Check if installation sequence is fully approved for dispatch gate */
export async function isInstallationSequenceApproved(projectId: string): Promise<boolean> {
  const { data } = await (supabase.from("installation_sequence_docs") as any)
    .select("document_url, azad_signed_at, awaiz_signed_at, karthik_signed_at")
    .eq("project_id", projectId).maybeSingle();
  if (!data) return false;
  return !!(data.document_url && data.azad_signed_at && data.awaiz_signed_at && data.karthik_signed_at);
}
