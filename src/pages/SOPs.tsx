import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sparkles, BookOpen, ArrowLeft, Loader2, CheckCircle2, Eye, Pencil, History } from "lucide-react";

const DEPARTMENTS = [
  "Factory Production",
  "Site Installation",
  "Quality Control",
  "Procurement & Stores",
  "Design & Engineering",
  "Finance & Accounting",
  "Sales & Marketing",
  "HR & Administration",
  "Health & Safety",
];

const HOD_ROLES = new Set([
  "super_admin","managing_director","finance_director","sales_director","architecture_director","head_operations",
  "production_head","factory_floor_supervisor","fabrication_foreman","site_installation_mgr","site_engineer",
  "delivery_rm_lead","qc_inspector","procurement","stores_executive","principal_architect","project_architect",
  "structural_architect","planning_engineer","costing_engineer","quantity_surveyor","finance_manager",
  "accounts_executive","hr_executive",
]);

type SOP = {
  id: string;
  title: string;
  department: string;
  process_name: string | null;
  role_performs: string | null;
  status: "draft" | "under_review" | "approved";
  purpose: string | null;
  scope: string | null;
  materials_tools: string | null;
  steps: string | null;
  quality_criteria: string | null;
  common_mistakes: string | null;
  safety: string | null;
  escalation: string | null;
  ai_generated: boolean;
  view_count: number;
  created_by_name: string | null;
  last_updated_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  updated_at: string;
};

export default function SOPs() {
  const { role, userId } = useUserRole();
  const isHOD = role ? HOD_ROLES.has(role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "views" | "alpha">("updated");
  const [selected, setSelected] = useState<SOP | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  // Deep-link: open the best-matching approved SOP for a given task name (?taskName=...)
  useEffect(() => {
    const taskName = searchParams.get("taskName");
    if (!taskName || loading || sops.length === 0 || selected) return;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const target = norm(taskName);
    const approved = sops.filter((s) => s.status === "approved");
    let best: { sop: SOP; score: number } | null = null;
    for (const s of approved) {
      const hay = norm(`${s.title} ${s.process_name ?? ""}`);
      let score = 0;
      if (hay === target) score = 100;
      else if (hay.includes(target) || target.includes(hay)) score = 60;
      else {
        const words = target.split(" ").filter((w) => w.length > 2);
        score = words.filter((w) => hay.includes(w)).length * 10;
      }
      if (!best || score > best.score) best = { sop: s, score };
    }
    if (best && best.score >= 20) setSelected(best.sop);
    else toast.info(`No approved SOP found for "${taskName}".`);
    // Clear param so reopening list isn't sticky
    searchParams.delete("taskName");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, loading, sops, selected, setSearchParams]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sop_procedures")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setSops((data ?? []) as SOP[]);
    setLoading(false);
  };

  // Auto-seed on first HOD/MD visit
  useEffect(() => {
    if (!isHOD || loading) return;
    if (sops.length > 0) return;
    let cancelled = false;
    (async () => {
      // Check global count via head request
      const { count } = await supabase
        .from("sop_procedures")
        .select("*", { count: "exact", head: true });
      if (cancelled || (count ?? 0) > 0) return;
      toast.info("Generating 20 starter SOPs in the background…");
      const { error } = await supabase.functions.invoke("sop-generate", {
        body: { action: "auto_seed" },
      });
      if (error) toast.error(`Auto-seed failed: ${error.message}`);
      else {
        toast.success("Starter SOPs ready. Review and approve drafts.");
        load();
      }
    })();
    return () => { cancelled = true; };
  }, [isHOD, loading, sops.length]);

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    let list = sops;
    if (dept !== "All") list = list.filter((s) => s.department === dept);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        [s.title, s.purpose, s.steps, s.process_name].some((v) => v?.toLowerCase().includes(q))
      );
    }
    if (sortBy === "views") list = [...list].sort((a, b) => b.view_count - a.view_count);
    else if (sortBy === "alpha") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [sops, dept, search, sortBy]);

  const tabs = ["All", ...DEPARTMENTS];

  if (selected) {
    return <SOPDetail sop={selected} userId={userId} role={role} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <BookOpen className="h-6 w-6" style={{ color: "#006039" }} />
            SOP Library
          </h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>
            Standard Operating Procedures — the right way to do every task.
          </p>
        </div>
        {isHOD && (
          <Button onClick={() => setGenOpen(true)} style={{ backgroundColor: "#006039", color: "#fff" }}>
            <Sparkles className="h-4 w-4 mr-2" /> Generate SOP with AI
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search SOPs by keyword…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="views">Most Viewed</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollableTabsWrapper>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setDept(t)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                dept === t ? "text-white" : "text-muted-foreground hover:bg-muted"
              )}
              style={dept === t ? { backgroundColor: "#006039" } : undefined}
            >
              {t}
            </button>
          ))}
        </div>
      </ScrollableTabsWrapper>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#006039" }} />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center" style={{ color: "#666" }}>
          {isHOD ? "No SOPs yet. Click 'Generate SOP with AI' to start." : "No approved SOPs in this department yet."}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <Card
              key={s.id}
              onClick={() => setSelected(s)}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              style={{ borderColor: "#E0E0E0" }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold leading-tight" style={{ color: "#1A1A1A" }}>{s.title}</h3>
                <StatusBadge status={s.status} />
              </div>
              <div className="text-xs mb-2" style={{ color: "#666" }}>{s.department}</div>
              {s.purpose && (
                <p className="text-sm line-clamp-3" style={{ color: "#444" }}>{s.purpose}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: "#999" }}>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.view_count}</span>
                {s.last_updated_by_name && <span>· {s.last_updated_by_name}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} onCreated={(s) => { setGenOpen(false); load(); setSelected(s); }} />
    </div>
  );
}

