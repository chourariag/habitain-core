import { supabase } from "@/integrations/supabase/client";

/** Only actuals are accepted here; schedule fields and actor IDs never enter this writer. */
export interface TaskProgressPatch {
  completion_percentage?: number;
  status?: string;
  actual_start_date?: string;
  actual_finish_date?: string;
  remarks?: string | null;
  delay_cause?: string | null;
  delay_resolution?: string | null;
}

export async function saveTaskProgress(id: string, patch: TaskProgressPatch): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("project_tasks").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) return error.message;
    // RLS may silently filter out the row instead of returning a PostgreSQL error.
    if (!data) return "This task was not saved. You do not have permission to update it, or it is no longer available.";
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "This task was not saved. Please try again.";
  }
}