import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { useProjectImportListener } from "@/lib/use-project-import";

interface Props {
  projectId: string;
}

/**
 * Shown on every project tab whose data is populated by the Project Setup
 * Template (Schedule, Materials, BOQ, Scope, Billing). Tells the user the
 * data is read-only and points them to a single re-upload action.
 */
export function SetupTemplateBanner({ projectId }: Props) {
  const [info, setInfo] = useState<{ at: string; by: string | null } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("projects")
      .select("setup_uploaded_at, setup_uploaded_by_name")
      .eq("id", projectId)
      .maybeSingle();
    const at = (data as any)?.setup_uploaded_at as string | null;
    if (at) setInfo({ at, by: ((data as any)?.setup_uploaded_by_name as string | null) ?? null });
    else setInfo(null);
  };
  useEffect(() => { load(); }, [projectId]);
  useProjectImportListener(projectId, load);

  if (!info) return null;
  const when = (() => { try { return format(new Date(info.at), "dd/MM/yyyy"); } catch { return info.at; } })();
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#006039]/20 bg-[#006039]/5 px-3 py-2 text-xs text-[#006039]">
      <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        Loaded from Project Setup Template — uploaded by {info.by || "Karthik"} on {when}.
        <span className="ml-1 text-muted-foreground">Re-upload the template from the project header to replace this data.</span>
      </div>
    </div>
  );
}

/** Lightweight hook that returns true once a Project Setup Template has been imported. */
export function useSetupUploaded(projectId: string | null | undefined) {
  const [uploaded, setUploaded] = useState(false);
  const load = async () => {
    if (!projectId) return;
    const { data } = await supabase.from("projects").select("setup_uploaded_at").eq("id", projectId).maybeSingle();
    setUploaded(!!(data as any)?.setup_uploaded_at);
  };
  useEffect(() => { load(); }, [projectId]);
  useProjectImportListener(projectId ?? "", load);
  return uploaded;
}
