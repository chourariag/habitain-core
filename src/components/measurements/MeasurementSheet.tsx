import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  fetchBoqItems,
  fetchPreviouslyRecordedMap,
  buildMeasurementRows,
  recomputeRow,
  submitMeasurement,
  type MeasurementRow,
  type MeasurementLocation,
} from "@/lib/measurement-helpers";
import { computeMeasurementAnomalies, type AnomalyFlag } from "@/lib/measurement-anomalies";
import { format } from "date-fns";

type Props = {
  location: MeasurementLocation;
  /** When set, the row's trade column filters BOQ items (for Mohan / Venugopal). */
  forceTrade?: "general" | "electrical" | "plumbing";
};

const INR = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function MeasurementSheet({ location, forceTrade }: Props) {
  const { selectedProjectId } = useProjectContext();
  const { userId, role } = useUserRole();

  const [modules, setModules] = useState<Array<{ id: string; module_id: string; current_stage: string | null }>>([]);
  const [moduleId, setModuleId] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyFlag[]>([]);
  const today = format(new Date(), "dd/MM/yyyy");

  const trade: "general" | "electrical" | "plumbing" =
    forceTrade
      ? forceTrade
      : role === "electrical_installer"
        ? "electrical"
        : role === "elec_plumbing_installer"
          ? "plumbing"
          : "general";

  // Load modules for factory; not needed for site
  useEffect(() => {
    if (!selectedProjectId || location !== "factory") { setModules([]); return; }
    (async () => {
      const { data } = await supabase
        .from("modules")
        .select("id, module_id, current_stage")
        .eq("project_id", selectedProjectId)
        .eq("is_archived", false)
        .order("module_id");
      setModules((data ?? []) as any[]);
    })();
  }, [selectedProjectId, location]);

  // When module changes, default the stage
  useEffect(() => {
    if (location !== "factory") return;
    const m = modules.find((x) => x.id === moduleId);
    if (m?.current_stage) setStage(m.current_stage);
  }, [moduleId, modules, location]);

  // Load BOQ items
  useEffect(() => {
    if (!selectedProjectId) { setRows([]); return; }
    (async () => {
      try {
        setLoading(true);
        const items = await fetchBoqItems({
          projectId: selectedProjectId,
          stage: stage || null,
          trade,
        });
        const prev = await fetchPreviouslyRecordedMap(items.map((i) => i.id));
        setRows(buildMeasurementRows(items, prev));
      } catch (err: any) {
        console.error(err);
        toast.error("Could not load BOQ items");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProjectId, stage, trade]);

  const summary = useMemo(() => {
    const valueToday = rows.reduce((a, r) => a + (r.value_today || 0), 0);
    const itemsTouched = rows.filter((r) => r.today_qty > 0).length;
    return { valueToday, itemsTouched };
  }, [rows]);

  const updateQty = (idx: number, qty: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? recomputeRow(r, qty) : r)));
  };

  const onSubmit = async () => {
    if (!selectedProjectId) return toast.error("Select a project first");
    if (location === "factory" && !moduleId) return toast.error("Select a module");
    if (!userId) return toast.error("Not signed in");
    if (rows.every((r) => !r.today_qty)) return toast.error("Enter at least one quantity");

    setSubmitting(true);
    try {
      const flags = await computeMeasurementAnomalies({
        projectId: selectedProjectId,
        moduleId: location === "factory" ? moduleId : null,
        location,
        rows,
        measurementDate: format(new Date(), "yyyy-MM-dd"),
      });
      setAnomalies(flags);

      await submitMeasurement({
        projectId: selectedProjectId,
        moduleId: location === "factory" ? moduleId || null : null,
        stage: stage || null,
        location,
        trade,
        teamLabel: team || null,
        notes: notes || null,
        rows,
        submittedBy: userId,
        anomalyFlags: flags,
      });
      toast.success("Measurement submitted and locked");
      // Reset today's quantities
      setRows((prev) => prev.map((r) => recomputeRow({ ...r, previously_recorded: r.cumulative }, 0)));
      setNotes("");
    } catch (err: any) {
      toast.error(err?.message ?? "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedProjectId) {
    return <p className="text-sm text-muted-foreground p-4">Select a project to enter today's measurements.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{location === "factory" ? "Factory Measurement Sheet" : "Site Measurement Sheet"}</span>
            <Badge variant="outline">{today}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {location === "factory" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Module</label>
                <Select value={moduleId} onValueChange={setModuleId}>
                  <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.module_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Stage</label>
              <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Stage (auto / type)" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Team</label>
              <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Trade</label>
              <Input value={trade} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          BOQ not uploaded yet. Ask Karthik to upload Project Setup.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead style={{ backgroundColor: "#F7F7F7" }}>
                <tr className="text-left">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">BOQ Qty</th>
                  <th className="px-3 py-2 text-right">Previously</th>
                  <th className="px-3 py-2 text-right">Today's Qty</th>
                  <th className="px-3 py-2 text-right">Cumulative</th>
                  <th className="px-3 py-2 text-right">% Complete</th>
                  <th className="px-3 py-2 text-right">Value Today</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2">{r.unit}</td>
                    <td className="px-3 py-2 text-right">{r.boq_qty}</td>
                    <td className="px-3 py-2 text-right">{r.previously_recorded.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right w-32">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={r.today_qty || ""}
                        onChange={(e) => updateQty(i, Number(e.target.value))}
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{r.cumulative.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{r.pct_complete.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{INR(r.value_today)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Items entered</p>
          <p className="text-2xl font-bold">{summary.itemsTouched}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Value today</p>
          <p className="text-2xl font-bold" style={{ color: "#006039" }}>{INR(summary.valueToday)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2 text-sm" style={{ color: "#666666" }}>
          <Lock className="h-4 w-4" /> Submitted entries lock immediately. Only the manager can unlock.
        </CardContent></Card>
      </div>

      {anomalies.length > 0 && (
        <Card style={{ borderColor: "#D4860A" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#D4860A" }}>
              <AlertTriangle className="h-4 w-4" /> Anomaly flags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {anomalies.map((a, i) => (<p key={i}>• {a.message}</p>))}
          </CardContent>
        </Card>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground">Notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={submitting} className="text-white" style={{ backgroundColor: "#006039" }}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Submit & Lock
        </Button>
      </div>
    </div>
  );
}
