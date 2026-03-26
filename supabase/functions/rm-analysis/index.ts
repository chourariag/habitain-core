import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { issue_description, image_urls } = await req.json();

    if (!issue_description) {
      return new Response(JSON.stringify({ error: "issue_description is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build content array with text + image URLs
    const userContent: any[] = [
      {
        type: "text",
        text: `Issue description: ${issue_description}`,
      },
    ];

    if (image_urls && image_urls.length > 0) {
      for (const url of image_urls) {
        userContent.push({
          type: "image_url",
          image_url: { url },
        });
      }
    }

    const systemPrompt = `You are an R&M assessment assistant for a modular and panel construction company in India.
Analyse the provided images and issue description.
Be specific, practical, and concise.
Respond in this exact JSON format:
{
  "summary": "string (2 sentences max)",
  "root_cause": "string (1-2 sentences)",
  "severity": "Critical" | "High" | "Medium" | "Low",
  "severity_reason": "string (1 sentence)",
  "immediate_action": "string (2-3 bullet points separated by newlines)",
  "complexity": "Simple" | "Moderate" | "Complex",
  "materials_needed": ["up to 5 items"]
}
Only respond with valid JSON, no markdown fences or extra text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? "";

    // Try to parse JSON from the response
    let parsed;
    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Return raw text if JSON parsing fails
      return new Response(JSON.stringify({ raw_text: rawText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ analysis: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rm-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
