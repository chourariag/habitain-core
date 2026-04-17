// SOP Generator — uses Lovable AI Gateway (google/gemini-2.5-pro)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert in modular construction operations at The Habitainer (Alternate Real Estate Experiences Pvt Ltd), a modular home manufacturer in Bangalore.

Generate a detailed Standard Operating Procedure for the requested task. Use plain language. Workers have varied educational backgrounds. Focus on safety, quality, and efficiency.

Always return JSON via the provided tool. Each section must be plain text (no markdown). Steps should be numbered like "1. ...\\n2. ...". Lists in mistakes/materials/quality use one item per line.`;

const SOP_TOOL = {
  type: "function",
  function: {
    name: "emit_sop",
    description: "Emit a structured SOP",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        role_performs: { type: "string" },
        purpose: { type: "string", description: "1-2 sentences why this task exists" },
        scope: { type: "string", description: "Who does this, when, for which projects" },
        materials_tools: { type: "string", description: "Checklist, one item per line" },
        steps: { type: "string", description: "Numbered steps, one per line" },
        quality_criteria: { type: "string", description: "How to know it was done right" },
        common_mistakes: { type: "string", description: "Bullet list of mistakes to avoid" },
        safety: { type: "string", description: "Safety precautions" },
        escalation: { type: "string", description: "Who to call if something goes wrong" },
      },
      required: [
        "title", "purpose", "scope", "materials_tools", "steps",
        "quality_criteria", "common_mistakes", "safety", "escalation",
      ],
      additionalProperties: false,
    },
  },
};

async function generateOne({
  task_name,
  department,
  description,
  inputs,
  outputs,
}: {
  task_name: string;
  department: string;
  description?: string;
  inputs?: string;
  outputs?: string;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

  const userPrompt = `Department: ${department}
Task name: ${task_name}
Description: ${description ?? "(use industry best practice for this task in modular construction)"}
Key inputs: ${inputs ?? "(infer)"}
Key outputs: ${outputs ?? "(infer)"}

Generate the SOP now.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [SOP_TOOL],
      tool_choice: { type: "function", function: { name: "emit_sop" } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI gateway error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call in AI response");
  const args = JSON.parse(call.function.arguments);
  return args;
}

const STARTER_SOPS: Array<{ task_name: string; department: string; process_name: string }> = [
  { task_name: "Steel Sub-Frame Fabrication", department: "Factory Production", process_name: "Sub-Frame" },
  { task_name: "Wall Framing Installation", department: "Factory Production", process_name: "Framing" },
  { task_name: "Floor Deck Sheet Installation", department: "Factory Production", process_name: "Decking" },
  { task_name: "Concrete Pouring (floor and roof)", department: "Factory Production", process_name: "Concrete" },
  { task_name: "Insulation Installation (Rockwool)", department: "Factory Production", process_name: "Insulation" },
  { task_name: "Internal Wall Boarding (Habito / Gypsum)", department: "Factory Production", process_name: "Boarding" },
  { task_name: "External Cladding (Shera Board)", department: "Factory Production", process_name: "Cladding" },
  { task_name: "Internal Painting (all stages)", department: "Factory Production", process_name: "Painting" },
  { task_name: "MEP Electrical Concealed Works", department: "Factory Production", process_name: "MEP Electrical" },
  { task_name: "MEP Plumbing Concealed Works", department: "Factory Production", process_name: "MEP Plumbing" },
  { task_name: "Shell and Core QC Inspection", department: "Quality Control", process_name: "Shell QC" },
  { task_name: "Builder Finish QC Inspection", department: "Quality Control", process_name: "Finish QC" },
  { task_name: "NCR Raising and Documentation", department: "Quality Control", process_name: "NCR" },
  { task_name: "Dry Assembly Check", department: "Quality Control", process_name: "Dry Assembly" },
  { task_name: "Module Erection on Site", department: "Site Installation", process_name: "Erection" },
  { task_name: "Marriage Line (full welding and grinding)", department: "Site Installation", process_name: "Marriage Line" },
  { task_name: "Site Receipt Checklist", department: "Site Installation", process_name: "Site Receipt" },
  { task_name: "Handover Inspection and Commissioning", department: "Site Installation", process_name: "Handover" },
  { task_name: "GRN Process (receiving materials on site and factory)", department: "Procurement & Stores", process_name: "GRN" },
  { task_name: "Purchase Order Verification (before approving payment)", department: "Procurement & Stores", process_name: "PO Verification" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr(401, "Missing auth");

    // Authed client to identify caller
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonErr(401, "Invalid user");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!profile) return jsonErr(403, "No profile");

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "generate";

    if (action === "generate") {
      const { task_name, department, description, inputs, outputs } = body;
      if (!task_name || !department) return jsonErr(400, "task_name and department required");
      const sop = await generateOne({ task_name, department, description, inputs, outputs });

      const { data: inserted, error } = await admin
        .from("sop_procedures")
        .insert({
          title: sop.title || task_name,
          department,
          process_name: body.process_name ?? null,
          role_performs: sop.role_performs ?? null,
          status: "draft",
          purpose: sop.purpose,
          scope: sop.scope,
          materials_tools: sop.materials_tools,
          steps: sop.steps,
          quality_criteria: sop.quality_criteria,
          common_mistakes: sop.common_mistakes,
          safety: sop.safety,
          escalation: sop.escalation,
          ai_generated: true,
          created_by: profile.id,
          created_by_name: profile.full_name,
          last_updated_by: profile.id,
          last_updated_by_name: profile.full_name,
        })
        .select()
        .single();
      if (error) throw error;
      return jsonOk({ sop: inserted });
    }

    if (action === "auto_seed") {
      // Only run if 0 SOPs exist
      const { count } = await admin
        .from("sop_procedures")
        .select("*", { count: "exact", head: true });
      if ((count ?? 0) > 0) return jsonOk({ seeded: false, reason: "already_populated" });

      let inserted = 0;
      for (const seed of STARTER_SOPS) {
        try {
          const sop = await generateOne({
            task_name: seed.task_name,
            department: seed.department,
          });
          await admin.from("sop_procedures").insert({
            title: sop.title || seed.task_name,
            department: seed.department,
            process_name: seed.process_name,
            role_performs: sop.role_performs ?? null,
            status: "draft",
            purpose: sop.purpose,
            scope: sop.scope,
            materials_tools: sop.materials_tools,
            steps: sop.steps,
            quality_criteria: sop.quality_criteria,
            common_mistakes: sop.common_mistakes,
            safety: sop.safety,
            escalation: sop.escalation,
            ai_generated: true,
            created_by: profile.id,
            created_by_name: profile.full_name,
            last_updated_by: profile.id,
            last_updated_by_name: profile.full_name,
          });
          inserted++;
          await new Promise((r) => setTimeout(r, 600));
        } catch (e) {
          console.error("Seed failed for", seed.task_name, e);
        }
      }
      return jsonOk({ seeded: true, count: inserted });
    }

    return jsonErr(400, "Unknown action");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "RATE_LIMIT") return jsonErr(429, "Rate limit exceeded, try again shortly.");
    if (msg === "PAYMENT_REQUIRED") return jsonErr(402, "AI credits required. Add funds in workspace settings.");
    console.error("sop-generate error:", msg);
    return jsonErr(500, msg);
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonErr(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
