// Permanently delete source media for a closed project across known buckets.
// Requires: caller is MD or head_of_projects, and project_archives.storage_cleanup_eligible = true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKETS = ["site-diary", "factory-photos", "qc-photos", "ncr-evidence", "chat-media"];

async function listAll(supabase: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  // Recursive walk: list folder, recurse into subfolders
  const stack: string[] = [prefix.replace(/\/$/, "")];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await supabase.storage.from(bucket).list(dir, { limit: 1000 });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("not found")) continue;
      throw error;
    }
    for (const item of data || []) {
      const path = dir ? `${dir}/${item.name}` : item.name;
      // Folders have id === null in Supabase storage listing
      if (item.id === null) stack.push(path);
      else out.push(path);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const { project_id, confirm_name } = await req.json();
    if (!project_id || !confirm_name) return json({ error: "project_id and confirm_name required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Identify caller
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Invalid auth" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const role = (profile as any)?.role;
    if (!profile?.is_active || !["managing_director", "super_admin", "head_of_projects"].includes(role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Verify pre-condition
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, project_code")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return json({ error: "Project not found" }, 404);
    if (String(confirm_name).trim().toLowerCase() !== String(project.name).trim().toLowerCase()) {
      return json({ error: "Project name does not match" }, 400);
    }

    const { data: archive } = await supabase
      .from("project_archives")
      .select("storage_cleanup_eligible")
      .eq("project_id", project_id)
      .maybeSingle();
    if (!archive?.storage_cleanup_eligible) {
      return json({ error: "Storage cleanup is not yet eligible. Waiting for Zoho Drive upload confirmation." }, 400);
    }

    // Walk + delete
    const summary: Record<string, number> = {};
    let total = 0;
    for (const bucket of BUCKETS) {
      try {
        const paths = await listAll(supabase, bucket, project_id);
        if (paths.length) {
          // Delete in chunks of 100
          for (let i = 0; i < paths.length; i += 100) {
            const chunk = paths.slice(i, i + 100);
            const { error } = await supabase.storage.from(bucket).remove(chunk);
            if (error) console.error(`remove ${bucket}:`, error.message);
          }
        }
        summary[bucket] = paths.length;
        total += paths.length;
      } catch (e: any) {
        console.error(`bucket ${bucket} error:`, e?.message);
        summary[bucket] = -1;
      }
    }

    // Mark project + audit
    await supabase.from("projects").update({
      storage_cleaned: true,
      storage_cleaned_at: new Date().toISOString(),
      storage_cleaned_by: user.id,
    }).eq("id", project_id);

    await supabase.from("project_storage_cleanup_log").insert({
      project_id,
      action: "storage_cleanup",
      performed_by: user.id,
      performed_by_role: role,
      files_deleted_count: total,
      buckets_processed: summary,
    });

    return json({ ok: true, files_deleted_count: total, buckets: summary });
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
