import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, MapPin, BookOpen, Loader2, Plus, Cloud, Sun, CloudRain } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  userRole: string | null;
}

const WEATHER_OPTIONS = [
  { value: "clear", label: "Clear", icon: Sun },
  { value: "cloudy", label: "Cloudy", icon: Cloud },
  { value: "rainy", label: "Rainy", icon: CloudRain },
];

export function SiteDiary({ projectId, userRole }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [notes, setNotes] = useState("");
  const [weather, setWeather] = useState("");
  const [manpower, setManpower] = useState("");
  const [blockers, setBlockers] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canAdd = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  useEffect(() => {
    loadEntries();
  }, [projectId]);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await (supabase.from("site_diary" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("entry_date", { ascending: false })
      .limit(50);
    setEntries((data as any[]) ?? []);
    setLoading(false);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (photos.length < 3) {
      toast.error("Please add at least 3 photos");
      return;
    }
    if (!notes.trim()) {
      toast.error("Work done today is required");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Auto-capture GPS
      let gpsLocation = "";
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        gpsLocation = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
      } catch {
        // GPS optional — continue without it
      }

      // Upload photos
      const urls: string[] = [];
      for (const photo of photos) {
        const path = `diary/${projectId}/${Date.now()}-${photo.name}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, photo);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      const { client } = await getAuthedClient();
      const { error } = await (client.from("site_diary" as any) as any).insert({
        project_id: projectId,
        notes: notes.trim(),
        gps_location: gpsLocation || null,
        photo_urls: urls,
        submitted_by: user.id,
        weather_condition: weather || null,
        manpower_count: manpower ? parseInt(manpower) : null,
        blockers: blockers.trim() || null,
      });
      if (error) throw error;

      toast.success("Site diary entry saved!");
      setNotes("");
      setWeather("");
      setManpower("");
      setBlockers("");
      setPhotos([]);
      setPhotoPreviews([]);
      setShowForm(false);
      await loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
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

      {/* New entry form */}
      {showForm && canAdd && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm text-card-foreground">
              New Diary Entry — {format(new Date(), "dd/MM/yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-card-foreground/70">Weather Condition</label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select weather..." />
                </SelectTrigger>
                <SelectContent>
                  {WEATHER_OPTIONS.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-card-foreground/70">Work Done Today *</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe site activity and progress..."
                className="mt-1 text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-card-foreground/70">Manpower on Site</label>
              <Input
                type="number"
                min="0"
                value={manpower}
                onChange={(e) => setManpower(e.target.value)}
                placeholder="Number of workers"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-card-foreground/70">Blockers / Issues (optional)</label>
              <Textarea
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any blockers or issues..."
                className="mt-1 text-sm"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-card-foreground/70">
                Photos (minimum 3) — {photos.length} added
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {photoPreviews.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img src={url} alt={`Photo ${idx + 1}`} className="h-16 w-16 rounded object-cover border border-border" />
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center"
                      onClick={() => removePhoto(idx)}
                    >×</button>
                  </div>
                ))}
                <label className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoAdd} />
                </label>
              </div>
              {photos.length > 0 && photos.length < 3 && (
                <p className="text-xs text-destructive mt-1">
                  Please add at least 3 photos ({3 - photos.length} more needed)
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">📍 GPS location will be auto-captured on submission</p>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || photos.length < 3} className="flex-1">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-card-foreground/60">No diary entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => (
            <Card key={entry.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-card-foreground">
                      {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                    </span>
                    {entry.weather_condition && (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">
                        {weatherLabel(entry.weather_condition)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-card-foreground/50">
                    {entry.manpower_count != null && (
                      <span>👷 {entry.manpower_count}</span>
                    )}
                    {entry.gps_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {entry.gps_location}
                      </span>
                    )}
                  </div>
                </div>

                {/* First photo thumbnail + notes excerpt */}
                <div className="flex gap-3">
                  {entry.photo_urls?.length > 0 && (
                    <a href={entry.photo_urls[0]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={entry.photo_urls[0]} alt="Site photo" className="h-16 w-16 rounded object-cover border border-border" />
                    </a>
                  )}
                  <div className="min-w-0 flex-1">
                    {entry.notes && (
                      <p className="text-sm text-card-foreground/80 line-clamp-2">{entry.notes}</p>
                    )}
                    {entry.blockers && (
                      <p className="text-xs text-destructive mt-1">⚠️ {entry.blockers}</p>
                    )}
                  </div>
                </div>

                {/* Additional photos */}
                {entry.photo_urls?.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {(entry.photo_urls as string[]).slice(1).map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${idx + 2}`} className="h-12 w-12 rounded object-cover border border-border hover:ring-2 ring-primary/50 transition" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
