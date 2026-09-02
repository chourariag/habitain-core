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

export async function createOffboardingRecord(opts: {
  profile_id: string;
  last_working_day: string;
  reason: string;
  exit_reason_category?: string;
  exit_interview_notes?: string;
}) {
  return callAdminFunction({ action: "create_offboarding_record", ...opts });
}

export async function resolveOffboardingImpactItem(opts: {
  impact_item_id: string;
  resolution_status: "resolved" | "leave_vacant";
  reassign_to_profile_id?: string;
  notes?: string;
}) {
  return callAdminFunction({ action: "resolve_offboarding_impact_item", ...opts });
}

export async function advanceOffboarding(recordId: string, newStatus: string) {
  return callAdminFunction({ action: "advance_offboarding", record_id: recordId, new_status: newStatus });
}

export async function getSoleRoleHolders() {
  return callAdminFunction({ action: "get_sole_role_holders" });
}


export async function createEmployee(opts: {
  full_name: string; email: string; role: AppRole;
  phone?: string; department?: string; reporting_manager_id?: string;
  secondary_manager_id?: string; temp_password?: string;
}) {
  return callAdminFunction({ action: "create_employee", ...opts });
}

export async function updateEmployee(opts: {
  user_id: string; role?: AppRole; department?: string | null;
  reporting_manager_id?: string | null; secondary_manager_id?: string | null;
  is_active?: boolean; display_name?: string; phone?: string | null;
}) {
  return callAdminFunction({ action: "update_employee", ...opts });
}

export async function resetEmployeePassword(userId: string, tempPassword?: string) {
  return callAdminFunction({ action: "reset_password", user_id: userId, temp_password: tempPassword });
}

export async function deleteEmployee(userId: string) {
  return callAdminFunction({ action: "delete_employee", user_id: userId });
}

export async function logBulkDeleteAllEmployees() {
  return callAdminFunction({ action: "bulk_delete_all_employees" });
}


