import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LabourHoursPanel() {
  const [hours, setHours] = useState("8");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void supabase.rpc("get_labour_standard_hours").then(({ data }) => { if (data != null) setHours(String(data)); }); }, []);
  const save = async () => {
    const n = Number(hours);
    if (!(n > 0 && n <= 16)) { toast.error("Standard hours must be more than 0 and at most 16."); return; }
    setSaving(true);
    const { error } = await supabase.rpc("set_labour_standard_hours", { p_hours: n });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Standard shift hours saved.");
  };
  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold">Labour standard shift</h3>
      <p className="mt-1 text-xs text-muted-foreground">Hours given to workers marked Present in the morning, before evening confirmation.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label htmlFor="labour-std-hours">Standard hours</Label><Input id="labour-std-hours" type="number" min={0.5} max={16} step="0.5" className="w-28" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <Button onClick={save} disabled={saving}>Save</Button>
      </div>
    </div>
  );
}
