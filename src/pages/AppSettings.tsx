import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const ADMIN_ROLES = ["super_admin", "managing_director"];

export default function AppSettings() {
  const { role } = useUserRole();
  const isAdmin = role && ADMIN_ROLES.includes(role);

  const [factoryLat, setFactoryLat] = useState("");
  const [factoryLng, setFactoryLng] = useState("");
  const [factoryRadius, setFactoryRadius] = useState("200");
  const [loadingGps, setLoadingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["factory_lat", "factory_lng", "factory_radius"]);
    if (data) {
      data.forEach((s: any) => {
        if (s.key === "factory_lat") setFactoryLat(s.value || "");
        if (s.key === "factory_lng") setFactoryLng(s.value || "");
        if (s.key === "factory_radius") setFactoryRadius(s.value || "200");
      });
    }
    setLoaded(true);
  };

  const handleUseCurrentLocation = async () => {
    setLoadingGps(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      setFactoryLat(pos.coords.latitude.toFixed(6));
      setFactoryLng(pos.coords.longitude.toFixed(6));
      toast.success("Location captured");
    } catch {
      toast.error("Could not get GPS. Enable location services.");
    }
    setLoadingGps(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { key: "factory_lat", value: factoryLat },
      { key: "factory_lng", value: factoryLng },
      { key: "factory_radius", value: factoryRadius },
    ];
    for (const u of updates) {
      await supabase.from("app_settings").update({ value: u.value }).eq("key", u.key);
    }
    toast.success("Factory location saved");
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>System configuration</p>
      </div>

      {isAdmin && loaded && (
        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold flex items-center gap-2 mb-4" style={{ color: "#1A1A1A" }}>
            <MapPin className="h-4 w-4" style={{ color: "#006039" }} /> Factory Location
          </h2>
          <p className="text-xs mb-4" style={{ color: "#666" }}>
            Set the GPS coordinates for the Doddaballapur factory. Employees checking in at Factory will be verified against this location.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Latitude</Label>
              <Input type="number" step="0.000001" value={factoryLat} onChange={(e) => setFactoryLat(e.target.value)} placeholder="e.g. 13.3622" className="font-inter text-[15px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Longitude</Label>
              <Input type="number" step="0.000001" value={factoryLng} onChange={(e) => setFactoryLng(e.target.value)} placeholder="e.g. 77.5401" className="font-inter text-[15px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Radius (metres)</Label>
              <Input type="number" min="50" value={factoryRadius} onChange={(e) => setFactoryRadius(e.target.value)} placeholder="200" className="font-inter text-[15px]" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleUseCurrentLocation} disabled={loadingGps} className="gap-2">
              {loadingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Use My Current Location
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2" style={{ backgroundColor: "#006039" }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-card rounded-lg p-8 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <p className="text-sm" style={{ color: "#999" }}>Settings are managed by administrators.</p>
        </div>
      )}
    </div>
  );
}
