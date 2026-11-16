import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Camera, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CapturedPhoto = { blob: Blob; capturedAt: string; lat: number; lng: number; accuracy: number };

const GPS_TIMEOUT_MS = 20000;
export const GPS_MAX_ACCURACY_M = 100;

/** Live-camera-only capture: no file input, no gallery, no drag-and-drop. */
export function ToolboxCamera({ projectName, onCaptured, disabled }: { projectName: string; onCaptured: (p: CapturedPhoto) => Promise<void> | void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"idle" | "starting" | "live" | "denied" | "unavailable">("idle");
  const [gps, setGps] = useState<{ state: "idle" | "locating" | "ok" | "weak" | "failed"; lat?: number; lng?: number; acc?: number }>({ state: "idle" });
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }, []);
  useEffect(() => stop, [stop]);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setGps({ state: "failed" }); return; }
    setGps({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ state: p.coords.accuracy <= GPS_MAX_ACCURACY_M ? "ok" : "weak", lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => setGps({ state: "failed" }),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCamState("unavailable"); return; }
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      setCamState("live");
      locate();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setCamState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  };

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || gps.state !== "ok" || gps.lat == null || gps.lng == null || gps.acc == null) return;
    setBusy(true);
    try {
      const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
      const scale = Math.min(1, 1600 / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vw * scale); canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = new Date();
      const lines = [format(now, "dd/MM/yyyy HH:mm"), projectName, `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`];
      const fs = Math.max(14, Math.round(canvas.width / 45));
      ctx.font = `600 ${fs}px sans-serif`;
      const boxH = fs * 1.35 * lines.length + fs * 0.6;
      const boxW = Math.min(canvas.width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs);
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, canvas.height - boxH, boxW, boxH);
      ctx.fillStyle = "#ffffff";
      lines.forEach((l, i) => ctx.fillText(l, fs / 2, canvas.height - boxH + fs * 1.2 + i * fs * 1.35, boxW - fs));
      let q = 0.75; let blob: Blob | null = null;
      for (let i = 0; i < 5; i++) {
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
        if (!blob || blob.size <= 400 * 1024) break;
        q -= 0.1;
      }
      if (!blob) throw new Error("Could not capture photo");
      await onCaptured({ blob, capturedAt: now.toISOString(), lat: gps.lat, lng: gps.lng, accuracy: gps.acc });
    } finally { setBusy(false); }
  };

  if (camState === "denied" || camState === "unavailable") {
    return (
      <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm break-words">
        <p className="font-medium">{camState === "denied" ? "Camera access is blocked." : "No camera is available on this device."}</p>
        <p>The toolbox talk photo must be taken live with the camera. Allow camera and location for this site in the browser settings (tap the lock icon next to the address), then try again. Uploading from the gallery is not allowed.</p>
        <Button size="sm" variant="outline" onClick={start}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="toolbox-camera">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" aria-label="Live camera preview" />
        {camState !== "live" && <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm text-muted-foreground">{camState === "starting" ? "Starting camera…" : "Camera is off"}</div>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">
          {gps.state === "idle" && "Location not requested yet"}
          {gps.state === "locating" && "Getting GPS fix…"}
          {gps.state === "ok" && `GPS ok (±${Math.round(gps.acc ?? 0)} m)`}
          {gps.state === "weak" && `GPS too weak (±${Math.round(gps.acc ?? 0)} m). Needs 100 m or better.`}
          {gps.state === "failed" && "No GPS fix. Turn on location and retry."}
        </span>
        {(gps.state === "weak" || gps.state === "failed") && <Button size="sm" variant="outline" onClick={locate}>Retry GPS</Button>}
      </div>
      {camState === "live"
        ? <Button className="w-full" onClick={shoot} disabled={disabled || busy || gps.state !== "ok"}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Take photo</Button>
        : <Button className="w-full" onClick={start} disabled={disabled || camState === "starting"}><Camera className="mr-2 h-4 w-4" />Open camera</Button>}
    </div>
  );
}
