import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SKILL_TYPES = [
  "Fabrication/Welding",
  "Wall Panelling",
  "General Labour",
  "Electrical",
  "Plumbing",
  "Painting",
  "Tiling",
  "Other",
];

// Default daily rates per skill type (₹/day, 8-hour day)
const DEFAULT_DAILY_RATES: Record<string, number> = {
  "Fabrication/Welding": 1200,
  "Wall Panelling": 1000,
  "General Labour": 700,
  "Electrical": 1100,
  "Plumbing": 1000,
  "Painting": 900,
  "Tiling": 1000,
  "Other": 800,
};

interface Props {
  moduleId: string;
  ncrId: string;
  ncrNumber: string;
  projectId: string;
  userRole: string | null;
}

export function ReworkLogSection({ moduleId, ncrId, ncrNumber, projectId, userRole }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [workerName, setWorkerName] = useState("");
  const [skillType, setSkillType] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [taskDesc, setTaskDesc] = useState("");

  const canLog = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(userRole ?? "");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("rework_log_entries") as any)
      .select("*")
      .eq("ncr_id", ncrId)
      .order("log_date", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [ncrId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleSubmit = async () => {
    if (!workerName.trim() || !skillType || !hoursWorked) {
      toast.error("Worker name, skill type, and hours are required");
      return;
    }
    const hrs = parseFloat(hoursWorked);
    if (isNaN(hrs) || hrs <= 0) { toast.error("Invalid hours"); return; }

    const dailyRate = DEFAULT_DAILY_RATES[skillType] ?? 800;
    const cost = (hrs * dailyRate) / 8;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { client } = await getAuthedClient();

      const { error } = await (client.from("rework_log_entries") as any).insert({
        ncr_id: ncrId,
        project_id: projectId,
        module_id: moduleId,
        log_date: new Date().toISOString().split("T")[0],
        worker_name: workerName.trim(),
        skill_type: skillType,
        hours_worked: hrs,
        daily_rate_used: dailyRate,
        rework_cost: Math.round(cost),
        task_description: taskDesc.trim() || null,
        logged_by: user?.id ?? null,
      });
      if (error) throw error;

      // Update NCR totals
      const { data: allEntries } = await (supabase.from("rework_log_entries") as any)
        .select("hours_worked, rework_cost")
        .eq("ncr_id", ncrId);
      const totalHours = (allEntries ?? []).reduce((s: number, e: any) => s + (e.hours_worked ?? 0), 0);
      const totalCost = (allEntries ?? []).reduce((s: number, e: any) => s + (e.rework_cost ?? 0), 0);

      await (client.from("ncr_register") as any).update({
        total_rework_hours: totalHours,
        total_rework_cost: totalCost,
      }).eq("id", ncrId);

      toast.success("Rework entry logged");
      setWorkerName(""); setSkillType(""); setHoursWorked(""); setTaskDesc("");
      setShowForm(false);
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to log rework");
    } finally {
      setSubmitting(false);
    }
  };

  const totalHours = entries.reduce((s: number, e: any) => s + (e.hours_worked ?? 0), 0);
  const totalCost = entries.reduce((s: number, e: any) => s + (e.rework_cost ?? 0), 0);

  return (
    <Card className="border-destructive/30">
      <CardHeader className="py-2 px-4">
        <CardTitle className="text-xs flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Rework — {ncrNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <>
            {entries.length > 0 && (
              <div className="space-y-1.5">
                {entries.map((e: any) => (
                  <div key={e.id} className="bg-destructive/5 rounded p-2 text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">{e.worker_name} · {e.skill_type}</span>
                      <span className="text-muted-foreground">{format(new Date(e.log_date), "dd/MM/yyyy")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{e.hours_worked}h @ ₹{e.daily_rate_used}/day</span>
                      <span className="font-semibold text-destructive">₹{e.rework_cost?.toLocaleString("en-IN")}</span>
                    </div>
                    {e.task_description && <p className="text-muted-foreground">{e.task_description}</p>}
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border">
                  <span>Total: {totalHours.toFixed(1)} hours</span>
                  <span className="text-destructive">₹{totalCost.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}

            {canLog && !showForm && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="text-xs w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Log Rework Entry
              </Button>
            )}

            {showForm && (
              <div className="space-y-2 border border-border rounded-md p-3">
                <Input placeholder="Worker Name *" value={workerName} onChange={e => setWorkerName(e.target.value)} className="text-sm" />
                <Select value={skillType} onValueChange={setSkillType}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Skill Type *" /></SelectTrigger>
                  <SelectContent>
                    {SKILL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Hours Worked *" value={hoursWorked} onChange={e => setHoursWorked(e.target.value)} className="text-sm" step="0.5" min="0.5" />
                {skillType && hoursWorked && (
                  <p className="text-[10px] text-muted-foreground">
                    Rate: ₹{DEFAULT_DAILY_RATES[skillType] ?? 800}/day → Cost: ₹{Math.round((parseFloat(hoursWorked || "0") * (DEFAULT_DAILY_RATES[skillType] ?? 800)) / 8).toLocaleString("en-IN")}
                  </p>
                )}
                <Textarea placeholder="Task description (optional)" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="text-sm min-h-[50px]" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                  <Button size="sm" onClick={handleSubmit} disabled={submitting} className="flex-1">
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Save
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
