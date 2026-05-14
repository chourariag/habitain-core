import { supabase } from "@/integrations/supabase/client";

type NotificationInput = {
  recipient_id: string;
  title: string;
  body: string;
  category: string;
  related_table?: string;
  related_id?: string;
  navigate_to?: string;
};

/**
 * Insert one or more notifications, mapping to the full table schema
 * (title, body, category are required; type + content are legacy columns kept in sync).
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
  }));
  return supabase.from("notifications").insert(rows as any);
}

export async function notifyDispatchParties(projectId: string, projectName: string, daysUntilDispatch: number) {
  const { data: awaiz } = await supabase.from("profiles").select("auth_user_id").eq("display_name", "Awaiz").maybeSingle();
  const { data: nazim } = await supabase.from("profiles").select("auth_user_id").eq("display_name", "Nazim").maybeSingle();
  const items: Parameters<typeof insertNotifications>[0][] = [];
  if (daysUntilDispatch === 14 && awaiz?.auth_user_id) {
    items.push({ recipient_id: awaiz.auth_user_id, title: `T-14: ${projectName} Dispatch`, body: `Dispatch for ${projectName} is in 14 days. Initiate pre-dispatch checklist.`, category: "production", navigate_to: "/procurement" });
  }
  if (daysUntilDispatch === 12 && nazim?.auth_user_id) {
    items.push({ recipient_id: nazim.auth_user_id, title: `T-12: ${projectName} Logistics`, body: `Dispatch for ${projectName} is in 12 days. Confirm transport arrangements.`, category: "production", navigate_to: "/site-hub" });
  }
  if (items.length) await insertNotifications(items);
}

export async function notifyMeasurementMiss(projectId: string, projectName: string, missedDays: number) {
  const { data: azad } = await supabase.from("profiles").select("auth_user_id").eq("display_name", "Azad").maybeSingle();
  const { data: suraj } = await supabase.from("profiles").select("auth_user_id").eq("display_name", "Suraj").maybeSingle();
  const { data: md } = await (supabase.from("profiles") as any).select("auth_user_id").eq("role", "managing_director").eq("is_active", true).limit(1).maybeSingle();
  const items: Parameters<typeof insertNotifications>[0][] = [];
  if (missedDays >= 1 && azad?.auth_user_id) {
    items.push({ recipient_id: azad.auth_user_id, title: "Measurement Entry Missing", body: `No measurement entry recorded for ${projectName} today. Please update the daily sheet.`, category: "production" });
  }
  if (missedDays >= 2) {
    if (suraj?.auth_user_id) items.push({ recipient_id: suraj.auth_user_id, title: "Measurement 2+ Days Missing", body: `${projectName} has missed measurement entries for ${missedDays} consecutive days.`, category: "production" });
    if (md?.auth_user_id) items.push({ recipient_id: md.auth_user_id, title: "Measurement Alert", body: `${projectName} has missed measurement entries for ${missedDays} consecutive days.`, category: "production" });
  }
  if (items.length) await insertNotifications(items);
}
