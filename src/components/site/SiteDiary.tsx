import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, MapPin, BookOpen, Loader2, Plus, Cloud, Sun, CloudRain, Trash2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PhotoGuidanceCard, PhotoFeedback, PhotoQualitySummary, usePhotoWithAI } from "@/components/photos/PhotoGuidance";
import { DailyProgressSection, validatePlannedActivities, type PlannedActivity } from "@/components/site/DailyProgressSection";

interface Props {
  projectId: string;
  userRole: string | null;
}

const WEATHER_OPTIONS = [
  { value: "clear", label: "Clear", icon: Sun },
  { value: "cloudy", label: "Cloudy", icon: Cloud },
  { value: "rainy", label: "Rainy", icon: CloudRain },
];

interface SubcontractorRow { name: string; workers: string; }
interface MaterialDeliveryRow { material: string; quantity: string; supplier: string; }

export function SiteDiary({ projectId, userRole }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [notes, setNotes] = useState("");
  const [weather, setWeather] = useState("");
  const [manpower, setManpower] = useState("");
  const [blockers, setBlockers] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    photos: aiPhotos,
    guidanceCollapsed,
    addPhotos: addAIPhotos,
    removePhoto: removeAIPhoto,
    overridePhoto,
    retakePhoto,
    resetPhotos: resetAIPhotos,
    anyChecking,
    qualityMeta,
  } = usePhotoWithAI("site_diary");

  // New fields
  const [subcontractors, setSubcontractors] = useState<SubcontractorRow[]>([]);
  const [powerCuts, setPowerCuts] = useState(false);
  const [powerCutDuration, setPowerCutDuration] = useState("");
  const [clientVisit, setClientVisit] = useState(false);
  const [clientVisitName, setClientVisitName] = useState("");
  const [clientVisitPurpose, setClientVisitPurpose] = useState("");
  const [clientVisitNotes, setClientVisitNotes] = useState("");
  const [materialDeliveries, setMaterialDeliveries] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<MaterialDeliveryRow[]>([]);
  const [shareWithClient, setShareWithClient] = useState(false);
  const [milestoneTag, setMilestoneTag] = useState("");
  const [clientNote, setClientNote] = useState("");

  // Planned activities state
  const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>([]);
  const [activityErrors, setActivityErrors] = useState<Record<number, string>>({});

  const canAdd = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => { loadEntries(); }, [projectId]);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_diary")
      .select("*").eq("project_id", projectId)
      .order("entry_date", { ascending: false }).limit(50);
    setEntries(data ?? []);
    setLoading(false);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addAIPhotos(files);
  };

  const handleSubmit = async () => {
    if (aiPhotos.length < 3) { toast.error("Please add at least 3 photos"); return; }
    if (!notes.trim()) { toast.error("Work done today is required"); return; }

    // Validate planned activities
    if (plannedActivities.length > 0) {
      const { valid, errors } = validatePlannedActivities(plannedActivities);
      setActivityErrors(errors);
      if (!valid) { toast.error("Please explain shortfalls for activities below 75%"); return; }
    }

    const completedCount = plannedActivities.filter((a) => a.actual_completion_pct >= 75).length;
    const dailySummary = plannedActivities.length > 0
      ? `${completedCount} of ${plannedActivities.length} activities completed`
      : null;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let gpsLocation = "";
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        gpsLocation = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      } catch { /* GPS optional */ }

      const urls: string[] = [];
      for (const p of aiPhotos) {
        const path = `diary/${projectId}/${Date.now()}-${p.file.name}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, p.file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      const { client } = await getAuthedClient();
      const { error } = await (client.from("site_diary") as any).insert({
        project_id: projectId,
        notes: notes.trim(),
        gps_location: gpsLocation || null,
        photo_urls: urls,
        submitted_by: user.id,
        weather_condition: weather || null,
        manpower_count: manpower ? parseInt(manpower) : null,
        blockers: blockers.trim() || null,
        subcontractor_attendance: subcontractors.filter((s) => s.name.trim()),
        power_cuts: powerCuts,
        power_cut_duration: powerCuts && powerCutDuration ? parseFloat(powerCutDuration) : null,
        client_visit: clientVisit,
        client_visit_name: clientVisit ? clientVisitName.trim() || null : null,
        client_visit_purpose: clientVisit ? clientVisitPurpose.trim() || null : null,
        client_visit_notes: clientVisit ? clientVisitNotes.trim() || null : null,
        material_deliveries: materialDeliveries,
        material_delivery_items: deliveryItems.filter((d) => d.material.trim()),
        planned_activities: plannedActivities.length > 0 ? plannedActivities : null,
        daily_summary: dailySummary,
        share_with_client: shareWithClient,
        milestone_tag: milestoneTag || null,
        ...qualityMeta,
      });
      if (error) throw error;

      // If shared with client, create construction journal entry
      if (shareWithClient && clientNote.trim()) {
        const { data: latestEntry } = await client.from("site_diary").select("id")
          .eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).single();
        await (client.from("construction_journal") as any).insert({
          project_id: projectId,
          diary_entry_id: latestEntry?.id || null,
          note: clientNote.trim(),
          photo_url: urls[0] || null,
          entry_date: new Date().toISOString().slice(0, 10),
          shared_by: user.id,
          shared_by_id: user.id,
          is_approved: false,
        });
      }

      // If milestone photo shared, create milestone photo record
      if (shareWithClient && milestoneTag && urls.length > 0) {
        await (client.from("client_milestone_photos") as any).insert({
          project_id: projectId,
          milestone_name: milestoneTag,
          photo_url: urls[0],
          completed_at: new Date().toISOString(),
          shared_by: user.id,
        });
      }

      // Trigger Agent 8: Site Diary Location Photo Verify
      const { data: latestDiary } = await client.from("site_diary").select("id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).single();
      if (latestDiary?.id) {
        supabase.functions.invoke("ai-agents", { body: { agent: "site_diary_verify", payload: { diary_id: latestDiary.id } } }).catch(() => {});
      }

      toast.success("Site diary entry saved!");
      resetForm();
      await loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNotes(""); setWeather(""); setManpower(""); setBlockers("");
    resetAIPhotos(); setShowForm(false);
    setSubcontractors([]); setPowerCuts(false); setPowerCutDuration("");
    setClientVisit(false); setClientVisitName(""); setClientVisitPurpose(""); setClientVisitNotes("");
    setMaterialDeliveries(false); setDeliveryItems([]);
    setPlannedActivities([]); setActivityErrors({});
    setShareWithClient(false); setMilestoneTag(""); setClientNote("");
  };

  const weatherLabel = (val: string | null) => WEATHER_OPTIONS.find((w) => w.value === val)?.label ?? val;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Site Diary
        </h3>
        {canAdd && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Entry
          </Button>
        )}
      </div>

      {showForm && canAdd && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm text-card-foreground">
              New Diary Entry — {format(new Date(), "dd/MM/yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Daily Progress — Planned vs Actual */}
            <DailyProgressSection
              projectId={projectId}
              activities={plannedActivities}
              onChange={setPlannedActivities}
              validationErrors={activityErrors}
            />

            <div>
              <label className="text-xs font-medium text-muted-foreground">Weather Condition</label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select weather..." /></SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map((w) => (<SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Work Done Today *</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe site activity..." className="mt-1 text-sm" rows={3} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Manpower on Site</label>
              <Input type="number" min="0" value={manpower} onChange={(e) => setManpower(e.target.value)} placeholder="Number of workers" className="mt-1 text-sm" />
            </div>

            {/* Subcontractor Attendance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Subcontractor Attendance</label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSubcontractors([...subcontractors, { name: "", workers: "" }])} className="text-xs h-6">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {subcontractors.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input placeholder="Subcontractor name" value={s.name} onChange={(e) => {
                    const updated = [...subcontractors]; updated[idx].name = e.target.value; setSubcontractors(updated);
                  }} className="text-sm flex-1" />
                  <Input type="number" placeholder="Workers" value={s.workers} onChange={(e) => {
                    const updated = [...subcontractors]; updated[idx].workers = e.target.value; setSubcontractors(updated);
                  }} className="text-sm w-20" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setSubcontractors(subcontractors.filter((_, i) => i !== idx))} className="h-8 w-8 shrink-0">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Power Cuts */}
            <div className="flex items-center gap-3">
              <Switch checked={powerCuts} onCheckedChange={setPowerCuts} />
              <label className="text-xs font-medium text-muted-foreground">Power Cuts</label>
            </div>
            {powerCuts && (
              <Input type="number" step="0.5" placeholder="Duration in hours" value={powerCutDuration} onChange={(e) => setPowerCutDuration(e.target.value)} className="text-sm" />
            )}

            {/* Client Visit */}
            <div className="flex items-center gap-3">
              <Switch checked={clientVisit} onCheckedChange={setClientVisit} />
              <label className="text-xs font-medium text-muted-foreground">Client Visit</label>
            </div>
            {clientVisit && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <Input placeholder="Client name" value={clientVisitName} onChange={(e) => setClientVisitName(e.target.value)} className="text-sm" />
                <Input placeholder="Purpose of visit" value={clientVisitPurpose} onChange={(e) => setClientVisitPurpose(e.target.value)} className="text-sm" />
                <Textarea placeholder="Notes" value={clientVisitNotes} onChange={(e) => setClientVisitNotes(e.target.value)} rows={2} className="text-sm" />
              </div>
            )}

            {/* Material Deliveries */}
            <div className="flex items-center gap-3">
              <Switch checked={materialDeliveries} onCheckedChange={setMaterialDeliveries} />
              <label className="text-xs font-medium text-muted-foreground">Material Deliveries on Site</label>
            </div>
            {materialDeliveries && (
              <div className="space-y-2">
                {deliveryItems.map((d, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input placeholder="Material" value={d.material} onChange={(e) => {
                      const updated = [...deliveryItems]; updated[idx].material = e.target.value; setDeliveryItems(updated);
                    }} className="text-sm flex-1" />
                    <Input placeholder="Qty" value={d.quantity} onChange={(e) => {
                      const updated = [...deliveryItems]; updated[idx].quantity = e.target.value; setDeliveryItems(updated);
                    }} className="text-sm w-16" />
                    <Input placeholder="Supplier" value={d.supplier} onChange={(e) => {
                      const updated = [...deliveryItems]; updated[idx].supplier = e.target.value; setDeliveryItems(updated);
                    }} className="text-sm flex-1" />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))} className="h-8 w-8 shrink-0">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => setDeliveryItems([...deliveryItems, { material: "", quantity: "", supplier: "" }])} className="text-xs h-6">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Blockers / Issues (optional)</label>
              <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Any blockers..." className="mt-1 text-sm" rows={2} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Photos (minimum 3) — {aiPhotos.length} added</label>
              <PhotoGuidanceCard context="site_diary" collapsed={guidanceCollapsed} />
              <div className="flex flex-wrap gap-3 mt-2">
                {aiPhotos.map((p, idx) => (
                  <PhotoFeedback
                    key={idx}
                    photo={p}
                    onRetake={() => retakePhoto(idx)}
                    onOverride={() => overridePhoto(idx)}
                  />
                ))}
                <label className="h-20 w-20 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoAdd} />
                </label>
              </div>
              {aiPhotos.length > 0 && aiPhotos.length < 3 && (
                <p className="text-xs text-destructive mt-1">Please add at least 3 photos ({3 - aiPhotos.length} more needed)</p>
              )}
              <PhotoQualitySummary photos={aiPhotos} />
            </div>

            {/* Share with Client */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={shareWithClient} onCheckedChange={setShareWithClient} />
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5" /> Share with Client
                </label>
              </div>
              {shareWithClient && (
                <>
                  <Select value={milestoneTag} onValueChange={setMilestoneTag}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Tag as milestone photo (optional)..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Production Start", "Foundation Confirmed", "Frame Erected", "Shell Complete",
                        "Boarding Complete", "Flooring Done", "Delivery from Factory", "Site Erection",
                        "Builder Finish", "Handover"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    placeholder="Write a client-facing note (e.g. 'All 7 modules erected and levelled')"
                    className="text-sm"
                    rows={2}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    This note and photo will appear on the client portal. Write as if the client will read it.
                  </p>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">📍 GPS location auto-captured on submission</p>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={resetForm} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || aiPhotos.length < 3 || anyChecking} className="flex-1">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No diary entries yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => (
            <Card key={entry.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{format(new Date(entry.entry_date), "dd/MM/yyyy")}</span>
                    {entry.weather_condition && (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">{weatherLabel(entry.weather_condition)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.manpower_count != null && <span>👷 {entry.manpower_count}</span>}
                    {entry.power_cuts && <span>⚡ Power cut {entry.power_cut_duration}h</span>}
                    {entry.client_visit && <span>🤝 Client visit</span>}
                    {entry.gps_location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {entry.gps_location}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  {entry.photo_urls?.length > 0 && (
                    <a href={entry.photo_urls[0]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={entry.photo_urls[0]} alt="Site photo" className="h-16 w-16 rounded object-cover border border-border" />
                    </a>
                  )}
                  <div className="min-w-0 flex-1">
                    {entry.notes && <p className="text-sm text-foreground/80 line-clamp-2">{entry.notes}</p>}
                    {entry.blockers && <p className="text-xs text-destructive mt-1">⚠️ {entry.blockers}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
