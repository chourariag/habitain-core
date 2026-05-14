// Compare today's photo with yesterday's photo at the same position, and cross-check measurement sheet entries.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { photo_id } = await req.json();
    if (!photo_id) throw new Error("photo_id required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: photo } = await sb.from("site_position_photos").select("*").eq("id", photo_id).single();
    if (!photo) throw new Error("Photo not found");

    const { data: pos } = await sb.from("photo_positions").select("area_name,floor_name").eq("id", photo.position_id).single();

    const { data: prev } = await sb
      .from("site_position_photos")
      .select("file_url,photo_date")
      .eq("position_id", photo.position_id)
      .lt("photo_date", photo.photo_date)
      .order("photo_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Pull measurement entries for the same project + date that mention this area
    const { data: measurements } = await sb
      .from("daily_measurements")
      .select("id, location, measurement_line_items(today_qty, boq_items(description, unit, stage))")
      .eq("project_id", photo.project_id)
      .eq("entry_date", photo.photo_date)
      .eq("is_archived", false);

    const measurementSummary = (measurements ?? [])
      .flatMap((m: any) => (m.measurement_line_items ?? []).map((li: any) => ({
        qty: li.today_qty,
        unit: li.boq_items?.unit,
        desc: li.boq_items?.description,
        stage: li.boq_items?.stage,
      })))
      .slice(0, 30);

    const prompt = `You are a construction QA assistant. Compare today's site photo at position "${pos?.area_name ?? ""}" (${pos?.floor_name ?? ""}) with yesterday's photo. Cross-check what is visible against the measurement sheet entries recorded by the supervisor today.

Measurement sheet entries for today: ${JSON.stringify(measurementSummary)}

Return:
- progress_detected: "visible_change" | "no_change" | "regression"
- new_materials_visible: short list (boarding, paint, tiling, etc.)
- safety_observations: short list (e.g. "workers without helmets")
- flags: discrepancies vs measurement sheet, each as a single sentence
- severity: "info" | "minor" | "major" (major if discrepancy >30% or missing entries)`;

    const messages: any[] = [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "text", text: "TODAY:" },
        { type: "image_url", image_url: { url: photo.file_url } },
      ],
    }];
    if (prev?.file_url) {
      messages[0].content.push({ type: "text", text: `YESTERDAY (${prev.photo_date}):` });
      messages[0].content.push({ type: "image_url", image_url: { url: prev.file_url } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "report_analysis",
            parameters: {
              type: "object",
              properties: {
                progress_detected: { type: "string", enum: ["visible_change", "no_change", "regression", "first_photo"] },
                new_materials_visible: { type: "array", items: { type: "string" } },
                safety_observations: { type: "array", items: { type: "string" } },
                flags: { type: "array", items: { type: "string" } },
                severity: { type: "string", enum: ["info", "minor", "major"] },
              },
              required: ["progress_detected", "flags", "severity"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI error", detail: txt.slice(0, 200) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const result = tc ? JSON.parse(tc.function.arguments) : {};
    const flags: string[] = result.flags ?? [];

    await sb.from("site_position_photos").update({
      ai_analysis_result: result,
      ai_flags: flags,
      ai_severity: result.severity ?? "info",
    }).eq("id", photo_id);

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
