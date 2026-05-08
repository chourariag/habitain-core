import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Upload, Check, Loader2, Video, AlertTriangle, Download, Plus, Trash2, Edit3 } from "lucide-react";
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
  const [showForm, setShowForm] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [seqRows, setSeqRows] = useState<{ moduleNo: string; gridPos: string; order: string; craneDir: string; notes: string }[]>(
    [{ moduleNo: "", gridPos: "", order: "", craneDir: "", notes: "" }]
  );
  const [craneLifts, setCraneLifts] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [craneOpNotes, setCraneOpNotes] = useState("");

  const canUpload = ["site_installation_mgr", "head_operations", "production_head", "super_admin", "managing_director", "site_engineer"].includes(userRole ?? "");

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Module Erection Sequence"],
      [],
      ["Module #", "Grid Position", "Bay Direction", "Crane Approach", "Erection Order", "Notes"],
      ["M1", "A1", "North-South", "From east", 1, ""],
      ["M2", "A2", "North-South", "From east", 2, ""],
      [],
      ["Number of crane lifts required:", ""],
      ["Special site access restrictions:", ""],
      ["Notes for crane operator:", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Erection Sequence");
    const sketch = XLSX.utils.aoa_to_sheet([["Site Plan Sketch — print and mark by hand, then upload photo"]]);
    XLSX.utils.book_append_sheet(wb, sketch, "Site Plan");
    XLSX.writeFile(wb, `Installation_Sequence_${projectName.replace(/\s+/g, "_")}.xlsx`);
  };

  const addRow = () => setSeqRows((r) => [...r, { moduleNo: "", gridPos: "", order: "", craneDir: "", notes: "" }]);
  const removeRow = (i: number) => setSeqRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, key: string, val: string) =>
    setSeqRows((r) => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const saveForm = async () => {
    const validRows = seqRows.filter((r) => r.moduleNo.trim());
    if (validRows.length === 0) { toast.error("Add at least one module"); return; }
    setSavingForm(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const payload = {
        project: projectName,
        savedAt: new Date().toISOString(),
        savedBy: user.id,
        sequence: validRows,
        craneLifts,
        accessNotes,
        craneOpNotes,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const path = `installation-sequence/${projectId}/form_${Date.now()}.json`;
      const { error: upErr } = await supabase.storage.from("drawings").upload(path, blob, { upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("drawings").getPublicUrl(path).data.publicUrl;

      const { client } = await getAuthedClient();
      if (doc) {
        await (client.from("installation_sequence_docs") as any).update({
          document_url: url, uploaded_by: user.id, uploaded_at: new Date().toISOString(),
        }).eq("id", doc.id);
      } else {
        await (client.from("installation_sequence_docs") as any).insert({
          project_id: projectId, document_url: url, uploaded_by: user.id, uploaded_at: new Date().toISOString(),
        });
      }
      toast.success("Sequence saved ✓");
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingForm(false);
    }
  };

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
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option A — Upload */}
              <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2" style={{ borderColor: "#D4860A" }}>
                <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Option A — Upload Document</p>
                <p className="text-[10px]" style={{ color: "#666666" }}>Use the template or your own file.</p>
                <div className="flex flex-col gap-2 items-center">
                  <Button size="sm" variant="outline" className="text-xs gap-1 w-full" onClick={downloadTemplate}>
                    <Download className="h-3 w-3" /> Download Template
                  </Button>
                  {canUpload && (
                    <label className="cursor-pointer w-full">
                      <Button size="sm" variant="outline" className="text-xs gap-1 w-full" disabled={uploading} asChild>
                        <span>
                          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Upload Document
                        </span>
                      </Button>
                      <input type="file" accept=".pdf,.dwg,.jpg,.jpeg,.png,.xlsx" className="hidden" onChange={handleDocUpload} />
                    </label>
                  )}
                </div>
              </div>
              {/* Option B — Fill in App */}
              <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2" style={{ borderColor: "#006039" }}>
                <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Option B — Fill In App</p>
                <p className="text-[10px]" style={{ color: "#666666" }}>Quick structured form for the sequence.</p>
                {canUpload && (
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowForm((s) => !s)}>
                    <Edit3 className="h-3 w-3" /> {showForm ? "Hide form" : "Open form"}
                  </Button>
                )}
              </div>
            </div>

            {showForm && canUpload && (
              <div className="border rounded-lg p-3 space-y-3" style={{ borderColor: "#E0E0E0" }}>
                <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Module Erection Sequence</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ color: "#666666" }}>
                        <th className="text-left p-1 font-medium">Module #</th>
                        <th className="text-left p-1 font-medium">Grid pos.</th>
                        <th className="text-left p-1 font-medium">Order</th>
                        <th className="text-left p-1 font-medium">Crane dir.</th>
                        <th className="text-left p-1 font-medium">Notes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {seqRows.map((row, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "#F0F0F0" }}>
                          <td className="p-1"><Input value={row.moduleNo} onChange={(e) => updateRow(i, "moduleNo", e.target.value)} className="h-7 text-xs" /></td>
                          <td className="p-1"><Input value={row.gridPos} onChange={(e) => updateRow(i, "gridPos", e.target.value)} className="h-7 text-xs" /></td>
                          <td className="p-1"><Input value={row.order} onChange={(e) => updateRow(i, "order", e.target.value)} className="h-7 text-xs w-14" /></td>
                          <td className="p-1"><Input value={row.craneDir} onChange={(e) => updateRow(i, "craneDir", e.target.value)} className="h-7 text-xs" /></td>
                          <td className="p-1"><Input value={row.notes} onChange={(e) => updateRow(i, "notes", e.target.value)} className="h-7 text-xs" /></td>
                          <td className="p-1">
                            {seqRows.length > 1 && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeRow(i)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={addRow}>
                  <Plus className="h-3 w-3" /> Add row
                </Button>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Crane lifts required</Label>
                    <Input value={craneLifts} onChange={(e) => setCraneLifts(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Site access restrictions</Label>
                    <Input value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Crane operator notes</Label>
                    <Input value={craneOpNotes} onChange={(e) => setCraneOpNotes(e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <Button size="sm" onClick={saveForm} disabled={savingForm} style={{ backgroundColor: "#006039" }}>
                  {savingForm ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Save Sequence
                </Button>
              </div>
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
