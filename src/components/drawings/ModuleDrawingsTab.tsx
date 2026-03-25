import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileText, MessageSquare, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getAuthedClient } from "@/lib/auth-client";
import { projectCode } from "@/lib/code-generators";

const DQ_QUERY_TYPES = ["Dimension Clarification", "Material Specification", "Structural Query", "MEP Routing", "Opening Position", "Finishing Detail", "Other"];
const DQ_URGENCY = ["Critical", "High", "Normal"];

interface Props {
  projectId: string;
  moduleId?: string;
  projectName?: string;
}

export function ModuleDrawingsTab({ projectId, moduleId, projectName }: Props) {
  const [drawings, setDrawings] = useState<any[]>([]);
  const [dqs, setDqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const [dqForm, setDqForm] = useState({ drawing_id: "", description: "", query_type: "Other", urgency: "Normal", affected_area: "" });
  const [dqPhoto, setDqPhoto] = useState<File | null>(null);
  const [dqSubmitting, setDqSubmitting] = useState(false);
  const [userName, setUserName] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", user.id).maybeSingle();
      setUserName((profile as any)?.display_name ?? user.email ?? "");
    }

    let query = (supabase.from("drawings") as any).select("*").eq("project_id", projectId).eq("is_archived", false).order("created_at", { ascending: false });
    const { data } = await query;
    setDrawings(data ?? []);
    setLoading(false);
  }, [projectId, moduleId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeDrawings = useMemo(() => drawings.filter((d: any) => d.status === "active"), [drawings]);
  const archivedDrawings = useMemo(() => drawings.filter((d: any) => d.status === "archived"), [drawings]);
  const isModuleSpecific = (d: any) => d.module_id === moduleId;

  const handleRaiseDQ = async () => {
    if (!dqForm.description) { toast.error("Description is required"); return; }
    setDqSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let photoUrl = null;
      if (dqPhoto) {
        const path = `dq-photos/${projectId}/${Date.now()}.${dqPhoto.name.split(".").pop()}`;
        await supabase.storage.from("site-photos").upload(path, dqPhoto);
        photoUrl = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;
      }

      const code = projectName ? projectCode(projectName) : "XX";
      const { data: existingDqs } = await (supabase.from("design_queries") as any).select("id").eq("project_id", projectId);
      const dqCode = `DQ-${code}-${String((existingDqs?.length ?? 0) + 1).padStart(3, "0")}`;

      const { data: architects } = await supabase.from("profiles")
        .select("auth_user_id").eq("role", "project_architect" as any).eq("is_active", true).limit(1);

      const { client } = await getAuthedClient();
      await (client.from("design_queries") as any).insert({
        project_id: projectId,
        module_id: moduleId || null,
        dq_code: dqCode,
        drawing_id: dqForm.drawing_id || null,
        description: dqForm.description,
        query_type: dqForm.query_type,
        urgency: dqForm.urgency,
        affected_area: dqForm.affected_area || null,
        photo_url: photoUrl,
        raised_by: user.id,
        raised_by_name: userName,
        assigned_architect_id: architects?.[0]?.auth_user_id ?? null,
        status: "open",
      });

      if (architects?.[0]) {
        await insertNotifications({
          recipient_id: architects[0].auth_user_id,
          title: "New Design Query",
          body: `DQ ${dqCode} (${dqForm.urgency}) raised. Please review.`,
          category: "design",
          related_table: "design_query",
        });
      }

      toast.success(`DQ ${dqCode} raised`);
      setDqOpen(false);
      setDqForm({ drawing_id: "", description: "", query_type: "Other", urgency: "Normal", affected_area: "" });
      setDqPhoto(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDqSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Drawings</h3>
        <div className="flex gap-2">
          <Dialog open={dqOpen} onOpenChange={setDqOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs gap-1"><MessageSquare className="h-3.5 w-3.5" /> Raise DQ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Raise Design Query</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Drawing Reference</Label>
                  <Select value={dqForm.drawing_id} onValueChange={(v) => setDqForm({ ...dqForm, drawing_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select drawing" /></SelectTrigger>
                    <SelectContent>
                      {activeDrawings.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.drawing_id_code} R{d.revision}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Query Type</Label>
                  <Select value={dqForm.query_type} onValueChange={(v) => setDqForm({ ...dqForm, query_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DQ_QUERY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Urgency</Label>
                  <Select value={dqForm.urgency} onValueChange={(v) => setDqForm({ ...dqForm, urgency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DQ_URGENCY.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Description *</Label>
                  <Textarea value={dqForm.description} onChange={(e) => setDqForm({ ...dqForm, description: e.target.value })} placeholder="Describe your query…" rows={3} />
                </div>
                <div>
                  <Label className="text-xs">Photo (optional)</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setDqPhoto(e.target.files?.[0] ?? null)} />
                </div>
                <Button className="w-full" onClick={handleRaiseDQ} disabled={dqSubmitting}>
                  {dqSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {archivedDrawings.length > 0 && (
            <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showArchived ? "Hide" : "Show"} History
            </Button>
          )}
        </div>
      </div>

      {activeDrawings.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No drawings linked.</p>}

      {activeDrawings.map((d: any) => (
        <div key={d.id} className={`flex items-center justify-between gap-2 p-2 rounded border ${moduleId && isModuleSpecific(d) ? "border-primary/50 bg-primary/5" : "border-border"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
            <span className="font-mono text-xs font-semibold">{d.drawing_id_code}</span>
            <span className="text-[10px]" style={{ color: "#999" }}>{d.drawing_type} · R{d.revision}</span>
            {moduleId && isModuleSpecific(d) && <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>Module</Badge>}
          </div>
          <a href={d.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
          </a>
        </div>
      ))}

      {showArchived && archivedDrawings.map((d: any) => (
        <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border" style={{ opacity: 0.5 }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="font-mono text-xs">{d.drawing_id_code}</span>
            <Badge variant="outline" className="text-[9px]" style={{ backgroundColor: "#F5F5F5", color: "#999", border: "none" }}>Archived R{d.revision}</Badge>
          </div>
          <a href={d.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
          </a>
        </div>
      ))}
    </div>
  );
}
