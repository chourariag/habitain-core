import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { REQUIRED_GATES } from "@/components/projects/PreProductionChecklist";

type BlockedProj = { id: string; name: string; missing: number };

/**
 * Banner shown at top of Factory Floor whenever any project currently
 * has production activity (modules exist) but pre-production gates are
 * incomplete. Read-only; surface only — does not prevent navigation.
 */
export function FactoryFloorPreProdBanner() {
  const [projects, setProjects] = useState<BlockedProj[]>([]);

  useEffect(() => {
    (async () => {
      // Projects with any module (production activity), not archived, habitainer
      const { data: mods } = await supabase
        .from("modules")
        .select("project_id, projects!inner(id, name, type, is_archived)")
        .eq("is_archived", false);

      const projMap = new Map<string, { name: string; type: string | null }>();
      for (const m of (mods ?? []) as any[]) {
        const p = m.projects;
        if (!p || p.is_archived) continue;
        if ((p.type ?? "").toLowerCase().startsWith("ads")) continue;
        projMap.set(p.id, { name: p.name, type: p.type });
      }
      if (projMap.size === 0) { setProjects([]); return; }

      const projectIds = Array.from(projMap.keys());
      const { data: gates } = await supabase
        .from("project_design_stages")
        .select("project_id, status, design_stage_definitions!inner(stage_code, pipeline_type)")
        .in("project_id", projectIds)
        .eq("design_stage_definitions.pipeline_type", "habitainer")
        .in("design_stage_definitions.stage_code", REQUIRED_GATES.map(g => g.code));

      const completed = new Map<string, number>();
      for (const r of (gates ?? []) as any[]) {
        if (r.status === "Completed") completed.set(r.project_id, (completed.get(r.project_id) ?? 0) + 1);
      }

      const blocked: BlockedProj[] = [];
      for (const [id, info] of projMap) {
        const done = completed.get(id) ?? 0;
        if (done < REQUIRED_GATES.length) blocked.push({ id, name: info.name, missing: REQUIRED_GATES.length - done });
      }
      setProjects(blocked.slice(0, 8));
    })();
  }, []);

  if (projects.length === 0) return null;

  return (
    <div
      className="rounded-md border p-3 flex items-start gap-3"
      style={{ backgroundColor: "#FFF8E8", borderColor: "#D4860A" }}
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
      <div className="text-sm" style={{ color: "#7A4E04" }}>
        <p className="font-medium">Pre-production checklist incomplete for {projects.length} active project{projects.length === 1 ? "" : "s"}.</p>
        <p className="mt-0.5">
          Check Projects → Overview to see what is blocking production:&nbsp;
          {projects.map((p, i) => (
            <span key={p.id}>
              <Link to={`/projects/${p.id}`} className="underline font-medium">{p.name}</Link>
              <span className="text-xs"> ({p.missing} pending)</span>
              {i < projects.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
