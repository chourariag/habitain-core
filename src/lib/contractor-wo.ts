// Contractor Work Order (client-issued WO to ALTREE) helpers.
// Distinct from public.work_orders, which is ALTREE -> subcontractor.

import { supabase } from "@/integrations/supabase/client";

export const CONTRACTOR_WO_TYPE = "contractor_wo";

export interface ClientWorkOrder {
  id: string;
  wo_number: string;
  amendment_number: string | null;
  client_company_name: string;
  client_contact_name: string | null;
  client_contact_email: string | null;
  client_contact_phone: string | null;
  issue_date: string | null;
  amendment_date: string | null;
  commencement_date: string | null;
  completion_days: number | null;
  retention_pct: number;
  dlp_months: number;
  delay_damages_pct_per_week: number;
  delay_damages_cap_pct: number;
  material_advance_pct_1: number;
  material_advance_pct_2: number;
  advance_recovery_threshold_pct: number;
  advance_disbursed: number;
  advance_recovered_to_date: number;
  gst_pct: number;
  sub_total: number;
  discount: number;
  grand_total: number;
  acceptance_platform: string | null;
  acceptance_document_id: string | null;
  acceptance_date: string | null;
  our_signatory: string | null;
  witness_name: string | null;
  acceptance_pdf_url: string | null;
  acceptance_signed: boolean;
  notes: string | null;
}

export interface WoPaymentStage {
  id?: string;
  work_order_id?: string;
  stage_order: number;
  stage_name: string;
  percentage: number;
  trigger_description: string | null;
}

export interface WoSummary {
  work_order_id: string;
  grand_total: number;
  billed_to_date: number;
  billed_pct: number;
  retention_held: number;
  retention_released: number;
  advance_disbursed: number;
  advance_recovered: number;
  advance_outstanding: number;
  advance_recovery_active: boolean;
  linked_projects: number;
  delay_weeks: number;
  delay_exposure: number;
}

export function isContractorWoProject(
  p: { project_type?: string | null; client_work_order_id?: string | null } | null | undefined
): boolean {
  if (!p) return false;
  return String(p.project_type ?? "").toLowerCase() === CONTRACTOR_WO_TYPE || !!p.client_work_order_id;
}

export async function listClientWorkOrders(): Promise<ClientWorkOrder[]> {
  const { data } = await (supabase.from("client_work_orders" as any) as any)
    .select("*").eq("is_archived", false).order("created_at", { ascending: false });
  return (data ?? []) as ClientWorkOrder[];
}

export async function getWoSummary(woId: string): Promise<WoSummary | null> {
  const { data, error } = await (supabase as any).rpc("get_client_wo_summary", { _wo_id: woId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as WoSummary | null;
}

export async function getPaymentStages(woId: string): Promise<WoPaymentStage[]> {
  const { data } = await (supabase.from("client_wo_payment_stages" as any) as any)
    .select("*").eq("work_order_id", woId).order("stage_order");
  return (data ?? []) as WoPaymentStage[];
}

/** Potential delay-damages exposure. Visibility only — never applied automatically. */
export function computeDelayExposure(wo: ClientWorkOrder, actualCompletion?: string | null) {
  if (!wo.commencement_date || !wo.completion_days) {
    return { plannedCompletion: null as string | null, delayWeeks: 0, exposure: 0, capped: false };
  }
  const planned = new Date(wo.commencement_date);
  planned.setDate(planned.getDate() + Number(wo.completion_days));
  const actual = actualCompletion ? new Date(actualCompletion) : new Date();
  const ms = actual.getTime() - planned.getTime();
  const delayWeeks = ms > 0 ? Math.ceil(ms / (7 * 24 * 3600 * 1000)) : 0;
  const raw = (delayWeeks * Number(wo.delay_damages_pct_per_week ?? 0)) / 100 * Number(wo.grand_total ?? 0);
  const cap = (Number(wo.delay_damages_cap_pct ?? 0) / 100) * Number(wo.grand_total ?? 0);
  const exposure = Math.max(0, Math.min(raw, cap));
  return {
    plannedCompletion: planned.toISOString().slice(0, 10),
    delayWeeks,
    exposure,
    capped: raw > cap && cap > 0,
  };
}

export function inr(n: number | null | undefined): string {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
