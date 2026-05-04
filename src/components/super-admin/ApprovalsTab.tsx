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

type Threshold = {
  id: string; approval_type: string;
  tier1_max_amount: number | null; tier1_approver_role: string | null;
  tier2_max_amount: number | null; tier2_approver_role: string | null;
  tier3_approver_role: string | null;
  notes: string | null;
};

export function ApprovalsTab() {
  const [editing, setEditing] = useState<Threshold | null>(null);
  const [diff, setDiff] = useState<Threshold[] | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["approval-thresholds"],
    queryFn: async () => {
      const { data } = await supabase.from("approval_thresholds" as never).select("*").order("approval_type");
      return ((data as unknown as Threshold[]) || []);
    },
  });

  function handleDownload() {
    const rows = (data || []).map(t => ({
      "Approval Type": t.approval_type,
      "Below This Amount (₹)": t.tier1_max_amount ?? "",
      "Approved By (Tier 1)": t.tier1_approver_role || "",
      "Above This Amount (₹)": t.tier1_max_amount ?? "",
      "Approved By (Tier 2)": t.tier2_approver_role || "",
      "Above This Amount 2nd Tier (₹)": t.tier2_max_amount ?? "",
      "Approved By (Tier 3)": t.tier3_approver_role || "",
      "Notes": t.notes || "",
    }));
    downloadXlsx(rows, "Approval_Thresholds.xlsx", "Thresholds");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    const rows = await readXlsx(file);
    const parsed: Threshold[] = rows.map(r => ({
      id: "",
      approval_type: String(r["Approval Type"] || "").trim(),
      tier1_max_amount: Number(r["Below This Amount (₹)"]) || null,
      tier1_approver_role: String(r["Approved By (Tier 1)"] || "") || null,
      tier2_max_amount: Number(r["Above This Amount 2nd Tier (₹)"]) || null,
      tier2_approver_role: String(r["Approved By (Tier 2)"] || "") || null,
      tier3_approver_role: String(r["Approved By (Tier 3)"] || "") || null,
      notes: String(r["Notes"] || "") || null,
    })).filter(r => r.approval_type);
    setDiff(parsed);
  }

  async function applyDiff() {
    if (!diff) return;
    const payload = diff.map(({ id: _id, ...rest }) => rest);
    const { error } = await supabase.from("approval_thresholds" as never).upsert(payload as never, { onConflict: "approval_type" } as never);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Approvals", action: "bulk_upload", new_value: { count: diff.length } });
    toast.success(`${diff.length} thresholds updated`);
    setDiff(null); refetch();
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("approval_thresholds" as never).update(editing as never).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ section: "Approvals", action: "edit", entity: editing.approval_type, new_value: editing });
    toast.success("Updated"); setEditing(null); refetch();
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
            <TableHead>Approval Type</TableHead>
            <TableHead>Tier 1 limit (₹)</TableHead><TableHead>Tier 1 approver</TableHead>
            <TableHead>Tier 2 limit (₹)</TableHead><TableHead>Tier 2 approver</TableHead>
            <TableHead>Tier 3 approver</TableHead><TableHead>Notes</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data || []).map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.approval_type}</TableCell>
                <TableCell>{t.tier1_max_amount?.toLocaleString("en-IN") || "—"}</TableCell>
                <TableCell>{t.tier1_approver_role}</TableCell>
                <TableCell>{t.tier2_max_amount?.toLocaleString("en-IN") || "—"}</TableCell>
                <TableCell>{t.tier2_approver_role}</TableCell>
                <TableCell>{t.tier3_approver_role}</TableCell>
                <TableCell className="text-xs max-w-[260px]">{t.notes}</TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={()=>setEditing(t)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit: {editing?.approval_type}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Tier 1 max (₹)" value={editing.tier1_max_amount ?? ""} onChange={e=>setEditing({...editing, tier1_max_amount: Number(e.target.value)})} />
              <Input placeholder="Tier 1 approver" value={editing.tier1_approver_role || ""} onChange={e=>setEditing({...editing, tier1_approver_role: e.target.value})} />
              <Input type="number" placeholder="Tier 2 max (₹)" value={editing.tier2_max_amount ?? ""} onChange={e=>setEditing({...editing, tier2_max_amount: Number(e.target.value)})} />
              <Input placeholder="Tier 2 approver" value={editing.tier2_approver_role || ""} onChange={e=>setEditing({...editing, tier2_approver_role: e.target.value})} />
              <Input className="col-span-2" placeholder="Tier 3 approver" value={editing.tier3_approver_role || ""} onChange={e=>setEditing({...editing, tier3_approver_role: e.target.value})} />
              <Input className="col-span-2" placeholder="Notes" value={editing.notes || ""} onChange={e=>setEditing({...editing, notes: e.target.value})} />
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!diff} onOpenChange={(o)=>!o && setDiff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Review Threshold Changes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{diff?.length} thresholds will be upserted.</p>
          <DialogFooter><Button variant="outline" onClick={()=>setDiff(null)}>Cancel</Button><Button onClick={applyDiff}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
