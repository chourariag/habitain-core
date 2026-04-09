import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Factory, CircleCheck, CircleAlert, CircleX } from "lucide-react";

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation",
  "Drywall", "Paint", "MEP Final", "Windows & Doors",
  "Finishing", "QC Inspection", "Dispatch",
];

const EARLY = PRODUCTION_STAGES.slice(0, 3);
const MIDDLE = PRODUCTION_STAGES.slice(3, 7);
const LATE = PRODUCTION_STAGES.slice(7, 10);

const INDOOR_BAYS = 10;
const OUTDOOR_BAYS = 8;

interface Props {
  userRole: string | null;
}

export function FactoryCapacityCard({ userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [early, setEarly] = useState(0);
  const [middle, setMiddle] = useState(0);
  const [late, setLate] = useState(0);
  const [indoorUsed, setIndoorUsed] = useState(0);
  const [outdoorUsed, setOutdoorUsed] = useState(0);

  const ALLOWED = ["production_head", "head_operations", "managing_director", "super_admin",
    "finance_director", "sales_director", "architecture_director", "planning_engineer"];

  useEffect(() => {
    loadCapacity();
  }, []);

  async function loadCapacity() {
    setLoading(true);

    // Get all active modules
    const { data: modules } = await supabase
      .from("modules")
      .select("id, current_stage, production_status")
      .eq("is_archived", false)
      .not("production_status", "in", "(completed,dispatched)");

    const mods = modules ?? [];
    let e = 0, m = 0, l = 0;
    for (const mod of mods) {
      const stage = mod.current_stage ?? "";
      if (EARLY.includes(stage)) e++;
      else if (MIDDLE.includes(stage)) m++;
      else if (LATE.includes(stage)) l++;
    }
    setEarly(e);
    setMiddle(m);
    setLate(l);

    // Bay assignments
    const { data: bays } = await supabase
      .from("bay_assignments")
      .select("bay_type, bay_number")
      .order("bay_number");

    let indoor = 0, outdoor = 0;
    const seenBays = new Set<string>();
    for (const b of bays ?? []) {
      const key = `${b.bay_type}-${b.bay_number}`;
      if (seenBays.has(key)) continue;
      seenBays.add(key);
      if (b.bay_type === "outdoor") outdoor++;
      else indoor++;
    }
    setIndoorUsed(indoor);
    setOutdoorUsed(outdoor);
    setLoading(false);
  }

  if (!ALLOWED.includes(userRole ?? "")) return null;

  if (loading) return (
    <Card><CardContent className="p-4 flex justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#666" }} />
    </CardContent></Card>
  );

  const total = early + middle + late;

  // Go/No-Go
  const goStatus = indoorUsed >= INDOOR_BAYS ? "red" : indoorUsed >= 8 ? "amber" : "green";
  const goConfig = {
    green: { icon: CircleCheck, label: "Factory can accept a new project", color: "#006039", bg: "#E8F2ED" },
    amber: { icon: CircleAlert, label: "Factory is near capacity — discuss before committing", color: "#D4860A", bg: "#FFF8E8" },
    red: { icon: CircleX, label: "Factory is at full capacity — do not commit new project", color: "#F40009", bg: "#FFF0F0" },
  };
  const go = goConfig[goStatus];
  const GoIcon = go.icon;

  function CapacityBar({ label, count, maxGuide }: { label: string; count: number; maxGuide: number }) {
    const pct = maxGuide > 0 ? Math.min((count / maxGuide) * 100, 100) : 0;
    const isHigh = pct > 70;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-display font-medium" style={{ color: "#1A1A1A" }}>{label}</span>
          <span className="font-bold" style={{ color: isHigh ? "#D4860A" : "#006039" }}>{count} modules</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#E0E0E0" }}>
          <div className="h-full rounded-full transition-all" style={{
            width: `${pct}%`,
            backgroundColor: isHigh ? "#D4860A" : "#006039",
          }} />
        </div>
      </div>
    );
  }

  return (
    <Card style={{ border: "1px solid #E0E0E0" }}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5" style={{ color: "#006039" }} />
          <h3 className="font-display text-sm font-bold" style={{ color: "#1A1A1A" }}>Factory Capacity</h3>
          <Badge className="ml-auto text-[10px]" style={{ backgroundColor: "#F7F7F7", color: "#666", border: "none" }}>
            {total} active modules
          </Badge>
        </div>

        {/* Stage group bars */}
        <div className="space-y-3">
          <CapacityBar label="Early Stages (1-3)" count={early} maxGuide={Math.max(total, 6)} />
          <CapacityBar label="Middle Stages (4-7)" count={middle} maxGuide={Math.max(total, 6)} />
          <CapacityBar label="Late Stages (8-10)" count={late} maxGuide={Math.max(total, 6)} />
        </div>

        {/* Bay usage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md p-2 text-center" style={{ backgroundColor: "#F7F7F7" }}>
            <p className="text-lg font-bold font-display" style={{ color: indoorUsed >= 9 ? "#F40009" : "#1A1A1A" }}>
              {indoorUsed}/{INDOOR_BAYS}
            </p>
            <p className="text-[10px]" style={{ color: "#666" }}>Indoor Bays</p>
          </div>
          <div className="rounded-md p-2 text-center" style={{ backgroundColor: "#F7F7F7" }}>
            <p className="text-lg font-bold font-display" style={{ color: outdoorUsed >= 7 ? "#D4860A" : "#1A1A1A" }}>
              {outdoorUsed}/{OUTDOOR_BAYS}
            </p>
            <p className="text-[10px]" style={{ color: "#666" }}>Outdoor Bays</p>
          </div>
        </div>

        {/* Go/No-Go */}
        <div className="rounded-md p-3 flex items-center gap-2" style={{ backgroundColor: go.bg }}>
          <GoIcon className="h-5 w-5 shrink-0" style={{ color: go.color }} />
          <p className="text-xs font-display font-bold" style={{ color: go.color }}>{go.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
