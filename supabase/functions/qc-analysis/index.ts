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

    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify role
    const { data: role } = await client.rpc("get_user_role", {
      _user_id: user.id,
    });
    const allowedRoles = [
      "qc_inspector",
      "production_head",
      "head_operations",
      "super_admin",
      "managing_director",
    ];
    if (!allowedRoles.includes(role as string)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { failedItems, panelDetails, stageName } = body;

    if (!failedItems || !Array.isArray(failedItems) || failedItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No failed items provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const prompt = `You are a Quality Control AI analyst for modular construction. Analyze the following QC inspection failures and provide structured recommendations.

Panel Details:
- Panel Code: ${panelDetails?.panelCode || "N/A"}
- Panel Type: ${panelDetails?.panelType || "N/A"}
- Dimensions: ${panelDetails?.lengthMm || "N/A"} x ${panelDetails?.heightMm || "N/A"} mm
- Production Stage: ${stageName}

Failed Checklist Items:
${failedItems
  .map(
    (item: any, i: number) =>
      `${i + 1}. Item #${item.itemNumber}: ${item.description}
   Inspector Notes: ${item.notes || "No notes"}
   Critical Item: ${item.isCritical ? "YES" : "No"}`
  )
  .join("\n")}

For each failed item, provide:
1. severity: "Critical", "Major", or "Minor"
2. rootCause: likely root cause (1-2 sentences)
3. immediateAction: what to do right now (1-2 sentences)
4. correctiveAction: long-term fix to prevent recurrence (1-2 sentences)

Also provide an overall stage decision: "PASS STAGE", "HOLD", or "REWORK REQUIRED"
- If ANY item is Critical severity → REWORK REQUIRED
- If multiple Major items → HOLD
- Otherwise → PASS STAGE

Respond in JSON format:
{
  "itemAnalysis": [
    {
      "itemNumber": 1,
      "severity": "Critical",
      "rootCause": "...",
      "immediateAction": "...",
      "correctiveAction": "..."
    }
  ],
  "stageDecision": "REWORK REQUIRED",
  "summary": "Brief overall summary of findings"
}`;

    const aiResponse = await fetch(
      "https://ai-gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a construction QC analyst. Always respond with valid JSON only, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      analysis = { raw: content, error: "Failed to parse AI response" };
    }

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("QC analysis error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
