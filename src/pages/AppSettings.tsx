import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Loader2, Save, Factory, Building2, HardHat } from "lucide-react";
import { toast } from "sonner";

const ADMIN_ROLES = ["super_admin", "managing_director"];

type LocCfg = { lat: string; lng: string; radius: string; enabled: boolean };

const FACTORY_DEFAULTS: LocCfg = { lat: "13.2696634", lng: "77.5744424", radius: "500", enabled: false };
const OFFICE_DEFAULTS: LocCfg = { lat: "", lng: "", radius: "200", enabled: false };

export default function AppSettings() {
  const { role } = useUserRole();
  const isAdmin = role && ADMIN_ROLES.includes(role);

  const [factory, setFactory] = useState<LocCfg>(FACTORY_DEFAULTS);
  const [office, setOffice] = useState<LocCfg>(OFFICE_DEFAULTS);
  const [loadingGps, setLoadingGps] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "factory_lat", "factory_lng", "factory_radius", "factory_gps_enabled",
        "office_lat", "office_lng", "office_radius", "office_gps_enabled",
      ]);
    const get = (k: string) => data?.find((s: any) => s.key === k)?.value ?? "";
    setFactory({
      lat: get("factory_lat") || FACTORY_DEFAULTS.lat,
      lng: get("factory_lng") || FACTORY_DEFAULTS.lng,
      radius: get("factory_radius") || FACTORY_DEFAULTS.radius,
      enabled: get("factory_gps_enabled") === "true",
    });
    setOffice({
      lat: get("office_lat") || "",
      lng: get("office_lng") || "",
      radius: get("office_radius") || OFFICE_DEFAULTS.radius,
      enabled: get("office_gps_enabled") === "true",
    });
    setLoaded(true);
  };

  const captureGps = async (target: "factory" | "office") => {
    setLoadingGps(target);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const lat = pos.coords.latitude.toFixed(7);
      const lng = pos.coords.longitude.toFixed(7);
      if (target === "factory") setFactory((f) => ({ ...f, lat, lng }));
      else setOffice((o) => ({ ...o, lat, lng }));
      toast.success("Location captured");
    } catch {
      toast.error("Could not get GPS. Enable location services.");
    }
    setLoadingGps(null);
  };

  const saveLocation = async (prefix: "factory" | "office", cfg: LocCfg) => {
    setSavingKey(prefix);
    const updates = [
      { key: `${prefix}_lat`, value: cfg.lat },
      { key: `${prefix}_lng`, value: cfg.lng },
      { key: `${prefix}_radius`, value: cfg.radius },
      { key: `${prefix}_gps_enabled`, value: cfg.enabled ? "true" : "false" },
    ];
    const errors: string[] = [];
    for (const u of updates) {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", u.key).maybeSingle();
      const { error } = existing
        ? await supabase.from("app_settings").update({ value: u.value }).eq("key", u.key)
        : await supabase.from("app_settings").insert({ key: u.key, value: u.value });
      if (error) errors.push(`${u.key}: ${error.message}`);
    }
    if (errors.length) toast.error(`Save failed — ${errors.join("; ")}`);
    else toast.success(`${prefix === "factory" ? "Factory" : "Office"} location saved`);
    setSavingKey(null);
  };

  const renderLocationCard = (
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    prefix: "factory" | "office",
    cfg: LocCfg,
    setCfg: (c: LocCfg) => void,
  ) => (
    <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-base font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            {icon} {title}
          </h3>
          <p className="text-xs mt-1" style={{ color: "#666" }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: cfg.enabled ? "#006039" : "#999" }}>
            {cfg.enabled ? "GPS On" : "GPS Off"}
          </span>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="space-y-1.5">
          <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Latitude</Label>
          <Input type="number" step="0.0000001" value={cfg.lat} onChange={(e) => setCfg({ ...cfg, lat: e.target.value })} placeholder="e.g. 13.2696634" className="font-inter text-[15px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Longitude</Label>
          <Input type="number" step="0.0000001" value={cfg.lng} onChange={(e) => setCfg({ ...cfg, lng: e.target.value })} placeholder="e.g. 77.5744424" className="font-inter text-[15px]" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-inter text-[11px] font-medium" style={{ color: "#666" }}>Radius (metres)</Label>
          <Input type="number" min="50" value={cfg.radius} onChange={(e) => setCfg({ ...cfg, radius: e.target.value })} placeholder="500" className="font-inter text-[15px]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => captureGps(prefix)} disabled={loadingGps === prefix} className="gap-2">
          {loadingGps === prefix ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          Use My Current Location
        </Button>
        <Button onClick={() => saveLocation(prefix, cfg)} disabled={savingKey === prefix} className="gap-2" style={{ backgroundColor: "#006039" }}>
          {savingKey === prefix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>System configuration</p>
      </div>

      {isAdmin && loaded && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold" style={{ color: "#1A1A1A" }}>Location Management</h2>
            <p className="text-xs mt-1" style={{ color: "#666" }}>
              Configure GPS coordinates for each work location. When GPS verification is disabled, employees can check in with location name only.
            </p>
          </div>

          {renderLocationCard(
            "Factory (Bengaluru)",
            "Doddaballapur unit",
            <Factory className="h-4 w-4" style={{ color: "#006039" }} />,
            "factory",
            factory,
            setFactory,
          )}

          {renderLocationCard(
            "Office (Bengaluru)",
            "Head office",
            <Building2 className="h-4 w-4" style={{ color: "#006039" }} />,
            "office",
            office,
            setOffice,
          )}

          <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 className="font-display text-base font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
              <HardHat className="h-4 w-4" style={{ color: "#D4860A" }} /> Site (project-specific)
            </h3>
            <p className="text-xs mt-2" style={{ color: "#666" }}>
              Site GPS coordinates are configured per project on the Project Detail page (Latitude, Longitude, Radius fields under Site Information). When not set, site check-ins record manually without GPS verification.
            </p>
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
