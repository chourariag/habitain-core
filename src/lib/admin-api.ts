import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/lib/roles";

interface AdminAction {
  action: string;
  [key: string]: unknown;
}

export async function callAdminFunction(payload: AdminAction) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("admin-users", {
    body: payload,
  });

  if (response.error) throw new Error(response.error.message);
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}

export async function createUser(email: string, role: AppRole, loginType: "email" | "otp" = "email", phone?: string) {
  return callAdminFunction({ action: "create_user", email, role, login_type: loginType, phone });
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
