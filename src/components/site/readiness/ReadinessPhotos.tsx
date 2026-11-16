import { useEffect, useState } from "react";
import { Camera, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { compressPhoto, readPhotoMeta } from "@/lib/site-report-photo";
import { getSignedUrls } from "@/lib/storage-signed-url";

export interface ReadinessPhoto { path: string; taken_at: string | null; lat: number | null; lng: number | null; gps_source: string; from_gallery: boolean; uploaded_at: string }

const BUCKET = "site-photos";

export function photoFlags(p: ReadinessPhoto): string[] {
  const f: string[] = [];
  if (p.from_gallery) f.push("Gallery");
  if (!p.taken_at) f.push("No EXIF date");
  if (p.gps_source === "none") f.push("No GPS");
  else if (p.gps_source === "device") f.push("Device GPS");
  return f;
}

interface Props {
  projectId: string; folder: string; photos: ReadinessPhoto[]; required?: boolean; readOnly?: boolean;
  onChange: (next: ReadinessPhoto[]) => void;
}

export function ReadinessPhotos({ projectId, folder, photos, required, readOnly, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const key = photos.map((p) => p.path).join("|");

  useEffect(() => {
    let off = false;
    getSignedUrls(BUCKET, photos.map((p) => p.path)).then((s) => { if (!off) setSigned(s); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const pick = async (file: File | undefined, gallery: boolean) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Photos only, please choose an image"); return; }
    setBusy(true);
    try {
      const meta = await readPhotoMeta(file);
      let blob: Blob; try { blob = await compressPhoto(file); } catch { blob = file; }
      const path = `site-readiness/${projectId}/${folder}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      onChange([...photos, { path, taken_at: meta.takenAt, lat: meta.lat, lng: meta.lng, gps_source: meta.source, from_gallery: gallery, uploaded_at: new Date().toISOString() }]);
    } catch (e: any) {
      toast.error(e?.message || "Photo upload failed. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 min-w-0">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.path} className="relative min-w-0">
              <a href={signed[p.path] ?? "#"} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded border border-border bg-muted">
                {signed[p.path] && <img src={signed[p.path]} alt={`Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />}
              </a>
              {photoFlags(p).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {photoFlags(p).map((f) => <Badge key={f} variant="outline" className="px-1 py-0 text-[9px] leading-4 border-warning text-warning">{f}</Badge>)}
                </div>
              )}
              {!readOnly && (
                <button type="button" aria-label="Remove photo" onClick={() => onChange(photos.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 rounded-full border border-border bg-background p-0.5">
                  <X className="h-3 w-3 text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-md bg-primary text-xs text-primary-foreground">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} Camera{required ? " *" : ""}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={(e) => { pick(e.target.files?.[0], false); e.target.value = ""; }} />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-md border border-border text-xs">
            <ImageIcon className="h-3.5 w-3.5" /> Gallery
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { pick(e.target.files?.[0], true); e.target.value = ""; }} />
          </label>
        </div>
      )}
    </div>
  );
}
