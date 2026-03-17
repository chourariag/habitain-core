import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, MapPin, BookOpen, Loader2, Plus, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  userRole: string | null;
}

export function SiteDiary({ projectId, userRole }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [notes, setNotes] = useState("");
  const [gpsLocation, setGpsLocation] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

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

  const getGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setGettingLocation(false);
      },
      (err) => {
        toast.error("Could not get location: " + err.message);
        setGettingLocation(false);
      }
    );
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = [...photos, ...files];
    const newPreviews = [...photoPreviews, ...files.map((f) => URL.createObjectURL(f))];
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (photos.length < 3) {
      toast.error("Minimum 3 photos required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
        notes: notes.trim() || null,
        gps_location: gpsLocation || null,
        photo_urls: urls,
        submitted_by: user.id,
      });
      if (error) throw error;

      toast.success("Site diary entry saved!");
      setNotes("");
      setGpsLocation("");
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
              <label className="text-xs font-medium text-card-foreground/70">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Site activity notes..."
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-card-foreground/70">GPS Location</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={gpsLocation}
                  onChange={(e) => setGpsLocation(e.target.value)}
                  placeholder="Lat, Long"
                  className="text-sm flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={getGPS}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                </Button>
              </div>
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
                  {3 - photos.length} more photo(s) required
                </p>
              )}
            </div>

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
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-card-foreground">
                    {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                  </span>
                  {entry.gps_location && (
                    <span className="text-xs text-card-foreground/50 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {entry.gps_location}
                    </span>
                  )}
                </div>
                {entry.notes && (
                  <p className="text-sm text-card-foreground/80">{entry.notes}</p>
                )}
                {entry.photo_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(entry.photo_urls as string[]).map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${idx + 1}`} className="h-16 w-16 rounded object-cover border border-border hover:ring-2 ring-primary/50 transition" />
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
