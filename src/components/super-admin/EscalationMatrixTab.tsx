import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, Pencil } from "lucide-react";
import { downloadXlsx, logAudit, readXlsx } from "@/lib/super-admin";
import { toast } from "sonner";

type Rule = {
  id: string;
  alert_type: string;
  level1_owner_role: string | null; level1_sla_hours: number | null;
  level2_owner_role: string | null; level2_sla_hours: number | null;
  level3_owner_role: string | null; level3_sla_hours: number | null;
  active: boolean;
};

export function EscalationMatrixTab() {
  const [editing, setEditing] = useState<Rule | null>(null);
  const [diff, setDiff] = useState<Rule[] | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["escalation-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("escalation_rules" as never).select("*").order("alert_type");
      return ((data as unknown as Rule[]) || []);
    },
  });

  function handleDownload() {
    const rows = (data || []).map(r => ({
      "Alert Type": r.alert_type,
      "Level 1 Owner": r.level1_owner_role || "", "L1 SLA (hrs)": r.level1_sla_hours ?? "",
      "Level 2 Owner": r.level2_owner_role || "", "L2 SLA (hrs)": r.level2_sla_hours ?? "",
      "Level 3 Owner": r.level3_owner_role || "", "L3 SLA (hrs)": r.level3_sla_hours ?? "",
      "Active (Y/N)": r.active ? "Y" : "N",
    }));
    downloadXlsx(rows, "Escalation_Matrix.xlsx", "Escalation");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const rows = await readXlsx(file);
    const parsed: Rule[] = rows.map(r => ({
      id: "",
      alert_type: String(r["Alert Type"] || "").trim(),
      level1_owner_role: String(r["Level 1 Owner"] || "") || null,
      level1_sla_hours: Number(r["L1 SLA (hrs)"]) || null,
      level2_owner_role: String(r["Level 2 Owner"] || "") || null,
      level2_sla_hours: Number(r["L2 SLA (hrs)"]) || null,
      level3_owner_role: String(r["Level 3 Owner"] || "") || null,
      level3_sla_hours: Number(r["L3 SLA (hrs)"]) || null,
      active: String(r["Active (Y/N)"] || "Y").toUpperCase().startsWith("Y"),
    })).filter(r => r.alert_type);
    setDiff(parsed);
  }

  async function applyDiff() {
    if (!diff) return;
    const payload = diff.map(({ id: _id, ...rest }) => rest);
    const { error } = await supabase.from("escalation_rules" as never).upsert(payload as never, { onConflict: "alert_type" } as never);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Escalation Matrix", action: "bulk_upload", new_value: { count: diff.length } });
    toast.success(`${diff.length} rules updated`);
    setDiff(null); refetch();
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("escalation_rules" as never).update(editing as never).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Escalation Matrix", action: "edit", entity: editing.alert_type, new_value: editing });
    toast.success("Updated");
    setEditing(null); refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleDownload}><Download className="h-4 w-4" /> Download</Button>
        <label><input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} /><Button asChild variant="outline"><span><Upload className="h-4 w-4" /> Upload</span></Button></label>
      </div>
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Alert Type</TableHead>
            <TableHead>L1 Owner</TableHead><TableHead>L1 SLA</TableHead>
            <TableHead>L2 Owner</TableHead><TableHead>L2 SLA</TableHead>
            <TableHead>L3 Owner</TableHead><TableHead>L3 SLA</TableHead>
            <TableHead>Active</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data || []).map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.alert_type}</TableCell>
                <TableCell>{r.level1_owner_role}</TableCell><TableCell>{r.level1_sla_hours}h</TableCell>
                <TableCell>{r.level2_owner_role}</TableCell><TableCell>{r.level2_sla_hours}h</TableCell>
                <TableCell>{r.level3_owner_role}</TableCell><TableCell>{r.level3_sla_hours}h</TableCell>
                <TableCell>{r.active ? "Y" : "N"}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit: {editing?.alert_type}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="L1 Owner role" value={editing.level1_owner_role || ""} onChange={e=>setEditing({...editing, level1_owner_role: e.target.value})} />
              <Input type="number" placeholder="L1 SLA hrs" value={editing.level1_sla_hours ?? ""} onChange={e=>setEditing({...editing, level1_sla_hours: Number(e.target.value)})} />
              <Input placeholder="L2 Owner role" value={editing.level2_owner_role || ""} onChange={e=>setEditing({...editing, level2_owner_role: e.target.value})} />
              <Input type="number" placeholder="L2 SLA hrs" value={editing.level2_sla_hours ?? ""} onChange={e=>setEditing({...editing, level2_sla_hours: Number(e.target.value)})} />
              <Input placeholder="L3 Owner role" value={editing.level3_owner_role || ""} onChange={e=>setEditing({...editing, level3_owner_role: e.target.value})} />
              <Input type="number" placeholder="L3 SLA hrs" value={editing.level3_sla_hours ?? ""} onChange={e=>setEditing({...editing, level3_sla_hours: Number(e.target.value)})} />
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active} onChange={e=>setEditing({...editing, active: e.target.checked})} /> Active
              </label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!diff} onOpenChange={(o)=>!o && setDiff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Review Escalation Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{diff?.length} rules will be upserted.</p>
          <DialogFooter><Button variant="outline" onClick={()=>setDiff(null)}>Cancel</Button><Button onClick={applyDiff}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
