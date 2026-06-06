import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Filter, AlertTriangle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
import { projectCode } from "@/lib/code-generators";
import {
  EDIT_ROLES, STAGE_STATUSES, STATUS_STYLES, QUOTATION_STATUSES,
  type DesignStageStatus, type QuotationStatus,
} from "@/lib/design-schedule";

type StageDef = {
  id: string; stage_code: string; stage_name: string; stage_order: number;
  pipeline_type: "habitainer" | "ads"; stage_group: string | null;
  is_mandatory: boolean; is_production_gate: boolean; is_read_only: boolean;
};
type ProjectStage = {
  id: string; project_id: string; stage_definition_id: string;
  status: DesignStageStatus; planned_date: string | null; actual_date: string | null;
  owner_id: string | null; notes: string | null;
};
type ProjectRow = { id: string; name: string; type: string | null; is_archived: boolean | null };
type Profile = { id: string; display_name: string | null; email: string | null };

const isAds = (t: string | null | undefined) => (t ?? "").toLowerCase().startsWith("ads");

export default function DesignSchedule() {
  const { role } = useUserRole();
  const canEdit = EDIT_ROLES.includes((role ?? "") as string);

  const [loading, setLoading] = useState(true);
  const [defs, setDefs] = useState<StageDef[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [pipelineFilter, setPipelineFilter] = useState<"all" | "habitainer" | "ads">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "blocked" | "overdue">("all");

  const [editing, setEditing] = useState<{ projectId: string; defId: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [defsRes, projRes, stagesRes, profRes] = await Promise.all([
      supabase.from("design_stage_definitions").select("*").order("stage_order"),
      supabase.from("projects").select("id, name, type, is_archived").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("project_design_stages").select("*"),
      supabase.from("profiles").select("id, display_name, email").eq("is_active", true).order("display_name"),
    ]);
    setDefs((defsRes.data ?? []) as StageDef[]);
    setProjects((projRes.data ?? []) as ProjectRow[]);
    setStages((stagesRes.data ?? []) as ProjectStage[]);
    setProfiles((profRes.data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // For projects that don't yet have stage rows (e.g. newly created), seed lazily
  useEffect(() => {
    if (loading || !canEdit) return;
    const missing: { project_id: string; stage_definition_id: string; status: DesignStageStatus }[] = [];
    for (const p of projects) {
      const pipe = isAds(p.type) ? "ads" : "habitainer";
      const projectDefs = defs.filter(d => d.pipeline_type === pipe);
      const have = new Set(stages.filter(s => s.project_id === p.id).map(s => s.stage_definition_id));
      for (const d of projectDefs) {
        if (!have.has(d.id)) missing.push({ project_id: p.id, stage_definition_id: d.id, status: "Not Started" });
      }
    }
    if (missing.length > 0) {
      supabase.from("project_design_stages").insert(missing).then(({ error }) => {
        if (!error) fetchAll();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const stageMap = useMemo(() => {
    const m = new Map<string, ProjectStage>();
    for (const s of stages) m.set(`${s.project_id}:${s.stage_definition_id}`, s);
    return m;
  }, [stages]);

  const habitainerDefs = useMemo(() => defs.filter(d => d.pipeline_type === "habitainer"), [defs]);
  const adsDefs = useMemo(() => defs.filter(d => d.pipeline_type === "ads"), [defs]);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (pipelineFilter === "habitainer") list = list.filter(p => !isAds(p.type));
    if (pipelineFilter === "ads") list = list.filter(p => isAds(p.type));

    if (statusFilter === "blocked") {
      list = list.filter(p => stages.some(s => s.project_id === p.id && s.status === "Blocked"));
    } else if (statusFilter === "overdue") {
      const today = startOfToday();
      list = list.filter(p => stages.some(s =>
        s.project_id === p.id && s.status !== "Completed" && s.status !== "Skipped" &&
        s.planned_date && isBefore(parseISO(s.planned_date), today)
      ));
    }
    if (stageFilter !== "all") {
      list = list.filter(p => {
        const s = stageMap.get(`${p.id}:${stageFilter}`);
        return s && (s.status === "In Progress" || s.status === "Blocked");
      });
    }
    return list;
  }, [projects, stages, pipelineFilter, statusFilter, stageFilter, stageMap]);

  // Summary tiles
  const summary = useMemo(() => {
    const today = startOfToday();
    const gateDefId = defs.find(d => d.is_production_gate)?.id;
    let readyForProd = 0;
    let blocked = 0;
    let overdue = 0;
    const blockedProjects = new Set<string>();
    for (const s of stages) {
      if (s.status === "Blocked") blockedProjects.add(s.project_id);
      if (s.status !== "Completed" && s.status !== "Skipped" && s.planned_date && isBefore(parseISO(s.planned_date), today)) overdue++;
    }
    if (gateDefId) {
      const ready = new Set<string>();
      for (const s of stages) if (s.stage_definition_id === gateDefId && s.status === "Completed") ready.add(s.project_id);
      readyForProd = ready.size;
    }
    blocked = blockedProjects.size;
    return { total: projects.length, readyForProd, blocked, overdue };
  }, [projects, stages, defs]);

  const editingStage = editing
    ? stageMap.get(`${editing.projectId}:${editing.defId}`)
    : null;
  const editingDef = editing ? defs.find(d => d.id === editing.defId) : null;
  const editingProject = editing ? projects.find(p => p.id === editing.projectId) : null;

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Design Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Pre-production pipeline tracker for every project — sales, design, commercial, technical, execution and handover stages.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Active Projects" value={summary.total} />
        <SummaryTile label="Ready for Production" value={summary.readyForProd} icon={<CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />} />
        <SummaryTile label="Projects Blocked" value={summary.blocked} icon={<AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />} />
        <SummaryTile label="Overdue Stages" value={summary.overdue} icon={<Clock className="h-4 w-4" style={{ color: "#D4860A" }} />} />
      </div>

      <Tabs defaultValue="tracker">
        <TabsList>
          <TabsTrigger value="tracker">Master Tracker</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={pipelineFilter} onValueChange={(v: any) => setPipelineFilter(v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="habitainer">Habitainer</SelectItem>
                    <SelectItem value="ads">ADS</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="blocked">Blocked only</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-[260px]"><SelectValue placeholder="Filter by stage" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {defs.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.pipeline_type === "ads" ? "[ADS] " : ""}{d.stage_code} · {d.stage_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TrackerGrid
                projects={filteredProjects}
                habitainerDefs={habitainerDefs}
                adsDefs={adsDefs}
                stageMap={stageMap}
                onCellClick={(projectId, defId) => canEdit && setEditing({ projectId, defId })}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations" className="space-y-4">
          <QuotationsTab canEdit={canEdit} />
        </TabsContent>
      </Tabs>

      {editing && editingDef && editingProject && (
        <EditStageDialog
          open
          onClose={() => setEditing(null)}
          stage={editingStage ?? null}
          def={editingDef}
          project={editingProject}
          profiles={profiles}
          onSaved={fetchAll}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold font-display mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrackerGrid({
  projects, habitainerDefs, adsDefs, stageMap, onCellClick, canEdit,
}: {
  projects: ProjectRow[];
  habitainerDefs: StageDef[];
  adsDefs: StageDef[];
  stageMap: Map<string, ProjectStage>;
  onCellClick: (projectId: string, defId: string) => void;
  canEdit: boolean;
}) {
  // Split rows by pipeline
  const hab = projects.filter(p => !isAds(p.type));
  const ads = projects.filter(p => isAds(p.type));

  return (
    <div className="overflow-x-auto">
      {hab.length > 0 && (
        <PipelineTable
          title="Habitainer"
          projects={hab}
          defs={habitainerDefs}
          stageMap={stageMap}
          onCellClick={onCellClick}
          canEdit={canEdit}
        />
      )}
      {ads.length > 0 && (
        <PipelineTable
          title="ADS — Altree Design Studio"
          projects={ads}
          defs={adsDefs}
          stageMap={stageMap}
          onCellClick={onCellClick}
          canEdit={canEdit}
        />
      )}
      {projects.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">No projects match these filters.</div>
      )}
    </div>
  );
}

function PipelineTable({
  title, projects, defs, stageMap, onCellClick, canEdit,
}: {
  title: string; projects: ProjectRow[]; defs: StageDef[];
  stageMap: Map<string, ProjectStage>;
  onCellClick: (projectId: string, defId: string) => void;
  canEdit: boolean;
}) {
  // Group defs by stage_group for header bands
  const groups = useMemo(() => {
    const out: { group: string; defs: StageDef[] }[] = [];
    for (const d of defs) {
      const last = out[out.length - 1];
      if (last && last.group === (d.stage_group ?? "")) last.defs.push(d);
      else out.push({ group: d.stage_group ?? "", defs: [d] });
    }
    return out;
  }, [defs]);

  return (
    <div className="mb-2">
      <div className="px-4 py-2 bg-muted/50 font-display text-sm font-semibold text-foreground sticky left-0">{title}</div>
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card border border-border px-2 py-1 text-left min-w-[220px] z-10">Project</th>
            {groups.map(g => (
              <th key={g.group} colSpan={g.defs.length} className="border border-border px-2 py-1 text-center bg-muted text-foreground">{g.group}</th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 bg-card border border-border px-2 py-1 text-left z-10"></th>
            {defs.map(d => (
              <th
                key={d.id}
                className="border border-border px-2 py-1 text-center align-bottom min-w-[44px] whitespace-nowrap"
                title={d.stage_name}
                style={d.is_production_gate ? { backgroundColor: "#006039", color: "#fff" } : undefined}
              >
                <div className="font-semibold">{d.stage_code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id}>
              <td className="sticky left-0 bg-card border border-border px-2 py-1 z-10">
                <Link to={`/projects/${p.id}?tab=design-schedule`} className="hover:underline flex items-center gap-1">
                  <span className="truncate max-w-[200px]" title={p.name}>{p.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </Link>
                <div className="text-[10px] text-muted-foreground">{projectCode(p.name)}</div>
              </td>
              {defs.map(d => {
                const s = stageMap.get(`${p.id}:${d.id}`);
                const status = (s?.status ?? "Not Started") as DesignStageStatus;
                const style = STATUS_STYLES[status];
                return (
                  <td
                    key={d.id}
                    className={`border border-border p-0 text-center ${canEdit && !d.is_read_only ? "cursor-pointer hover:opacity-80" : ""}`}
                    style={{ backgroundColor: style.cell }}
                    onClick={() => !d.is_read_only && onCellClick(p.id, d.id)}
                    title={`${d.stage_name} — ${status}${s?.planned_date ? ` (planned ${s.planned_date})` : ""}${s?.notes ? `\n${s.notes}` : ""}`}
                  >
                    <div className="px-2 py-1.5 text-[10px]" style={{ color: style.fg }}>
                      {status === "Completed" ? "✓" : status === "Blocked" ? "!" : status === "In Progress" ? "●" : status === "Skipped" ? "—" : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditStageDialog({
  open, onClose, stage, def, project, profiles, onSaved, canEdit,
}: {
  open: boolean; onClose: () => void; stage: ProjectStage | null;
  def: StageDef; project: ProjectRow; profiles: Profile[];
  onSaved: () => void; canEdit: boolean;
}) {
  const [status, setStatus] = useState<DesignStageStatus>(stage?.status ?? "Not Started");
  const [plannedDate, setPlannedDate] = useState<string>(stage?.planned_date ?? "");
  const [actualDate, setActualDate] = useState<string>(stage?.actual_date ?? "");
  const [ownerId, setOwnerId] = useState<string>(stage?.owner_id ?? "");
  const [notes, setNotes] = useState<string>(stage?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(stage?.status ?? "Not Started");
    setPlannedDate(stage?.planned_date ?? "");
    setActualDate(stage?.actual_date ?? "");
    setOwnerId(stage?.owner_id ?? "");
    setNotes(stage?.notes ?? "");
  }, [stage?.id]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      project_id: project.id,
      stage_definition_id: def.id,
      status,
      planned_date: plannedDate || null,
      actual_date: actualDate || null,
      owner_id: ownerId || null,
      notes: notes || null,
      updated_by: user?.id ?? null,
    };
    let res;
    if (stage?.id) {
      res = await supabase.from("project_design_stages").update(payload).eq("id", stage.id);
    } else {
      res = await supabase.from("project_design_stages").insert(payload);
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Stage updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{def.stage_code} · {def.stage_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{project.name} · {projectCode(project.name)}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: DesignStageStatus) => setStatus(v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Planned Date</Label>
              <Input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label>Actual Date</Label>
              <Input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={ownerId || "__none__"} onValueChange={v => setOwnerId(v === "__none__" ? "" : v)} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name || p.email || "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} disabled={!canEdit} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canEdit}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotationsTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("quotations").select("*").order("date_of_release", { ascending: false, nullsFirst: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Quotations Tracker</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Quotation
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Enquiry Shared By</th>
                  <th className="text-left px-3 py-2">Drawings / Scope</th>
                  <th className="text-left px-3 py-2">Date of Release</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Notes</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.client_name}</td>
                    <td className="px-3 py-2">{r.enquiry_shared_by ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[280px] truncate" title={r.drawings_shared ?? ""}>{r.drawings_shared ?? "—"}</td>
                    <td className="px-3 py-2">{r.date_of_release ? format(parseISO(r.date_of_release), "dd/MM/yyyy") : "—"}</td>
                    <td className="px-3 py-2"><QuotationStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 max-w-[280px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">No quotations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {open && (
        <QuotationDialog
          row={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); load(); }}
        />
      )}
    </Card>
  );
}

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const map: Record<QuotationStatus, { bg: string; fg: string }> = {
    "Pending":   { bg: "#FFF8E8", fg: "#D4860A" },
    "Released":  { bg: "#E8F0FE", fg: "#1A73E8" },
    "Won":       { bg: "#E8F2ED", fg: "#006039" },
    "Lost":      { bg: "#FFE9EA", fg: "#F40009" },
    "On Hold":   { bg: "#F2F2F2", fg: "#666" },
  };
  const s = map[status] ?? map["Pending"];
  return <Badge style={{ backgroundColor: s.bg, color: s.fg, border: "none" }}>{status}</Badge>;
}

function QuotationDialog({ row, onClose, onSaved }: { row: any | null; onClose: () => void; onSaved: () => void }) {
  const [client, setClient] = useState(row?.client_name ?? "");
  const [enquiry, setEnquiry] = useState(row?.enquiry_shared_by ?? "");
  const [drawings, setDrawings] = useState(row?.drawings_shared ?? "");
  const [date, setDate] = useState(row?.date_of_release ?? "");
  const [status, setStatus] = useState<QuotationStatus>(row?.status ?? "Pending");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!client.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      client_name: client.trim(),
      enquiry_shared_by: enquiry || null,
      drawings_shared: drawings || null,
      date_of_release: date || null,
      status,
      notes: notes || null,
    };
    let res;
    if (row?.id) res = await supabase.from("quotations").update(payload).eq("id", row.id);
    else res = await supabase.from("quotations").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Quotation saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{row ? "Edit Quotation" : "New Quotation"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Client Name *</Label><Input value={client} onChange={e => setClient(e.target.value)} /></div>
          <div><Label>Enquiry Shared By</Label><Input value={enquiry} onChange={e => setEnquiry(e.target.value)} /></div>
          <div><Label>Drawings / Scope Details</Label><Textarea value={drawings} onChange={e => setDrawings(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of Release</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: QuotationStatus) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUOTATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
