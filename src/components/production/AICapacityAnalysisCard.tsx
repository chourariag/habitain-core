import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

interface CapacityWeek { week_start: string; week_end: string; utilisation_pct: number; status: string; }
interface AvailWindow { start: string; end: string; capacity_modules: number; }
interface Bottleneck { stage: string; reason: string; impact: string; }
interface Analysis {
  summary: string;
  recommended_start: string;
  capacity_weeks: CapacityWeek[];
  available_windows: AvailWindow[];
  bottlenecks: Bottleneck[];
}

const AI_ALLOWED = ["production_head", "planning_head", "managing_director", "super_admin"];

function statusColor(pct: number, status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "full" || pct >= 100) return { bg: "#FFF0F0", text: "#F40009", border: "#F40009" };
  if (s === "near_full" || pct >= 80) return { bg: "#FFF8E8", text: "#D4860A", border: "#D4860A" };
  return { bg: "#E8F2ED", text: "#006039", border: "#006039" };
}

export function AICapacityAnalysisCard({ role }: { role: string | null }) {
  const canRun = AI_ALLOWED.includes(role ?? "");
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [newModules, setNewModules] = useState<string>("");
  const [newStart, setNewStart] = useState<string>("");

  if (!canRun) return null;

  async function runAnalysis() {
    setRunning(true);
    try {
      const body: any = {};
      if (newModules && newStart) {
        body.new_project = { module_count: Number(newModules), target_start: newStart };
      }
      const { data, error } = await supabase.functions.invoke("capacity-ai-analysis", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data.analysis as Analysis);
      toast.success("AI capacity analysis complete");
    } catch (e: any) {
      toast.error(e?.message ?? "AI analysis failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card style={{ border: "1px solid #006039" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#006039" }} />
          AI Capacity Analysis
          <Badge variant="outline" className="ml-2 text-[10px]">Gemini 2.5 Pro</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs">New project — modules (optional)</Label>
            <Input type="number" min={1} value={newModules}
              placeholder="e.g. 8"
              onChange={(e) => setNewModules(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Target start (optional)</Label>
            <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </div>
          <Button onClick={runAnalysis} disabled={running}
            style={{ backgroundColor: "#006039", color: "white" }}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {running ? "Analysing…" : "Run AI Analysis"}
          </Button>
        </div>

        {analysis && (
          <div className="space-y-4">
            <div className="rounded-md p-3 text-sm" style={{ backgroundColor: "#F7F7F7", border: "1px solid #E0E0E0" }}>
              <p className="font-semibold mb-1" style={{ color: "#006039" }}>Summary</p>
              <p style={{ color: "#1A1A1A", whiteSpace: "pre-wrap" }}>{analysis.summary}</p>
            </div>

            {analysis.recommended_start && (
              <div className="rounded-md p-3 flex items-center gap-2" style={{ backgroundColor: "#E8F2ED", border: "1px solid #006039" }}>
                <CalendarCheck className="h-5 w-5" style={{ color: "#006039" }} />
                <div>
                  <p className="text-xs" style={{ color: "#666" }}>Recommended start date for new project</p>
                  <p className="text-lg font-bold font-display" style={{ color: "#006039" }}>
                    {new Date(analysis.recommended_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}

            {analysis.capacity_weeks?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#1A1A1A" }}>Weekly capacity heatmap</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {analysis.capacity_weeks.map((w, i) => {
                    const c = statusColor(w.utilisation_pct, w.status);
                    return (
                      <div key={i} className="rounded-md p-2 text-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
                        <p className="text-[10px]" style={{ color: "#666" }}>
                          {new Date(w.week_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                        <p className="text-lg font-bold font-display" style={{ color: c.text }}>{w.utilisation_pct}%</p>
                        <p className="text-[10px] capitalize" style={{ color: c.text }}>{w.status.replace("_", " ")}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {analysis.available_windows?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "#1A1A1A" }}>Available capacity windows</p>
                <div className="space-y-1">
                  {analysis.available_windows.map((w, i) => (
                    <div key={i} className="text-xs rounded-md p-2 flex justify-between"
                      style={{ backgroundColor: "#E8F2ED", border: "1px solid #006039" }}>
                      <span style={{ color: "#1A1A1A" }}>
                        {new Date(w.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → {new Date(w.end).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                      <span className="font-bold" style={{ color: "#006039" }}>{w.capacity_modules} modules</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.bottlenecks?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: "#1A1A1A" }}>
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#F40009" }} /> Production stage bottlenecks
                </p>
                <div className="space-y-2">
                  {analysis.bottlenecks.map((b, i) => (
                    <div key={i} className="rounded-md p-2 text-xs" style={{ backgroundColor: "#FFF0F0", border: "1px solid #F40009" }}>
                      <p className="font-bold" style={{ color: "#F40009" }}>{b.stage}</p>
                      <p style={{ color: "#1A1A1A" }}><strong>Reason:</strong> {b.reason}</p>
                      <p style={{ color: "#1A1A1A" }}><strong>Impact:</strong> {b.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!analysis && !running && (
          <p className="text-xs text-center py-3" style={{ color: "#666" }}>
            Click "Run AI Analysis" to generate a capacity outlook with bottleneck detection and recommended start dates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
