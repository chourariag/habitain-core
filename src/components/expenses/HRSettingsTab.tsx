import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Cake, Gift } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, differenceInDays, addYears, isBefore, isAfter, startOfDay } from "date-fns";
import { toast } from "sonner";

export function HRSettingsTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [settings, setSettings] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [newCarRate, setNewCarRate] = useState("");
  const [newBikeRate, setNewBikeRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isHR = role === "hr_executive" || role === "super_admin" || role === "managing_director";
  const canApprove = ["finance_director", "managing_director", "super_admin"].includes(role || "");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("hr_settings").select("*"),
      supabase.from("profiles").select("auth_user_id, display_name, date_of_birth, wedding_anniversary, children, role, is_active").eq("is_active", true),
    ]);
    setSettings(s ?? []);
    setProfiles(p ?? []);
    setLoading(false);
  };

  const getSetting = (key: string) => settings.find((s) => s.key === key);
  const carSetting = getSetting("car_rate_per_km");
  const bikeSetting = getSetting("bike_rate_per_km");

  const handlePropose = async () => {
    if (!newCarRate || !newBikeRate || !effectiveDate) {
      toast.error("Fill all fields");
      return;
    }
    if (Number(newCarRate) <= 0 || Number(newBikeRate) <= 0) {
      toast.error("Rates must be greater than 0");
      return;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    if (effectiveDate < today) {
      toast.error("Effective date cannot be in the past");
      return;
    }
    setSubmitting(true);
    // Create pending proposals
    for (const [key, val] of [["car_rate_per_km", newCarRate], ["bike_rate_per_km", newBikeRate]]) {
      await supabase.from("hr_settings").update({
        proposed_value: val,
        proposed_by: user?.id,
        effective_date: effectiveDate,
        status: "pending_approval",
      } as any).eq("key", key);
    }
    toast.success("Rate change proposed — awaiting Director & MD approval");
    setProposeOpen(false);
    setSubmitting(false);
    fetchData();
  };

  const handleApprove = async (key: string) => {
    const setting = getSetting(key);
    if (!setting) return;
    const field = !setting.approval1_by ? "approval1_by" : "approval2_by";
    const atField = !setting.approval1_by ? "approval1_at" : "approval2_at";

    const updates: any = { [field]: user?.id, [atField]: new Date().toISOString() };

    // If second approval, activate the new rate
    if (setting.approval1_by) {
      updates.value = setting.proposed_value;
      updates.status = "active";
      updates.proposed_value = null;
    }

    await supabase.from("hr_settings").update(updates).eq("key", key);
    toast.success(setting.approval1_by ? "Rate change activated ✓" : "First approval recorded");
    fetchData();
  };

  // Celebrations — upcoming 30 days
  const today = startOfDay(new Date());
  const thirtyDaysLater = new Date(today.getTime() + 30 * 86400000);

  const celebrations: { name: string; type: string; date: Date; emoji: string }[] = [];
  profiles.forEach((p) => {
    if (p.date_of_birth) {
      const bday = new Date(p.date_of_birth);
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (!isBefore(thisYear, today) && isBefore(thisYear, thirtyDaysLater)) {
        celebrations.push({ name: p.display_name || "—", type: "Birthday", date: thisYear, emoji: "🎂" });
      }
    }
    if (p.wedding_anniversary) {
      const ann = new Date(p.wedding_anniversary);
      const thisYear = new Date(today.getFullYear(), ann.getMonth(), ann.getDate());
      if (!isBefore(thisYear, today) && isBefore(thisYear, thirtyDaysLater)) {
        celebrations.push({ name: p.display_name || "—", type: "Anniversary", date: thisYear, emoji: "💍" });
      }
    }
    if (p.children && Array.isArray(p.children)) {
      (p.children as any[]).forEach((child: any) => {
        if (child.dob) {
          const cd = new Date(child.dob);
          const thisYear = new Date(today.getFullYear(), cd.getMonth(), cd.getDate());
          if (!isBefore(thisYear, today) && isBefore(thisYear, thirtyDaysLater)) {
            celebrations.push({ name: `${child.name} (${p.display_name}'s child)`, type: "Birthday", date: thisYear, emoji: "⭐" });
          }
        }
      });
    }
  });
  celebrations.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Conveyance Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" /> Conveyance Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md p-3 border border-border" style={{ backgroundColor: "#F7F7F7" }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Car Rate</p>
              <p className="text-xl font-bold font-display mt-1" style={{ color: "#006039" }}>₹{carSetting?.value || "9.5"}/km</p>
              {carSetting?.status === "pending_approval" && (
                <div className="mt-2 text-xs" style={{ color: "#D4860A" }}>
                  Proposed: ₹{carSetting.proposed_value}/km
                  {canApprove && !carSetting.approval1_by && (
                    <Button size="sm" className="ml-2 h-5 text-[10px]" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove("car_rate_per_km")}>Approve</Button>
                  )}
                  {canApprove && carSetting.approval1_by && !carSetting.approval2_by && carSetting.approval1_by !== user?.id && (
                    <Button size="sm" className="ml-2 h-5 text-[10px]" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove("car_rate_per_km")}>2nd Approve</Button>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-md p-3 border border-border" style={{ backgroundColor: "#F7F7F7" }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Bike Rate</p>
              <p className="text-xl font-bold font-display mt-1" style={{ color: "#006039" }}>₹{bikeSetting?.value || "3.5"}/km</p>
              {bikeSetting?.status === "pending_approval" && (
                <div className="mt-2 text-xs" style={{ color: "#D4860A" }}>
                  Proposed: ₹{bikeSetting.proposed_value}/km
                  {canApprove && !bikeSetting.approval1_by && (
                    <Button size="sm" className="ml-2 h-5 text-[10px]" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove("bike_rate_per_km")}>Approve</Button>
                  )}
                  {canApprove && bikeSetting.approval1_by && !bikeSetting.approval2_by && bikeSetting.approval1_by !== user?.id && (
                    <Button size="sm" className="ml-2 h-5 text-[10px]" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove("bike_rate_per_km")}>2nd Approve</Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isHR && (
            <Button size="sm" variant="outline" onClick={() => setProposeOpen(true)} className="text-xs">
              Propose Rate Change
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Leave Entitlements placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave Entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs" style={{ color: "#999" }}>Configure in Phase 5 — leave balance tracking and auto-deduction coming soon.</p>
        </CardContent>
      </Card>

      {/* Celebrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Upcoming Celebrations (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {celebrations.length === 0 ? (
            <p className="text-xs" style={{ color: "#999" }}>No upcoming celebrations.</p>
          ) : (
            <div className="space-y-2">
              {celebrations.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border bg-white text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{c.emoji}</span>
                    <div>
                      <p className="font-medium" style={{ color: "#1A1A1A" }}>{c.name}</p>
                      <p style={{ color: "#666" }}>{c.type}</p>
                    </div>
                  </div>
                  <p className="font-inter" style={{ color: "#006039" }}>{format(c.date, "dd MMM")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Propose Rate Change Sheet */}
      <Sheet open={proposeOpen} onOpenChange={setProposeOpen}>
        <SheetContent className="w-full sm:max-w-[380px]">
          <SheetHeader>
            <SheetTitle className="font-display">Propose Rate Change</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label className="text-xs font-inter" style={{ color: "#666" }}>New Car Rate (₹/km)</Label>
              <Input type="number" step="0.5" value={newCarRate} onChange={(e) => setNewCarRate(e.target.value)} className="mt-1 font-inter" />
            </div>
            <div>
              <Label className="text-xs font-inter" style={{ color: "#666" }}>New Bike Rate (₹/km)</Label>
              <Input type="number" step="0.5" value={newBikeRate} onChange={(e) => setNewBikeRate(e.target.value)} className="mt-1 font-inter" />
            </div>
            <div>
              <Label className="text-xs font-inter" style={{ color: "#666" }}>Effective From</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-1 font-inter" />
            </div>
            <div>
              <Label className="text-xs font-inter" style={{ color: "#666" }}>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 font-inter" />
            </div>
            <Button onClick={handlePropose} disabled={submitting} className="w-full text-white" style={{ backgroundColor: "#006039" }}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Proposal
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