function StatusBadge({ status }: { status: SOP["status"] }) {
  if (status === "approved")
    return <Badge style={{ backgroundColor: "#006039", color: "#fff" }}>Approved</Badge>;
  if (status === "under_review")
    return <Badge style={{ backgroundColor: "#F59E0B", color: "#fff" }}>Review</Badge>;
  return <Badge style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>DRAFT</Badge>;
}

function GenerateDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (s: SOP) => void }) {
  const [task_name, setTaskName] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [description, setDescription] = useState("");
  const [inputs, setInputs] = useState("");
  const [outputs, setOutputs] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!task_name.trim()) return toast.error("Task name required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("sop-generate", {
      body: { action: "generate", task_name, department, description, inputs, outputs },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("SOP draft created — review and approve.");
    onCreated(data.sop as SOP);
    setTaskName(""); setDescription(""); setInputs(""); setOutputs("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate SOP with AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Task name</label>
            <Input value={task_name} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g. Wall framing installation" />
          </div>
          <div>
            <label className="text-sm font-medium">Department</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Brief description (2-3 sentences)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium">Key inputs</label>
            <Textarea value={inputs} onChange={(e) => setInputs(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">Key outputs</label>
            <Textarea value={outputs} onChange={(e) => setOutputs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} style={{ backgroundColor: "#006039", color: "#fff" }}>
            {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Draft</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SOPDetail({
  sop, userId, role, onBack,
}: { sop: SOP; userId: string | null; role: string | null; onBack: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SOP>(sop);
  const [busy, setBusy] = useState(false);
  const canEdit = role ? HOD_ROLES.has(role) : false;

  useEffect(() => {
    // Log view + bump count
    if (!userId) return;
    supabase.from("sop_view_log").insert({ sop_id: sop.id, viewed_by: userId });
    supabase.from("sop_procedures").update({ view_count: sop.view_count + 1 }).eq("id", sop.id);
  }, [sop.id, userId]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("sop_procedures")
      .update({
        title: draft.title,
        role_performs: draft.role_performs,
        purpose: draft.purpose,
        scope: draft.scope,
        materials_tools: draft.materials_tools,
        steps: draft.steps,
        quality_criteria: draft.quality_criteria,
        common_mistakes: draft.common_mistakes,
        safety: draft.safety,
        escalation: draft.escalation,
      })
      .eq("id", sop.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(false);
  };

  const approve = async () => {
    setBusy(true);
    const { data: prof } = await supabase
      .from("profiles").select("id, display_name").eq("auth_user_id", userId!).maybeSingle();
    const { error } = await supabase
      .from("sop_procedures")
      .update({
        status: "approved",
        approved_by: prof?.id,
        approved_by_name: prof?.display_name,
        approved_at: new Date().toISOString(),
      })
      .eq("id", sop.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("SOP approved — now visible to all employees.");
    onBack();
  };

  const sections: Array<[string, keyof SOP]> = [
    ["A. Purpose", "purpose"],
    ["B. Scope", "scope"],
    ["C. Materials & Tools", "materials_tools"],
    ["D. Step-by-Step Procedure", "steps"],
    ["E. Quality Criteria", "quality_criteria"],
    ["F. Common Mistakes to Avoid", "common_mistakes"],
    ["G. Safety Precautions", "safety"],
    ["H. Escalation", "escalation"],
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" onClick={onBack} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to library
      </Button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="text-xl font-bold" />
          ) : (
            <h1 className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{sop.title}</h1>
          )}
          <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: "#666" }}>
            <span>{sop.department}</span>
            {sop.process_name && <span>· {sop.process_name}</span>}
            <StatusBadge status={sop.status} />
          </div>
        </div>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            {sop.status !== "approved" && (
              <Button onClick={approve} disabled={busy} style={{ backgroundColor: "#006039", color: "#fff" }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
            )}
          </div>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditing(false); setDraft(sop); }}>Cancel</Button>
            <Button onClick={save} disabled={busy} style={{ backgroundColor: "#006039", color: "#fff" }}>Save</Button>
          </div>
        )}
      </div>

      {editing && (
        <div>
          <label className="text-sm font-medium">Role who performs this</label>
          <Input value={draft.role_performs ?? ""} onChange={(e) => setDraft({ ...draft, role_performs: e.target.value })} />
        </div>
      )}
      {!editing && sop.role_performs && (
        <div className="text-sm" style={{ color: "#444" }}>
          <span className="font-medium">Performed by:</span> {sop.role_performs}
        </div>
      )}

      <div className="space-y-4">
        {sections.map(([label, key]) => (
          <Card key={key} className="p-4" style={{ borderColor: "#E0E0E0" }}>
            <h3 className="font-semibold mb-2" style={{ color: "#006039" }}>{label}</h3>
            {editing ? (
              <Textarea
                value={(draft[key] as string) ?? ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value } as SOP)}
                rows={key === "steps" ? 8 : 4}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap" style={{ color: "#333" }}>
                {(sop[key] as string) || "—"}
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="text-xs pt-4" style={{ color: "#999" }}>
        Last updated by {sop.last_updated_by_name ?? "—"} · {new Date(sop.updated_at).toLocaleString()}
        {sop.approved_by_name && <> · Approved by {sop.approved_by_name}</>}
      </div>

      <VersionHistory sopId={sop.id} />
    </div>
  );
}

type SOPVersion = {
  id: string;
  version_number: number;
  title: string;
  role_performs: string | null;
  purpose: string | null;
  scope: string | null;
  materials_tools: string | null;
  steps: string | null;
  quality_criteria: string | null;
  common_mistakes: string | null;
  safety: string | null;
  escalation: string | null;
  edited_by_name: string | null;
  created_at: string;
};

function VersionHistory({ sopId }: { sopId: string }) {
  const [versions, setVersions] = useState<SOPVersion[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sop_versions")
        .select("*")
        .eq("sop_id", sopId)
        .order("version_number", { ascending: false });
      setVersions((data ?? []) as SOPVersion[]);
      setLoaded(true);
    })();
  }, [sopId]);

  if (!loaded) return null;
  if (versions.length === 0)
    return (
      <Card className="p-4 mt-2" style={{ borderColor: "#E0E0E0" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "#666" }}>
          <History className="h-4 w-4" /> No previous versions yet.
        </div>
      </Card>
    );

  const sections: Array<[string, keyof SOPVersion]> = [
    ["Purpose", "purpose"],
    ["Scope", "scope"],
    ["Materials & Tools", "materials_tools"],
    ["Steps", "steps"],
    ["Quality Criteria", "quality_criteria"],
    ["Common Mistakes", "common_mistakes"],
    ["Safety", "safety"],
    ["Escalation", "escalation"],
  ];

  return (
    <Card className="p-4 mt-2" style={{ borderColor: "#E0E0E0" }}>
      <div className="flex items-center gap-2 mb-2 font-semibold" style={{ color: "#006039" }}>
        <History className="h-4 w-4" /> Version History ({versions.length})
      </div>
      <Accordion type="single" collapsible className="w-full">
        {versions.map((v) => (
          <AccordionItem key={v.id} value={v.id}>
            <AccordionTrigger className="text-sm hover:no-underline">
              <div className="flex flex-col items-start text-left">
                <span className="font-medium">v{v.version_number} — {v.title}</span>
                <span className="text-xs" style={{ color: "#999" }}>
                  {v.edited_by_name ?? "Unknown"} · {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                {sections.map(([label, key]) => (
                  <div key={key}>
                    <div className="font-medium text-xs uppercase tracking-wide" style={{ color: "#666" }}>{label}</div>
                    <p className="whitespace-pre-wrap" style={{ color: "#333" }}>{(v[key] as string) || "—"}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
