import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  FOUNDATION_GROUPS, FOUNDATION_ITEMS, FOUNDATION_SECTION_COMMENT_KEY, type CheckRow, type CheckStatus,
  type FoundationItem, type Tolerances, daysAgo, effectiveStatus, foundationComplete, isOutOfTolerance, itemComplete, toleranceLimit,
} from "@/lib/site-readiness-foundation";
import { ReadinessPhotos, type ReadinessPhoto } from "./ReadinessPhotos";

interface Props { projectId: string; canEdit: boolean; onComplete: (done: boolean) => void }

type Draft = { status: CheckStatus | null; value_numeric: string; value_text: string; comment: string; photo_paths: ReadinessPhoto[]; checked_at: string | null };
const EMPTY: Draft = { status: null, value_numeric: "", value_text: "", comment: "", photo_paths: [], checked_at: null };

function friendly(msg: string) {
  if (/tolerances/i.test(msg)) return "Enter the allowed tolerances from the GFC drawing first.";
  if (/needs a comment/i.test(msg)) return "A Not ok item needs a comment.";
  if (/row-level security|permission/i.test(msg)) return "You don't have permission to change this checklist.";
  return msg || "Could not save. Try again.";
}

const STATUS_OPTS: { v: CheckStatus; label: string }[] = [{ v: "ok", label: "Ok" }, { v: "not_ok", label: "Not ok" }, { v: "na", label: "N/A" }];

