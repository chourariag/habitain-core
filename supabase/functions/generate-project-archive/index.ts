// Generate project archive ZIP. Creates a manifest JSON + summary file and stores in `project-archives` bucket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Mark generating
    await supabase.from("project_archives").update({ zip_generation_status: "generating" }).eq("project_id", project_id);

    const tables = [
      "projects","design_stages","qc_inspections","ncr_register","design_queries","site_diary",
      "punch_list_items","variation_register","project_boq_items","project_billing_milestones",
      "project_invoices","handover_pack","drawings","dispatch_packs","daily_production_logs",
      "project_messages",
    ];
    const data: Record<string, any> = {};
    for (const t of tables) {
      const q = t === "projects"
        ? supabase.from(t).select("*").eq("id", project_id).maybeSingle()
        : supabase.from(t).select("*").eq("project_id", project_id);
      const { data: rows } = await (q as any);
      data[t] = rows;
    }

    const zip = new JSZip();
    zip.file("project-summary.json", JSON.stringify(data.projects, null, 2));
    zip.folder("financial")?.file("billing.json", JSON.stringify(data.project_billing_milestones || [], null, 2));
    zip.folder("financial")?.file("invoices.json", JSON.stringify(data.project_invoices || [], null, 2));
    zip.folder("financial")?.file("boq.json", JSON.stringify(data.project_boq_items || [], null, 2));
    zip.folder("qc-reports")?.file("inspections.json", JSON.stringify(data.qc_inspections || [], null, 2));
    zip.folder("ncr-records")?.file("ncrs.json", JSON.stringify(data.ncr_register || [], null, 2));
    zip.folder("design")?.file("stages.json", JSON.stringify(data.design_stages || [], null, 2));
    zip.folder("design")?.file("queries.json", JSON.stringify(data.design_queries || [], null, 2));
    zip.folder("drawings")?.file("manifest.json", JSON.stringify(data.drawings || [], null, 2));
    zip.folder("site-diary")?.file("entries.json", JSON.stringify(data.site_diary || [], null, 2));
    zip.folder("documents")?.file("handover.json", JSON.stringify(data.handover_pack || [], null, 2));
    zip.folder("documents")?.file("punch-list.json", JSON.stringify(data.punch_list_items || [], null, 2));
    zip.folder("documents")?.file("variations.json", JSON.stringify(data.variation_register || [], null, 2));
    zip.folder("dispatch")?.file("packs.json", JSON.stringify(data.dispatch_packs || [], null, 2));
    zip.folder("factory-photos")?.file("daily-logs.json", JSON.stringify(data.daily_production_logs || [], null, 2));
    zip.file("chat-history.json", JSON.stringify(data.project_messages || [], null, 2));
    zip.file("README.txt", `Archive for project ${data.projects?.name || project_id}\nGenerated ${new Date().toISOString()}\n\nThis ZIP contains JSON manifests of all project records.\nReferenced files (drawings, photos) remain accessible via the cloud report in HStack.`);

    const blob = await zip.generateAsync({ type: "uint8array" });
    const path = `${project_id}/${Date.now()}-archive.zip`;
    const { error: upErr } = await supabase.storage.from("project-archives").upload(path, blob, {
      contentType: "application/zip", upsert: true,
    });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("project-archives").createSignedUrl(path, 60 * 60 * 24 * 365);

    await supabase.from("project_archives").update({
      zip_download_url: path,
      zip_generated_at: new Date().toISOString(),
      zip_generation_status: "ready",
      zip_generation_error: null,
    }).eq("project_id", project_id);

    return new Response(JSON.stringify({ ok: true, path, signed_url: signed?.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
