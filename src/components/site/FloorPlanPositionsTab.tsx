import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Lock, Unlock, Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  userRole: string | null;
}

const DIRECTIONS = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];

const CAN_MANAGE = new Set([
  "super_admin",
  "managing_director",
  "site_installation_mgr",
  "operations_architect",
  "project_architect",
  "principal_architect",
  "head_operations",
]);

export function FloorPlanPositionsTab({ projectId, userRole }: Props) {
  const canManage = CAN_MANAGE.has(userRole ?? "");
  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [floorName, setFloorName] = useState("Ground Floor");
  const [file, setFile] = useState<File | null>(null);
  const [lastPhotoMap, setLastPhotoMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: fps }, { data: ps }, { data: photos }] = await Promise.all([
      (supabase.from("floor_plans") as any).select("*").eq("project_id", projectId).eq("is_archived", false).order("created_at"),
      (supabase.from("photo_positions") as any).select("*").eq("project_id", projectId).order("position_number"),
      (supabase.from("site_position_photos") as any).select("position_id, photo_date").eq("project_id", projectId).order("photo_date", { ascending: false }),
    ]);
    setFloorPlans(fps ?? []);
    setPositions(ps ?? []);
    const map: Record<string, string> = {};
    (photos ?? []).forEach((p: any) => { if (!map[p.position_id]) map[p.position_id] = p.photo_date; });
    setLastPhotoMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async () => {
    if (!file || !floorName.trim()) { toast.error("Pick file and floor name"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${projectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("floor-plans").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("floor-plans").getPublicUrl(path);
      const { data: row, error } = await (supabase.from("floor_plans") as any).insert({
        project_id: projectId,
        floor_name: floorName.trim(),
        file_url: pub.publicUrl,
        storage_path: path,
        uploaded_by: user?.id,
      }).select().single();
      if (error) throw error;
      toast.success("Floor plan uploaded — analysing…");
      setAnalyzing(row.id);
      await supabase.functions.invoke("floor-plan-analyze", { body: { floor_plan_id: row.id } });
      setAnalyzing(null);
      setFile(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updatePos = async (id: string, patch: any) => {
    const { error } = await (supabase.from("photo_positions") as any).update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const deletePos = async (id: string) => {
    if (!confirm("Delete this position?")) return;
    const { error } = await (supabase.from("photo_positions") as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPositions((prev) => prev.filter((p) => p.id !== id));
  };

  const addPosition = async (fp: any) => {
    const fpPositions = positions.filter((p) => p.floor_plan_id === fp.id);
    const nextNum = (fpPositions.reduce((m, p) => Math.max(m, p.position_number), 0)) + 1;
    const { data, error } = await (supabase.from("photo_positions") as any).insert({
      floor_plan_id: fp.id, project_id: projectId, position_number: nextNum,
      area_name: `Area ${nextNum}`, floor_name: fp.floor_name, direction: "N",
      is_mandatory: true, is_active: true, source: "manual",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setPositions((prev) => [...prev, data]);
  };

  const toggleLock = async (fp: any) => {
    const { error } = await (supabase.from("floor_plans") as any).update({ is_locked: !fp.is_locked, updated_at: new Date().toISOString() }).eq("id", fp.id);
    if (error) { toast.error(error.message); return; }
    setFloorPlans((prev) => prev.map((f) => (f.id === fp.id ? { ...f, is_locked: !fp.is_locked } : f)));
    toast.success(fp.is_locked ? "Unlocked" : "Positions locked");
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Upload Floor Plan</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground">Floor name</label>
              <Input value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="Ground Floor" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">File (PDF, JPG, PNG)</label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading || !file} style={{ backgroundColor: "#006039" }}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload & Analyse
            </Button>
          </CardContent>
        </Card>
      )}

      {floorPlans.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No floor plan uploaded yet. Awaiz / Venkat can upload one above.</CardContent></Card>
      )}

      {floorPlans.map((fp) => {
        const fpPos = positions.filter((p) => p.floor_plan_id === fp.id).sort((a, b) => a.position_number - b.position_number);
        return (
          <Card key={fp.id}>
            <CardHeader className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {fp.floor_name}
                  {fp.is_locked ? <Badge variant="outline" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
                    : <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                  {fp.ai_analysis_status === "processing" && <Badge variant="outline" className="text-[10px]"><Loader2 className="h-3 w-3 mr-1 animate-spin" />AI analysing…</Badge>}
                  {fp.ai_analysis_status === "failed" && <Badge variant="destructive" className="text-[10px]">AI failed</Badge>}
                </CardTitle>
                {canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addPosition(fp)} disabled={fp.is_locked}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Position
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleLock(fp)}>
                      {fp.is_locked ? <><Unlock className="h-3.5 w-3.5 mr-1" />Unlock</> : <><Lock className="h-3.5 w-3.5 mr-1" />Confirm & Lock</>}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href={fp.file_url} target="_blank" rel="noreferrer" className="block">
                <img src={fp.file_url} alt={fp.floor_name} className="max-h-64 rounded border border-border object-contain bg-muted" />
              </a>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Daily?</TableHead>
                      <TableHead>Last Photo</TableHead>
                      {canManage && <TableHead></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fpPos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No positions yet.</TableCell></TableRow>}
                    {fpPos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.position_number}</TableCell>
                        <TableCell>
                          {canManage && !fp.is_locked ? (
                            <Input value={p.area_name} onChange={(e) => updatePos(p.id, { area_name: e.target.value })} className="h-8 text-sm" />
                          ) : <span className="text-sm">{p.area_name}</span>}
                        </TableCell>
                        <TableCell>
                          {canManage && !fp.is_locked ? (
                            <Select value={p.direction ?? "N"} onValueChange={(v) => updatePos(p.id, { direction: v })}>
                              <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{DIRECTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : <span className="text-sm">{p.direction}</span>}
                        </TableCell>
                        <TableCell>
                          <Switch checked={p.is_mandatory} disabled={!canManage || fp.is_locked} onCheckedChange={(v) => updatePos(p.id, { is_mandatory: v })} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lastPhotoMap[p.id] ?? "—"}</TableCell>
                        {canManage && (
                          <TableCell>
                            {!fp.is_locked && (
                              <Button size="icon" variant="ghost" onClick={() => deletePos(p.id)} className="h-8 w-8">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
