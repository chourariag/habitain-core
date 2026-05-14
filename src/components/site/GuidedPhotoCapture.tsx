import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  diaryId?: string | null;
  onProgressChange?: (info: { mandatoryDone: number; mandatoryTotal: number; allRequiredCaptured: boolean }) => void;
}

interface Position {
  id: string;
  position_number: number;
  area_name: string;
  floor_name: string;
  direction: string | null;
  is_mandatory: boolean;
}

export function GuidedPhotoCapture({ projectId, diaryId, onProgressChange }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [yesterdayPhotos, setYesterdayPhotos] = useState<Record<string, string>>({});
  const [todayPhotos, setTodayPhotos] = useState<Record<string, { url: string; id: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [hasFloorPlan, setHasFloorPlan] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: fps }, { data: pos }, { data: prev }, { data: today_ }] = await Promise.all([
        (supabase.from("floor_plans") as any).select("id,is_locked").eq("project_id", projectId).eq("is_archived", false),
        (supabase.from("photo_positions") as any).select("*").eq("project_id", projectId).eq("is_active", true).order("position_number"),
        (supabase.from("site_position_photos") as any).select("position_id,file_url,photo_date").eq("project_id", projectId).lte("photo_date", yesterday).order("photo_date", { ascending: false }),
        (supabase.from("site_position_photos") as any).select("id,position_id,file_url").eq("project_id", projectId).eq("photo_date", today),
      ]);
      setHasFloorPlan((fps ?? []).some((f: any) => f.is_locked));
      setPositions(pos ?? []);
      const yMap: Record<string, string> = {};
      (prev ?? []).forEach((p: any) => { if (!yMap[p.position_id]) yMap[p.position_id] = p.file_url; });
      setYesterdayPhotos(yMap);
      const tMap: Record<string, { url: string; id: string }> = {};
      (today_ ?? []).forEach((p: any) => { tMap[p.position_id] = { url: p.file_url, id: p.id }; });
      setTodayPhotos(tMap);
      setLoading(false);
    })();
  }, [projectId, today, yesterday]);

  useEffect(() => {
    const mandatory = positions.filter((p) => p.is_mandatory);
    const done = mandatory.filter((p) => todayPhotos[p.id]).length;
    onProgressChange?.({ mandatoryDone: done, mandatoryTotal: mandatory.length, allRequiredCaptured: done === mandatory.length });
  }, [positions, todayPhotos]);

  const captureFor = async (pos: Position, file: File) => {
    setUploading(pos.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let lat: number | null = null, lng: number | null = null;
      try {
        const p = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = p.coords.latitude; lng = p.coords.longitude;
      } catch { /* gps optional */ }

      const path = `${projectId}/site_diary/${today}/${pos.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("site-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("site-photos").getPublicUrl(path);

      const { data: row, error } = await (supabase.from("site_position_photos") as any).insert({
        project_id: projectId,
        diary_id: diaryId ?? null,
        position_id: pos.id,
        photo_date: today,
        file_url: pub.publicUrl,
        storage_path: path,
        gps_lat: lat,
        gps_lng: lng,
        submitted_by: user?.id,
      }).select().single();
      if (error) throw error;

      setTodayPhotos((prev) => ({ ...prev, [pos.id]: { url: pub.publicUrl, id: row.id } }));
      // fire-and-forget AI analysis
      supabase.functions.invoke("site-photo-analyze", { body: { photo_id: row.id } }).catch(() => {});
      toast.success(`${pos.area_name} captured`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  if (!hasFloorPlan) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="py-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-700" />
          <span>Floor plan not uploaded. Ask Awaiz to upload one in <strong>Floor Plan & Positions</strong> before starting site diary photos.</span>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return <p className="text-xs text-muted-foreground">No active positions defined yet.</p>;
  }

  const mandatoryDone = positions.filter((p) => p.is_mandatory && todayPhotos[p.id]).length;
  const mandatoryTotal = positions.filter((p) => p.is_mandatory).length;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        {mandatoryDone} of {mandatoryTotal} mandatory positions photographed
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {positions.map((pos) => {
          const taken = todayPhotos[pos.id];
          const yPhoto = yesterdayPhotos[pos.id];
          return (
            <Card key={pos.id} className={taken ? "border-green-300" : pos.is_mandatory ? "border-amber-200" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Position {pos.position_number} — {pos.area_name}</div>
                    <div className="text-[11px] text-muted-foreground">{pos.floor_name} · Face: {pos.direction ?? "—"}{pos.is_mandatory ? "" : " · optional"}</div>
                  </div>
                  {taken ? <Badge style={{ backgroundColor: "#006039", color: "white" }}><CheckCircle2 className="h-3 w-3 mr-1" />Captured</Badge>
                    : <Badge variant="outline">Pending</Badge>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground mb-1">Yesterday</div>
                    {yPhoto ? <img src={yPhoto} className="h-20 w-full object-cover rounded border" alt="yesterday" />
                      : <div className="h-20 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">No photo</div>}
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground mb-1">Today</div>
                    {taken ? <img src={taken.url} className="h-20 w-full object-cover rounded border" alt="today" />
                      : <div className="h-20 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">—</div>}
                  </div>
                </div>
                <label className="block">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) captureFor(pos, f); e.currentTarget.value = ""; }} />
                  <Button size="sm" variant={taken ? "outline" : "default"} className="w-full" disabled={uploading === pos.id} asChild>
                    <span>
                      {uploading === pos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                      {taken ? "Retake" : "Take Photo"}
                    </span>
                  </Button>
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
