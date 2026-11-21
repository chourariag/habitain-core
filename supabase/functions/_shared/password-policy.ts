// Only non-reversible fingerprints are kept; never keep retired credentials here.
const RETIRED_FINGERPRINTS = new Set(["83bf0ef422ae24314144311cf3f1fff8a7eea06e8366945bd729806661f0ba77", "39ac916ca6de1eb80770d07b72dada5fb91f7e949484dbef78b3f706e1648098"]);
export async function passwordPolicyError(password: unknown): Promise<string | null> {
  if (typeof password !== "string" || password.length < 10) return "Password must be at least 10 characters";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return RETIRED_FINGERPRINTS.has(fingerprint) ? "The retired default cannot be used" : null;
}
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}
export function roleGrantError(callerRoles: string[], callerId: string, targetId: string | undefined, newRole: string, oldRoles: string[] = [], lastSuper = false): string | null {
  const superAdmin = callerRoles.includes("super_admin");
  const directors = ["managing_director", "finance_director", "sales_director", "architecture_director"];
  if (!superAdmin && !callerRoles.some(r => directors.includes(r))) return "Director access required";
  if (targetId === callerId) return "Cannot change your own role";
  if (!superAdmin && (newRole === "super_admin" || oldRoles.includes("super_admin"))) return "Only Super Admin may grant or revoke Super Admin";
  if (lastSuper && oldRoles.includes("super_admin") && newRole !== "super_admin") return "Cannot demote the last Super Admin";
  return null;
}
