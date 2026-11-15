import { supabase } from "@/integrations/supabase/client";
import { readExifDate, compressPhoto } from "@/lib/site-report-photo";

export type ExpenseWarning = "duplicate" | "older_than_7_days" | "over_category_cap" | "receipt_missing";

export const WARNING_LABELS: Record<ExpenseWarning, string> = {
  duplicate: "Same vendor, bill number and amount already logged",
  older_than_7_days: "Expense date is more than 7 days ago",
  over_category_cap: "Amount is above the category limit",
  receipt_missing: "Receipt missing",
};

export const MIN_REASON = 5;

/** Whole days between entry date and today (local calendar days). */
export function daysOld(entryDate: Date, today: Date = new Date()): number {
  const a = Date.UTC(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((b - a) / 86400000);
}

export function computeWarnings(input: {
  entryDate: Date; today?: Date; receiptMissing: boolean; duplicate: boolean; categoryCap?: number | null; amount?: number;
}): ExpenseWarning[] {
  const w: ExpenseWarning[] = [];
  if (input.duplicate) w.push("duplicate");
  if (daysOld(input.entryDate, input.today) > 7) w.push("older_than_7_days");
  if (input.categoryCap != null && input.amount != null && input.amount > input.categoryCap) w.push("over_category_cap");
  if (input.receiptMissing) w.push("receipt_missing");
  return w;
}

export function reasonOk(reason: string): boolean {
  return reason.trim().length >= MIN_REASON;
}

export function receiptPath(userId: string, d: Date = new Date(), rand = Math.random().toString(36).slice(2, 8)): string {
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${userId}/${ym}/${d.getTime()}-${rand}.jpg`;
}

export type UploadedReceipt = { path: string; exifAt: string | null; flags: string[] };

/** Read EXIF before compressing, compress (~400 KB, 1600 px, JPEG 0.7), upload to private bucket. */
export async function uploadReceipt(userId: string, file: File, fromGallery: boolean): Promise<UploadedReceipt> {
  let exifAt: string | null = null;
  try { exifAt = await readExifDate(file); } catch { exifAt = null; }
  const blob = await compressPhoto(file, 1600, 400 * 1024);
  const path = receiptPath(userId);
  const { error } = await supabase.storage.from("expense-receipts").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const flags: string[] = [];
  if (!exifAt) flags.push("no_exif");
  if (fromGallery) flags.push("from_gallery");
  return { path, exifAt, flags };
}

/** Signed URL for receipt_path first; for legacy receipt_url try signing the site-photos path, else return as-is. */
export async function openReceiptUrl(e: { receipt_path?: string | null; receipt_url?: string | null }): Promise<string | null> {
  if (e.receipt_path) {
    const { data } = await supabase.storage.from("expense-receipts").createSignedUrl(e.receipt_path, 300);
    return data?.signedUrl ?? null;
  }
  if (e.receipt_url) {
    const m = e.receipt_url.match(/\/object\/public\/site-photos\/(.+)$/);
    if (m) {
      const { data } = await supabase.storage.from("site-photos").createSignedUrl(decodeURIComponent(m[1]), 300);
      if (data?.signedUrl) return data.signedUrl;
    }
    return e.receipt_url;
  }
  return null;
}

export function hasReceipt(e: { receipt_path?: string | null; receipt_url?: string | null }): boolean {
  return !!(e.receipt_path || e.receipt_url);
}

export async function isDuplicate(vendor: string, billNo: string, amount: number, excludeId?: string): Promise<boolean> {
  if (!vendor.trim() || !billNo.trim() || !(amount > 0)) return false;
  const { data, error } = await supabase.rpc("check_expense_duplicate" as any, {
    p_vendor: vendor, p_bill_no: billNo, p_amount: amount, p_exclude_id: excludeId ?? null,
  } as any);
  if (error) { console.error("duplicate check failed", error); return false; }
  return data === true;
}

/** Match an Excel "Project Code" to a project: exact id, or project name (case-insensitive). Projects have no separate code column. */
export function matchProject<T extends { id: string; name: string }>(code: string, projects: T[]): T | null {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  return projects.find((p) => p.id.toLowerCase() === c || p.name.trim().toLowerCase() === c) ?? null;
}
