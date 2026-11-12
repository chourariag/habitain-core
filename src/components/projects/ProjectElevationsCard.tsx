import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Archive, Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

export const ELEVATION_MANAGER_ROLES = ["planning_head", "managing_director", "super_admin", "head_of_projects"];
type Elevation = { id: string; name: string; drawing_ref: string | null; sort_order: number };
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export function ProjectElevationsCard({ projectId, userRole }: { projectId: string; userRole: string | null }) {
  const canManage = !!userRole && ELEVATION_MANAGER_ROLES.includes(userRole);
  const [rows, setRows] = useState<Elevation[]>([]);
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRef, setEditRef] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from("project_elevations").select("id,name,drawing_ref,sort_order")
      .eq("project_id", projectId).eq("is_active", true).order("sort_order").order("created_at");
    if (error) { console.error(error); return; }
    setRows(data ?? []);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await rpc(fn, args);
    setBusy(false);
    if (error) { console.error(error); toast.error(error.message.includes("already exists") ? "An elevation with this name already exists" : "Could not save the elevation. Please try again."); return false; }
    await load(); return true;
  };

  const add = async () => {
    if (!name.trim()) return;
    if (await run("upsert_project_elevation", { p_project_id: projectId, p_id: null, p_name: name, p_drawing_ref: ref, p_sort_order: null })) { setName(""); setRef(""); }
  };
  const save = async (e: Elevation) => {
    if (await run("upsert_project_elevation", { p_project_id: projectId, p_id: e.id, p_name: editName, p_drawing_ref: editRef, p_sort_order: e.sort_order })) setEditId(null);
  };
  const move = async (i: number, dir: -1 | 1) => {
    const a = rows[i], b = rows[i + dir]; if (!a || !b) return;
    // renumber so swapped orders are distinct
    const order = rows.map((r) => r.id); order[i] = b.id; order[i + dir] = a.id;
    setBusy(true);
    for (let k = 0; k < order.length; k++) {
      const r = rows.find((x) => x.id === order[k])!;
      if (r.sort_order === k + 1) continue;
      const { error } = await rpc("upsert_project_elevation", { p_project_id: projectId, p_id: r.id, p_name: r.name, p_drawing_ref: r.drawing_ref, p_sort_order: k + 1 });
      if (error) { console.error(error); toast.error("Could not reorder. Please try again."); break; }
    }
    setBusy(false); load();
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Elevations (as per drawings)</CardTitle></CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        <p className="text-xs text-muted-foreground">One photo per elevation is required in every daily report.</p>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No elevations defined yet.</p>}
        {rows.map((e, i) => (
          <div key={e.id} className="rounded-md border border-border p-2 min-w-0">
            {editId === e.id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={(x) => setEditName(x.target.value)} placeholder="Elevation name" aria-label="Elevation name" />
                <Input value={editRef} onChange={(x) => setEditRef(x.target.value)} placeholder="Drawing reference (optional)" aria-label="Drawing reference" />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={busy || !editName.trim()} onClick={() => save(e)}><Check className="h-4 w-4 mr-1" />Save</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditId(null)}><X className="h-4 w-4 mr-1" />Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">{e.name}</p>
                  {e.drawing_ref && <p className="text-xs text-muted-foreground break-words">Drawing: {e.drawing_ref}</p>}
                </div>
                {canManage && (
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Rename" onClick={() => { setEditId(e.id); setEditName(e.name); setEditRef(e.drawing_ref ?? ""); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Archive" disabled={busy}
                      onClick={() => { if (window.confirm(`Archive elevation "${e.name}"?`)) run("archive_project_elevation", { p_id: e.id }); }}><Archive className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {canManage && (
          <div className="space-y-2 pt-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Elevation name, e.g. North" aria-label="New elevation name" />
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Drawing reference (optional)" aria-label="New drawing reference" />
            <Button className="w-full" disabled={busy || !name.trim()} onClick={add}><Plus className="h-4 w-4 mr-1" />Add elevation</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
