import { supabase } from "@/integrations/supabase/client";

export const LABOUR_INVOICE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "#F7F7F7", text: "#666666", label: "Draft" },
  checklist_pending: { bg: "#FFF3CD", text: "#D4860A", label: "Checklist Pending" },
  approved: { bg: "#E8F2ED", text: "#006039", label: "Approved" },
  sent: { bg: "#EAF0FB", text: "#1A1A8C", label: "Sent to Subcontractor" },
  partially_paid: { bg: "#FFF3CD", text: "#D4860A", label: "Partially Paid" },
  fully_paid: { bg: "#E8F2ED", text: "#006039", label: "Fully Paid" },
};

export const LABOUR_INVOICE_RAISE_ROLES = [
  "super_admin", "managing_director", "production_head", "site_installation_mgr",
  "finance_director", "finance_manager", "head_operations",
];

export const LABOUR_INVOICE_APPROVE_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
  "production_head", "head_operations",
];

/** Creates a draft labour invoice for a measured & signed-off work order. */
export async function raiseLabourInvoice(
  wo: { id: string; wo_number: string; project_id: string; subcontractor_id: string; total_value: number },
  userId: string | null,
) {
  const { data: existing } = await supabase
    .from("labour_invoices").select("id, invoice_number").eq("work_order_id", wo.id).maybeSingle();
  if (existing) return { alreadyExists: true, invoiceNumber: existing.invoice_number, id: existing.id, error: null };

  const { count } = await supabase.from("labour_invoices").select("id", { count: "exact", head: true });
  const invoiceNumber = `LINV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase.from("labour_invoices").insert({
    invoice_number: invoiceNumber,
    work_order_id: wo.id,
    project_id: wo.project_id,
    subcontractor_id: wo.subcontractor_id,
    amount_total: Number(wo.total_value || 0),
    status: "checklist_pending",
    raised_by: userId,
  }).select("id").maybeSingle();

  return { alreadyExists: false, invoiceNumber, id: data?.id ?? null, error };
}
