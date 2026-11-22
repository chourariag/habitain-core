import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTier1OrSuper } from "@/lib/roles";
export function RequestClientContact({ requestId, role }: { requestId: string; role: string | null }) {
  const [contact, setContact] = useState<{ client_phone: string; client_email: string } | null>(null);
  useEffect(() => {
    let current = true;
    setContact(null);
    if (isTier1OrSuper(role)) void supabase.rpc("get_project_request_client_contact", { p_request_id: requestId }).then(({ data }) => { if (current) setContact(data?.[0] ?? null); });
    return () => { current = false; };
  }, [requestId, role]);
  if (!isTier1OrSuper(role) || !contact) return null;
  return <section className="space-y-1 border-t border-border py-2" aria-label="Private client contact"><h3 className="font-medium">Client contact</h3><p className="break-all text-xs">{contact.client_phone}</p><p className="break-all text-xs">{contact.client_email}</p></section>;
}