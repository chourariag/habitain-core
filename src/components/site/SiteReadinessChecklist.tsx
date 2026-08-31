import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, ClipboardCheck, Upload, Video, Eye, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";
import { canSubmitSiteReadiness } from "@/lib/site-readiness-permissions";
import { getSignedUrl, getSignedUrls } from "@/lib/storage-signed-url";

const PHOTO_BUCKET = "site-photos";
const VIDEO_BUCKET = "dry-run-videos";

interface Props {
  projectId: string;
  userRole: string | null;
  onReadinessConfirmed: () => void;
}

const PREP_ITEMS = [
  { key: "foundation_ready", label: "Foundation Ready" },
  { key: "crane_booked", label: "Crane Booked" },
  { key: "site_access_clear", label: "Site Access Clear" },
  { key: "team_briefed", label: "Team Briefed" },
  { key: "safety_equipment", label: "Safety Equipment on Site" },
] as const;

type PrepKey = (typeof PREP_ITEMS)[number]["key"];

interface ChecklistState {
  foundation_ready: boolean;
  crane_booked: boolean;
  site_access_clear: boolean;
  team_briefed: boolean;
  safety_equipment: boolean;
  foundation_ready_notes: string;
  foundation_ready_photo_urls: string[];
  foundation_ready_video_url: string;
  crane_booked_notes: string;
  crane_booked_photo_urls: string[];
  crane_booked_video_url: string;
  site_access_clear_notes: string;
  site_access_clear_photo_urls: string[];
  site_access_clear_video_url: string;
  team_briefed_notes: string;
  team_briefed_photo_urls: string[];
  team_briefed_video_url: string;
  safety_equipment_notes: string;
  safety_equipment_photo_urls: string[];
  safety_equipment_video_url: string;
  dry_run_video_url: string;
  labour_stay: boolean;
  labour_stay_notes: string;
  labour_food: boolean;
  labour_food_notes: string;
  dg_generator: boolean;
  dg_generator_notes: string;
  nearest_hardware_shop: boolean;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  supervisor_stay: boolean;
  supervisor_stay_notes: string;
}

const INITIAL_STATE: ChecklistState = {
  foundation_ready: false, crane_booked: false, site_access_clear: false,
  team_briefed: false, safety_equipment: false, dry_run_video_url: "",
  foundation_ready_notes: "", foundation_ready_photo_urls: [], foundation_ready_video_url: "",
  crane_booked_notes: "", crane_booked_photo_urls: [], crane_booked_video_url: "",
  site_access_clear_notes: "", site_access_clear_photo_urls: [], site_access_clear_video_url: "",
  team_briefed_notes: "", team_briefed_photo_urls: [], team_briefed_video_url: "",
  safety_equipment_notes: "", safety_equipment_photo_urls: [], safety_equipment_video_url: "",
  labour_stay: false, labour_stay_notes: "", labour_food: false, labour_food_notes: "",
  dg_generator: false, dg_generator_notes: "", nearest_hardware_shop: false,
  shop_name: "", shop_address: "", shop_phone: "",
  supervisor_stay: false, supervisor_stay_notes: "",
};

const CheckItem = ({ checked, onCheck, label }: { checked: boolean; onCheck: (v: boolean) => void; label: string }) => (
  <label className="flex items-center gap-3 cursor-pointer py-1">
    <Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} />
    <span className="text-sm" style={{ color: "#1A1A1A" }}>{label}</span>
    {checked && <Check className="h-3.5 w-3.5 ml-auto" style={{ color: "#006039" }} />}
  </label>
);

interface PrepItemProps {
  label: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  notes: string;
  onNotes: (v: string) => void;
  photos: string[];
  onAddPhotos: (files: FileList | null) => void;
  onRemovePhoto: (idx: number) => void;
  video: string;
  onVideo: (file: File | null) => void;
  onRemoveVideo: () => void;
  signed: Record<string, string>;
  busy: boolean;
}

