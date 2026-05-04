import { supabase } from "@/integrations/supabase/client";

export type ApprovalRequestType = "add_user" | "deactivate_user" | "create_project" | "archive_project";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  status: ApprovalStatus;
  requested_by: string;
  requested_by_name: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  payload: Record<string, unknown>;
  audit_notes: string | null;
}

export async function raiseApprovalRequest(
  request_type: ApprovalRequestType,
  payload: Record<string, unknown>,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: prof } = await supabase
    .from("profiles")
    .select("display_name,email")
    .eq("auth_user_id", auth.user.id)
    .single();
  const requested_by_name = prof?.display_name || prof?.email || "User";
  const { data, error } = await supabase
    .from("approval_requests" as never)
    .insert({
      request_type,
      payload: payload as never,
      requested_by: auth.user.id,
      requested_by_name,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function listApprovalRequests(filter?: {
  type?: ApprovalRequestType; status?: ApprovalStatus;
}): Promise<ApprovalRequest[]> {
  let q = supabase.from("approval_requests" as never).select("*").order("requested_at", { ascending: false });
  if (filter?.type) q = q.eq("request_type", filter.type);
  if (filter?.status) q = q.eq("status", filter.status);
  const { data } = await q;
  return (data as unknown as ApprovalRequest[]) || [];
}

export async function setApprovalDecision(
  id: string,
  decision: "approved" | "rejected",
  reason?: string,
  audit_notes?: string,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data: prof } = await supabase
    .from("profiles").select("display_name,email").eq("auth_user_id", auth.user.id).single();
  const approved_by_name = prof?.display_name || prof?.email || "MD";
  const { error } = await supabase
    .from("approval_requests" as never)
    .update({
      status: decision,
      approved_by: auth.user.id,
      approved_by_name,
      approved_at: new Date().toISOString(),
      rejected_reason: decision === "rejected" ? (reason || null) : null,
      audit_notes: audit_notes || null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}
