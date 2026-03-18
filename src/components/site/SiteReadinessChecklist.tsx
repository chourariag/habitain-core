import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, ClipboardCheck, Upload, Video, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  moduleId: string;
  userRole: string | null;
  onReadinessConfirmed: () => void;
}

interface ChecklistState {
  // Section 1 - Site Preparation
  foundation_ready: boolean;
  crane_booked: boolean;
  site_access_clear: boolean;
  team_briefed: boolean;
  safety_equipment: boolean;
  // Section 2 - Dry Run
  dry_run_video_url: string;
  // Section 3 - Logistics
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
  labour_stay: false, labour_stay_notes: "", labour_food: false, labour_food_notes: "",
  dg_generator: false, dg_generator_notes: "", nearest_hardware_shop: false,
  shop_name: "", shop_address: "", shop_phone: "",
  supervisor_stay: false, supervisor_stay_notes: "",
};

export function SiteReadinessChecklist({ moduleId, userRole, onReadinessConfirmed }: Props) {
  const [state, setState] = useState<ChecklistState>(INITIAL_STATE);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canManage = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? "");

  // Completion counts
  const section1Count = [state.foundation_ready, state.crane_booked, state.site_access_clear, state.team_briefed, state.safety_equipment].filter(Boolean).length;
  const section2Count = state.dry_run_video_url ? 1 : 0;
  const section3Count = [state.labour_stay, state.labour_food, state.dg_generator, state.nearest_hardware_shop, state.supervisor_stay].filter(Boolean).length;
  const totalComplete = section1Count + section2Count + section3Count;
  const allComplete = totalComplete === 11;

  useEffect(() => { loadExisting(); }, [moduleId]);

  const loadExisting = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_readiness" as any)
      .select("*")
      .eq("module_id", moduleId)
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
      const path = `${moduleId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("dry-run-videos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("dry-run-videos").getPublicUrl(path);
      setState((p) => ({ ...p, dry_run_video_url: urlData.publicUrl }));
      toast.success("Video uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
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
        module_id: moduleId,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        is_complete: true,
        ...state,
      };
      if (existing) {
        const { error } = await (client.from("site_readiness" as any) as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("site_readiness" as any) as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Site readiness confirmed!");
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
        module_id: moduleId,
        submitted_by: user.id,
        is_complete: false,
        ...state,
      };
      if (existing) {
        const { error } = await (client.from("site_readiness" as any) as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("site_readiness" as any) as any).insert(payload);
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
            <a href={existing.dry_run_video_url} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium flex items-center gap-1 mt-2" style={{ color: "#006039" }}>
              <Eye className="h-3.5 w-3.5" /> View Dry Run Video
            </a>
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

  const CheckItem = ({ checked, onCheck, label }: { checked: boolean; onCheck: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheck(!!v)} />
      <span className="text-sm" style={{ color: "#1A1A1A" }}>{label}</span>
      {checked && <Check className="h-3.5 w-3.5 ml-auto" style={{ color: "#006039" }} />}
    </label>
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
        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs" style={{ color: "#666666" }}>
            <span>Overall Progress</span>
            <span className="font-medium" style={{ color: allComplete ? "#006039" : "#1A1A1A" }}>{totalComplete} of 11 items</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Section 1 — Site Preparation */}
        <div className="border rounded-lg p-3" style={{ borderColor: "#E5E5E5" }}>
          <SectionHeader title="Section 1 — Site Preparation" done={section1Count} total={5} />
          <div className="space-y-1">
            <CheckItem checked={state.foundation_ready} onCheck={(v) => set("foundation_ready", v)} label="Foundation Ready" />
            <CheckItem checked={state.crane_booked} onCheck={(v) => set("crane_booked", v)} label="Crane Booked" />
            <CheckItem checked={state.site_access_clear} onCheck={(v) => set("site_access_clear", v)} label="Site Access Clear" />
            <CheckItem checked={state.team_briefed} onCheck={(v) => set("team_briefed", v)} label="Team Briefed" />
            <CheckItem checked={state.safety_equipment} onCheck={(v) => set("safety_equipment", v)} label="Safety Equipment on Site" />
          </div>
        </div>

        {/* Section 2 — Dry Run */}
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
                <a href={state.dry_run_video_url} target="_blank" rel="noopener noreferrer"
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

        {/* Section 3 — Logistics & Arrangements */}
        <div className="border rounded-lg p-3" style={{ borderColor: "#E5E5E5" }}>
          <SectionHeader title="Section 3 — Logistics & Arrangements" done={section3Count} total={5} />
          <div className="space-y-3">
            {/* Labour Stay */}
            <div>
              <CheckItem checked={state.labour_stay} onCheck={(v) => set("labour_stay", v)} label="Labour Stay" />
              {state.labour_stay && (
                <Textarea placeholder="Notes on labour stay arrangements…" value={state.labour_stay_notes}
                  onChange={(e) => set("labour_stay_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>

            {/* Labour Food */}
            <div>
              <CheckItem checked={state.labour_food} onCheck={(v) => set("labour_food", v)} label="Labour Food Arrangements" />
              {state.labour_food && (
                <Textarea placeholder="Notes on food arrangements…" value={state.labour_food_notes}
                  onChange={(e) => set("labour_food_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>

            {/* DG/Generator */}
            <div>
              <CheckItem checked={state.dg_generator} onCheck={(v) => set("dg_generator", v)} label="DG/Generator Arrangement" />
              {state.dg_generator && (
                <Textarea placeholder="Notes on generator arrangement…" value={state.dg_generator_notes}
                  onChange={(e) => set("dg_generator_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>

            {/* Nearest Hardware Shop */}
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

            {/* Supervisor Stay */}
            <div>
              <CheckItem checked={state.supervisor_stay} onCheck={(v) => set("supervisor_stay", v)} label="Supervisor Stay Arrangements" />
              {state.supervisor_stay && (
                <Textarea placeholder="Notes on supervisor stay…" value={state.supervisor_stay_notes}
                  onChange={(e) => set("supervisor_stay_notes", e.target.value)} className="mt-1.5 text-sm" rows={2} />
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
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
