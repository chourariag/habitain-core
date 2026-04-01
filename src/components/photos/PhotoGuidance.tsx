import { useState, useCallback } from "react";
import { Camera, Sun, Ruler, Move } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─── */
export type PhotoContext =
  | "daily_log"
  | "site_diary"
  | "rm_ticket"
  | "delivery_checklist"
  | "qc_evidence";

export interface PhotoCheckResult {
  accepted: boolean;
  quality_issues: string[];
  main_feedback: string;
  retake_tip: string;
  subject_visible: boolean;
}

export interface PhotoWithMeta {
  file: File;
  preview: string;
  checking: boolean;
  result: PhotoCheckResult | null;
  error: boolean;
  overridden: boolean;
}

/* ─── Guidance text per context ─── */
const GUIDANCE: Record<PhotoContext, string[]> = {
  daily_log: [
    "Step back until the full panel or frame fits in frame",
    "Make sure the light is in front of you, not behind",
    "Hold your phone steady and horizontal (landscape)",
  ],
  site_diary: [
    "Capture the full area of work — not just one corner",
    "Take one wide shot first, then a closeup if needed",
    "Avoid shooting into direct sunlight — turn around",
  ],
  rm_ticket: [
    "Get close enough to clearly show the damage or defect",
    "Take one photo showing the full area, one close-up",
    "If indoors, turn on all lights before taking the photo",
  ],
  delivery_checklist: [
    "Capture the full panel or module from end to end",
    "Make sure the ID label on the panel is visible and readable",
    "Step back at least 6 feet to fit the full item in frame",
  ],
  qc_evidence: [
    "Photo must clearly show the item being checked",
    "Hold the phone still — blurry photos will be flagged",
    "If measuring, include the tape measure in the frame",
  ],
};

