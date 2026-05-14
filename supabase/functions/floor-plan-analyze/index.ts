// Analyze a floor plan image with Lovable AI (Gemini) and create candidate camera positions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { floor_plan_id } = await req.json();
    if (!floor_plan_id) throw new Error("floor_plan_id required");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: fp, error: fpErr } = await sb.from("floor_plans").select("*").eq("id", floor_plan_id).single();
    if (fpErr || !fp) throw new Error("Floor plan not found");

    await sb.from("floor_plans").update({ ai_analysis_status: "processing", ai_analysis_error: null }).eq("id", floor_plan_id);

    const prompt = `You are an architect analyzing a floor plan image. Identify each distinct enclosed room or space. For each room, provide:
- area_name (use any visible label, otherwise infer e.g. "Living Room", "Bedroom 1", "Kitchen", "Bathroom", "Hallway")
- direction: which compass direction (N, S, E, W) the photographer should face from inside the room to get the best wide coverage of that space
- is_mandatory: true for habitable rooms (living, bed, kitchen, bath); false for tiny utility spaces.
Return ONLY via the tool call.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: fp.file_url } },
          ],
        }],
        tools: [{
          type: "function",
          function: {
            name: "report_positions",
            description: "Report list of camera positions",
            parameters: {
              type: "object",
              properties: {
                positions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      area_name: { type: "string" },
                      direction: { type: "string", enum: ["N", "S", "E", "W", "NE", "NW", "SE", "SW"] },
                      is_mandatory: { type: "boolean" },
                    },
                    required: ["area_name", "direction", "is_mandatory"],
                  },
                },
              },
              required: ["positions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_positions" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      await sb.from("floor_plans").update({ ai_analysis_status: "failed", ai_analysis_error: `${aiRes.status}: ${txt.slice(0, 300)}` }).eq("id", floor_plan_id);
      return new Response(JSON.stringify({ error: "AI gateway error", status: aiRes.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = tc ? JSON.parse(tc.function.arguments) : { positions: [] };
    const positions: Array<{ area_name: string; direction: string; is_mandatory: boolean }> = args.positions ?? [];

    if (positions.length > 0) {
      const rows = positions.map((p, i) => ({
        floor_plan_id,
        project_id: fp.project_id,
        position_number: i + 1,
        area_name: p.area_name,
        floor_name: fp.floor_name,
        direction: p.direction,
        is_mandatory: p.is_mandatory ?? true,
        is_active: true,
        source: "ai",
      }));
      await sb.from("photo_positions").insert(rows);
    }
    await sb.from("floor_plans").update({ ai_analysis_status: "done" }).eq("id", floor_plan_id);

    return new Response(JSON.stringify({ ok: true, count: positions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