export function FoundationSection({ projectId, canEdit, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [tol, setTol] = useState<Tolerances | null>(null);
  const [tolDraft, setTolDraft] = useState({ level: "", diagonal: "", spacing: "" });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sectionComment, setSectionComment] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ A: true });

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: rows }] = await Promise.all([
      (supabase.from("site_readiness_tolerances") as any).select("*").eq("project_id", projectId).maybeSingle(),
      (supabase.from("site_readiness_checks") as any).select("*").eq("project_id", projectId).eq("section", "foundation"),
    ]);
    setTol(t ?? null);
    if (t) setTolDraft({ level: String(t.allowed_level_diff_mm), diagonal: String(t.allowed_diagonal_diff_mm), spacing: String(t.allowed_spacing_dev_mm) });
    const d: Record<string, Draft> = {};
    for (const r of (rows ?? []) as any[]) {
      if (r.item_key === FOUNDATION_SECTION_COMMENT_KEY) { setSectionComment(r.comment ?? ""); continue; }
      d[r.item_key] = { status: r.status, value_numeric: r.value_numeric == null ? "" : String(r.value_numeric), value_text: r.value_text ?? "", comment: r.comment ?? "", photo_paths: Array.isArray(r.photo_paths) ? r.photo_paths : [], checked_at: r.checked_at };
    }
    setDrafts(d);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const rows = useMemo(() => {
    const out: Record<string, CheckRow> = {};
    for (const [k, v] of Object.entries(drafts)) if (v.status) out[k] = { item_key: k, status: v.status, value_numeric: v.value_numeric === "" ? null : Number(v.value_numeric), value_text: v.value_text || null, comment: v.comment || null, photo_paths: v.photo_paths, checked_at: v.checked_at };
    return out;
  }, [drafts]);
  const complete = foundationComplete(rows, tol);
  useEffect(() => { onComplete(complete); }, [complete, onComplete]);

  const lastChecked = useMemo(() => Object.values(drafts).map((d) => d.checked_at).filter(Boolean).sort().pop() ?? null, [drafts]);

  const saveTolerances = async () => {
    const vals = [tolDraft.level, tolDraft.diagonal, tolDraft.spacing].map((v) => v.trim());
    if (vals.some((v) => v === "" || Number.isNaN(Number(v)) || Number(v) < 0)) { toast.error("Enter all three tolerances in mm from the GFC drawing."); return; }
    setSaving("tol");
    const { error } = await (supabase.from("site_readiness_tolerances") as any).upsert({ project_id: projectId, allowed_level_diff_mm: Number(vals[0]), allowed_diagonal_diff_mm: Number(vals[1]), allowed_spacing_dev_mm: Number(vals[2]) }, { onConflict: "project_id" });
    setSaving(null);
    if (error) { toast.error(friendly(error.message)); return; }
    toast.success("Tolerances saved"); load();
  };

  const saveItem = async (item: FoundationItem, next: Draft) => {
    setDrafts((p) => ({ ...p, [item.key]: next }));
    const vn0 = next.value_numeric === "" ? null : Number(next.value_numeric);
    if (!next.status && isOutOfTolerance(item, vn0, next.value_text || null, tol)) next = { ...next, status: "not_ok" };
    if (!next.status) return;
    if (item.tolerance && !tol) { toast.error("Enter the allowed tolerances from the GFC drawing first."); return; }
    const vn = next.value_numeric === "" ? null : Number(next.value_numeric);
    const status = effectiveStatus(item, next.status, vn, next.value_text || null, tol);
    if (status === "not_ok" && !next.comment.trim()) { setDrafts((p) => ({ ...p, [item.key]: { ...next, status } })); return; }
    setSaving(item.key);
    const { data, error } = await (supabase.from("site_readiness_checks") as any).upsert({
      project_id: projectId, section: "foundation", item_key: item.key, status, value_numeric: vn,
      value_text: next.value_text || null, comment: next.comment || null, photo_paths: next.photo_paths,
    }, { onConflict: "project_id,item_key" }).select("status, checked_at").single();
    setSaving(null);
    if (error) { toast.error(friendly(error.message)); return; }
    setDrafts((p) => ({ ...p, [item.key]: { ...next, status: data.status, checked_at: data.checked_at } }));
    if (data.status === "not_ok") {
      const { error: e2 } = await (supabase.rpc as any)("escalate_foundation_issues", { p_project_id: projectId });
      if (e2) console.warn("Foundation escalation failed", e2.message);
    }
  };

  const saveSectionComment = async () => {
    const { error } = await (supabase.from("site_readiness_checks") as any).upsert({ project_id: projectId, section: "foundation", item_key: FOUNDATION_SECTION_COMMENT_KEY, status: "na", comment: sectionComment || null }, { onConflict: "project_id,item_key" });
    if (error) toast.error(friendly(error.message));
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const age = lastChecked ? daysAgo(lastChecked) : null;

  return (
    <div className="space-y-3 min-w-0">
      <p className={cn("text-xs", age != null && age > 7 ? "text-warning font-medium" : "text-muted-foreground")}>
        {lastChecked ? `Last checked ${format(new Date(lastChecked), "dd/MM/yyyy")} (${age} day${age === 1 ? "" : "s"} ago)` : "Not checked yet"}
      </p>

      <div className="rounded-md border border-border bg-card p-3 space-y-2">
        <p className="text-xs font-semibold">Allowed tolerances from the GFC drawing (mm) — required</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([["level", "Level difference"], ["diagonal", "Diagonal / overall size difference"], ["spacing", "Spacing / anchor position deviation"]] as const).map(([k, l]) => (
            <label key={k} className="text-xs space-y-1 min-w-0">
              <span className="block text-muted-foreground">{l}</span>
              <Input inputMode="decimal" value={tolDraft[k]} disabled={!canEdit} onChange={(e) => setTolDraft((p) => ({ ...p, [k]: e.target.value }))} className="h-9 text-sm" />
            </label>
          ))}
        </div>
        {canEdit && <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={saveTolerances} disabled={saving === "tol"}>{saving === "tol" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save tolerances</Button>}
        {!tol && <p className="text-xs text-warning">Measured items cannot be saved until tolerances are entered.</p>}
      </div>

      {FOUNDATION_GROUPS.map((g) => {
        const done = g.items.filter((it) => itemComplete(it, rows[it.key])).length;
        const bad = g.items.some((it) => rows[it.key]?.status === "not_ok");
        return (
          <Collapsible key={g.key} open={!!open[g.key]} onOpenChange={(v) => setOpen((p) => ({ ...p, [g.key]: v }))} className="rounded-md border border-border" data-group={g.key}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 text-left">
              <span className="flex-1 min-w-0 text-sm font-semibold break-words">{g.title}</span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", bad ? "bg-destructive/10 text-destructive" : done === g.items.length ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{done}/{g.items.length}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open[g.key] && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-3 pb-3">
              {g.items.map((it) => <ItemRow key={it.key} item={it} draft={drafts[it.key] ?? EMPTY} tol={tol} canEdit={canEdit} projectId={projectId} saving={saving === it.key} onSave={(d) => saveItem(it, d)} />)}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <label className="block space-y-1">
        <span className="text-xs font-semibold">Foundation comments</span>
        <Textarea rows={2} value={sectionComment} disabled={!canEdit} onChange={(e) => setSectionComment(e.target.value)} onBlur={canEdit ? saveSectionComment : undefined} placeholder="Overall observations on the foundation…" className="text-sm" />
      </label>
      <p className={cn("text-xs font-medium", complete ? "text-primary" : "text-muted-foreground")}>
        {complete ? "Foundation complete" : `Foundation: ${FOUNDATION_ITEMS.filter((it) => itemComplete(it, rows[it.key])).length} of ${FOUNDATION_ITEMS.length} items complete`}
      </p>
    </div>
  );
}

function ItemRow({ item, draft, tol, canEdit, projectId, saving, onSave }: { item: FoundationItem; draft: Draft; tol: Tolerances | null; canEdit: boolean; projectId: string; saving: boolean; onSave: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(draft);
  useEffect(() => { setD(draft); }, [draft]);
  const vn = d.value_numeric === "" ? null : Number(d.value_numeric);
  const out = isOutOfTolerance(item, vn, d.value_text || null, tol);
  const shown: CheckStatus | null = out ? "not_ok" : d.status;
  const needsComment = shown === "not_ok" && !d.comment.trim();
  const needsPhoto = item.photo && shown === "ok" && d.photo_paths.length === 0;
  const locked = !canEdit || (!!item.tolerance && !tol);
  const commit = (patch: Partial<Draft>) => onSave({ ...d, ...patch });

  return (
    <div className={cn("rounded-md border p-2.5 space-y-2 min-w-0", shown === "not_ok" ? "border-destructive/60 bg-destructive/5" : "border-border")}>
      <p className="text-sm break-words"><span className="font-semibold">{item.key}.</span> {item.label}{item.photo && <span className="text-destructive"> *</span>}</p>
      <div className="grid grid-cols-3 gap-1">
        {STATUS_OPTS.map((o) => (
          <button key={o.v} type="button" disabled={locked || saving} onClick={() => commit({ status: o.v })}
            className={cn("h-9 rounded-md border text-xs font-medium", shown === o.v ? (o.v === "not_ok" ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground") : "border-border bg-background")}>
            {o.label}
          </button>
        ))}
      </div>
      {item.value === "count_vs_expected" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1 min-w-0"><span className="block text-muted-foreground">Counted</span>
            <Input inputMode="numeric" disabled={locked} value={d.value_numeric} onChange={(e) => setD({ ...d, value_numeric: e.target.value })} onBlur={() => commit({})} className="h-9 text-sm" /></label>
          <label className="text-xs space-y-1 min-w-0"><span className="block text-muted-foreground">Expected (drawing)</span>
            <Input inputMode="numeric" disabled={locked} value={d.value_text} onChange={(e) => setD({ ...d, value_text: e.target.value })} onBlur={() => commit({})} className="h-9 text-sm" /></label>
        </div>
      )}
      {(item.value === "numeric_mm" || item.value === "numeric_m") && (
        <label className="block text-xs space-y-1"><span className="block text-muted-foreground break-words">{item.valueLabel}{item.tolerance && tol ? ` — allowed ${toleranceLimit(item.tolerance, tol)} mm` : ""}</span>
          <Input inputMode="decimal" disabled={locked} value={d.value_numeric} onChange={(e) => setD({ ...d, value_numeric: e.target.value })} onBlur={() => commit({})} className={cn("h-9 text-sm", out && "border-destructive text-destructive")} /></label>
      )}
      {item.value === "text" && (
        <label className="block text-xs space-y-1"><span className="block text-muted-foreground">{item.valueLabel}</span>
          <Input disabled={locked} value={d.value_text} onChange={(e) => setD({ ...d, value_text: e.target.value })} onBlur={() => commit({})} className="h-9 text-sm" /></label>
      )}
      {out && <p className="text-xs font-medium text-destructive">Out of tolerance — marked Not ok.</p>}
      <Textarea rows={2} disabled={!canEdit} value={d.comment} placeholder={shown === "not_ok" ? "Comment required: what is wrong and the action" : "Comment (optional)"}
        onChange={(e) => setD({ ...d, comment: e.target.value })} onBlur={() => commit({})} className={cn("text-sm", needsComment && "border-destructive")} />
      {needsComment && <p className="text-xs text-destructive">Add a comment to save this Not ok item.</p>}
      <ReadinessPhotos projectId={projectId} folder={`foundation/${item.key}`} photos={d.photo_paths} required={item.photo} readOnly={!canEdit} onChange={(p) => commit({ photo_paths: p })} />
      {needsPhoto && <p className="text-xs text-warning">At least one photo is needed.</p>}
      {!d.status && !out && canEdit && <p className="text-[11px] text-muted-foreground">Choose Ok, Not ok or N/A to save.</p>}
      {saving && <p className="text-[11px] text-muted-foreground">Saving…</p>}
    </div>
  );
}
