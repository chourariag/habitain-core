import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const STAGE_NAMES: Record<number, string> = {
  1: "Sub-Frame", 2: "MEP Rough-In", 3: "Insulation", 4: "Drywall",
  5: "Paint", 6: "MEP Final", 7: "Windows & Doors", 8: "Finishing",
  9: "QC Inspection", 10: "Dispatch",
};

interface Confirmation {
  id: string;
  project_id: string;
  module_id: string;
  stage_number: number;
  stage_start_date: string;
  status: string;
  materials_confirmed: string | null;
  materials_missing: string | null;
  missing_eta: string | null;
  confirmed_at: string | null;
  project_name?: string;
}

export function MaterialAvailabilityGate() {
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [shortageId, setShortageId] = useState<string | null>(null);
  const [missingText, setMissingText] = useState("");
  const [missingEta, setMissingEta] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("material_availability_confirmations")
      .select("*, projects(name)")
      .in("status", ["pending", "escalated"])
      .order("stage_start_date", { ascending: true });

    const rows = (data || []).map((r: any) => ({
      ...r,
      project_name: r.projects?.name || "—",
    }));
    setConfirmations(rows);
    setLoading(false);
  }

  async function handleConfirm(id: string) {
    setActionId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("material_availability_confirmations") as any)
        .update({
          status: "confirmed",
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          materials_confirmed: "All materials available",
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Materials confirmed — production can proceed");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleShortage(id: string) {
    if (!missingText.trim()) { toast.error("Please specify missing materials"); return; }
    setActionId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("material_availability_confirmations") as any)
        .update({
          status: "shortage",
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          materials_missing: missingText.trim(),
          missing_eta: missingEta || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Shortage reported — teams notified");
      setShortageId(null);
      setMissingText("");
      setMissingEta("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) return null;
  if (confirmations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5" style={{ color: "#D4860A" }} />
        <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>
          Material Availability Gate
        </h2>
        <Badge style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
          {confirmations.length} pending
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {confirmations.map((c) => {
          const daysUntil = differenceInDays(new Date(c.stage_start_date), new Date());
          const urgencyColor = daysUntil <= 1 ? "#F40009" : daysUntil <= 3 ? "#D4860A" : "#006039";
          const isExpanded = shortageId === c.id;

          return (
            <Card key={c.id} className="border-l-4" style={{ borderLeftColor: urgencyColor, borderColor: "#E0E0E0" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>
                      {STAGE_NAMES[c.stage_number] || `Stage ${c.stage_number}`}
                    </p>
                    <p className="text-xs" style={{ color: "#666666" }}>
                      {c.module_id} · {c.project_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" style={{ color: urgencyColor }} />
                    <span className="text-xs font-semibold" style={{ color: urgencyColor }}>
                      {daysUntil <= 0 ? "Overdue" : `${daysUntil}d to start`}
                    </span>
                  </div>
                </div>

                <p className="text-xs" style={{ color: "#666666" }}>
                  Planned start: {format(new Date(c.stage_start_date), "dd/MM/yyyy")}
                </p>

                {c.status === "escalated" && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Escalated — no response in 24h
                  </Badge>
                )}

                {isExpanded ? (
                  <div className="space-y-2 pt-1">
                    <div>
                      <Label className="text-xs">Which materials are missing? *</Label>
                      <Textarea
                        value={missingText}
                        onChange={(e) => setMissingText(e.target.value)}
                        placeholder="e.g. 50mm steel C-sections, HVAC ducting"
                        className="mt-1 text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Expected arrival date</Label>
                      <Input
                        type="date"
                        value={missingEta}
                        onChange={(e) => setMissingEta(e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleShortage(c.id)}
                        disabled={actionId === c.id}
                      >
                        Report Shortage
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShortageId(null); setMissingText(""); setMissingEta(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(c.id)}
                      disabled={actionId === c.id}
                      style={{ backgroundColor: "#006039", color: "#fff" }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Available
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShortageId(c.id)}
                      style={{ borderColor: "#F40009", color: "#F40009" }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Not Available
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