/* ─── Image compression ─── */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1280;
      let w = img.width;
      let h = img.height;
      if (w > h && w > MAX) { h = (h * MAX) / w; w = MAX; }
      else if (h > MAX) { w = (w * MAX) / h; h = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve(dataUrl.split(",")[1]); // base64 only
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ─── AI check call ─── */
async function checkPhoto(
  file: File,
  context: PhotoContext
): Promise<PhotoCheckResult> {
  const base64 = await compressImage(file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase.functions.invoke("photo-check", {
      body: { image_base64: base64, context },
    });
    clearTimeout(timeout);
    if (error) throw error;
    return data.result;
  } catch {
    clearTimeout(timeout);
    throw new Error("Photo check unavailable");
  }
}

/* ─── Guidance Card component ─── */
export function PhotoGuidanceCard({
  context,
  collapsed,
}: {
  context: PhotoContext;
  collapsed: boolean;
}) {
  const tips = GUIDANCE[context];
  if (collapsed) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-border mb-2">
      <div
        className="px-3 py-1.5 text-xs font-semibold text-white"
        style={{ backgroundColor: "#006039" }}
      >
        📸 Photo Tips
      </div>
      <div className="px-3 py-2 bg-[#F7F7F7] space-y-1">
        {tips.map((t, i) => (
          <p key={i} className="text-xs text-foreground/80 leading-relaxed">
            • {t}
          </p>
        ))}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Ruler className="h-3 w-3" /> Distance
          </span>
          <span className="flex items-center gap-0.5">
            <Sun className="h-3 w-3" /> Lighting
          </span>
          <span className="flex items-center gap-0.5">
            <Move className="h-3 w-3" /> Angle
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Feedback per photo ─── */
export function PhotoFeedback({
  photo,
  onRetake,
  onOverride,
}: {
  photo: PhotoWithMeta;
  onRetake: () => void;
  onOverride: () => void;
}) {
  if (photo.checking) {
    return (
      <div className="relative rounded-lg overflow-hidden">
        <img
          src={photo.preview}
          alt="Checking"
          className="h-20 w-20 object-cover rounded"
        />
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded"
          style={{ backgroundColor: "rgba(0,96,57,0.8)" }}
        >
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-[9px] text-white mt-1">Checking...</span>
        </div>
      </div>
    );
  }

  if (photo.error) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <img
            src={photo.preview}
            alt="Photo"
            className="h-20 w-20 object-cover rounded border border-border"
          />
          <span
            className="absolute -top-1 -right-1 text-[9px] px-1 rounded text-white"
            style={{ backgroundColor: "#D4860A" }}
          >
            —
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground">
          Photo check unavailable — proceeding without analysis
        </p>
      </div>
    );
  }

  if (!photo.result) return null;

  if (photo.result.accepted) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <img
            src={photo.preview}
            alt="Accepted"
            className="h-20 w-20 object-cover rounded border-2"
            style={{ borderColor: "#006039" }}
          />
          <span className="absolute -top-1 -right-1 text-xs">✅</span>
        </div>
        <div
          className="rounded px-2 py-1 text-[10px]"
          style={{ backgroundColor: "#E8F2ED", color: "#006039" }}
        >
          ✅ {photo.result.main_feedback}
        </div>
      </div>
    );
  }

  // Rejected but overridden
  if (photo.overridden) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <img
            src={photo.preview}
            alt="Overridden"
            className="h-20 w-20 object-cover rounded border border-border"
          />
          <span className="absolute -top-1 -right-1 text-xs">⚠</span>
        </div>
        <p
          className="text-[9px] px-1 py-0.5 rounded"
          style={{ backgroundColor: "#FFF3CD", color: "#D4860A" }}
        >
          ⚠ Low quality — submitted as is
        </p>
      </div>
    );
  }

  // Rejected — show retake options
  return (
    <div className="space-y-1.5">
      <img
        src={photo.preview}
        alt="Rejected"
        className="h-20 w-20 object-cover rounded border-2"
        style={{ borderColor: "#F40009" }}
      />
      <div
        className="rounded px-2 py-1.5 text-[10px] space-y-1"
        style={{ backgroundColor: "#FDE8E8", color: "#F40009" }}
      >
        <p className="font-semibold">❌ Let's get a better photo</p>
        <p>{photo.result.main_feedback}</p>
      </div>
      {photo.result.retake_tip && (
        <div
          className="rounded px-2 py-1 text-[10px]"
          style={{ backgroundColor: "#FFF3CD", color: "#333" }}
        >
          💡 Tip: {photo.result.retake_tip}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={onRetake}
          className="flex-1 text-[10px] font-medium px-2 py-1 rounded text-white"
          style={{ backgroundColor: "#006039" }}
        >
          📷 Retake
        </button>
        <button
          onClick={onOverride}
          className="flex-1 text-[10px] px-2 py-1 rounded border"
          style={{ borderColor: "#999", color: "#666" }}
        >
          Use Anyway
        </button>
      </div>
    </div>
  );
}

/* ─── Summary warning ─── */
export function PhotoQualitySummary({
  photos,
}: {
  photos: PhotoWithMeta[];
}) {
  const flagged = photos.filter(
    (p) => p.result && !p.result.accepted && !p.overridden
  ).length;
  const overridden = photos.filter((p) => p.overridden).length;
  if (flagged === 0 && overridden === 0) return null;
  return (
    <div
      className="rounded px-3 py-1.5 text-xs"
      style={{ backgroundColor: "#FFF3CD", color: "#D4860A" }}
    >
      {flagged > 0 && `⚠ ${flagged} photo(s) may need a retake. `}
      {overridden > 0 && `${overridden} photo(s) submitted as low quality. `}
      You can still submit.
    </div>
  );
}

/* ─── Hook for managing photo state with AI checks ─── */
export function usePhotoWithAI(context: PhotoContext) {
  const [photos, setPhotos] = useState<PhotoWithMeta[]>([]);
  const [guidanceCollapsed, setGuidanceCollapsed] = useState(false);

  const addPhotos = useCallback(
    async (files: File[]) => {
      setGuidanceCollapsed(true); // collapse guidance after camera tap

      const newPhotos: PhotoWithMeta[] = files.map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        checking: true,
        result: null,
        error: false,
        overridden: false,
      }));

      setPhotos((prev) => [...prev, ...newPhotos]);

      // Check each photo
      for (let i = 0; i < files.length; i++) {
        try {
          const result = await checkPhoto(files[i], context);
          setPhotos((prev) =>
            prev.map((p) =>
              p.file === files[i]
                ? { ...p, checking: false, result }
                : p
            )
          );
        } catch {
          setPhotos((prev) =>
            prev.map((p) =>
              p.file === files[i]
                ? { ...p, checking: false, error: true }
                : p
            )
          );
        }
      }
    },
    [context]
  );

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const overridePhoto = useCallback((index: number) => {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, overridden: true } : p))
    );
  }, []);

  const retakePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setGuidanceCollapsed(false);
  }, []);

  const resetPhotos = useCallback(() => {
    setPhotos([]);
    setGuidanceCollapsed(false);
  }, []);

  const hasUnresolvedRejections = photos.some(
    (p) => p.result && !p.result.accepted && !p.overridden
  );

  const anyChecking = photos.some((p) => p.checking);

  const qualityMeta = {
    quality_override: photos.some((p) => p.overridden),
    quality_issues: photos.flatMap((p) => p.result?.quality_issues ?? []),
    ai_quality_checked: photos.some((p) => p.result !== null || p.error),
  };

  return {
    photos,
    guidanceCollapsed,
    addPhotos,
    removePhoto,
    overridePhoto,
    retakePhoto,
    resetPhotos,
    hasUnresolvedRejections,
    anyChecking,
    qualityMeta,
    setGuidanceCollapsed,
  };
}
