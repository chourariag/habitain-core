import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, CheckCircle2, Loader2, AlertTriangle, Sparkles } from "lucide-react";
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

interface TodayPhoto {
  id: string;
  url: string;
  ai_severity?: string | null;
  ai_flags?: string[] | null;
  ai_analysis_result?: any | null;
}

export function GuidedPhotoCapture({ projectId, diaryId, onProgressChange }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [yesterdayPhotos, setYesterdayPhotos] = useState<Record<string, string>>({});
  const [todayPhotos, setTodayPhotos] = useState<Record<string, TodayPhoto>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [hasFloorPlan, setHasFloorPlan] = useState(true);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<Position | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: fps }, { data: pos }, { data: prev }, { data: today_ }] = await Promise.all([
        (supabase.from("floor_plans") as any).select("id,is_locked").eq("project_id", projectId).eq("is_archived", false),
        (supabase.from("photo_positions") as any).select("*").eq("project_id", projectId).eq("is_active", true).order("position_number"),
        (supabase.from("site_position_photos") as any).select("position_id,file_url,photo_date").eq("project_id", projectId).lt("photo_date", today).order("photo_date", { ascending: false }),
        (supabase.from("site_position_photos") as any).select("id,position_id,file_url,ai_severity,ai_flags,ai_analysis_result").eq("project_id", projectId).eq("photo_date", today),
      ]);
      setHasFloorPlan((fps ?? []).some((f: any) => f.is_locked));
      setPositions(pos ?? []);
      const yMap: Record<string, string> = {};
      (prev ?? []).forEach((p: any) => { if (!yMap[p.position_id]) yMap[p.position_id] = p.file_url; });
      setYesterdayPhotos(yMap);
      const tMap: Record<string, TodayPhoto> = {};
      (today_ ?? []).forEach((p: any) => {
        tMap[p.position_id] = { id: p.id, url: p.file_url, ai_severity: p.ai_severity, ai_flags: p.ai_flags, ai_analysis_result: p.ai_analysis_result };
      });
      setTodayPhotos(tMap);
      setLoading(false);
    })();
  }, [projectId, today]);

  useEffect(() => {
    const mandatory = positions.filter((p) => p.is_mandatory);
    const done = mandatory.filter((p) => todayPhotos[p.id]).length;
    onProgressChange?.({ mandatoryDone: done, mandatoryTotal: mandatory.length, allRequiredCaptured: done === mandatory.length });
  }, [positions, todayPhotos]);

  const refreshPhoto = async (photoId: string, posId: string) => {
    const { data } = await (supabase.from("site_position_photos") as any)
      .select("id,file_url,ai_severity,ai_flags,ai_analysis_result")
      .eq("id", photoId).maybeSingle();
    if (!data) return;
    setTodayPhotos((prev) => ({
      ...prev,
      [posId]: { id: data.id, url: data.file_url, ai_severity: data.ai_severity, ai_flags: data.ai_flags, ai_analysis_result: data.ai_analysis_result },
    }));
  };

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

      setTodayPhotos((prev) => ({ ...prev, [pos.id]: { id: row.id, url: pub.publicUrl } }));
      toast.success(`${pos.area_name} captured`);

      // Trigger AI comparison and poll for the result
      setAnalyzing((s) => new Set(s).add(pos.id));
      supabase.functions.invoke("site-photo-analyze", { body: { photo_id: row.id } })
        .then(async () => {
          await refreshPhoto(row.id, pos.id);
        })
        .catch(() => { /* non-blocking */ })
        .finally(() => {
          setAnalyzing((s) => { const n = new Set(s); n.delete(pos.id); return n; });
        });
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
  const totalDone = positions.filter((p) => todayPhotos[p.id]).length;
  const pct = positions.length > 0 ? Math.round((totalDone / positions.length) * 100) : 0;

  const reviewPhoto = reviewing ? todayPhotos[reviewing.id] : null;
  const reviewYesterday = reviewing ? yesterdayPhotos[reviewing.id] : null;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Today's Site Diary — {format(new Date(), "dd/MM/yyyy")}</div>
            <div className="text-xs text-muted-foreground">{totalDone} of {positions.length} zones captured</div>
          </div>
          <Progress value={pct} className="h-2" />
          {mandatoryTotal > 0 && (
            <div className="text-[11px] text-muted-foreground">{mandatoryDone} of {mandatoryTotal} mandatory zones photographed</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {positions.map((pos) => {
          const taken = todayPhotos[pos.id];
          const yPhoto = yesterdayPhotos[pos.id];
          const isAnalyzing = analyzing.has(pos.id);
          const severity = taken?.ai_severity ?? "info";
          const hasConcern = severity === "minor" || severity === "major";
          const summary = taken?.ai_analysis_result?.new_materials_visible?.join(", ");
          const progressDetected = taken?.ai_analysis_result?.progress_detected;

          return (
            <Card key={pos.id} className={taken ? (hasConcern ? "border-amber-300" : "border-green-300") : pos.is_mandatory ? "border-amber-200" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Zone {pos.area_name}</div>
                    <div className="text-[11px] text-muted-foreground">{pos.floor_name} · Face: {pos.direction ?? "—"}{pos.is_mandatory ? "" : " · optional"}</div>
                  </div>
                  {taken ? <Badge style={{ backgroundColor: "#006039", color: "white" }}><CheckCircle2 className="h-3 w-3 mr-1" />Captured</Badge>
                    : <Badge variant="outline">Pending</Badge>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground mb-1">Yesterday</div>
                    {yPhoto ? <img src={yPhoto} className="h-20 w-full object-cover rounded border cursor-pointer" alt="yesterday" onClick={() => window.open(yPhoto, "_blank")} />
                      : <div className="h-20 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">No photo</div>}
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-muted-foreground mb-1">Today</div>
                    {taken ? <img src={taken.url} className="h-20 w-full object-cover rounded border cursor-pointer" alt="today" onClick={() => window.open(taken.url, "_blank")} />
                      : <div className="h-20 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">—</div>}
                  </div>
                </div>

                {taken && (
                  <div className="space-y-1 border-t pt-2">
                    {isAnalyzing && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> AI analysing progress…
                      </div>
                    )}
                    {!isAnalyzing && taken.ai_analysis_result && (
                      <>
                        <div className="flex items-start gap-1.5 text-[11px]">
                          <Sparkles className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          <span className="text-foreground">
                            {progressDetected === "visible_change" && "Progress detected. "}
                            {progressDetected === "no_change" && "No visible change since yesterday. "}
                            {progressDetected === "regression" && "Regression detected. "}
                            {progressDetected === "first_photo" && "First photo for this zone. "}
                            {summary && <span className="text-muted-foreground">{summary}</span>}
                          </span>
                        </div>
                        {hasConcern && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px] border-amber-400 text-amber-700 hover:bg-amber-50"
                            onClick={() => setReviewing(pos)}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            ⚠ Review ({severity})
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                <label className="block">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) captureFor(pos, f); e.currentTarget.value = ""; }} />
                  <Button size="sm" variant={taken ? "outline" : "default"} className="w-full" disabled={uploading === pos.id} asChild>
                    <span>
                      {uploading === pos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
                      {taken ? "Retake" : "Capture Photo"}
                    </span>
                  </Button>
                </label>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Zone {reviewing?.area_name} — Side-by-side review</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Yesterday</div>
              {reviewYesterday
                ? <img src={reviewYesterday} className="w-full rounded border" alt="yesterday" />
                : <div className="rounded border border-dashed py-12 text-center text-xs text-muted-foreground">No previous photo</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Today</div>
              {reviewPhoto && <img src={reviewPhoto.url} className="w-full rounded border" alt="today" />}
            </div>
          </div>
          {reviewPhoto?.ai_analysis_result && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Severity:</span>{" "}
                <Badge variant={reviewPhoto.ai_severity === "major" ? "destructive" : "outline"} className="capitalize">
                  {reviewPhoto.ai_severity}
                </Badge>
              </div>
              {reviewPhoto.ai_analysis_result.progress_detected && (
                <div><span className="font-medium">Progress:</span> {reviewPhoto.ai_analysis_result.progress_detected}</div>
              )}
              {(reviewPhoto.ai_analysis_result.new_materials_visible ?? []).length > 0 && (
                <div>
                  <div className="font-medium">New materials visible:</div>
                  <ul className="list-disc pl-5 text-muted-foreground text-xs">
                    {reviewPhoto.ai_analysis_result.new_materials_visible.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {(reviewPhoto.ai_flags ?? []).length > 0 && (
                <div>
                  <div className="font-medium text-amber-700">Concerns:</div>
                  <ul className="list-disc pl-5 text-xs">
                    {(reviewPhoto.ai_flags ?? []).map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {(reviewPhoto.ai_analysis_result.safety_observations ?? []).length > 0 && (
                <div>
                  <div className="font-medium">Safety:</div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {reviewPhoto.ai_analysis_result.safety_observations.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
