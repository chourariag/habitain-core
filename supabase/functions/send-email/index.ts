// Internal templates retain markup; user fields only enter server-owned templates.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { authorizeUser, DIRECTOR_CALLERS, isServiceBearer, escapeHtml, denied } from "../_shared/caller-auth.ts";
import { tplGeneral, tplOverdue, tplMilestone, tplArchiveReady, tplGfcKickoff } from "../_shared/email-templates.ts";

// Existing notifications originate throughout these employee workflows.
const EMAIL_CALLERS = [...DIRECTOR_CALLERS, "director", "chairman", "head_operations", "production_head", "finance_manager", "planning_engineer", "costing_engineer", "quantity_surveyor", "site_installation_mgr", "delivery_rm_lead", "site_engineer", "qc_inspector", "factory_floor_supervisor", "fabrication_foreman", "procurement", "stores_executive", "accounts_executive", "hr_executive", "project_architect", "structural_architect", "principal_architect", "planning_head", "head_of_projects", "procurement_assistant", "hr_admin", "marketing", "sales_executive", "logistics_manager", "operations_architect", "factory_supervisor", "senior_architect", "sales_associate", "senior_factory_supervisor", "purchase_assistant", "assistant_manager"];
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("RESEND_FROM") || "HStack <notify@altree.in>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const internal = isServiceBearer(req) || authenticateCronRequest(req) === null;
    const access = internal ? null : await authorizeUser(req, EMAIL_CALLERS);
    if (access instanceof Response) return access;
    const body = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let to: string[] = Array.isArray(body.to) ? [...new Set(body.to.filter((email: unknown): email is string => typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).map((email: string) => email.trim().toLowerCase()))] : [];
    if (Array.isArray(body.recipient_ids) && body.recipient_ids.length) {
      const ids = body.recipient_ids;
      if (!ids.every((id: unknown) => typeof id === "string" && /^[a-f\d-]{36}$/i.test(id))) return denied(400, "Invalid recipients");
      const { data: recipients, error } = await admin.from("profiles").select("auth_user_id,email").in("auth_user_id", ids);
      if (error || !recipients || ids.some((id: string) => !recipients.some(row => row.auth_user_id === id && row.email))) return denied(403, "Recipients must exist in profiles");
      to = [...new Set(recipients.map(row => String(row.email).toLowerCase()))];
    }
    if (!internal) {
      const { data: recipients, error } = await admin.from("profiles").select("email").in("email", to);
      const registered = new Set((recipients || []).map(row => String(row.email).toLowerCase()));
      if (error || to.some(email => !registered.has(email))) return denied(403, "Recipients must exist in profiles");
    }
    const notificationId = body.notification_id || null;
    if (notificationId && !internal) {
      const { data: notification, error } = await admin.from("notifications").select("recipient_id").eq("id", notificationId).maybeSingle();
      if (error || !notification || notification.recipient_id !== access?.userId) return denied(403, "Notification does not belong to caller");
    }
    let subject = String(body.subject || "").slice(0, 200).replace(/[\r\n]/g, " ");
    let html = internal ? String(body.html || "") : `<p>${escapeHtml(body.text || body.html || "")}</p>`;
    let text = String(body.text || "");
    if (body.template === "notification") {
      const title = String(body.title || "");
      const message = String(body.message || "");
      const category = String(body.category || "").toLowerCase();
      const requestedPath = String(body.navigate_to || "/");
      const navigateTo = /^\/(?!\/)[^<>"'\r\n]*$/.test(requestedPath) ? requestedPath : "/";
      const template = category.includes("overdue") ? tplOverdue({ projectName: "", stage: title, daysOverdue: 0, navigateTo })
        : category.includes("milestone") ? tplMilestone({ projectName: title, milestone: message, navigateTo })
        : category.includes("archive") ? tplArchiveReady({ projectName: title })
        : category.includes("kickoff") ? tplGfcKickoff({ projectName: title, deadline: message, navigateTo })
        : tplGeneral({ title, body: message, navigateTo });
      ({ subject, html, text } = template);
      subject = subject.slice(0, 200).replace(/[\r\n]/g, " ");
    }
    if (!to.length || !subject || !html) return denied(400, "Missing to/subject/html");
    if (!RESEND_API_KEY) return denied(500, "Email service is not configured");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to, subject, html, text }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return denied(502, payload?.message || "Email delivery failed");
    if (notificationId) {
      await admin.from("notifications").update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq("id", notificationId);
    }
    return new Response(JSON.stringify({ success: true, id: payload?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch { return denied(500, "Email request failed"); }
});
