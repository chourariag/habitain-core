import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { insertNotifications } from "@/lib/notifications";
import { getAuthedClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2, Search, Upload, Download, FileText, MessageSquare,
  Plus, Filter, Clock, AlertTriangle, CheckCircle2, Eye
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const DRAWING_TYPES = ["Architectural", "Structural", "MEP", "BOQ Reference", "Site Plan"];
const DQ_STATUSES = ["open", "under_review", "resolved"];

export default function Drawings() {
  const [drawings, setDrawings] = useState<any[]>([]);
  const [dqs, setDqs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dqFilterProject, setDqFilterProject] = useState("all");
  const [dqFilterStatus, setDqFilterStatus] = useState("all");

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    project_id: "", module_id: "", drawing_type: "Architectural",
    drawing_id_code: "", notes: "", revision: 1,
    existing_drawing_code: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // DQ dialog
  const [dqOpen, setDqOpen] = useState(false);
  const [dqForm, setDqForm] = useState({
    project_id: "", module_id: "", drawing_id: "", description: "",
  });
  const [dqPhoto, setDqPhoto] = useState<File | null>(null);
  const [dqVoice, setDqVoice] = useState<File | null>(null);
  const [dqSubmitting, setDqSubmitting] = useState(false);

  // DQ detail
  const [selectedDq, setSelectedDq] = useState<any>(null);
  const [dqResponse, setDqResponse] = useState("");
  const [respondingDq, setRespondingDq] = useState(false);

  const canUpload = ["principal_architect", "project_architect", "structural_architect", "super_admin", "managing_director"].includes(userRole ?? "");
  const isArchitect = ["principal_architect", "project_architect", "structural_architect"].includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const [roleRes, profileRes] = await Promise.all([
        supabase.rpc("get_user_role", { _user_id: user.id }),
        supabase.from("profiles").select("display_name").eq("auth_user_id", user.id).maybeSingle(),
      ]);
      setUserRole(roleRes.data as string | null);
      setUserName((profileRes.data as any)?.display_name ?? user.email ?? "");
    }

    const [projectsRes, modulesRes, drawingsRes, dqsRes] = await Promise.all([
      supabase.from("projects").select("id,name").eq("is_archived", false).order("name"),
      supabase.from("modules").select("id,name,module_code,project_id").eq("is_archived", false),
      (supabase.from("drawings") as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      (supabase.from("design_queries") as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
    ]);

    setProjects(projectsRes.data ?? []);
    setModules(modulesRes.data ?? []);
    setDrawings(drawingsRes.data ?? []);
    setDqs(dqsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime for DQs
  useEffect(() => {
    const ch = supabase
      .channel("dq-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "design_queries" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const moduleMap = useMemo(() => {
    const m: Record<string, any> = {};
    modules.forEach((mod) => { m[mod.id] = mod; });
    return m;
  }, [modules]);

  // Get next DQ sequence for a project
  const getNextDqCode = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    const code = proj?.name?.substring(0, 2).toUpperCase() ?? "XX";
    const existing = dqs.filter((d) => d.project_id === projectId);
    return `DQ-${code}-${String(existing.length + 1).padStart(3, "0")}`;
  };

  // Filtered drawings
  const filteredDrawings = useMemo(() => {
    return drawings.filter((d) => {
      if (filterProject !== "all" && d.project_id !== filterProject) return false;
      if (filterType !== "all" && d.drawing_type !== filterType) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!d.drawing_id_code.toLowerCase().includes(term) && !d.file_name?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [drawings, filterProject, filterType, filterStatus, searchTerm]);

  // Filtered DQs
  const filteredDqs = useMemo(() => {
    return dqs.filter((d) => {
      if (dqFilterProject !== "all" && d.project_id !== dqFilterProject) return false;
      if (dqFilterStatus !== "all" && d.status !== dqFilterStatus) return false;
      return true;
    });
  }, [dqs, dqFilterProject, dqFilterStatus]);

  // Upload drawing
  const handleUploadDrawing = async () => {
    if (!uploadFile) { toast.error("Please select a file"); return; }
    if (!uploadForm.project_id) { toast.error("Please select a project"); return; }
    if (!uploadForm.drawing_id_code) { toast.error("Please enter a Drawing ID"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const ext = uploadFile.name.split(".").pop();
      const path = `${uploadForm.project_id}/${uploadForm.drawing_id_code.replace(/\s/g, "_")}_R${uploadForm.revision}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("drawings").upload(path, uploadFile, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(path);

      // If this is a revision of existing drawing, archive old ones
      if (uploadForm.existing_drawing_code) {
        const { client } = await getAuthedClient();
        await (client.from("drawings") as any)
          .update({ status: "archived" })
          .eq("drawing_id_code", uploadForm.existing_drawing_code)
          .eq("status", "active");

        // Notify quantity_surveyor
        const { data: qsProfiles } = await supabase.from("profiles")
          .select("auth_user_id").eq("role", "quantity_surveyor" as any).eq("is_active", true);
        if (qsProfiles?.length) {
          await insertNotifications(
            qsProfiles.map((p: any) => ({
              recipient_id: p.auth_user_id,
              title: "Drawing Revised",
              body: `Drawing ${uploadForm.drawing_id_code} has been revised to R${uploadForm.revision}. Please review for quantity changes.`,
              category: "design",
              related_table: "drawing",
            }))
          );
        }
      }

      const { client } = await getAuthedClient();
      const { error } = await (client.from("drawings") as any).insert({
        project_id: uploadForm.project_id,
        module_id: uploadForm.module_id || null,
        drawing_id_code: uploadForm.drawing_id_code,
        drawing_type: uploadForm.drawing_type,
        revision: uploadForm.revision,
        file_url: urlData.publicUrl,
        file_name: uploadFile.name,
        uploaded_by: user.id,
        uploaded_by_name: userName,
        notes: uploadForm.notes || null,
        status: "active",
      });
      if (error) throw error;

      toast.success("Drawing uploaded successfully");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadForm({ project_id: "", module_id: "", drawing_type: "Architectural", drawing_id_code: "", notes: "", revision: 1, existing_drawing_code: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Raise DQ
  const handleRaiseDQ = async () => {
    if (!dqForm.project_id || !dqForm.description) { toast.error("Project and description are required"); return; }
    setDqSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let photoUrl = null;
      let voiceUrl = null;

      if (dqPhoto) {
        const path = `dq-photos/${dqForm.project_id}/${Date.now()}.${dqPhoto.name.split(".").pop()}`;
        await supabase.storage.from("site-photos").upload(path, dqPhoto);
        photoUrl = supabase.storage.from("site-photos").getPublicUrl(path).data.publicUrl;
      }
      if (dqVoice) {
        const path = `${dqForm.project_id}/${Date.now()}.${dqVoice.name.split(".").pop()}`;
        await supabase.storage.from("voice-notes").upload(path, dqVoice);
        voiceUrl = supabase.storage.from("voice-notes").getPublicUrl(path).data.publicUrl;
      }

      const dqCode = getNextDqCode(dqForm.project_id);

      // Find assigned architect for this project (first project_architect profile)
      const { data: architects } = await supabase.from("profiles")
        .select("auth_user_id,display_name").eq("role", "project_architect" as any).eq("is_active", true).limit(3);
      const assignedArchitect = architects?.[0];

      const { client } = await getAuthedClient();
      const { error } = await (client.from("design_queries") as any).insert({
        project_id: dqForm.project_id,
        module_id: dqForm.module_id || null,
        dq_code: dqCode,
        drawing_id: dqForm.drawing_id || null,
        description: dqForm.description,
        photo_url: photoUrl,
        voice_note_url: voiceUrl,
        raised_by: user.id,
        raised_by_name: userName,
        assigned_architect_id: assignedArchitect?.auth_user_id ?? null,
        status: "open",
      });
      if (error) throw error;

      const { data: newDq } = await client.from("design_queries").select("id").eq("dq_code", dqCode).single();

      // Notify architect
      if (assignedArchitect) {
        await insertNotifications({
          recipient_id: assignedArchitect.auth_user_id,
          title: "New Design Query",
          body: `Design Query ${dqCode} raised. Please review.`,
          category: "design",
          related_table: "design_query",
        });
      }

      // Trigger Agent 6: DQ Consequence Statement
      if (newDq?.id) {
        supabase.functions.invoke("ai-agents", { body: { agent: "dq_consequence", payload: { dq_id: newDq.id } } }).catch(() => {});
      }

      toast.success(`Design Query ${dqCode} raised successfully`);
      setDqOpen(false);
      setDqForm({ project_id: "", module_id: "", drawing_id: "", description: "" });
      setDqPhoto(null);
      setDqVoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to raise DQ");
    } finally {
      setDqSubmitting(false);
    }
  };

  // Respond to DQ
  const handleRespondDQ = async (dq: any) => {
    if (!dqResponse.trim()) { toast.error("Please enter a response"); return; }
    setRespondingDq(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      const { error } = await (client.from("design_queries") as any).update({
        status: "under_review",
        response_text: dqResponse,
        responded_by: user.id,
        responded_by_name: userName,
        responded_at: new Date().toISOString(),
      }).eq("id", dq.id);
      if (error) throw error;

      // Notify raiser
      await insertNotifications({
        recipient_id: dq.raised_by,
        title: "DQ Response",
        body: `DQ ${dq.dq_code} has been responded to by ${userName}`,
        category: "design",
        related_table: "design_query",
      });

      toast.success("Response submitted");
      setDqResponse("");
      setSelectedDq(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to respond");
    } finally {
      setRespondingDq(false);
    }
  };

  // Resolve DQ
  const handleResolveDQ = async (dq: any) => {
    try {
      const { client } = await getAuthedClient();
      const { error } = await (client.from("design_queries") as any).update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", dq.id);
      if (error) throw error;
      toast.success(`${dq.dq_code} resolved`);
      setSelectedDq(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve");
    }
  };

  const dqStatusBadge = (status: string) => {
    switch (status) {
      case "open": return { bg: "#FFF0F0", color: "#F40009", label: "Open" };
      case "under_review": return { bg: "#FFF8E8", color: "#D4860A", label: "Under Review" };
      case "resolved": return { bg: "#E8F2ED", color: "#006039", label: "Resolved" };
      default: return { bg: "#F5F5F5", color: "#666666", label: status };
    }
  };

  const drawingStatusBadge = (status: string) => {
    return status === "active"
      ? { bg: "#E8F2ED", color: "#006039", label: "Active" }
      : { bg: "#F5F5F5", color: "#999999", label: `Archived` };
  };

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Drawings</h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>Architecture & Design Portal</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dqOpen} onOpenChange={setDqOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageSquare className="h-4 w-4" /> Raise DQ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Raise a Design Query</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Project *</Label>
                  <Select value={dqForm.project_id} onValueChange={(v) => setDqForm({ ...dqForm, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Module (optional)</Label>
                  <Select value={dqForm.module_id} onValueChange={(v) => setDqForm({ ...dqForm, module_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                    <SelectContent>
                      {modules.filter((m) => m.project_id === dqForm.project_id).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.module_code ?? m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Drawing Reference (optional)</Label>
                  <Select value={dqForm.drawing_id} onValueChange={(v) => setDqForm({ ...dqForm, drawing_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select drawing" /></SelectTrigger>
                    <SelectContent>
                      {drawings.filter((d) => d.project_id === dqForm.project_id && d.status === "active").map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.drawing_id_code} (R{d.revision})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Description *</Label>
                  <Textarea value={dqForm.description} onChange={(e) => setDqForm({ ...dqForm, description: e.target.value })}
                    placeholder="Describe your query…" rows={3} />
                </div>
                <div>
                  <Label className="text-xs">Photo (optional)</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setDqPhoto(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label className="text-xs">Voice Note (optional)</Label>
                  <Input type="file" accept="audio/*" onChange={(e) => setDqVoice(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={handleRaiseDQ} disabled={dqSubmitting} className="w-full" style={{ backgroundColor: "#006039", color: "#fff" }}>
                  {dqSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Submit Design Query
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {canUpload && (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" style={{ backgroundColor: "#006039", color: "#fff" }}>
                  <Upload className="h-4 w-4" /> Upload Drawing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Upload Drawing</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Project *</Label>
                    <Select value={uploadForm.project_id} onValueChange={(v) => setUploadForm({ ...uploadForm, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Module (optional)</Label>
                    <Select value={uploadForm.module_id} onValueChange={(v) => setUploadForm({ ...uploadForm, module_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                      <SelectContent>
                        {modules.filter((m) => m.project_id === uploadForm.project_id).map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.module_code ?? m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Drawing Type *</Label>
                    <Select value={uploadForm.drawing_type} onValueChange={(v) => setUploadForm({ ...uploadForm, drawing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DRAWING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Drawing ID *</Label>
                    <Input value={uploadForm.drawing_id_code} onChange={(e) => setUploadForm({ ...uploadForm, drawing_id_code: e.target.value })}
                      placeholder="e.g. VV-ARCH-001-R1" />
                  </div>
                  <div>
                    <Label className="text-xs">Revision Number</Label>
                    <Input type="number" min={1} value={uploadForm.revision}
                      onChange={(e) => setUploadForm({ ...uploadForm, revision: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-xs">Revising existing drawing? (leave blank for new)</Label>
                    <Select value={uploadForm.existing_drawing_code} onValueChange={(v) => setUploadForm({ ...uploadForm, existing_drawing_code: v })}>
                      <SelectTrigger><SelectValue placeholder="Select if revision" /></SelectTrigger>
                      <SelectContent>
                        {[...new Set(drawings.filter((d) => d.project_id === uploadForm.project_id && d.status === "active").map((d) => d.drawing_id_code))]
                          .map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">File (PDF or DWG) *</Label>
                    <Input type="file" accept=".pdf,.dwg,.DWG,.PDF" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea value={uploadForm.notes} onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })} rows={2} />
                  </div>
                  <Button onClick={handleUploadDrawing} disabled={uploading} className="w-full" style={{ backgroundColor: "#006039", color: "#fff" }}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Upload Drawing
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="drawings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drawings" className="gap-1.5"><FileText className="h-4 w-4" /> Drawings</TabsTrigger>
          <TabsTrigger value="dqs" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Design Queries
            {dqs.filter((d) => d.status === "open").length > 0 && (
              <Badge variant="outline" className="ml-1" style={{ backgroundColor: "#FFF0F0", color: "#F40009", border: "none" }}>
                {dqs.filter((d) => d.status === "open").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drawings" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#999" }} />
              <Input placeholder="Search by Drawing ID…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DRAWING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredDrawings.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No drawings found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredDrawings.map((d) => {
                const sb = drawingStatusBadge(d.status);
                return (
                  <div key={d.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
                    style={d.status === "archived" ? { opacity: 0.6 } : {}}>
                    <FileText className="h-5 w-5 shrink-0" style={{ color: "#006039" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold" style={{ color: "#1A1A1A" }}>{d.drawing_id_code}</span>
                        <Badge variant="outline" style={{ backgroundColor: sb.bg, color: sb.color, border: "none" }}>{sb.label}{d.status === "archived" ? ` R${d.revision}` : ""}</Badge>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F5F5F5", color: "#666" }}>{d.drawing_type}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: "#666666" }}>
                        <span>{projectMap[d.project_id] ?? "—"}</span>
                        <span>R{d.revision}</span>
                        <span>by {d.uploaded_by_name ?? "—"}</span>
                        <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1"><Download className="h-3.5 w-3.5" /> Download</Button>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dqs" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={dqFilterProject} onValueChange={setDqFilterProject}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dqFilterStatus} onValueChange={setDqFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredDqs.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No design queries found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredDqs.map((dq) => {
                const sb = dqStatusBadge(dq.status);
                return (
                  <button key={dq.id} type="button" onClick={() => setSelectedDq(dq)}
                    className="w-full bg-card border border-border rounded-lg p-3 text-left hover:border-[#006039]/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold" style={{ color: "#1A1A1A" }}>{dq.dq_code}</span>
                          <Badge variant="outline" style={{ backgroundColor: sb.bg, color: sb.color, border: "none" }}>{sb.label}</Badge>
                        </div>
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: "#666" }}>{dq.description}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs" style={{ color: "#999" }}>
                          <span>{projectMap[dq.project_id] ?? "—"}</span>
                          {dq.module_id && <span>{moduleMap[dq.module_id]?.name ?? "—"}</span>}
                          <span>by {dq.raised_by_name ?? "—"}</span>
                          <span>{formatDistanceToNow(new Date(dq.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      {dq.photo_url && <img src={dq.photo_url} alt="" className="h-12 w-12 rounded object-cover shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DQ Detail Dialog */}
      {selectedDq && (
        <Dialog open={!!selectedDq} onOpenChange={() => setSelectedDq(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedDq.dq_code}
                {(() => { const sb = dqStatusBadge(selectedDq.status); return <Badge variant="outline" style={{ backgroundColor: sb.bg, color: sb.color, border: "none" }}>{sb.label}</Badge>; })()}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium" style={{ color: "#999" }}>Project</p>
                <p className="text-sm">{projectMap[selectedDq.project_id] ?? "—"}</p>
              </div>
              {selectedDq.module_id && (
                <div>
                  <p className="text-xs font-medium" style={{ color: "#999" }}>Module</p>
                  <p className="text-sm">{moduleMap[selectedDq.module_id]?.name ?? "—"}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium" style={{ color: "#999" }}>Description</p>
                <p className="text-sm">{selectedDq.description}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "#999" }}>Raised by</p>
                <p className="text-sm">{selectedDq.raised_by_name} · {formatDistanceToNow(new Date(selectedDq.created_at), { addSuffix: true })}</p>
              </div>
              {selectedDq.photo_url && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "#999" }}>Photo</p>
                  <img src={selectedDq.photo_url} alt="DQ Photo" className="rounded-md max-h-48 object-contain" />
                </div>
              )}
              {selectedDq.voice_note_url && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "#999" }}>Voice Note</p>
                  <audio controls src={selectedDq.voice_note_url} className="w-full" />
                </div>
              )}

              {selectedDq.response_text && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium" style={{ color: "#006039" }}>Response</p>
                  <p className="text-sm mt-1">{selectedDq.response_text}</p>
                  <p className="text-xs mt-1" style={{ color: "#999" }}>
                    by {selectedDq.responded_by_name} · {selectedDq.responded_at ? formatDistanceToNow(new Date(selectedDq.responded_at), { addSuffix: true }) : ""}
                  </p>
                </div>
              )}

              {/* Architect can respond */}
              {isArchitect && selectedDq.status === "open" && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-xs">Your Response</Label>
                  <Textarea value={dqResponse} onChange={(e) => setDqResponse(e.target.value)} placeholder="Type your clarification…" rows={3} />
                  <Button onClick={() => handleRespondDQ(selectedDq)} disabled={respondingDq} style={{ backgroundColor: "#006039", color: "#fff" }}>
                    {respondingDq ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Submit Response
                  </Button>
                </div>
              )}

              {/* Architect can resolve */}
              {isArchitect && selectedDq.status === "under_review" && (
                <div className="border-t pt-3">
                  <Button onClick={() => handleResolveDQ(selectedDq)} variant="outline" className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Mark as Resolved
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
