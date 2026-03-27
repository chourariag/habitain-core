import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { imageUrls, issueDescription, priority } = body as {
      imageUrls: string[];
      issueDescription: string;
      priority: string;
    };

    if (!imageUrls || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one image is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch each image and convert to base64
    const imageBlocks: object[] = [];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const imgRes = await fetch(url);
        if (!imgRes.ok) continue;
        const buffer = await imgRes.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        );
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const mediaType = contentType.startsWith("image/png")
          ? "image/png"
          : "image/jpeg";
        imageBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        });
      } catch {
        // skip images that fail to fetch
      }
    }

    if (imageBlocks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Could not load any images for analysis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const textBlock = {
      type: "text",
      text: `You are an expert R&M (Repair & Maintenance) analyst for modular construction buildings.

Analyse the attached images of a reported issue and provide a structured assessment.

Issue Description: ${issueDescription}
Priority Level: ${priority}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence overall assessment of what you see",
  "severity": "High" or "Medium" or "Low",
  "rootCause": "1-2 sentences explaining likely root cause",
  "materials": ["material1", "material2", "material3"],
  "repairSteps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "estimatedDuration": "e.g. 2-4 hours"
}

severity rules:
- High: structural damage, water ingress, electrical, safety hazard
- Medium: functional but degraded, moderate damage
- Low: cosmetic, minor wear

materials: list specific materials/tools needed (3-6 items)
repairSteps: clear numbered steps (3-6 steps)`,
    };

    // Call Anthropic API directly
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [...imageBlocks, textBlock],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicData = await anthropicRes.json();
    const content = anthropicData.content?.[0]?.text ?? "";

    let analysis;
    try {
      // Strip markdown fences if present
      const clean = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      analysis = JSON.parse(clean);
    } catch {
      analysis = {
        summary: content,
        severity: "Medium",
        rootCause: "Unable to parse structured response",
        materials: [],
        repairSteps: [],
        estimatedDuration: "Unknown",
      };
    }

    // Stamp model used
    analysis.model = "claude-sonnet-4-20250514";
    analysis.generatedAt = new Date().toISOString();

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("rm-ai-analysis error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
