import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/lib/roles";

interface AdminAction {
  action: string;
  [key: string]: unknown;
}

export async function callAdminFunction(payload: AdminAction) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Not authenticated");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Function failed: ${response.status}`);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createUser(email: string, role: AppRole, loginType: "email" | "otp" = "email", phone?: string, kioskPin?: string) {
  return callAdminFunction({ action: "create_user", email, role, login_type: loginType, phone, kiosk_pin: kioskPin });
}

export async function deactivateUser(userId: string) {
  return callAdminFunction({ action: "deactivate_user", user_id: userId });
}

export async function reactivateUser(userId: string) {
  return callAdminFunction({ action: "reactivate_user", user_id: userId });
}

export async function updateUserRole(userId: string, role: AppRole) {
  return callAdminFunction({ action: "update_role", user_id: userId, role });
}

export async function createUserWithPassword(opts: {
  email: string; role: AppRole; password: string;
  display_name?: string; phone?: string; reporting_manager_id?: string;
}) {
  return callAdminFunction({ action: "create_user_with_password", ...opts });
}

export async function reassignAndDeactivate(userId: string, reassignTo?: string) {
  return callAdminFunction({ action: "reassign_and_deactivate", user_id: userId, reassign_to: reassignTo });
}
