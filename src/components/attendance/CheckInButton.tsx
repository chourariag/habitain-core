import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useConnectionStatus } from "@/components/OfflineProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Check, Loader2, Factory, HardHat, Home, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { saveOfflineRecord, type OfflineAttendanceRecord } from "@/lib/offline-attendance";

interface Props {
  userRole: string | null;
}

export function CheckInButton({ userRole }: Props) {
  const { user } = useAuth();
  const { projects } = useProjectContext();
  const connectionStatus = useConnectionStatus();
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
  const [gpsNotConfigured, setGpsNotConfigured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [offlineCheckedIn, setOfflineCheckedIn] = useState(false);
  const [locationNote, setLocationNote] = useState("");

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
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
    setOfflineCheckedIn(false);
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
    setGpsNotConfigured(false);
    if (type === "office") {
      setStep("confirm");
      return;
    }

    if (type === "factory" || type === "site") {
      try {
        const pos = await getGPS();
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);

        let refLat = 0, refLng = 0, radius = 200;
        if (type === "factory") {
          const { data: settings } = await supabase.from("app_settings").select("key, value").in("key", ["factory_lat", "factory_lng", "factory_radius"]);
          const latVal = settings?.find((s: any) => s.key === "factory_lat")?.value;
          const lngVal = settings?.find((s: any) => s.key === "factory_lng")?.value;
          const radVal = settings?.find((s: any) => s.key === "factory_radius")?.value;
          refLat = parseFloat(latVal || "0");
          refLng = parseFloat(lngVal || "0");
          radius = parseInt(radVal || "200") || 200;

          if (!latVal || !lngVal || latVal === "" || lngVal === "") {
            setGpsNotConfigured(true);
            setGpsVerified(false);
            setStep("confirm");
            return;
          }
        } else if (type === "site" && selectedProject) {
          const { data: proj } = await supabase.from("projects").select("site_lat, site_lng, site_radius").eq("id", selectedProject).maybeSingle();
          if (proj) {
            refLat = parseFloat(String((proj as any).site_lat || "0"));
            refLng = parseFloat(String((proj as any).site_lng || "0"));
            radius = parseInt(String((proj as any).site_radius || "300")) || 300;
          }
          if (!refLat && !refLng) {
            setGpsNotConfigured(true);
            setGpsVerified(false);
            setStep("confirm");
            return;
          }
        }

        if (refLat && refLng) {
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, refLat, refLng);
          setGpsVerified(dist <= radius);
          setGpsWarning(dist > radius);
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

    if (connectionStatus === "offline") {
      const offlineRec: OfflineAttendanceRecord = {
        id: crypto.randomUUID(),
        ...record,
        action: "check_in",
        offline_captured: true,
        created_at: now.toISOString(),
      };
      await saveOfflineRecord(offlineRec);
      toast.success("Saved Offline ✓ — will sync when connected", { style: { backgroundColor: "#D4860A", color: "#fff" } });
      setTodayRecord({ ...record, check_in_time: now.toISOString(), id: offlineRec.id });
      setOfflineCheckedIn(true);
      setOpen(false);
      resetState();
    } else {
      const { error } = await supabase.from("attendance_records").insert(record);
      if (error) {
        toast.error("Check-in failed: " + error.message);
      } else {
        toast.success("Checked in successfully!");
        setOpen(false);
        resetState();
        fetchToday();
      }
    }
    setSubmitting(false);
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setCheckingOut(true);
    const now = new Date();
    const checkIn = new Date(todayRecord.check_in_time);
    const hoursWorked = Math.round(((now.getTime() - checkIn.getTime()) / 3600000) * 100) / 100;

    if (connectionStatus === "offline") {
      const offlineRec: OfflineAttendanceRecord = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        date: format(now, "yyyy-MM-dd"),
        check_out_time: now.toISOString(),
        location_type: todayRecord.location_type,
        gps_verified: false,
        hours_worked: hoursWorked,
        action: "check_out",
        attendance_record_id: todayRecord.id,
        created_at: now.toISOString(),
      };
      await saveOfflineRecord(offlineRec);
      toast.success("Saved Offline ✓ — will sync when connected", { style: { backgroundColor: "#D4860A", color: "#fff" } });
      setTodayRecord({ ...todayRecord, check_out_time: now.toISOString(), hours_worked: hoursWorked });
    } else {
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
    setGpsNotConfigured(false);
  };

  if (loading) return null;

  const isCheckedIn = !!todayRecord?.check_in_time;
  const isCheckedOut = !!todayRecord?.check_out_time;

  // Calculate live hours
  const liveHours = isCheckedIn && !isCheckedOut
    ? Math.round(((currentTime.getTime() - new Date(todayRecord.check_in_time).getTime()) / 3600000) * 10) / 10
    : 0;

  // === THREE VISUAL STATES ===
  if (!isCheckedIn) {
    // NOT CHECKED IN
    return (
      <>
        <div className="rounded-lg p-4 md:p-5" style={{ backgroundColor: "#006039", boxShadow: "0 2px 8px rgba(0,96,57,0.3)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">You haven't checked in yet</p>
              <p className="text-white/60 text-xs mt-1 font-inter">{format(currentTime, "EEEE, dd MMM · hh:mm a")}</p>
            </div>
            <Button onClick={() => { resetState(); setOpen(true); }} className="gap-2 font-display font-bold" style={{ backgroundColor: "#fff", color: "#006039" }}>
              Check In Now <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {renderDialog()}
      </>
    );
  }

  if (isCheckedOut) {
    // CHECKED OUT — DONE
    return (
      <div className="rounded-lg p-4" style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" style={{ color: "#666" }} />
            <p className="text-sm font-semibold" style={{ color: "#666" }}>
              Done for today · {todayRecord.hours_worked?.toFixed(1)}h worked
            </p>
          </div>
          <p className="text-xs" style={{ color: "#999" }}>
            {format(new Date(todayRecord.check_in_time), "hh:mm a")} — {format(new Date(todayRecord.check_out_time), "hh:mm a")}
          </p>
        </div>
      </div>
    );
  }

  // CHECKED IN — ACTIVE
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "#E8F2ED", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#006039" }}>
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            Checked in at {format(new Date(todayRecord.check_in_time), "hh:mm a")} · {todayRecord.location_type}
            {offlineCheckedIn && <span className="ml-2 text-[10px] font-medium" style={{ color: "#D4860A" }}>📵 Offline</span>}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#006039" }}>{liveHours.toFixed(1)}h worked so far</p>
        </div>
        <Button onClick={handleCheckOut} disabled={checkingOut} variant="outline" className="gap-2 font-display" style={{ borderColor: "#006039", color: "#006039" }}>
          {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Check Out
        </Button>
      </div>
    </div>
  );

  function renderDialog() {
    return (
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
              {gpsNotConfigured && (
                <div className="rounded-md p-3 text-sm" style={{ backgroundColor: "#FFF3E0", color: "#D4860A" }}>
                  ⚠ {locationType === "factory" ? "Factory" : "Site"} GPS not set up. Contact Admin to configure location verification.
                </div>
              )}
              {gpsWarning && !gpsNotConfigured && (
                <div className="rounded-md p-3 text-sm" style={{ backgroundColor: "#FFF3E0", color: "#D4860A" }}>
                  ⚠ You appear to be outside the expected area. You can still check in.
                </div>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span style={{ color: "#666" }}>Date</span><span style={{ color: "#1A1A1A" }}>{format(new Date(), "dd/MM/yyyy")}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>Time</span><span style={{ color: "#1A1A1A" }}>{format(new Date(), "hh:mm a")}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>Location</span><span style={{ color: "#1A1A1A" }} className="capitalize">{locationType === "office" ? subType : locationType}</span></div>
                <div className="flex justify-between"><span style={{ color: "#666" }}>GPS</span><span style={{ color: gpsNotConfigured ? "#D4860A" : gpsVerified ? "#006039" : "#D4860A" }}>{gpsNotConfigured ? "Not configured" : gpsVerified ? "Verified ✓" : "Not verified"}</span></div>
              </div>
              <Button onClick={handleCheckIn} disabled={submitting} className="w-full" style={{ backgroundColor: "#006039" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Confirm Check In
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
}
