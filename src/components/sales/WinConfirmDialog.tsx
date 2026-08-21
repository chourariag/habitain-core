import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

const APPROVER_ROLES = ["sales_director", "managing_director", "super_admin"];

/** Normalised similarity 0..1 (Levenshtein based) — tolerant of spelling variants
 *  such as "Thakur Bakshani" vs "Thakur Bhakshani". */
function similarity(a: string, b: string) {
  const s = a.trim().toLowerCase().replace(/\s+/g, " ");
  const t = b.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s || !t) return 0;
  if (s === t) return 1;
  const m = s.length, n = t.length;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  const cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return 1 - prev[n] / Math.max(m, n);
}

const fmt = (v: number) => {
  if (!v) return "₹0";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)} L`;
  return `₹${v.toLocaleString("en-IN")}`;
};

interface Props {
  open: boolean;
  deal: any | null;
  onClose: () => void;
  onDone: () => void;
}

export function WinConfirmDialog({ open, deal, onClose, onDone }: Props) {
  const { role } = useUserRole();
  const canConfirm = !!role && APPROVER_ROLES.includes(role);

  const [division, setDivision] = useState<string>("");
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [createNewLead, setCreateNewLead] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [noProject, setNoProject] = useState(false);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !deal) return;
    setDivision(deal.division === "both" ? "" : String(deal.division || "").toLowerCase());
    setLeadId(deal.pipeline_lead_id ?? null);
    setCreateNewLead(false);
    setProjectId(null);
    setNoProject(false);
    setShowAllLeads(false);
    setShowAllProjects(false);
    setLeadSearch("");
    setProjectSearch("");
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("sales_pipeline_leads").select("*").eq("is_archived", false).neq("stage", "Lost"),
        supabase.from("projects").select("id, name, client_name, project_type, division"),
      ]);
      setLeads(l || []);
      setProjects(p || []);
    })();
  }, [open, deal]);

  const scoredLeads = useMemo(() => {
    if (!deal) return [];
    return leads
      .map((l) => ({ ...l, score: similarity(deal.client_name || "", l.client_name || "") }))
      .sort((a, b) => b.score - a.score);
  }, [leads, deal]);

  const suggestedLead = scoredLeads[0]?.score >= 0.6 ? scoredLeads[0] : null;

  const typeProjects = useMemo(() => {
    if (!division) return [];
    return projects.filter(
      (p) => String(p.project_type || p.division || "").toLowerCase() === division
    );
  }, [projects, division]);

  const linkedLead = leadId ? leads.find((l) => l.id === leadId) : null;

  const scoredProjects = useMemo(() => {
    const base = linkedLead?.client_name || deal?.client_name || "";
    return typeProjects
      .map((p) => ({ ...p, score: Math.max(similarity(base, p.client_name || ""), similarity(base, p.name || "")) }))
      .sort((a, b) => b.score - a.score);
  }, [typeProjects, linkedLead, deal]);

  const suggestedProject = scoredProjects[0]?.score >= 0.6 ? scoredProjects[0] : null;

  const leadStepDone = !!leadId || createNewLead;
  const projectStepDone = !!projectId || noProject;

  const submit = async () => {
    if (!deal) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("sync_deal_win", {
      p_deal_id: deal.id,
      p_lead_id: leadId,
      p_create_lead: createNewLead,
      p_project_id: projectId,
      p_division_choice: division,
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Move the CRM deal itself to Won (unchanged live flow)
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("sales_stage_history").insert({
      deal_id: deal.id, from_stage: deal.stage, to_stage: "Won", changed_by: auth?.user?.id,
    });
    const update: any = { stage: "Won" };
    if (deal.final_agreed_price) update.contract_value = Number(deal.final_agreed_price);
    const { error: upErr } = await supabase.from("sales_deals").update(update).eq("id", deal.id);
    setSaving(false);
    if (upErr) { toast.error(upErr.message); return; }

    const pending = (data as any)?.pending;
    toast.success(
      pending
        ? "Won recorded — pipeline lead flagged “Ready to Win”, Planning Head notified"
        : "Won recorded and linked to the project"
    );
    onDone();
    onClose();
  };

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Win — {deal.client_name}</DialogTitle>
        </DialogHeader>

        {!canConfirm ? (
          <p className="text-sm" style={{ color: "#F40009" }}>
            Only the Sales Director, Managing Director or Super Admin can confirm a win and its board-pipeline links.
          </p>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="rounded-md p-3" style={{ background: "#F7F7F7" }}>
              <div className="font-semibold">{deal.client_name}</div>
              <div style={{ color: "#666" }}>
                {fmt(Number(deal.final_agreed_price || deal.contract_value || 0))} · {deal.project_type || "—"}
              </div>
            </div>

            {/* Division choice — required for "both" */}
            {String(deal.division).toLowerCase() === "both" && (
              <div>
                <Label className="font-semibold">Which division is this win?</Label>
                <div className="flex gap-2 mt-2">
                  {["habitainer", "ads"].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={division === d ? "default" : "outline"}
                      style={division === d ? { background: "#006039", color: "#fff" } : {}}
                      onClick={() => { setDivision(d); setProjectId(null); setNoProject(false); }}
                    >
                      {d === "ads" ? "ADS" : "Habitainer"}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1 — pipeline lead */}
            <div className="space-y-2">
              <div className="font-semibold">Step 1 — Board pipeline lead</div>
              {deal.pipeline_lead_id ? (
                <p style={{ color: "#006039" }}>Already linked — using the existing pipeline lead.</p>
              ) : (
                <>
                  {suggestedLead && !createNewLead && (
                    <div className="rounded-md border p-3 space-y-1" style={{ borderColor: leadId === suggestedLead.id ? "#006039" : "#E5E7EB" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suggestedLead.client_name}</span>
                        <Badge variant="outline">{Math.round(suggestedLead.score * 100)}% match</Badge>
                      </div>
                      <div style={{ color: "#666" }}>
                        {suggestedLead.segment || "—"} · {fmt(Number(suggestedLead.value || 0))} · {suggestedLead.stage}
                        {suggestedLead.sales_rep_name ? ` · ${suggestedLead.sales_rep_name}` : ""}
                      </div>
                      <Button
                        size="sm"
                        style={{ background: "#006039", color: "#fff" }}
                        onClick={() => { setLeadId(suggestedLead.id); setCreateNewLead(false); }}
                        disabled={leadId === suggestedLead.id}
                      >
                        {leadId === suggestedLead.id ? "Linked" : "Link to this lead"}
                      </Button>
                    </div>
                  )}

                  <button className="underline text-xs" style={{ color: "#666" }} onClick={() => setShowAllLeads((v) => !v)}>
                    {showAllLeads ? "Hide other candidates" : "Show other candidates"}
                  </button>

                  {showAllLeads && (
                    <div className="space-y-1">
                      <Input placeholder="Search leads…" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {scoredLeads
                          .filter((l) => !leadSearch || l.client_name?.toLowerCase().includes(leadSearch.toLowerCase()))
                          .slice(0, 25)
                          .map((l) => (
                            <button
                              key={l.id}
                              className="w-full text-left rounded px-2 py-1 border"
                              style={{ borderColor: leadId === l.id ? "#006039" : "#E5E7EB" }}
                              onClick={() => { setLeadId(l.id); setCreateNewLead(false); }}
                            >
                              {l.client_name} <span style={{ color: "#999" }}>· {l.stage} · {Math.round(l.score * 100)}%</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={createNewLead}
                      onChange={(e) => { setCreateNewLead(e.target.checked); if (e.target.checked) setLeadId(null); }}
                    />
                    <span>Not the same person — create a new pipeline lead from this deal</span>
                  </label>
                </>
              )}
            </div>

            {/* Step 2 — project */}
            <div className="space-y-2">
              <div className="font-semibold">
                Step 2 — HStack project{" "}
                <span className="font-normal" style={{ color: "#666" }}>
                  ({division === "ads" ? "ADS" : division === "habitainer" ? "Habitainer" : "pick a division first"} projects only)
                </span>
              </div>

              {!division ? (
                <p style={{ color: "#D4860A" }}>Choose Habitainer or ADS above to see matching projects.</p>
              ) : (
                <>
                  {suggestedProject && !noProject && (
                    <div className="rounded-md border p-3 space-y-1" style={{ borderColor: projectId === suggestedProject.id ? "#006039" : "#E5E7EB" }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{suggestedProject.name}</span>
                        <Badge variant="outline">{Math.round(suggestedProject.score * 100)}% match</Badge>
                      </div>
                      <div style={{ color: "#666" }}>{suggestedProject.client_name} · {suggestedProject.project_type}</div>
                      <Button
                        size="sm"
                        style={{ background: "#006039", color: "#fff" }}
                        onClick={() => { setProjectId(suggestedProject.id); setNoProject(false); }}
                        disabled={projectId === suggestedProject.id}
                      >
                        {projectId === suggestedProject.id ? "Confirmed" : "Confirm this project"}
                      </Button>
                    </div>
                  )}

                  <button className="underline text-xs" style={{ color: "#666" }} onClick={() => setShowAllProjects((v) => !v)}>
                    {showAllProjects ? "Hide other projects" : "Show other projects"}
                  </button>

                  {showAllProjects && (
                    <div className="space-y-1">
                      <Input placeholder="Search projects…" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {scoredProjects
                          .filter((p) => !projectSearch || `${p.name} ${p.client_name}`.toLowerCase().includes(projectSearch.toLowerCase()))
                          .slice(0, 25)
                          .map((p) => (
                            <button
                              key={p.id}
                              className="w-full text-left rounded px-2 py-1 border"
                              style={{ borderColor: projectId === p.id ? "#006039" : "#E5E7EB" }}
                              onClick={() => { setProjectId(p.id); setNoProject(false); }}
                            >
                              {p.name} <span style={{ color: "#999" }}>· {p.client_name}</span>
                            </button>
                          ))}
                        {scoredProjects.length === 0 && <p style={{ color: "#999" }}>No projects of this type.</p>}
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={noProject}
                      onChange={(e) => { setNoProject(e.target.checked); if (e.target.checked) setProjectId(null); }}
                    />
                    <span>
                      No project exists yet — hold the pipeline lead at its current stage, flag it
                      “Ready to Win — awaiting project creation” and notify the Planning Head.
                      No project will be created here.
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                style={{ background: "#006039", color: "#fff" }}
                disabled={saving || !division || !leadStepDone || !projectStepDone}
                onClick={submit}
              >
                {saving ? "Saving…" : "Confirm Win"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
