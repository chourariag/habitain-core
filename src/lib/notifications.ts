import { supabase } from "@/integrations/supabase/client";
import { tplGeneral, tplOverdue, tplMilestone, tplArchiveReady, tplGfcKickoff } from "./email-templates";

type NotificationInput = {
  recipient_id: string;
  title: string;
  body: string;
  category: string;
  related_table?: string;
  related_id?: string;
  navigate_to?: string;
  priority?: "low" | "normal" | "high" | "critical";
};

// Categories that always trigger an email regardless of recipient role.
const HIGH_PRIORITY_CATEGORIES = new Set<string>([
  "overdue", "overdue_alert",
  "approval", "approval_request", "variation_approval", "expense_approval",
  "archive_ready", "archive",
  "gfc_kickoff", "project_setup_approval",
]);

// Roles whose notifications always get an email copy.
const ALWAYS_EMAIL_ROLES = new Set<string>([
  "managing_director", "super_admin", "director",
  "finance_director", "sales_director", "architecture_director",
  "principal_architect",
]);

function pickTemplate(n: NotificationInput) {
  const cat = n.category.toLowerCase();
  if (cat.includes("overdue")) {
    return tplOverdue({ projectName: "", stage: n.title, daysOverdue: 0, navigateTo: n.navigate_to });
  }
  if (cat.includes("milestone")) {
    return tplMilestone({ projectName: n.title, milestone: n.body, navigateTo: n.navigate_to });
  }
  if (cat.includes("archive")) {
    return tplArchiveReady({ projectName: n.title });
  }
  if (cat.includes("gfc_kickoff") || cat.includes("kickoff")) {
    return tplGfcKickoff({ projectName: n.title, deadline: n.body, navigateTo: n.navigate_to });
  }
  return tplGeneral({ title: n.title, body: n.body, navigateTo: n.navigate_to });
}

async function dispatchEmails(inserted: Array<{ id: string } & NotificationInput>) {
  // Look up auth -> profile (email + role) for all unique recipients
  const recipientIds = Array.from(new Set(inserted.map((r) => r.recipient_id)));
  if (!recipientIds.length) return;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("auth_user_id, email, role")
    .in("auth_user_id", recipientIds as any);
  const byAuthId = new Map<string, { email: string | null; role: string | null }>();
  (profiles ?? []).forEach((p: any) => byAuthId.set(p.auth_user_id, { email: p.email, role: p.role }));

  for (const n of inserted) {
    const prof = byAuthId.get(n.recipient_id);
    if (!prof?.email) continue;
    const shouldEmail =
      n.priority === "high" || n.priority === "critical" ||
      HIGH_PRIORITY_CATEGORIES.has(n.category.toLowerCase()) ||
      (prof.role && ALWAYS_EMAIL_ROLES.has(prof.role));
    if (!shouldEmail) continue;
    const tpl = pickTemplate(n);
    // Fire and forget — don't block the caller
    supabase.functions.invoke("send-email", {
      body: { to: [prof.email], subject: tpl.subject, html: tpl.html, text: tpl.text, notification_id: n.id },
    }).catch((e) => console.error("send-email invoke failed", e));
  }
}

/**
 * Insert one or more notifications. High-priority ones also trigger a branded email.
 */
export async function insertNotifications(items: NotificationInput | NotificationInput[]) {
  const arr = Array.isArray(items) ? items : [items];
  const rows = arr.map((n) => ({
    recipient_id: n.recipient_id,
    title: n.title,
    body: n.body,
    category: n.category,
    type: n.category,            // legacy column
    content: n.body,             // legacy column
    related_table: n.related_table ?? null,
    related_id: n.related_id ?? null,
    linked_entity_type: n.related_table ?? null,
    linked_entity_id: n.related_id ?? null,
    navigate_to: n.navigate_to ?? null,
    priority: n.priority ?? "normal",
  }));
  const res = await supabase.from("notifications").insert(rows as any).select("id");
  if (!res.error && res.data) {
    const merged = res.data.map((r: any, i: number) => ({ id: r.id, ...arr[i] }));
    dispatchEmails(merged).catch(() => {});
  }
  return res;
}
