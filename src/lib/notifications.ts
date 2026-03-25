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
