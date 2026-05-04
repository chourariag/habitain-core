import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, Plus } from "lucide-react";
import { downloadXlsx, logAudit, readXlsx } from "@/lib/super-admin";
import { toast } from "sonner";

type Template = {
  id: string;
  stage_number: string;
  phase_name: string | null;
  task_type: string;
  task_name: string;
  production_system: string;
  responsible_role: string | null;
  responsible_user_id: string | null;
  predecessor_stage_numbers: string[] | null;
  typical_duration_days: number | null;
  notes: string | null;
};

type Profile = { id: string; display_name: string | null; email: string | null };

type DiffRow = {
  kind: "new" | "changed" | "removed";
  stage: string;
  task: string;
  before?: string;
  after?: string;
};

export function TaskMasterTab() {
  const [diff, setDiff] = useState<{ rows: DiffRow[]; payload: Record<string, unknown>[] } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingApply, setPendingApply] = useState<{ rows: Record<string, unknown>[] } | null>(null);

  const { data: templates, refetch } = useQuery({
    queryKey: ["task-master-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_task_templates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email").eq("is_active", true);
      return (data || []) as Profile[];
    },
  });

  function profileName(id: string | null) {
    if (!id) return "";
    const p = profiles?.find(x => x.id === id);
    return p?.display_name || p?.email || "";
  }

  function handleDownload() {
    const rows = (templates || []).map(t => ({
      "Stage #": t.stage_number,
      "Phase": t.phase_name || "",
      "Task Type": t.task_type,
      "Task Name": t.task_name,
      "Production System": t.production_system,
      "Responsible Role": t.responsible_role || "",
      "Responsible User": profileName(t.responsible_user_id),
      "Predecessor Stage #s": (t.predecessor_stage_numbers || []).join(","),
      "Typical Duration (days)": t.typical_duration_days || 0,
      "Notes": t.notes || "",
    }));
    downloadXlsx(rows, "Task_Master_Template.xlsx", "Task Master");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const rows = await readXlsx(file);
      const existing = new Map((templates || []).map(t => [`${t.production_system}|${t.stage_number}`, t]));
      const incomingKeys = new Set<string>();
      const diffRows: DiffRow[] = [];

      for (const r of rows) {
        const stage = String(r["Stage #"] || "").trim();
        const sys = String(r["Production System"] || "modular").trim().toLowerCase();
        if (!stage) continue;
        const key = `${sys}|${stage}`;
        incomingKeys.add(key);
        const ex = existing.get(key);
        const newRole = String(r["Responsible Role"] || "");
        const newUser = String(r["Responsible User"] || "");
        if (!ex) {
          diffRows.push({ kind: "new", stage, task: String(r["Task Name"] || ""), after: `${newRole}${newUser ? ` → ${newUser}` : ""}` });
        } else {
          const before = `${ex.responsible_role || ""}${ex.responsible_user_id ? ` → ${profileName(ex.responsible_user_id)}` : ""}`;
          const after = `${newRole}${newUser ? ` → ${newUser}` : ""}`;
          if (before !== after) diffRows.push({ kind: "changed", stage, task: ex.task_name, before, after });
        }
      }
      for (const [key, t] of existing) {
        if (!incomingKeys.has(key)) {
          diffRows.push({ kind: "removed", stage: t.stage_number, task: t.task_name });
        }
      }
      setDiff({ rows: diffRows, payload: rows });
    } catch (err) {
      toast.error(`Failed to parse file: ${(err as Error).message}`);
    }
  }

  async function applyDiff(applyToActive: boolean) {
    if (!diff) return;
    const profMap = new Map((profiles || []).map(p => [(p.display_name || p.email || "").toLowerCase(), p.id]));
    try {
      const upserts = diff.payload.map(r => {
        const userName = String(r["Responsible User"] || "").toLowerCase().trim();
        const userId = userName ? profMap.get(userName) ?? null : null;
        const sys = String(r["Production System"] || "modular").toLowerCase().trim();
        return {
          stage_number: String(r["Stage #"] || "").trim(),
          phase_name: String(r["Phase"] || ""),
          task_type: String(r["Task Type"] || "Task"),
          task_name: String(r["Task Name"] || ""),
          production_system: sys,
          responsible_role: String(r["Responsible Role"] || "") || null,
          responsible_user_id: userId,
          predecessor_stage_numbers: String(r["Predecessor Stage #s"] || "").split(",").map(s => s.trim()).filter(Boolean),
          typical_duration_days: Number(r["Typical Duration (days)"] || 0),
          notes: String(r["Notes"] || "") || null,
          display_order: Number(r["Stage #"]) || 0,
        };
      });

      // Wipe & re-seed for the systems present in the upload
      const systems = Array.from(new Set(upserts.map(u => u.production_system)));
      for (const sys of systems) {
        await supabase.from("production_task_templates").delete().eq("production_system", sys as never);
      }
      const { error } = await supabase.from("production_task_templates").insert(upserts as never);
      if (error) throw error;

      await logAudit({
        section: "Task Master", action: "bulk_upload",
        summary: `Replaced templates for systems: ${systems.join(", ")} (${upserts.length} rows)`,
        new_value: { count: upserts.length, systems },
      });

      if (applyToActive) {
        // Update responsible_role on un-started project_tasks where matched by stage_number
        for (const u of upserts) {
          if (!u.responsible_role) continue;
          await supabase
            .from("project_tasks")
            .update({ responsible_role: u.responsible_role } as never)
            .eq("stage_number", u.stage_number)
            .eq("status", "Upcoming");
        }
        toast.success("Applied to active projects (un-started tasks).");
      } else {
        toast.success("Templates updated. Active projects unchanged.");
      }
      setDiff(null);
      setPendingApply(null);
      refetch();
    } catch (err) {
      toast.error(`Apply failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleDownload} variant="outline"><Download className="h-4 w-4" /> Download Template</Button>
        <label>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          <Button asChild variant="outline"><span><Upload className="h-4 w-4" /> Upload</span></Button>
        </label>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Task</Button>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead><TableHead>Task</TableHead><TableHead>System</TableHead>
              <TableHead>Role</TableHead><TableHead>User</TableHead><TableHead>Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(templates || []).map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.stage_number}</TableCell>
                <TableCell className="max-w-[280px] truncate">{t.task_name}</TableCell>
                <TableCell>{t.production_system}</TableCell>
                <TableCell>{t.responsible_role}</TableCell>
                <TableCell>{profileName(t.responsible_user_id)}</TableCell>
                <TableCell>{t.typical_duration_days}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Diff preview */}
      <Dialog open={!!diff} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Review Changes</DialogTitle></DialogHeader>
          {diff && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                NEW: {diff.rows.filter(r=>r.kind==="new").length} ·
                CHANGED: {diff.rows.filter(r=>r.kind==="changed").length} ·
                REMOVED: {diff.rows.filter(r=>r.kind==="removed").length}
              </p>
              <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Stage</TableHead><TableHead>Task</TableHead><TableHead>Before → After</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {diff.rows.map((r,i)=>(
                      <TableRow key={i}>
                        <TableCell className="font-medium uppercase text-xs">{r.kind}</TableCell>
                        <TableCell>{r.stage}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.task}</TableCell>
                        <TableCell className="text-xs">{r.before ? `${r.before} → ${r.after}` : r.after || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDiff(null)}>Cancel</Button>
            <Button onClick={() => setPendingApply({ rows: diff?.payload || [] })}>Apply Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to active projects? */}
      <Dialog open={!!pendingApply} onOpenChange={(o)=>!o && setPendingApply(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply assignment changes to active projects too?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will update responsible roles on existing project tasks that have not yet started.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => applyDiff(false)}>Future projects only</Button>
            <Button onClick={() => applyDiff(true)}>Apply to active projects</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddTaskDialog open={showAdd} onClose={() => { setShowAdd(false); refetch(); }} profiles={profiles || []} />
    </div>
  );
}

function AddTaskDialog({ open, onClose, profiles }: { open: boolean; onClose: () => void; profiles: Profile[] }) {
  const [form, setForm] = useState({
    stage_number: "", phase_name: "", task_type: "Task", task_name: "",
    production_system: "modular", responsible_role: "", responsible_user_id: "",
    predecessors: "", typical_duration_days: "0", notes: "",
  });
  useEffect(() => { if (!open) setForm({ stage_number:"", phase_name:"", task_type:"Task", task_name:"", production_system:"modular", responsible_role:"", responsible_user_id:"", predecessors:"", typical_duration_days:"0", notes:"" }); }, [open]);

  async function save() {
    if (!form.stage_number || !form.task_name) { toast.error("Stage # and Task Name are required"); return; }
    const { error } = await supabase.from("production_task_templates").insert({
      stage_number: form.stage_number,
      phase_name: form.phase_name || null,
      task_type: form.task_type as never,
      task_name: form.task_name,
      production_system: form.production_system as never,
      responsible_role: form.responsible_role || null,
      responsible_user_id: form.responsible_user_id || null,
      predecessor_stage_numbers: form.predecessors.split(",").map(s=>s.trim()).filter(Boolean),
      typical_duration_days: Number(form.typical_duration_days) || 0,
      notes: form.notes || null,
      display_order: Number(form.stage_number) || 0,
    } as never);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Task Master", action: "add_task", entity: form.task_name, new_value: form });
    toast.success("Task added");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o)=>!o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Stage #" value={form.stage_number} onChange={e=>setForm({...form, stage_number: e.target.value})} />
          <Input placeholder="Phase" value={form.phase_name} onChange={e=>setForm({...form, phase_name: e.target.value})} />
          <Input placeholder="Task Type" value={form.task_type} onChange={e=>setForm({...form, task_type: e.target.value})} />
          <Input placeholder="Production System (modular/panelised/hybrid)" value={form.production_system} onChange={e=>setForm({...form, production_system: e.target.value})} />
          <Input className="col-span-2" placeholder="Task Name" value={form.task_name} onChange={e=>setForm({...form, task_name: e.target.value})} />
          <Input placeholder="Responsible Role" value={form.responsible_role} onChange={e=>setForm({...form, responsible_role: e.target.value})} />
          <select className="border rounded-md px-2 text-sm" value={form.responsible_user_id} onChange={e=>setForm({...form, responsible_user_id: e.target.value})}>
            <option value="">— Specific user (optional) —</option>
            {profiles.map(p=><option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
          </select>
          <Input placeholder="Predecessor Stage #s (comma-sep)" value={form.predecessors} onChange={e=>setForm({...form, predecessors: e.target.value})} />
          <Input placeholder="Duration (days)" type="number" value={form.typical_duration_days} onChange={e=>setForm({...form, typical_duration_days: e.target.value})} />
          <Input className="col-span-2" placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} />
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
