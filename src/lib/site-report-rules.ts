import { format, parseISO, subDays } from "date-fns";

export const SITE_REPORT_BACKDATE_DAYS = 2; // today + previous 2 days = last 3 days
export const ELEVATION_KINDS = ["elevation_front", "elevation_rear", "elevation_left", "elevation_right"] as const;
export type PhotoKind = (typeof ELEVATION_KINDS)[number] | "site_clean" | "other";
export const PHOTO_LABEL: Record<string, string> = {
  elevation_front: "Front", elevation_rear: "Rear", elevation_left: "Left", elevation_right: "Right", site_clean: "Site clean", other: "Other",
};
export const FLAG_LABEL: Record<string, string> = {
  no_exif: "No photo date", date_mismatch: "Taken on another day", far_from_site: "Over 500 m from site", gallery: "From gallery",
};

/** ISO dates (yyyy-MM-dd) the user may report on, newest first. */
export function allowedReportDates(todayIso: string): string[] {
  const t = parseISO(todayIso);
  return Array.from({ length: SITE_REPORT_BACKDATE_DAYS + 1 }, (_, i) => format(subDays(t, i), "yyyy-MM-dd"));
}
export function isAllowedReportDate(dateIso: string, todayIso: string) {
  return allowedReportDates(todayIso).includes(dateIso);
}

export function parsePct(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export function labourBalance(attendanceHours: number, allocated: number[]) {
  const total = allocated.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return { allocated: total, unallocated: Math.max(attendanceHours - total, 0), over: Math.max(total - attendanceHours, 0) };
}

export function exceedsBoq(boqQty: number, cumulative: number, today: number) {
  return boqQty > 0 && cumulative + today > boqQty;
}

export type SubmitCheck = { elevationKinds: string[]; siteClean: boolean; siteCleanPhoto: boolean; tasksWithProgress: number; notes: string };
export function submitBlockers(c: SubmitCheck): string[] {
  const out: string[] = [];
  const missing = ELEVATION_KINDS.filter((k) => !c.elevationKinds.includes(k));
  if (missing.length) out.push(`Elevation photos missing: ${missing.map((k) => PHOTO_LABEL[k]).join(", ")}`);
  if (!c.siteClean) out.push("Tick site clean");
  if (!c.siteCleanPhoto) out.push("Add the site clean photo");
  if (c.tasksWithProgress === 0 && c.notes.trim().length < 5) out.push("Enter progress on a task, or write in notes why no work happened");
  return out;
}
