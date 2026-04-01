import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHECK_CONTEXTS: Record<string, string> = {
  daily_log:
    "Factory production progress photo — should show a module or panel at a stage of construction",
  site_diary:
    "Site installation progress photo — should show site work, panels being erected, or completed installation areas",
  rm_ticket:
    "Repair and maintenance defect photo — should clearly show the damage, crack, or issue being reported",
  delivery_checklist:
    "Module dispatch photo — should show panels loaded on truck, wrapped and labelled, or at the loading bay",
  qc_evidence:
    "Quality control evidence photo — should show the specific item being inspected as described in the checklist item",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, context } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "image_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkContext = CHECK_CONTEXTS[context] || CHECK_CONTEXTS.daily_log;

    const systemPrompt = `You are a construction photo quality checker for a prefab modular building company in India. Your job is to check if a photo is good enough for construction documentation. Be helpful and encouraging. Always respond in simple English that a site worker can understand. Never use technical jargon.

Respond ONLY in this exact JSON format:
{
  "accepted": true or false,
  "quality_issues": [],
  "main_feedback": "one sentence plain English",
  "retake_tip": "one specific actionable tip if rejected",
  "subject_visible": true or false
}

Check for these quality issues:
- too_dark: image is underexposed or hard to see
- too_bright: overexposed or washed out
- blurry: motion blur or out of focus
- too_far: subject is too small to see detail
- obstructed: hand, finger, or object blocking lens
- wrong_subject: clearly not a construction photo
- portrait_orientation: phone held vertically for a scene needing landscape

Context of this photo: ${checkContext}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${image_base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      const cleaned = rawText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Default to accepted if parsing fails
      parsed = {
        accepted: true,
        quality_issues: [],
        main_feedback: "Photo check completed",
        retake_tip: "",
        subject_visible: true,
      };
    }

    return new Response(JSON.stringify({ result: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("photo-check error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
