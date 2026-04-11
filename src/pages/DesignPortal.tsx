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
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2, Search, Upload, Download, FileText, MessageSquare,
  Plus, Clock, AlertTriangle, CheckCircle2, XCircle,
  ArrowLeft, Flame, Eye
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { projectCode } from "@/lib/code-generators";
import { BriefScopeSection } from "@/components/design/BriefScopeSection";
import { ConsultantRow } from "@/components/design/ConsultantRow";
import { ProjectHealthCard } from "@/components/design/ProjectHealthCard";
import { MasterQCChecklist } from "@/components/design/MasterQCChecklist";
import { DetailLibraryTab } from "@/components/design/DetailLibraryTab";
import { DrawingApprovalSheet } from "@/components/design/DrawingApprovalSheet";
import { DQStatsBar, DQEscalationBadge } from "@/components/design/DQStatsBar";

const DRAWING_TYPES = ["Architectural", "Structural", "MEP", "BOQ Reference", "Site Plan"];
const DESIGN_STAGES_ORDER = ["Concept Design", "Schematic Design", "Design Development", "Working Drawings", "GFC Issue"];
const STAGE_STATUSES = ["not_started", "in_progress", "submitted_to_client", "revision_requested", "client_approved"];
const DQ_QUERY_TYPES = ["Dimension Clarification", "Material Specification", "Structural Query", "MEP Routing", "Opening Position", "Finishing Detail", "Other"];
const DQ_URGENCY = ["Critical", "High", "Normal"];

const stageStatusLabel = (s: string) => ({
  not_started: "Not Started", in_progress: "In Progress", submitted_to_client: "Submitted to Client",
  revision_requested: "Revision Requested", client_approved: "Client Approved",
}[s] ?? s);

const stageStatusStyle = (s: string): React.CSSProperties => ({
  not_started: { backgroundColor: "#F5F5F5", color: "#666666" },
  in_progress: { backgroundColor: "#FFF8E8", color: "#D4860A" },
  submitted_to_client: { backgroundColor: "#E8F0FE", color: "#1A73E8" },
  revision_requested: { backgroundColor: "#FFF0F0", color: "#F40009" },
  client_approved: { backgroundColor: "#E8F2ED", color: "#006039" },
}[s] ?? { backgroundColor: "#F5F5F5", color: "#666666" });

