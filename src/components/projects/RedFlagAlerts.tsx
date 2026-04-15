import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/components/AuthProvider";

interface RedFlag {
  id: string;
  project_id: string;
  task_id: string;
  task_name: string;
  task_category: string;
  module_count_band: string;
  benchmark_avg: number;
  current_duration: number;
  days_over: number;
  most_common_cause: string | null;
  status: string;
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}

interface Props {
  projectId?: string; // if provided, show only for this project
}

export function RedFlagAlerts({ projectId }: Props) {
  const { session } = useAuth();
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondFlag, setRespondFlag] = useState<RedFlag | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = (supabase.from("red_flag_alerts") as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (projectId) q = q.eq("project_id", projectId);
    const { data } = await q;
    setFlags(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleRespond = async () => {
    if (!respondFlag || !note.trim()) return;
    setSaving(true);
    await (supabase.from("red_flag_alerts") as any).update({
      response_note: note.trim(),
      responded_by: session?.user?.id,
      responded_at: new Date().toISOString(),
    }).eq("id", respondFlag.id);
    toast.success("Response noted");
    setSaving(false);
    setRespondFlag(null);
    setNote("");
    fetch();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const active = flags.filter((f) => f.status === "active");
  const resolved = flags.filter((f) => f.status === "resolved");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" style={{ color: "#F40009" }} />
        <h3 className="text-base font-bold font-display text-foreground">
          Red Flag Alerts {active.length > 0 && <span className="text-sm font-normal text-muted-foreground">({active.length} active)</span>}
        </h3>
      </div>

      {flags.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: "hsl(var(--primary))" }} />
          <p className="text-sm text-muted-foreground">No red flags — all tasks within benchmark range</p>
        </CardContent></Card>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="text-center">Current</TableHead>
                <TableHead className="text-center">Benchmark Avg</TableHead>
                <TableHead className="text-center">Days Over</TableHead>
                <TableHead>Common Cause</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Response</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.id} className={f.status === "active" ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <p className="font-medium text-sm text-foreground">{f.task_name}</p>
                    <p className="text-xs text-muted-foreground">{f.module_count_band} modules</p>
                  </TableCell>
                  <TableCell className="text-center font-medium" style={{ color: "#F40009" }}>{f.current_duration}d</TableCell>
                  <TableCell className="text-center text-muted-foreground">{f.benchmark_avg}d</TableCell>
                  <TableCell className="text-center font-bold" style={{ color: "#F40009" }}>+{f.days_over}d</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.most_common_cause ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "active" ? "destructive" : "secondary"} className="text-xs">
                      {f.status === "active" ? "Active" : "Resolved"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {f.response_note ?? "—"}
                  </TableCell>
                  <TableCell>
                    {f.status === "active" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => { setRespondFlag(f); setNote(f.response_note ?? ""); }}>
                        <MessageSquare className="h-3 w-3" /> Respond
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!respondFlag} onOpenChange={(v) => { if (!v) setRespondFlag(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Respond to Red Flag</DialogTitle></DialogHeader>
          {respondFlag && (
            <div className="space-y-3">
              <p className="text-sm text-foreground font-medium">{respondFlag.task_name}</p>
              <p className="text-xs text-muted-foreground">
                Current: {respondFlag.current_duration}d | Benchmark: {respondFlag.benchmark_avg}d | Over by {respondFlag.days_over}d
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe what action is being taken..."
                maxLength={500}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleRespond} disabled={saving || !note.trim()} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
