import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Check, Loader2, Factory, HardHat, Home } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ARCHITECT_ROLES = ["principal_architect", "project_architect", "structural_architect"];

interface Props {
  userRole: string | null;
}

export function CheckInButton({ userRole }: Props) {
  const { user } = useAuth();
  const { projects } = useProjectContext();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "gps" | "confirm">("type");
  const [locationType, setLocationType] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [remoteReason, setRemoteReason] = useState("");
  const [subType, setSubType] = useState<"office" | "remote">("office");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const isArchitect = userRole && ARCHITECT_ROLES.includes(userRole);

  useEffect(() => {
    if (!user || isArchitect) return;
    fetchToday();
  }, [user]);

  const fetchToday = async () => {
    if (!user) return;
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();
    setTodayRecord(data);
    setLoading(false);
  };

  if (isArchitect || !user) return null;

  const getGPS = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
    );

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleSelectType = async (type: string) => {
    setLocationType(type);
    if (type === "office") {
      setStep("confirm");
      return;
    }

    if (type === "factory" || type === "site") {
      try {
        const pos = await getGPS();
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);

        // Get reference coordinates
        let refLat = 0, refLng = 0;
        if (type === "factory") {
          const { data: settings } = await supabase.from("app_settings").select("key, value").in("key", ["factory_lat", "factory_lng"]);
          const latSetting = settings?.find((s: any) => s.key === "factory_lat");
          const lngSetting = settings?.find((s: any) => s.key === "factory_lng");
          refLat = parseFloat(latSetting?.value || "0");
          refLng = parseFloat(lngSetting?.value || "0");
        }

        if (refLat && refLng) {
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, refLat, refLng);
          if (dist <= 200) {
            setGpsVerified(true);
            setGpsWarning(false);
          } else {
            setGpsVerified(false);
            setGpsWarning(true);
          }
        } else {
          setGpsVerified(false);
          setGpsWarning(true);
        }
        setStep("confirm");
      } catch {
        toast.error("Could not get GPS location. Please enable location services.");
        setGpsWarning(true);
        setStep("confirm");
      }
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setSubmitting(true);
    const now = new Date();
    const finalLocationType = locationType === "office" ? (subType === "remote" ? "remote" : "office") : locationType;

    const record: any = {
      user_id: user.id,
      date: format(now, "yyyy-MM-dd"),
      check_in_time: now.toISOString(),
      location_type: finalLocationType,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_verified: gpsVerified,
      remote_reason: finalLocationType === "remote" ? remoteReason.trim() || null : null,
      project_id: locationType === "site" && selectedProject ? selectedProject : null,
    };

    const { error } = await supabase.from("attendance_records").insert(record);
    if (error) {
      toast.error("Check-in failed: " + error.message);
    } else {
      toast.success("Checked in successfully!");
      setOpen(false);
      resetState();
      fetchToday();
    }
    setSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setCheckingOut(true);
    const now = new Date();
    const checkIn = new Date(todayRecord.check_in_time);
    const hoursWorked = Math.round(((now.getTime() - checkIn.getTime()) / 3600000) * 100) / 100;

    const { error } = await supabase
      .from("attendance_records")
      .update({ check_out_time: now.toISOString(), hours_worked: hoursWorked })
      .eq("id", todayRecord.id);

    if (error) {
      toast.error("Check-out failed");
    } else {
      toast.success(`Checked out. ${hoursWorked.toFixed(1)} hours logged.`);
      fetchToday();
    }
    setCheckingOut(false);
  };

  const resetState = () => {
    setStep("type");
    setLocationType("");
    setSelectedProject("");
    setRemoteReason("");
    setSubType("office");
    setGpsLat(null);
    setGpsLng(null);
    setGpsVerified(false);
    setGpsWarning(false);
  };

  if (loading) return null;

  const isCheckedIn = !!todayRecord?.check_in_time;
  const isCheckedOut = !!todayRecord?.check_out_time;

  return (
    <div className="rounded-lg border border-border bg-card p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#999" }}>Today's Attendance</p>
          {isCheckedIn && (
            <p className="text-sm mt-1" style={{ color: "#666" }}>
              Checked in at {format(new Date(todayRecord.check_in_time), "hh:mm a")}
              {todayRecord.location_type && ` · ${todayRecord.location_type}`}
              {isCheckedOut && ` · ${todayRecord.hours_worked?.toFixed(1)}h`}
            </p>
          )}
        </div>
        {!isCheckedIn ? (
          <Button onClick={() => { resetState(); setOpen(true); }} style={{ backgroundColor: "#006039" }} className="text-white gap-2">
            <MapPin className="h-4 w-4" /> Check In
          </Button>
        ) : isCheckedOut ? (
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#006039" }}>
            <Check className="h-4 w-4" /> Day Complete
          </div>
        ) : (
          <Button onClick={handleCheckOut} disabled={checkingOut} variant="outline" className="gap-2" style={{ borderColor: "#006039", color: "#006039" }}>
            {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Check Out
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); setOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Check In</DialogTitle>
          </DialogHeader>

          {step === "type" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#666" }}>Where are you working today?</p>
              <button onClick={() => handleSelectType("factory")} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors">
                <Factory className="h-5 w-5" style={{ color: "#006039" }} />
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Factory</p>
                  <p className="text-xs" style={{ color: "#666" }}>Doddaballapur unit</p>
                </div>
              </button>
              <button onClick={() => { setLocationType("site"); setStep("gps"); }} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors">
                <HardHat className="h-5 w-5" style={{ color: "#D4860A" }} />
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Site</p>
                  <p className="text-xs" style={{ color: "#666" }}>Project location</p>
                </div>
              </button>
              <button onClick={() => { setLocationType("office"); setStep("gps"); }} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/10 transition-colors">
                <Home className="h-5 w-5" style={{ color: "#666" }} />
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Office / Remote</p>
                  <p className="text-xs" style={{ color: "#666" }}>No GPS required</p>
                </div>
              </button>
            </div>
          )}

          {step === "gps" && locationType === "site" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#666" }}>Select project site:</p>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => handleSelectType("site")} disabled={!selectedProject} className="w-full" style={{ backgroundColor: "#006039" }}>
                Verify Location
              </Button>
            </div>
          )}

          {step === "gps" && locationType === "office" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#666" }}>Select your work mode:</p>
              <div className="flex gap-2">
                <Button variant={subType === "office" ? "default" : "outline"} className="flex-1" style={subType === "office" ? { backgroundColor: "#006039" } : {}} onClick={() => setSubType("office")}>
                  In Office
                </Button>
                <Button variant={subType === "remote" ? "default" : "outline"} className="flex-1" style={subType === "remote" ? { backgroundColor: "#006039" } : {}} onClick={() => setSubType("remote")}>
                  Remote
                </Button>
              </div>
              {subType === "remote" && (
                <Input placeholder="Brief reason (max 100 chars)" maxLength={100} value={remoteReason} onChange={(e) => setRemoteReason(e.target.value)} className="font-inter text-[15px]" />
              )}
              <Button onClick={() => setStep("confirm")} className="w-full" style={{ backgroundColor: "#006039" }}>
                Continue
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              {gpsWarning && (
                <div className="rounded-md p-3 text-sm" style={{ backgroundColor: "#FFF3E0", color: "#D4860A" }}>
                  ⚠ You appear to be outside the expected area. You can still check in.
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span style={{ color: "#666" }}>Date</span><span style={{ color: "#1A1A1A" }}>{format(new Date(), "dd/MM/yyyy")}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>Time</span><span style={{ color: "#1A1A1A" }}>{format(new Date(), "hh:mm a")}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>Location</span><span style={{ color: "#1A1A1A" }} className="capitalize">{locationType === "office" ? subType : locationType}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>GPS</span><span style={{ color: gpsVerified ? "#006039" : "#D4860A" }}>{gpsVerified ? "Verified ✓" : "Not verified"}</span></div>
              </div>
              <Button onClick={handleCheckIn} disabled={submitting} className="w-full" style={{ backgroundColor: "#006039" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Confirm Check In
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
