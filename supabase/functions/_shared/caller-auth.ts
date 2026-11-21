import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { TIER1_ROLES } from "./director-tier.ts";
import { createHash, timingSafeEqual } from "node:crypto";

export const DIRECTOR_CALLERS = ["super_admin", ...TIER1_ROLES] as const;
export const CAPACITY_CALLERS = [...DIRECTOR_CALLERS, "production_head", "head_operations", "planning_engineer"] as const;
export const CALENDAR_CALLERS = [...DIRECTOR_CALLERS, "operations_architect", "principal_architect", "head_operations"] as const;
export function denied(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
export async function authorizeUser(req: Request, roles?: readonly string[]) {
  const token = /^Bearer ([^\s,]+)$/.exec(req.headers.get("Authorization") || "")?.[1];
  if (!token) return denied(401, "Unauthorized");
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return denied(401, "Unauthorized");
    const userId = data.user.id;
    const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] = await Promise.all([
      client.from("profiles").select("is_active").eq("auth_user_id", userId).maybeSingle(),
      client.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileError || roleError || profile?.is_active !== true) return denied(403, "Forbidden");
    const assignedRoles = (roleRows || []).map(row => row.role as string);
    if (roles && !assignedRoles.some(role => roles.includes(role))) return denied(403, "Forbidden");
    return { userId, client, roles: assignedRoles };
  } catch { return denied(401, "Unauthorized"); }
}
export async function canAccessProject(client: ReturnType<typeof createClient>, userId: string, projectId: unknown): Promise<boolean> {
  if (typeof projectId !== "string" || !projectId) return false;
  const { data, error } = await client.rpc("user_can_access_project", { _uid: userId, _project_id: projectId });
  return !error && data === true;
}
// Internal email callers may keep using their existing service bearer.
// Fixed-size digests avoid leaking credential prefixes or lengths.
export function isServiceBearer(req: Request): boolean {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = /^Bearer ([^\s,]+)$/.exec(req.headers.get("Authorization") || "")?.[1];
  if (!expected || !token) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(token), hash(expected));
}
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}
export function validMeetingLink(value: unknown): boolean {
  if (!value) return true;
  try { const url = new URL(String(value)); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}