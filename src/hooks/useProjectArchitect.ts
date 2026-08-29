import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ArchitectProfile = { id: string; display_name: string | null; role: string | null };

/** Roles eligible to be set as a project's Project Architect. */
export const ARCHITECT_ROLES = [
  "project_architect",
  "senior_architect",
  "principal_architect",
  "structural_architect",
  "operations_architect",
  "architecture_director",
];

/** Roles allowed to assign / reassign the Project Architect on a project. */
export const ARCHITECT_ASSIGN_ROLES = [
  "super_admin",
  "managing_director",
  "chairman",
  "architecture_director",
  "sales_director",
  "principal_architect",
  "planning_head",
  "head_of_projects",
];

/**
 * Gates whose ownership resolves dynamically from projects.project_architect_id.
 * Note: the checklist row labelled "S1 Sign-off" is stage code E-3
 * (S1 Structural Drawing Set 1); S-1 is the separate "Sign Up" stage.
 */
export const ARCHITECT_OWNED_GATES = ["S-1", "E-3", "E-5"];

/**
 * Live-resolved Project Architect for a project.
 * Never cached against stage rows — reassigning the architect updates every
 * gate display immediately.
 */
export function useProjectArchitect(projectId: string | null | undefined) {
  const [architect, setArchitect] = useState<ArchitectProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setArchitect(null); setLoading(false); return; }
    const { data } = await supabase
      .from("projects")
      .select("project_architect_id")
      .eq("id", projectId)
      .maybeSingle();
    const architectId = (data as any)?.project_architect_id ?? null;
    if (!architectId) { setArchitect(null); setLoading(false); return; }
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", architectId)
      .maybeSingle();
    setArchitect((prof as any) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!projectId) return;
    const ch = supabase
      .channel(`project-architect-${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, load]);

  return { architect, loading, refresh: load };
}

/** Fetch the list of profiles eligible to be a Project Architect. */
export async function fetchArchitectCandidates(): Promise<ArchitectProfile[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("is_active", true)
    .in("role", ARCHITECT_ROLES as any)
    .order("display_name");
  return ((data as any[]) ?? []) as ArchitectProfile[];
}