/** Defined at module scope so typing in the textarea never remounts the input. */
const PrepItem = ({
  label, checked, onCheck, notes, onNotes, photos, onAddPhotos, onRemovePhoto,
  video, onVideo, onRemoveVideo, signed, busy,
}: PrepItemProps) => {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border p-2.5" style={{ borderColor: "#EEEEEE" }}>
      <CheckItem checked={checked} onCheck={onCheck} label={label} />

      <Textarea
        placeholder="Status / details, issues or pending work, site observations…"
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        className="mt-1.5 text-sm"
        rows={2}
      />

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { onAddPhotos(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => { onVideo(e.target.files?.[0] ?? null); e.target.value = ""; }}
      />

      <div className="flex flex-wrap gap-2 mt-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={busy} onClick={() => photoRef.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          Add Photos
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={busy} onClick={() => videoRef.current?.click()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
          {video ? "Replace Video" : "Add Video"}
        </Button>
      </div>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {photos.map((p, i) => (
            <div key={`${p}-${i}`} className="relative">
              <a href={signed[p] ?? "#"} target="_blank" rel="noopener noreferrer">
                <img
                  src={signed[p]}
                  alt={`${label} photo ${i + 1}`}
                  loading="lazy"
                  className="h-16 w-16 rounded object-cover border"
                  style={{ borderColor: "#E5E5E5" }}
                />
              </a>
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onRemovePhoto(i)}
                className="absolute -top-1.5 -right-1.5 rounded-full p-0.5 border bg-background"
                style={{ borderColor: "#E5E5E5" }}
              >
                <X className="h-3 w-3" style={{ color: "#F40009" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {video && (
        <div className="flex items-center gap-2 mt-2 p-2 rounded-md" style={{ backgroundColor: "#F0FFF4" }}>
          <Video className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
          <span className="text-xs font-medium flex-1 truncate" style={{ color: "#006039" }}>Video uploaded</span>
          <a href={signed[video] ?? "#"} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium flex items-center gap-1 shrink-0" style={{ color: "#006039" }}>
            <Eye className="h-3.5 w-3.5" /> View
          </a>
          <button type="button" aria-label="Remove video" onClick={onRemoveVideo}>
            <X className="h-3.5 w-3.5" style={{ color: "#F40009" }} />
          </button>
        </div>
      )}
    </div>
  );
};

export function SiteReadinessChecklist({ projectId, userRole, onReadinessConfirmed }: Props) {
  const [state, setState] = useState<ChecklistState>(INITIAL_STATE);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyKey, setBusyKey] = useState<PrepKey | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Site-present roles fill the readiness checklist on the ground; mirrors site_readiness RLS insert/update policy.
  const canManage = canSubmitSiteReadiness(userRole);

  const section1Count = PREP_ITEMS.filter((it) => state[it.key]).length;
  const section2Count = state.dry_run_video_url ? 1 : 0;
  const section3Count = [state.labour_stay, state.labour_food, state.dg_generator, state.nearest_hardware_shop, state.supervisor_stay].filter(Boolean).length;
  const totalComplete = section1Count + section2Count + section3Count;
  const allComplete = totalComplete === 11;

  useEffect(() => { loadExisting(); }, [projectId]);

  // Private buckets: mint short-lived signed URLs for every stored object path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const photoValues = PREP_ITEMS.flatMap((it) => state[`${it.key}_photo_urls` as keyof ChecklistState] as string[]);
      const videoValues = [
        ...PREP_ITEMS.map((it) => state[`${it.key}_video_url` as keyof ChecklistState] as string),
        state.dry_run_video_url,
        existing?.dry_run_video_url ?? "",
      ];
      const [p, v] = await Promise.all([
        getSignedUrls(PHOTO_BUCKET, photoValues),
        getSignedUrls(VIDEO_BUCKET, videoValues),
      ]);
      if (!cancelled) setSigned({ ...p, ...v });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(PREP_ITEMS.map((it) => [state[`${it.key}_photo_urls` as keyof ChecklistState], state[`${it.key}_video_url` as keyof ChecklistState]])),
    state.dry_run_video_url,
    existing?.dry_run_video_url,
  ]);

  const loadExisting = async () => {
    setLoading(true);
    const { data } = await (supabase.from("site_readiness") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    const record = (data as any[])?.[0];
    if (record) {
      setExisting(record);
      setState({
        foundation_ready: record.foundation_ready ?? false,
        crane_booked: record.crane_booked ?? false,
        site_access_clear: record.site_access_clear ?? false,
        team_briefed: record.team_briefed ?? false,
        safety_equipment: record.safety_equipment ?? false,
        foundation_ready_notes: record.foundation_ready_notes ?? "",
        foundation_ready_photo_urls: record.foundation_ready_photo_urls ?? [],
        foundation_ready_video_url: record.foundation_ready_video_url ?? "",
        crane_booked_notes: record.crane_booked_notes ?? "",
        crane_booked_photo_urls: record.crane_booked_photo_urls ?? [],
        crane_booked_video_url: record.crane_booked_video_url ?? "",
        site_access_clear_notes: record.site_access_clear_notes ?? "",
        site_access_clear_photo_urls: record.site_access_clear_photo_urls ?? [],
        site_access_clear_video_url: record.site_access_clear_video_url ?? "",
        team_briefed_notes: record.team_briefed_notes ?? "",
        team_briefed_photo_urls: record.team_briefed_photo_urls ?? [],
        team_briefed_video_url: record.team_briefed_video_url ?? "",
        safety_equipment_notes: record.safety_equipment_notes ?? "",
        safety_equipment_photo_urls: record.safety_equipment_photo_urls ?? [],
        safety_equipment_video_url: record.safety_equipment_video_url ?? "",
        dry_run_video_url: record.dry_run_video_url ?? "",
        labour_stay: record.labour_stay ?? false,
        labour_stay_notes: record.labour_stay_notes ?? "",
        labour_food: record.labour_food ?? false,
        labour_food_notes: record.labour_food_notes ?? "",
        dg_generator: record.dg_generator ?? false,
        dg_generator_notes: record.dg_generator_notes ?? "",
        nearest_hardware_shop: record.nearest_hardware_shop ?? false,
        shop_name: record.shop_name ?? "",
        shop_address: record.shop_address ?? "",
        shop_phone: record.shop_phone ?? "",
        supervisor_stay: record.supervisor_stay ?? false,
        supervisor_stay_notes: record.supervisor_stay_notes ?? "",
      });
    }
    setLoading(false);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please upload a video file"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file);
      if (error) throw error;
      // Private bucket — persist the object path, sign it at render time.
      setState((p) => ({ ...p, dry_run_video_url: path }));
      toast.success("Video uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePrepPhotos = async (key: PrepKey, files: FileList | null) => {
    if (!files?.length) return;
    setBusyKey(key);
    try {
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); continue; }
        const path = `site-readiness/${projectId}/${key}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
        if (error) throw error;
        paths.push(path);
      }
      if (paths.length) {
        setState((p) => ({
          ...p,
          [`${key}_photo_urls`]: [...(p[`${key}_photo_urls` as keyof ChecklistState] as string[]), ...paths],
        }));
        toast.success(`${paths.length} photo(s) uploaded`);
      }
    } catch (err: any) {
      toast.error(err.message || "Photo upload failed");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePrepVideo = async (key: PrepKey, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please upload a video file"); return; }
    setBusyKey(key);
    try {
      const ext = file.name.split(".").pop();
      const path = `${projectId}/${key}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file);
      if (error) throw error;
      setState((p) => ({ ...p, [`${key}_video_url`]: path }));
      toast.success("Video uploaded");
    } catch (err: any) {
      toast.error(err.message || "Video upload failed");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmit = async () => {
    if (!allComplete) { toast.error("All 11 items must be complete before confirming"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const payload = {
        project_id: projectId,
        module_id: null as any,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        is_complete: true,
        ...state,
      };
      if (existing) {
        const { error } = await (client.from("site_readiness") as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("site_readiness") as any).insert(payload);
        if (error) throw error;
      }
      // Set site_ready_confirmed on the project
      await (client.from("projects") as any).update({ site_ready_confirmed: true }).eq("id", projectId);

      // Get project name for notifications
      const { data: projData } = await supabase.from("projects").select("name").eq("id", projectId).single();
      const pName = projData?.name ?? "this project";

      // Notify production_head and factory_floor_supervisor
      const { data: prodRecipients } = await supabase
        .from("profiles")
        .select("auth_user_id, role")
        .in("role", ["production_head", "factory_floor_supervisor"] as any)
        .eq("is_active", true);
      if (prodRecipients?.length) {
        await insertNotifications(prodRecipients.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Site Ready",
          body: `Site is ready for ${pName}. Complete the Delivery Checklist to proceed with dispatch.`,
          category: "Production",
          related_table: "projects",
          related_id: projectId,
          navigate_to: "/production",
        })));
      }

      // Notify stores_executive
      const { data: storesRecipients } = await supabase
        .from("profiles")
        .select("auth_user_id")
        .eq("role", "stores_executive" as any)
        .eq("is_active", true);
      if (storesRecipients?.length) {
        await insertNotifications(storesRecipients.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Site Ready — Tools Checklist",
          body: `Site is ready for ${pName}. Complete the Tools and Equipment Checklist for dispatch.`,
          category: "Production",
          related_table: "projects",
          related_id: projectId,
          navigate_to: "/production",
        })));
      }

      toast.success("Site readiness confirmed for this project!");
      onReadinessConfirmed();
      await loadExisting();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProgress = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const payload = {
        project_id: projectId,
        module_id: null as any,
        submitted_by: user.id,
        is_complete: false,
        ...state,
      };
      if (existing) {
        const { error } = await (client.from("site_readiness") as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("site_readiness") as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Progress saved");
      await loadExisting();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof ChecklistState, val: any) => setState((p) => ({ ...p, [key]: val }));

  if (loading) return null;

  if (existing?.is_complete) {
    return (
      <Card className="border-[#006039]/30" style={{ backgroundColor: "#F0FFF4" }}>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#006039" }}>
            <Check className="h-4 w-4" /> Site Readiness Confirmed
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <p className="text-xs" style={{ color: "#666666" }}>
            Confirmed at {existing.submitted_at ? format(new Date(existing.submitted_at), "dd/MM/yyyy HH:mm") : "—"}
          </p>
          {existing.dry_run_video_url && (
            <button
              type="button"
              onClick={async () => {
                const url = await getSignedUrl(VIDEO_BUCKET, existing.dry_run_video_url);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
                else toast.error("You don't have access to this video");
              }}
              className="text-xs font-medium flex items-center gap-1 mt-2" style={{ color: "#006039" }}>
              <Eye className="h-3.5 w-3.5" /> View Dry Run Video
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!canManage) return null;

  const SectionHeader = ({ title, done, total }: { title: string; done: number; total: number }) => (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{title}</h3>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: done === total ? "#E8F2ED" : "#F5F5F5", color: done === total ? "#006039" : "#666666" }}>
        {done} of {total} complete
      </span>
    </div>
  );

  const progressPct = Math.round((totalComplete / 11) * 100);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} />
          Site Readiness Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs" style={{ color: "#666666" }}>
            <span>Overall Progress</span>
            <span className="font-medium" style={{ color: allComplete ? "#006039" : "#1A1A1A" }}>{totalComplete} of 11 items</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="border rounded-lg p-3" style={{ borderColor: "#E5E5E5" }}>
          <SectionHeader title="Section 1 — Site Preparation" done={section1Count} total={5} />
          <div className="space-y-2.5">
            {PREP_ITEMS.map((it) => (
              <PrepItem
                key={it.key}
                label={it.label}
                checked={state[it.key]}
                onCheck={(v) => set(it.key, v)}
                notes={state[`${it.key}_notes` as keyof ChecklistState] as string}
                onNotes={(v) => set(`${it.key}_notes` as keyof ChecklistState, v)}
                photos={state[`${it.key}_photo_urls` as keyof ChecklistState] as string[]}
                onAddPhotos={(files) => handlePrepPhotos(it.key, files)}
                onRemovePhoto={(idx) => set(
                  `${it.key}_photo_urls` as keyof ChecklistState,
                  (state[`${it.key}_photo_urls` as keyof ChecklistState] as string[]).filter((_, i) => i !== idx),
                )}
                video={state[`${it.key}_video_url` as keyof ChecklistState] as string}
                onVideo={(file) => handlePrepVideo(it.key, file)}
                onRemoveVideo={() => set(`${it.key}_video_url` as keyof ChecklistState, "")}
                signed={signed}
                busy={busyKey === it.key}
              />
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-3" style={{ borderColor: "#E5E5E5" }}>
          <SectionHeader title="Section 2 — Dry Run" done={section2Count} total={1} />
          <div className="space-y-2">
            <p className="text-xs" style={{ color: "#666666" }}>
              Upload a video showing crane placement, material unloading, truck movement, truck placement, and planned installation day actions.
            </p>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            {state.dry_run_video_url ? (
              <div className="flex items-center gap-3 p-2 rounded-md" style={{ backgroundColor: "#F0FFF4" }}>
                <Video className="h-5 w-5 shrink-0" style={{ color: "#006039" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "#006039" }}>Video uploaded ✅</p>
                </div>
                <a href={signed[state.dry_run_video_url] ?? "#"} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium flex items-center gap-1 shrink-0" style={{ color: "#006039" }}>
                  <Eye className="h-3.5 w-3.5" /> View
                </a>
                <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => fileRef.current?.click()}>
                  Replace
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload Dry Run Video"}
              </Button>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-3" style={{ borderColor: "#E5E5E5" }}>
          <SectionHeader title="Section 3 — Logistics & Arrangements" done={section3Count} total={5} />
          <div className="space-y-3">
            <div>
              <CheckItem checked={state.labour_stay} onCheck={(v) => set("labour_stay", v)} label="Labour Stay" />
              {state.labour_stay && (
                <Textarea placeholder="Notes on labour stay arrangements…" value={state.labour_stay_notes}
                  onChange={(e) => set("labour_stay_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>
            <div>
              <CheckItem checked={state.labour_food} onCheck={(v) => set("labour_food", v)} label="Labour Food Arrangements" />
              {state.labour_food && (
                <Textarea placeholder="Notes on food arrangements…" value={state.labour_food_notes}
                  onChange={(e) => set("labour_food_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>
            <div>
              <CheckItem checked={state.dg_generator} onCheck={(v) => set("dg_generator", v)} label="DG/Generator Arrangement" />
              {state.dg_generator && (
                <Textarea placeholder="Notes on generator arrangement…" value={state.dg_generator_notes}
                  onChange={(e) => set("dg_generator_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>
            <div>
              <CheckItem checked={state.nearest_hardware_shop} onCheck={(v) => set("nearest_hardware_shop", v)} label="Nearest Hardware Shop" />
              {state.nearest_hardware_shop && (
                <div className="mt-1.5 space-y-2">
                  <Input placeholder="Shop Name" value={state.shop_name} onChange={(e) => set("shop_name", e.target.value)} className="text-sm" />
                  <Input placeholder="Address" value={state.shop_address} onChange={(e) => set("shop_address", e.target.value)} className="text-sm" />
                  <Input placeholder="Phone Number" value={state.shop_phone} onChange={(e) => set("shop_phone", e.target.value)} className="text-sm" />
                </div>
              )}
            </div>
            <div>
              <CheckItem checked={state.supervisor_stay} onCheck={(v) => set("supervisor_stay", v)} label="Supervisor Stay Arrangements" />
              {state.supervisor_stay && (
                <Textarea placeholder="Notes on supervisor stay…" value={state.supervisor_stay_notes}
                  onChange={(e) => set("supervisor_stay_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSaveProgress} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Progress
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !allComplete} className="flex-1"
            style={allComplete ? { backgroundColor: "#006039", color: "#FFFFFF" } : {}}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm Site Readiness
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
