import { callAdminFunction } from "@/lib/admin-api";
import { passwordPolicyError } from "@/lib/password-policy";

export async function changeAccountPassword(password: string, currentPassword?: string, recovery = false) {
  const error = await passwordPolicyError(password);
  if (error) throw new Error(error);
  return callAdminFunction({ action: "change_password", password, current_password: currentPassword, recovery });
}