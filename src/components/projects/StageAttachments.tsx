import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Paperclip, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "design-files";

type Attachment = {
  id: string;
  file_name: string | null;
  file_size_bytes: number | null;
  storage_path: string | null;
  uploaded_by: string | null;
};

function prettySize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function StageAttachments({
  projectId,
  stageId,
  canUpload,
}: {
  projectId: string;
  stageId: string | null;
  canUpload: boolean;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!stageId) { setFiles([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("file_attachments")
      .select("id, file_name, file_size_bytes, storage_path, uploaded_by")
      .eq("entity_type", "project_design_stage")
      .eq("entity_id", stageId)
      .eq("is_archived", false)
      .order("uploaded_at", { ascending: false });
    setFiles((data ?? []) as Attachment[]);
    setLoading(false);
  }, [stageId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id").eq("auth_user_id", user.id).maybeSingle();
      setProfileId((data as any)?.id ?? null);
    })();
  }, []);

  const handleUpload = async (list: FileList | null) => {
    if (!list?.length || !stageId) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `design-stages/${projectId}/${stageId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("file_attachments").insert({
          entity_type: "project_design_stage",
          entity_id: stageId,
          file_name: file.name,
          file_type: file.name.split(".").pop() ?? "file",
          mime_type: file.type || null,
          file_size_bytes: file.size,
          storage_bucket: BUCKET,
          storage_path: path,
          file_url: path,
          uploaded_by: profileId,
        } as any);
        if (rowErr) throw rowErr;
      }
      toast.success("File(s) attached");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openFile = async (f: Attachment) => {
    if (!f.storage_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Unable to open file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removeFile = async (f: Attachment) => {
    setBusy(true);
    try {
      if (f.storage_path) await supabase.storage.from(BUCKET).remove([f.storage_path]);
      const { error } = await supabase.from("file_attachments").delete().eq("id", f.id);
      if (error) throw error;
      toast.success("Attachment removed");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not remove file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Label>Attachments</Label>
      {!stageId ? (
        <p className="text-xs text-muted-foreground mt-1">Save this stage once to enable file attachments.</p>
      ) : (
        <div className="mt-1 space-y-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files attached yet.</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1" title={f.file_name ?? ""}>{f.file_name}</span>
                  <span className="text-[10px] text-muted-foreground">{prettySize(f.file_size_bytes)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openFile(f)} title="View / download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canUpload && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={busy} onClick={() => removeFile(f)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5" style={{ color: "#F40009" }} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canUpload && (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Paperclip className="h-3.5 w-3.5 mr-2" />}
                Attach file
              </Button>
              <span className="text-[10px] text-muted-foreground">Drawings, sign-offs, PDFs or images</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