export default function DesignPortal() {
  const [loading, setLoading] = useState(true);
  const [countsLoading, setCountsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [dqs, setDqs] = useState<any[]>([]);
  const [designFiles, setDesignFiles] = useState<any[]>([]);
  const [designStages, setDesignStages] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFileTab, setProjectFileTab] = useState("design-file");
  const [detailStats, setDetailStats] = useState({ complete: 0, inProgress: 0, notStarted: 40, na: 0, total: 40 });

  // Filters
  const [dqFilterProject, setDqFilterProject] = useState("all");
  const [dqFilterStatus, setDqFilterStatus] = useState("all");
  const [dqFilterUrgency, setDqFilterUrgency] = useState("all");
  const [drawingFilterProject, setDrawingFilterProject] = useState("all");
  const [drawingFilterType, setDrawingFilterType] = useState("all");
  const [drawingFilterStatus, setDrawingFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // DQ Dialog
  const [dqOpen, setDqOpen] = useState(false);
  const [dqForm, setDqForm] = useState({
    project_id: "", module_id: "", drawing_id: "", description: "",
    query_type: "Other", urgency: "Normal", affected_area: "",
  });
  const [dqPhoto, setDqPhoto] = useState<File | null>(null);
  const [dqVoice, setDqVoice] = useState<File | null>(null);
  const [dqSubmitting, setDqSubmitting] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    project_id: "", module_id: "", drawing_type: "Architectural",
    drawing_id_code: "", notes: "", revision: 1, existing_drawing_code: "", revision_reason: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // DQ detail
  const [selectedDq, setSelectedDq] = useState<any>(null);
  const [dqResponse, setDqResponse] = useState("");
  const [respondingDq, setRespondingDq] = useState(false);

  const isPrincipal = userRole === "principal_architect";
  const canUpload = ["principal_architect", "project_architect", "structural_architect", "super_admin", "managing_director"].includes(userRole ?? "");
  const isArchitect = ["principal_architect", "project_architect", "structural_architect"].includes(userRole ?? "");

  const dedupe = <T extends { id?: string }>(arr: T[]): T[] =>
    Array.from(new Map(arr.map((item) => [(item as any).id ?? JSON.stringify(item), item])).values());

  const normalizeProjectLevelDesignStages = useCallback((rows: any[]) => {
    const canonical = new Map<string, any>();

    [...(rows ?? [])]
      .filter((row) => row?.project_id && row?.stage_name)
      .sort((a, b) => {
        const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      })
      .forEach((row) => {
        const key = `${row.project_id}:${row.stage_name}`;
        if (!canonical.has(key)) {
          canonical.set(key, row);
        }
      });

    return Array.from(canonical.values()).sort((a, b) => {
      if (a.project_id === b.project_id) {
        return (a.stage_order ?? 0) - (b.stage_order ?? 0);
      }
      return String(a.project_id).localeCompare(String(b.project_id));
    });
  }, []);

  const fetchStageCounts = useCallback(async () => {
    setCountsLoading(true);
    const [dsRes, dfRes, dqsRes] = await Promise.all([
      (supabase.from("design_stages") as any).select("*").order("stage_order"),
      (supabase.from("project_design_files") as any).select("*"),
      (supabase.from("design_queries") as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
    ]);
    setDesignStages(normalizeProjectLevelDesignStages(dsRes.data ?? []));
    setDesignFiles(dedupe(dfRes.data ?? []));
    setDqs(dedupe(dqsRes.data ?? []));
    setCountsLoading(false);
  }, [normalizeProjectLevelDesignStages]);

  const fetchData = useCallback(async () => {
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

    const [projectsRes, drawingsRes, dqsRes, dfRes, dsRes, dcRes] = await Promise.all([
      supabase.from("projects").select("id,name,client_name,status,updated_at").eq("is_archived", false).order("name"),
      (supabase.from("drawings") as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      (supabase.from("design_queries") as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      (supabase.from("project_design_files") as any).select("*"),
      (supabase.from("design_stages") as any).select("*").order("stage_order"),
      (supabase.from("design_consultants") as any).select("*").order("created_at"),
    ]);

    setProjects(dedupe(projectsRes.data ?? []));
    setDrawings(dedupe(drawingsRes.data ?? []));
    setDqs(dedupe(dqsRes.data ?? []));
    setDesignFiles(dedupe(dfRes.data ?? []));
    setDesignStages(normalizeProjectLevelDesignStages(dsRes.data ?? []));
    setConsultants(dedupe(dcRes.data ?? []));
    setLoading(false);
    setCountsLoading(false);
  }, [normalizeProjectLevelDesignStages]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stable ref for fetchStageCounts so realtime callback doesn't go stale
  const fetchStageCountsRef = useRef(fetchStageCounts);
  fetchStageCountsRef.current = fetchStageCounts;

  // Single realtime channel — created once, never recreated
  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (channelRef.current) return; // already subscribed
    channelRef.current = supabase
      .channel("design-dashboard-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "design_stages" }, () => {
        fetchStageCountsRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "design_queries" }, () => {
        fetchStageCountsRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_design_files" }, () => {
        fetchStageCountsRef.current();
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // empty deps — runs once

  // Fallback: refetch on window/tab focus
  useEffect(() => {
    const onFocus = () => { fetchStageCountsRef.current(); };
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("focus", onFocus); };
  }, []);

  const projectMap = useMemo(() => {
    const m: Record<string, any> = {};
    projects.forEach((p) => { m[p.id] = p; });
    return m;
  }, [projects]);

  // ── Design stage counts: determine each project's current stage from design_stages table ──
  const designStageCounts = useMemo(() => {
    const stageMap: Record<string, string> = {
      "Concept Design": "concept", "Schematic Design": "schematic",
      "Design Development": "design_development", "Working Drawings": "working_drawings", "GFC Issue": "gfc_issued",
    };
    const counts: Record<string, number> = { brief: 0, concept: 0, schematic: 0, design_development: 0, working_drawings: 0, gfc_issued: 0 };

    projects.forEach((p) => {
      const df = designFiles.find((d: any) => d.project_id === p.id);
      if (df?.design_stage === "gfc_issued") {
        counts.gfc_issued++;
        return;
      }

      const projStages = designStages.filter((s: any) => s.project_id === p.id);
      if (projStages.length === 0) {
        counts.brief++;
        return;
      }

      // Find the highest approved stage
      const approved = projStages.filter((s: any) => s.status === "client_approved");
      if (approved.length > 0) {
        const maxApproved = approved.reduce((a: any, b: any) => a.stage_order > b.stage_order ? a : b);
        // Check if there's a next stage in progress
        const nextInProgress = projStages.find((s: any) => s.stage_order > maxApproved.stage_order && s.status !== "not_started");
        if (nextInProgress) {
          counts[stageMap[nextInProgress.stage_name] ?? "brief"]++;
        } else {
          counts[stageMap[maxApproved.stage_name] ?? "brief"]++;
        }
        return;
      }

      // No approved stages — find first non-not_started stage
      const active = projStages.filter((s: any) => s.status !== "not_started");
      if (active.length > 0) {
        const first = active.reduce((a: any, b: any) => a.stage_order < b.stage_order ? a : b);
        counts[stageMap[first.stage_name] ?? "brief"]++;
      } else {
        counts.brief++;
      }
    });

    return counts;
  }, [projects, designFiles, designStages]);

  const pendingClientApprovals = useMemo(() => designStages.filter((s: any) => s.status === "submitted_to_client").length, [designStages]);
  const openDqCount = useMemo(() => dqs.filter((d: any) => d.status === "open").length, [dqs]);
  const criticalDqCount = useMemo(() => dqs.filter((d: any) => d.status === "open" && d.urgency === "Critical").length, [dqs]);
  const gfcReadyCount = designStageCounts.gfc_issued;

  // ──── DQ helpers ────
  const getNextDqCode = (projectId: string) => {
    const proj = projects.find((p: any) => p.id === projectId);
    const code = proj ? projectCode(proj.name) : "XX";
    const existing = dqs.filter((d: any) => d.project_id === projectId);
    return `DQ-${code}-${String(existing.length + 1).padStart(3, "0")}`;
  };

  const urgencyStyle = (u: string): React.CSSProperties => {
    if (u === "Critical") return { backgroundColor: "#FFF0F0", color: "#F40009" };
    if (u === "High") return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    return { backgroundColor: "#F5F5F5", color: "#666666" };
  };

  const dqStatusStyle = (s: string): React.CSSProperties => {
    if (s === "open") return { backgroundColor: "#FFF0F0", color: "#F40009" };
    if (s === "under_review") return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    if (s === "resolved") return { backgroundColor: "#E8F2ED", color: "#006039" };
    return { backgroundColor: "#F5F5F5", color: "#666666" };
  };

  const dqStatusLabel = (s: string) => ({ open: "Open", under_review: "In Review", resolved: "Resolved", closed: "Closed" }[s] ?? s);

  // ──── Filtered data ────
  const filteredDqs = useMemo(() => {
    return dqs.filter((d: any) => {
      if (dqFilterProject !== "all" && d.project_id !== dqFilterProject) return false;
      if (dqFilterStatus !== "all" && d.status !== dqFilterStatus) return false;
      if (dqFilterUrgency !== "all" && d.urgency !== dqFilterUrgency) return false;
      return true;
    });
  }, [dqs, dqFilterProject, dqFilterStatus, dqFilterUrgency]);

  const filteredDrawings = useMemo(() => {
    return drawings.filter((d: any) => {
      if (drawingFilterProject !== "all" && d.project_id !== drawingFilterProject) return false;
      if (drawingFilterType !== "all" && d.drawing_type !== drawingFilterType) return false;
      if (drawingFilterStatus !== "all" && d.status !== drawingFilterStatus) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!d.drawing_id_code.toLowerCase().includes(t) && !d.file_name?.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [drawings, drawingFilterProject, drawingFilterType, drawingFilterStatus, searchTerm]);

  // ──── Actions ────
  const handleRaiseDQ = async () => {
    if (!dqForm.project_id || !dqForm.description) { toast.error("Project and description are required"); return; }
    setDqSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let photoUrl = null, voiceUrl = null;
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
        query_type: dqForm.query_type,
        urgency: dqForm.urgency,
        affected_area: dqForm.affected_area || null,
        photo_url: photoUrl,
        voice_note_url: voiceUrl,
        raised_by: user.id,
        raised_by_name: userName,
        assigned_architect_id: assignedArchitect?.auth_user_id ?? null,
        status: "open",
      });
      if (error) throw error;

      if (assignedArchitect) {
        await insertNotifications({
          recipient_id: assignedArchitect.auth_user_id,
          title: "New Design Query",
          body: `Design Query ${dqCode} (${dqForm.urgency}) raised. Please review.`,
          category: "design",
          related_table: "design_query",
        });
      }

      toast.success(`Design Query ${dqCode} raised`);
      setDqOpen(false);
      setDqForm({ project_id: "", module_id: "", drawing_id: "", description: "", query_type: "Other", urgency: "Normal", affected_area: "" });
      setDqPhoto(null);
      setDqVoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to raise DQ");
    } finally {
      setDqSubmitting(false);
    }
  };

  const handleRespondDQ = async (dq: any) => {
    if (!dqResponse.trim()) { toast.error("Enter a response"); return; }
    setRespondingDq(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      await (client.from("design_queries") as any).update({
        status: "under_review", response_text: dqResponse,
        responded_by: user.id, responded_by_name: userName,
        responded_at: new Date().toISOString(),
      }).eq("id", dq.id);

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
      toast.error(err.message);
    } finally {
      setRespondingDq(false);
    }
  };

  const handleResolveDQ = async (dq: any) => {
    try {
      const { client } = await getAuthedClient();
      await (client.from("design_queries") as any).update({
        status: "resolved", resolved_at: new Date().toISOString(),
      }).eq("id", dq.id);
      toast.success(`${dq.dq_code} resolved`);
      setSelectedDq(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUploadDrawing = async () => {
    if (!uploadFile || !uploadForm.project_id || !uploadForm.drawing_id_code) {
      toast.error("File, project, and Drawing ID are required"); return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = uploadFile.name.split(".").pop();
      const path = `${uploadForm.project_id}/${uploadForm.drawing_id_code.replace(/\s/g, "_")}_R${uploadForm.revision}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("drawings").upload(path, uploadFile, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("drawings").getPublicUrl(path);

      if (uploadForm.existing_drawing_code) {
        const { client } = await getAuthedClient();
        await (client.from("drawings") as any)
          .update({ status: "archived" })
          .eq("drawing_id_code", uploadForm.existing_drawing_code)
          .eq("status", "active");

        const { data: qsProfiles } = await supabase.from("profiles")
          .select("auth_user_id").eq("role", "quantity_surveyor" as any).eq("is_active", true);
        if (qsProfiles?.length) {
          await insertNotifications(
            qsProfiles.map((p: any) => ({
              recipient_id: p.auth_user_id,
              title: "Drawing Revised",
              body: `Drawing ${uploadForm.drawing_id_code} revised to R${uploadForm.revision}. Please review for quantity changes.`,
              category: "design",
              related_table: "drawing",
            }))
          );
        }
      }

      const { client } = await getAuthedClient();
      await (client.from("drawings") as any).insert({
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
        revision_reason: uploadForm.revision_reason || null,
        status: "active",
      });

      toast.success("Drawing uploaded");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadForm({ project_id: "", module_id: "", drawing_type: "Architectural", drawing_id_code: "", notes: "", revision: 1, existing_drawing_code: "", revision_reason: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ──── Initialize design file & stages for a project ────
  const initProjectDesignFile = async (projId: string) => {
    const existing = designFiles.find((d: any) => d.project_id === projId);
    if (!existing) {
      const { client } = await getAuthedClient();
      await (client.from("project_design_files") as any).insert({ project_id: projId, created_by: userId });
      const stageInserts = DESIGN_STAGES_ORDER.map((name, i) => ({
        project_id: projId, stage_name: name, stage_order: i + 1, status: "not_started",
      }));
      await (client.from("design_stages") as any).insert(stageInserts);
      await fetchData();
    }
    setSelectedProjectId(projId);
    setActiveTab("project-file");
  };

  // ──── Update design stage ────
  const updateStage = async (stageId: string, updates: Record<string, any>) => {
    const { client } = await getAuthedClient();
    await (client.from("design_stages") as any).update(updates).eq("id", stageId);
    // Lightweight refetch of stages only
    const { data } = await (supabase.from("design_stages") as any).select("*").order("stage_order");
    setDesignStages(normalizeProjectLevelDesignStages(data ?? []));
  };

  // ──── Add consultant ────
  const addConsultant = async (projId: string) => {
    const { client } = await getAuthedClient();
    await (client.from("design_consultants") as any).insert({
      project_id: projId, consultant_type: "Other", name: "New Consultant",
    });
    const { data } = await (supabase.from("design_consultants") as any).select("*").order("created_at");
    setConsultants(data ?? []);
  };

  const refreshConsultants = useCallback(async () => {
    const { data } = await (supabase.from("design_consultants") as any).select("*").order("created_at");
    setConsultants(data ?? []);
  }, []);

  // ──── Issue GFC ────
  const issueGFC = async (projId: string) => {
    const { client } = await getAuthedClient();
    await (client.from("project_design_files") as any).update({ design_stage: "gfc_issued" }).eq("project_id", projId);

    const { data: prodProfiles } = await supabase.from("profiles")
      .select("auth_user_id").in("role", ["production_head", "planning_engineer", "factory_floor_supervisor"] as any[]).eq("is_active", true);
    const projName = projectMap[projId]?.name ?? "Unknown";
    if (prodProfiles?.length) {
      await insertNotifications(
        prodProfiles.map((p: any) => ({
          recipient_id: p.auth_user_id,
          title: "GFC Issued",
          body: `GFC issued for ${projName} — drawings now available in production.`,
          category: "design",
          related_table: "project",
          related_id: projId,
        }))
      );
    }

    toast.success(`GFC issued for ${projName}`);
    fetchData();
  };




  // ──── Helper for design stage label on dashboard ────
  const getDesignStage = (projectId: string) => {
    const df = designFiles.find((d: any) => d.project_id === projectId);
    return df?.design_stage ?? "brief";
  };

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const selectedDF = designFiles.find((d: any) => d.project_id === selectedProjectId);
  const selectedStages = designStages.filter((s: any) => s.project_id === selectedProjectId);
  const selectedConsultants = consultants.filter((c: any) => c.project_id === selectedProjectId);
  const selectedDrawings = drawings.filter((d: any) => d.project_id === selectedProjectId);
  const selectedProject = selectedProjectId ? projectMap[selectedProjectId] : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {activeTab === "project-file" && (
            <Button variant="ghost" size="icon" onClick={() => setActiveTab("dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {activeTab === "project-file" ? selectedProject?.name ?? "Project" : "Design Portal"}
            </h1>
            <p className="text-sm mt-1" style={{ color: "#666666" }}>
              {activeTab === "project-file" ? "Project Design File" : "Architecture & Design Management"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={dqOpen} onOpenChange={setDqOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageSquare className="h-4 w-4" /> Raise DQ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  <Label className="text-xs">Drawing Reference (optional)</Label>
                  <Select value={dqForm.drawing_id} onValueChange={(v) => setDqForm({ ...dqForm, drawing_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select drawing" /></SelectTrigger>
                    <SelectContent>
                      {drawings.filter((d: any) => d.project_id === dqForm.project_id && d.status === "active").map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.drawing_id_code} (R{d.revision})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Query Type *</Label>
                  <Select value={dqForm.query_type} onValueChange={(v) => setDqForm({ ...dqForm, query_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DQ_QUERY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Urgency *</Label>
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
                  <Label className="text-xs">Affected Area (optional)</Label>
                  <Input value={dqForm.affected_area} onChange={(e) => setDqForm({ ...dqForm, affected_area: e.target.value })} placeholder="e.g. Kitchen Wall Panel 3" />
                </div>
                <div>
                  <Label className="text-xs">Photo (optional)</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setDqPhoto(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label className="text-xs">Voice Note (optional)</Label>
                  <Input type="file" accept="audio/*" onChange={(e) => setDqVoice(e.target.files?.[0] ?? null)} />
                </div>
                <Button className="w-full" onClick={handleRaiseDQ} disabled={dqSubmitting}>
                  {dqSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit Design Query
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {canUpload && (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> Upload Drawing</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                    <Label className="text-xs">Drawing Type</Label>
                    <Select value={uploadForm.drawing_type} onValueChange={(v) => setUploadForm({ ...uploadForm, drawing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DRAWING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Drawing ID *</Label>
                    <Input value={uploadForm.drawing_id_code} onChange={(e) => setUploadForm({ ...uploadForm, drawing_id_code: e.target.value })} placeholder="e.g. VV-ARCH-001-R1" />
                  </div>
                  <div>
                    <Label className="text-xs">Revision Number</Label>
                    <Input type="number" value={uploadForm.revision} onChange={(e) => setUploadForm({ ...uploadForm, revision: parseInt(e.target.value) || 1 })} min={1} />
                  </div>
                  <div>
                    <Label className="text-xs">Existing Drawing Code (for revision)</Label>
                    <Input value={uploadForm.existing_drawing_code} onChange={(e) => setUploadForm({ ...uploadForm, existing_drawing_code: e.target.value })} placeholder="Leave blank for new drawing" />
                  </div>
                  <div>
                    <Label className="text-xs">Revision Reason</Label>
                    <Select value={uploadForm.revision_reason} onValueChange={(v) => setUploadForm({ ...uploadForm, revision_reason: v })}>
                      <SelectTrigger><SelectValue placeholder="Select reason (optional)" /></SelectTrigger>
                      <SelectContent>
                        {["Client Design Change", "Structural Input", "MEP Coordination", "Material Change", "Site Constraint", "Other"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">File (PDF, DWG or DXF) *</Label>
                    <Input type="file" accept=".pdf,.dwg,.DWG,.PDF,.dxf,.DXF" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={uploadForm.notes} onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })} rows={2} />
                  </div>
                  <Button className="w-full" onClick={handleUploadDrawing} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Upload
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {activeTab !== "project-file" ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollableTabsWrapper>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="drawings-register">Drawings</TabsTrigger>
              <TabsTrigger value="dq-register">Design Queries</TabsTrigger>
            </TabsList>
          </ScrollableTabsWrapper>

          {/* ═══════ TAB 1: Dashboard ═══════ */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: "Brief", count: designStageCounts.brief },
                { label: "Concept", count: designStageCounts.concept },
                { label: "Schematic", count: designStageCounts.schematic },
                { label: "Design Dev", count: designStageCounts.design_development },
                { label: "Working Dwgs", count: designStageCounts.working_drawings },
              ].map((s) => (
                <Card key={s.label} className="text-center">
                  <CardContent className="pt-4 pb-3">
                    {countsLoading ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-7 w-10 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-16 rounded bg-muted animate-pulse mt-1" />
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{s.count}</p>
                        <p className="text-xs mt-1" style={{ color: "#666666" }}>{s.label}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card style={!countsLoading && openDqCount > 0 ? { backgroundColor: criticalDqCount > 0 ? "#FFF0F0" : "#FFF8E8" } : {}}>
                <CardContent className="pt-4 pb-3 text-center">
                  {countsLoading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-10 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-16 rounded bg-muted animate-pulse mt-1" />
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold" style={{ color: criticalDqCount > 0 ? "#F40009" : openDqCount > 0 ? "#D4860A" : "#1A1A1A" }}>
                        {openDqCount}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#666666" }}>Open DQs</p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  {countsLoading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-10 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-16 rounded bg-muted animate-pulse mt-1" />
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold" style={{ color: pendingClientApprovals > 0 ? "#D4860A" : "#1A1A1A" }}>{pendingClientApprovals}</p>
                      <p className="text-xs mt-1" style={{ color: "#666666" }}>Pending Approvals</p>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  {countsLoading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-7 w-10 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-16 rounded bg-muted animate-pulse mt-1" />
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{gfcReadyCount}</p>
                      <p className="text-xs mt-1" style={{ color: "#666666" }}>GFC Issued</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Project list */}
            <div>
              <h2 className="font-semibold text-foreground mb-3">Projects</h2>
              <div className="space-y-2">
                {projects.map((p) => {
                  const stage = getDesignStage(p.id);
                  const pDqs = dqs.filter((d: any) => d.project_id === p.id && d.status === "open").length;
                  const df = designFiles.find((d: any) => d.project_id === p.id);
                  const isDesignOnly = df?.is_design_only !== false;
                  return (
                    <button key={p.id} type="button" onClick={() => initProjectDesignFile(p.id)}
                      className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{p.name}</p>
                          <p className="text-xs truncate" style={{ color: "#666666" }}>{p.client_name || "No client"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" style={isDesignOnly
                            ? { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none" }
                            : { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "none" }
                          } className="text-[10px]">
                            {isDesignOnly ? "Design Only" : "Linked"}
                          </Badge>
                          {pDqs > 0 && <Badge variant="outline" style={{ backgroundColor: "#FFF0F0", color: "#F40009", border: "none" }}>{pDqs} DQ</Badge>}
                          <Badge variant="outline" style={stageStatusStyle(stage === "gfc_issued" ? "client_approved" : "in_progress")}>
                            {stage.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ═══════ TAB 3: DQ Register ═══════ */}
          <TabsContent value="dq-register" className="space-y-4">
            <DQStatsBar dqs={dqs} />
            <div className="flex flex-wrap gap-2">
              <Select value={dqFilterProject} onValueChange={setDqFilterProject}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={dqFilterStatus} onValueChange={setDqFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dqFilterUrgency} onValueChange={setDqFilterUrgency}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Urgency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {DQ_URGENCY.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selectedDq ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDq(null)}><ArrowLeft className="h-4 w-4" /></Button>
                    <CardTitle className="text-lg">{selectedDq.dq_code}</CardTitle>
                    <Badge variant="outline" style={dqStatusStyle(selectedDq.status)}>{dqStatusLabel(selectedDq.status)}</Badge>
                    <Badge variant="outline" style={urgencyStyle(selectedDq.urgency ?? "Normal")}>{selectedDq.urgency ?? "Normal"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#666666" }}>Project</p>
                    <p className="text-sm">{projectMap[selectedDq.project_id]?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#666666" }}>Raised by</p>
                    <p className="text-sm">{selectedDq.raised_by_name ?? "—"} · {formatDistanceToNow(new Date(selectedDq.created_at), { addSuffix: true })}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#666666" }}>Description</p>
                    <p className="text-sm">{selectedDq.description}</p>
                  </div>
                  {selectedDq.photo_url && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Photo</p>
                      <img src={selectedDq.photo_url} alt="DQ" className="rounded max-h-48 object-cover" />
                    </div>
                  )}
                  {selectedDq.voice_note_url && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: "#666666" }}>Voice Note</p>
                      <audio controls src={selectedDq.voice_note_url} className="w-full" />
                    </div>
                  )}
                  {selectedDq.response_text && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium" style={{ color: "#666666" }}>Response from {selectedDq.responded_by_name}</p>
                      <p className="text-sm mt-1">{selectedDq.response_text}</p>
                    </div>
                  )}
                  {isArchitect && selectedDq.status === "open" && (
                    <div className="border-t pt-3 space-y-2">
                      <Textarea value={dqResponse} onChange={(e) => setDqResponse(e.target.value)} placeholder="Type your response…" rows={3} />
                      <Button onClick={() => handleRespondDQ(selectedDq)} disabled={respondingDq}>
                        {respondingDq ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Respond
                      </Button>
                    </div>
                  )}
                  {isArchitect && selectedDq.status === "under_review" && (
                    <Button variant="outline" onClick={() => handleResolveDQ(selectedDq)} style={{ color: "#006039", borderColor: "#006039" }}>
                      Mark Resolved
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredDqs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No design queries found.</p>}
                {filteredDqs.map((dq: any) => {
                  const hoursOpen = (Date.now() - new Date(dq.created_at).getTime()) / (1000 * 60 * 60);
                  return (
                    <button key={dq.id} type="button" onClick={() => setSelectedDq(dq)}
                      className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          {hoursOpen > 24 && dq.status !== "resolved" && <Flame className="h-4 w-4 shrink-0" style={{ color: "#F40009" }} />}
                          <span className="font-mono text-sm font-semibold">{dq.dq_code}</span>
                          <span className="text-xs truncate" style={{ color: "#666666" }}>{projectMap[dq.project_id]?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DQEscalationBadge dq={dq} />
                          <Badge variant="outline" style={urgencyStyle(dq.urgency ?? "Normal")} className="text-[10px]">{dq.urgency ?? "Normal"}</Badge>
                          <Badge variant="outline" style={dqStatusStyle(dq.status)} className="text-[10px]">{dqStatusLabel(dq.status)}</Badge>
                        </div>
                      </div>
                      <p className="text-xs mt-1.5 line-clamp-1" style={{ color: "#666666" }}>{dq.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "#999999" }}>
                        <span>{dq.raised_by_name}</span>
                        <span>{formatDistanceToNow(new Date(dq.created_at), { addSuffix: true })}</span>
                        <span>{Math.floor(hoursOpen / 24)}d open</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ═══════ TAB 4: Drawings Register ═══════ */}
          <TabsContent value="drawings-register" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search drawings…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={drawingFilterProject} onValueChange={setDrawingFilterProject}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={drawingFilterType} onValueChange={setDrawingFilterType}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DRAWING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={drawingFilterStatus} onValueChange={setDrawingFilterStatus}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredDrawings.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No drawings found.</p>}
              {filteredDrawings.map((d: any) => (
                <div key={d.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
                  style={d.status === "archived" ? { opacity: 0.6 } : {}}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                      <span className="font-mono text-sm font-semibold">{d.drawing_id_code}</span>
                      {d.drawing_title && <span className="text-xs text-muted-foreground">— {d.drawing_title}</span>}
                      <Badge variant="outline" style={d.status === "active" ? { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "none" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none" }}>
                        {d.status === "active" ? "Active" : `Archived R${d.revision}`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <span>{projectMap[d.project_id]?.name}</span>
                      <span>{d.drawing_type}</span>
                      <span>R{d.revision}</span>
                      <span>{d.uploaded_by_name}</span>
                      <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="mt-1.5">
                      <DrawingApprovalSheet drawing={d} isArchitect={isArchitect} userId={userId} userName={userName} onRefresh={fetchData} />
                    </div>
                  </div>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                  </a>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        /* ═══════ Project Design File View ═══════ */
        <div className="space-y-6">
          {selectedProject && (
            <ProjectHealthCard
              project={selectedProject}
              designFile={selectedDF}
              designStages={designStages}
              architects={[]}
            />
          )}

          <Tabs value={projectFileTab} onValueChange={setProjectFileTab}>
            <ScrollableTabsWrapper>
              <TabsList>
                <TabsTrigger value="design-file">Project Design File</TabsTrigger>
                <TabsTrigger value="qc-checklist">QC Checklist</TabsTrigger>
                <TabsTrigger value="detail-library">Detail Library</TabsTrigger>
                <TabsTrigger value="consultants">Consultants</TabsTrigger>
                <TabsTrigger value="drawings">Drawings</TabsTrigger>
              </TabsList>
            </ScrollableTabsWrapper>

            <TabsContent value="design-file" className="space-y-6">
              <BriefScopeSection
                designFile={selectedDF}
                projectId={selectedProjectId!}
                canEdit={canUpload}
                onSaved={fetchData}
              />

              <Card>
                <CardHeader><CardTitle className="text-lg">B — Design Stages & Client Approvals</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {selectedStages.map((stage: any) => (
                    <div key={stage.id} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{stage.stage_name}</h4>
                        <Badge variant="outline" style={stageStatusStyle(stage.status)}>{stageStatusLabel(stage.status)}</Badge>
                      </div>
                      {canUpload && (
                        <div className="flex flex-wrap gap-2">
                          {STAGE_STATUSES.filter((s) => s !== stage.status).map((s) => (
                            <Button key={s} size="sm" variant="outline" className="text-xs"
                              onClick={() => {
                                if (s === "client_approved") {
                                  const hasDrawings = drawings.some((d: any) => d.project_id === selectedProjectId && d.status === "active");
                                  if (!hasDrawings) { toast.error("Upload at least one drawing before approving"); return; }
                                }
                                updateStage(stage.id, { status: s });
                              }}>
                              {stageStatusLabel(s)}
                            </Button>
                          ))}
                        </div>
                      )}
                      {stage.status === "revision_requested" && stage.revision_comments && (
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-xs" style={{ color: "#666666" }}>Client Comments: {stage.revision_comments}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

            </TabsContent>

            <TabsContent value="qc-checklist">
              {selectedProjectId && (
                <MasterQCChecklist
                  projectId={selectedProjectId}
                  projectName={selectedProject?.name ?? ""}
                  designFile={selectedDF}
                  isPrincipal={isPrincipal}
                  isArchitect={isArchitect}
                  userId={userId}
                  userName={userName}
                  userRole={userRole}
                  detailLibraryReady={(detailStats.complete + detailStats.na) >= detailStats.total && detailStats.total > 0}
                  detailLibraryStats={detailStats}
                  onRefresh={fetchData}
                />
              )}
            </TabsContent>

            <TabsContent value="detail-library">
              {selectedProjectId && (
                <DetailLibraryTab
                  projectId={selectedProjectId}
                  isArchitect={isArchitect}
                  userId={userId}
                  userName={userName}
                  onStatsChange={setDetailStats}
                />
              )}
            </TabsContent>

            <TabsContent value="consultants" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Consultant Coordination</h3>
                {canUpload && <Button size="sm" variant="outline" onClick={() => selectedProjectId && addConsultant(selectedProjectId)}><Plus className="h-4 w-4 mr-1" /> Add</Button>}
              </div>
              {selectedConsultants.length === 0 && <p className="text-sm text-muted-foreground">No consultants added.</p>}
              {selectedConsultants.map((c: any) => (
                <ConsultantRow key={c.id} consultant={c} canEdit={canUpload} onSaved={refreshConsultants} />
              ))}
            </TabsContent>

            <TabsContent value="drawings" className="space-y-4">
              <h3 className="text-base font-semibold">Drawings Library</h3>
              {selectedDrawings.length === 0 && <p className="text-sm text-muted-foreground">No drawings uploaded for this project.</p>}
              {selectedDrawings.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-2 rounded border border-border"
                  style={d.status === "archived" ? { opacity: 0.5 } : {}}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
                    <span className="font-mono text-xs font-semibold">{d.drawing_id_code}</span>
                    <span className="text-[10px]" style={{ color: "#999999" }}>{d.drawing_type} · R{d.revision}</span>
                    <Badge variant="outline" style={d.status === "active" ? { backgroundColor: "#E8F2ED", color: "#006039", border: "none" } : { backgroundColor: "#F5F5F5", color: "#999999", border: "none" }} className="text-[10px]">
                      {d.status === "active" ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                    </a>
                    {isPrincipal && d.status === "active" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        const { client } = await getAuthedClient();
                        await (client.from("drawings") as any).update({ status: "archived" }).eq("id", d.id);
                        toast.success("Drawing superseded");
                        fetchData();
                      }}>
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#D4860A" }} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
