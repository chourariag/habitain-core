import { useState } from "react";
import { MapPin, LocateFixed, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSitePin, outsideIndia, parseSitePin, siteMapUrl, type SiteLocation } from "@/lib/project-location";

export function SiteLocationFields({ value, onChange }: { value: SiteLocation; onChange: (value: SiteLocation) => void }) {
  const [paste, setPaste] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const update = (key: keyof SiteLocation, text: string) => onChange({ ...value, [key]: text });
  const pin = hasSitePin(value.site_lat, value.site_lng);
  const gps = () => {
    if (!navigator.geolocation) { toast.error("Location access is unavailable in this browser"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      onChange({ ...value, site_lat: String(coords.latitude), site_lng: String(coords.longitude) });
      setAccuracy(coords.accuracy); setLocating(false);
    }, () => { setLocating(false); toast.error("Allow location access and try again"); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  return <fieldset className="min-w-0 space-y-3">
    <legend className="mb-3 flex items-center gap-2 font-display font-semibold"><MapPin className="h-4 w-4" />Site location</legend>
    <div className="space-y-1.5"><Label htmlFor="site-address">Site address *</Label><Input id="site-address" required value={value.location} onChange={e => update("location", e.target.value)} /></div>
    <Button type="button" variant="outline" className="min-h-11 w-full gap-2" disabled={locating} onClick={gps}>{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Use my current location</Button>
    {accuracy !== null && <p className="break-words text-xs text-muted-foreground" role="status">Coordinates: {value.site_lat}, {value.site_lng} · Accuracy: ±{Math.round(accuracy)} m</p>}
    <div className="space-y-1.5"><Label htmlFor="site-pin-paste">Google Maps link or lat, lng</Label><Input id="site-pin-paste" value={paste} onChange={e => setPaste(e.target.value)} placeholder="12.9716, 77.5946" /><Button type="button" variant="outline" className="min-h-11" onClick={() => { const parsed = parseSitePin(paste); if (!parsed) { toast.error("Paste coordinates or a full Google Maps link containing coordinates. Open shortened links in Maps first."); return; } onChange({ ...value, site_lat: String(parsed.lat), site_lng: String(parsed.lng) }); setAccuracy(null); }}>Use pin</Button></div>
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <div className="min-w-0 space-y-1.5"><Label htmlFor="site-latitude">Latitude *</Label><Input id="site-latitude" type="number" step="any" min={-90} max={90} required value={value.site_lat} onChange={e => { update("site_lat", e.target.value); setAccuracy(null); }} /></div>
      <div className="min-w-0 space-y-1.5"><Label htmlFor="site-longitude">Longitude *</Label><Input id="site-longitude" type="number" step="any" min={-180} max={180} required value={value.site_lng} onChange={e => { update("site_lng", e.target.value); setAccuracy(null); }} /></div>
    </div>
    {pin && <a className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline" href={siteMapUrl(value.site_lat, value.site_lng)} target="_blank" rel="noopener noreferrer">Open in Google Maps<ExternalLink className="h-4 w-4" /></a>}
    {pin && outsideIndia(Number(value.site_lat), Number(value.site_lng)) && <p className="text-sm text-warning" role="status">This pin appears outside India. Please verify the location.</p>}
    <div className="space-y-1.5"><Label htmlFor="site-radius">Attendance radius (metres) *</Label><Input id="site-radius" type="number" min={50} max={1000} step={1} required value={value.site_radius} onChange={e => update("site_radius", e.target.value)} /><p className="text-xs text-muted-foreground">Staff and site engineers can check in only within this distance of the pin.</p></div>
  </fieldset>;
}