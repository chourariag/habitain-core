import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, Send, Save, Video, Upload, Unlock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { insertNotifications } from "@/lib/notifications";

interface Step { stepNo: number; description: string; team: string; durationHrs: number; notes: string; }
interface Risk { risk: string; likelihood: "Low" | "Med" | "High"; impact: "Low" | "Med" | "High"; mitigation: string; }
interface Equip { name: string; have: boolean; }

interface Props { projectId: string; projectName: string; }

const DEFAULT_EQUIP: Equip[] = [
  { name: "Crane (rigging certified)", have: false },
  { name: "Lifting slings", have: false },
  { name: "Spreader bar", have: false },
  { name: "Spirit level / laser level", have: false },
  { name: "Torque wrench", have: false },
  { name: "Shackles & chains", have: false },
];

const READINESS_KEYS = [
  { k: "civil_works", label: "Civil works complete" },
  { k: "foundation_bolts", label: "Foundation bolts in position" },
  { k: "access_road", label: "Access road clear" },
  { k: "crane_booked", label: "Crane booked" },
  { k: "temporary_power", label: "Temporary power available" },
] as const;

export function InstallationSequenceV2({ projectId, projectName }: Props) {
  const { role, userId } = useUserRole();
  const isAwaiz = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? "");
  const isMD = ["super_admin", "managing_director"].includes(role ?? "");

  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleNo, setModuleNo] = useState("");
  const [cranePosition, setCranePosition] = useState("");
  const [craneType, setCraneType] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ stepNo: 1, description: "", team: "", durationHrs: 1, notes: "" }]);
  const [equipment, setEquipment] = useState<Equip[]>(DEFAULT_EQUIP);
  const [safety, setSafety] = useState("");
  const [risks, setRisks] = useState<Risk[]>([]);
  const [readiness, setReadiness] = useState<Record<string, boolean>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [dispatchDate, setDispatchDate] = useState<Date | null>(null);

  const submitted = !!doc?.submitted_at && !doc?.unlocked_by_md_at;
  const locked = submitted;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tasks } = await supabase
      .from("project_tasks").select("planned_finish_date,task_name")
      .eq("project_id", projectId).ilike("task_name", "%dispatch%")
      .order("planned_finish_date", { ascending: true }).limit(1);
    const d = tasks?.[0]?.planned_finish_date;
    setDispatchDate(d ? new Date(d) : null);

    const { data } = await (supabase.from("installation_sequence_docs") as any)
      .select("*").eq("project_id", projectId).maybeSingle();
    setDoc(data);
    if (data) {
      setModuleNo(data.module_no ?? "");
      setCranePosition(data.crane_position ?? "");
      setCraneType(data.crane_type ?? "");
      if (Array.isArray(data.erection_sequence) && data.erection_sequence.length) setSteps(data.erection_sequence);
      if (Array.isArray(data.equipment_tools) && data.equipment_tools.length) setEquipment(data.equipment_tools);
      setSafety(data.safety_requirements ?? "");
      if (Array.isArray(data.risk_register)) setRisks(data.risk_register);
      if (data.site_readiness && typeof data.site_readiness === "object") setReadiness(data.site_readiness);
      setVideoUrl(data.video_url);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const daysUntilDispatch = dispatchDate ? Math.ceil((dispatchDate.getTime() - Date.now()) / 86400000) : null;

  const addStep = () => setSteps((s) => [...s, { stepNo: s.length + 1, description: "", team: "", durationHrs: 1, notes: "" }]);
  const updateStep = (i: number, k: keyof Step, v: any) => setSteps((s) => s.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, stepNo: idx + 1 })));
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((s) => {
      const next = [...s]; const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((x, idx) => ({ ...x, stepNo: idx + 1 }));
    });
  };

  const addRisk = () => setRisks((r) => [...r, { risk: "", likelihood: "Med", impact: "Med", mitigation: "" }]);
  const updateRisk = (i: number, k: keyof Risk, v: any) => setRisks((r) => r.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const removeRisk = (i: number) => setRisks((r) => r.filter((_, idx) => idx !== i));

  const addEquip = () => setEquipment((e) => [...e, { name: "", have: false }]);
  const updateEquip = (i: number, k: keyof Equip, v: any) => setEquipment((e) => e.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const removeEquip = (i: number) => setEquipment((e) => e.filter((_, idx) => idx !== i));

  const uploadVideo = async (file: File) => {
    setUploadingVideo(true);
    try {
      const path = `dry-run/${projectId}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("dry-run-videos").upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from("dry-run-videos").getPublicUrl(path).data.publicUrl;
      setVideoUrl(url);
      toast.success("Video uploaded");
    } catch (e: any) { toast.error(e.message); } finally { setUploadingVideo(false); }
  };

  const persist = async (markSubmitted: boolean) => {
    if (locked) return toast.error("Locked. Request unlock from MD.");
    if (markSubmitted) {
      if (!cranePosition.trim() || !craneType.trim()) return toast.error("Crane position and type required");
      if (steps.filter((s) => s.description.trim()).length === 0) return toast.error("Add at least one step");
    }
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      const payload: any = {
        project_id: projectId,
        module_no: moduleNo.trim() || null,
        crane_position: cranePosition.trim(),
        crane_type: craneType.trim(),
        erection_sequence: steps.filter((s) => s.description.trim()),
        equipment_tools: equipment.filter((e) => e.name.trim()),
        safety_requirements: safety.trim() || null,
        risk_register: risks.filter((r) => r.risk.trim()),
        site_readiness: readiness,
        video_url: videoUrl,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
      };
      if (markSubmitted) {
        payload.submitted_at = new Date().toISOString();
        payload.submitted_by = userId;
        payload.unlocked_by_md_at = null;
      }
      if (doc) {
        const { error } = await (client.from("installation_sequence_docs") as any).update(payload).eq("id", doc.id);
        if (error) throw error;
      } else {
        const { error } = await (client.from("installation_sequence_docs") as any).insert(payload);
        if (error) throw error;
      }
      if (markSubmitted) {
        const { data: notify } = await supabase.from("profiles").select("auth_user_id")
          .in("role", ["production_head", "head_operations", "site_engineer"] as any).eq("is_active", true);
        if (notify?.length) {
          await insertNotifications(notify.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Installation Sequence Submitted",
            body: `${projectName} — sequence locked. Awaiz can request unlock from MD.`,
            category: "Production", related_table: "installation_sequence_docs",
            navigate_to: "/dispatch-delivery",
          })));
        }
      }
      toast.success(markSubmitted ? "Submitted and locked" : "Saved");
      await load();
    } catch (e: any) { toast.error(e.message || "Save failed"); } finally { setSaving(false); }
  };

  const requestUnlock = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("installation_sequence_docs") as any)
        .update({ unlock_requested_at: new Date().toISOString() }).eq("id", doc.id);
      const { data: mds } = await supabase.from("profiles").select("auth_user_id")
        .in("role", ["managing_director", "super_admin"] as any).eq("is_active", true);
      if (mds?.length) {
        await insertNotifications(mds.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Unlock requested — Installation Sequence",
          body: `Awaiz has requested unlock for ${projectName}.`,
          category: "Production", related_table: "installation_sequence_docs",
          related_id: doc.id, navigate_to: "/dispatch-delivery",
        })));
      }
      toast.success("Unlock requested from MD");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const mdUnlock = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const { client } = await getAuthedClient();
      await (client.from("installation_sequence_docs") as any)
        .update({ unlocked_by_md_at: new Date().toISOString(), submitted_at: null }).eq("id", doc.id);
      toast.success("Unlocked — Awaiz can now edit");
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const canEdit = isAwaiz && !locked;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-bold">Installation Sequence — Stage 3</h2>
        {locked
          ? <Badge style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }} className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
          : <Badge style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>Editable</Badge>}
      </div>

      {dispatchDate && daysUntilDispatch !== null && daysUntilDispatch > 14 && (
        <div className="rounded-md p-3 text-xs flex gap-2" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
          <AlertTriangle className="h-4 w-4" />
          <div>Dispatch in {daysUntilDispatch} days. Form opens automatically at T-14 days. You can still draft now.</div>
        </div>
      )}

      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Project & Module</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Label className="text-xs">Project</Label><Input value={projectName} disabled className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Module No.</Label><Input value={moduleNo} onChange={(e) => setModuleNo(e.target.value)} disabled={!canEdit} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Crane Position*</Label><Input value={cranePosition} onChange={(e) => setCranePosition(e.target.value)} disabled={!canEdit} placeholder="e.g. NW corner of plot" className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Crane Type*</Label><Input value={craneType} onChange={(e) => setCraneType(e.target.value)} disabled={!canEdit} placeholder="e.g. 50T mobile crane" className="mt-1 text-sm" /></div>
        </CardContent></Card>

      <Card><CardHeader className="py-3 flex flex-row items-center justify-between"><CardTitle className="text-sm">Erection Sequence</CardTitle>
        {canEdit && <Button size="sm" variant="outline" onClick={addStep} className="gap-1"><Plus className="h-3 w-3" /> Add Step</Button>}
      </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left" style={{ color: "#666" }}>
              <th className="py-1 pr-2 w-10">#</th><th className="py-1 pr-2">Description</th><th className="py-1 pr-2">Subcontractor / Team</th><th className="py-1 pr-2">Hrs</th><th className="py-1 pr-2">Notes</th><th className="w-24"></th>
            </tr></thead>
            <tbody>{steps.map((s, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2 font-bold">{s.stepNo}</td>
                <td className="py-1 pr-2"><Input value={s.description} onChange={(e) => updateStep(i, "description", e.target.value)} disabled={!canEdit} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2"><Input value={s.team} onChange={(e) => updateStep(i, "team", e.target.value)} disabled={!canEdit} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2"><Input type="number" min={0} step={0.5} value={s.durationHrs} onChange={(e) => updateStep(i, "durationHrs", Number(e.target.value))} disabled={!canEdit} className="h-7 text-xs w-16" /></td>
                <td className="py-1 pr-2"><Input value={s.notes} onChange={(e) => updateStep(i, "notes", e.target.value)} disabled={!canEdit} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2 flex gap-1">
                  {canEdit && <>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStep(i, -1)}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStep(i, 1)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeStep(i)}><Trash2 className="h-3 w-3" /></Button>
                  </>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent></Card>

      <Card><CardHeader className="py-3 flex flex-row items-center justify-between"><CardTitle className="text-sm">Equipment & Tools</CardTitle>
        {canEdit && <Button size="sm" variant="outline" onClick={addEquip} className="gap-1"><Plus className="h-3 w-3" /> Add</Button>}
      </CardHeader>
        <CardContent className="space-y-1.5">
          {equipment.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox checked={e.have} onCheckedChange={(v) => updateEquip(i, "have", !!v)} disabled={!canEdit} />
              <Input value={e.name} onChange={(ev) => updateEquip(i, "name", ev.target.value)} disabled={!canEdit} className="h-7 text-xs flex-1" />
              {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeEquip(i)}><Trash2 className="h-3 w-3" /></Button>}
            </div>
          ))}
        </CardContent></Card>

      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Safety Requirements</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={safety} onChange={(e) => setSafety(e.target.value)} disabled={!canEdit} className="text-sm" />
        </CardContent></Card>

      <Card><CardHeader className="py-3 flex flex-row items-center justify-between"><CardTitle className="text-sm">Risk Register</CardTitle>
        {canEdit && <Button size="sm" variant="outline" onClick={addRisk} className="gap-1"><Plus className="h-3 w-3" /> Add Risk</Button>}
      </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left" style={{ color: "#666" }}>
              <th className="py-1 pr-2">Risk</th><th className="py-1 pr-2">Likelihood</th><th className="py-1 pr-2">Impact</th><th className="py-1 pr-2">Mitigation</th><th></th>
            </tr></thead>
            <tbody>{risks.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2"><Input value={r.risk} onChange={(e) => updateRisk(i, "risk", e.target.value)} disabled={!canEdit} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2">
                  <Select value={r.likelihood} onValueChange={(v) => updateRisk(i, "likelihood", v)} disabled={!canEdit}>
                    <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Med">Med</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
                  </Select>
                </td>
                <td className="py-1 pr-2">
                  <Select value={r.impact} onValueChange={(v) => updateRisk(i, "impact", v)} disabled={!canEdit}>
                    <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Med">Med</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
                  </Select>
                </td>
                <td className="py-1 pr-2"><Input value={r.mitigation} onChange={(e) => updateRisk(i, "mitigation", e.target.value)} disabled={!canEdit} className="h-7 text-xs" /></td>
                <td className="py-1 pr-2">{canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeRisk(i)}><Trash2 className="h-3 w-3" /></Button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {risks.length === 0 && <p className="text-xs text-muted-foreground py-2">No risks recorded.</p>}
        </CardContent></Card>

      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Site Readiness Checklist</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {READINESS_KEYS.map(({ k, label }) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!readiness[k]} disabled={!canEdit}
                onCheckedChange={(v) => setReadiness((r) => ({ ...r, [k]: !!v }))} />
              <span>{label}</span>
            </label>
          ))}
        </CardContent></Card>

      <Card><CardHeader className="py-3"><CardTitle className="text-sm">Dry Run Video (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {videoUrl ? (
            <div className="flex items-center gap-2 text-xs"><Video className="h-3 w-3" />
              <a href={videoUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: "#006039" }}>View video</a>
            </div>
          ) : <p className="text-xs text-muted-foreground">No video uploaded.</p>}
          {canEdit && (
            <label className="cursor-pointer inline-block">
              <Button size="sm" variant="outline" className="gap-1" disabled={uploadingVideo} asChild>
                <span>{uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload Video</span>
              </Button>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
            </label>
          )}
        </CardContent></Card>

      {/* Actions */}
      <div className="sticky bottom-0 bg-white border-t py-3 flex flex-col sm:flex-row gap-2">
        {!locked && isAwaiz && (
          <>
            <Button variant="outline" className="flex-1 gap-1" onClick={() => persist(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
            </Button>
            <Button className="flex-1 gap-1" style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
              onClick={() => persist(true)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit & Lock
            </Button>
          </>
        )}
        {locked && isAwaiz && !doc?.unlock_requested_at && (
          <Button variant="outline" className="gap-1" onClick={requestUnlock} disabled={saving}>
            <Unlock className="h-4 w-4" /> Request unlock from MD
          </Button>
        )}
        {locked && doc?.unlock_requested_at && !isMD && (
          <p className="text-xs text-muted-foreground">Unlock requested {format(new Date(doc.unlock_requested_at), "dd/MM/yyyy HH:mm")} — awaiting MD.</p>
        )}
        {locked && isMD && (
          <Button className="gap-1" style={{ backgroundColor: "#D4860A", color: "#FFFFFF" }} onClick={mdUnlock} disabled={saving}>
            <Unlock className="h-4 w-4" /> Unlock for Awaiz
          </Button>
        )}
      </div>
    </div>
  );
}
