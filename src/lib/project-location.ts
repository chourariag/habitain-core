import { isTier1OrSuper } from "@/lib/roles";

export const SITE_LOCATION_MISSING = "Site location is not set. Ask a director or the Head of Projects to set it.";
export type SiteLocation = { location: string; site_lat: string; site_lng: string; site_radius: string };
export const emptySiteLocation = (): SiteLocation => ({ location: "", site_lat: "", site_lng: "", site_radius: "300" });
export const canEditSiteLocation = (role: string | null | undefined) => isTier1OrSuper(role) || role === "head_of_projects";
export function hasSitePin(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return false;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180 && !(a === 0 && b === 0);
}
export function validateSiteLocation(value: SiteLocation): string | null {
  if (!value.location.trim()) return "Site address is required";
  if (!hasSitePin(value.site_lat, value.site_lng)) return "Enter a valid site latitude and longitude; 0,0 is not allowed";
  const radius = Number(value.site_radius);
  if (!Number.isInteger(radius) || radius < 50 || radius > 1000) return "Attendance radius must be between 50 and 1000 metres";
  return null;
}
export function normaliseClientPhone(value: string): string | null {
  const phone = value.trim().replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(phone)) return `+91${phone}`;
  return /^\+91[6-9]\d{9}$/.test(phone) ? phone : null;
}
export const validClientEmail = (value: string) => /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim());
export const outsideIndia = (lat: number, lng: number) => lat < 6 || lat > 38 || lng < 68 || lng > 98;
export const siteMapUrl = (lat: unknown, lng: unknown) => `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
export function parseSitePin(value: string): { lat: number; lng: number } | null {
  const pair = (text: string) => {
    const m = text.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    return m && hasSitePin(m[1], m[2]) ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
  };
  const plain = pair(value);
  if (plain) return plain;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^(?:www\.)?google\.(?:com|co\.in)$/.test(url.hostname) && url.hostname !== "maps.google.com") return null;
    const data = decodeURIComponent(url.pathname + url.search);
    const exact = data.match(/!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)/);
    if (exact) return pair(`${exact[1]},${exact[2]}`);
    for (const key of ["q", "query", "ll", "destination"]) {
      const result = pair(url.searchParams.get(key) ?? "");
      if (result) return result;
    }
    const at = data.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
    return at ? pair(`${at[1]},${at[2]}`) : null;
  } catch { return null; }
}

// Explicit projection shared by project screens; never include contact or portal credentials.
export const PROJECT_PUBLIC_SELECT = "id,name,client_name,location,type,status,start_date,est_completion,created_by,created_at,updated_at,updated_by,is_archived,construction_type,site_lat,site_lng,site_radius,division,is_design_only,site_ready_confirmed,wip_start_date,wip_close_date,wip_status,gfc_budget,planned_labour_cost,client_portal_enabled,client_portal_expires_at,client_portal_status_message,milestones_locked,production_system,archived_at,archive_reason,contract_value,gfc_budget_total,actually_spent,site_schedule_unlocked_at,site_schedule_notified_at,site_schedule_escalated_at,setup_uploaded_at,setup_uploaded_by_name,module_count,panel_count,project_type,project_size,project_setup_approved,project_setup_approved_at,gfc_budget_approved_at,project_setup_status,closed_at,closed_by,storage_cleaned,storage_cleaned_at,storage_cleaned_by,client_work_order_id,wo_line_item_ref,actual_completion_date,project_architect_id";