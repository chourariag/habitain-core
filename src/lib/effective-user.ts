// Returns the active Testing Mode persona name (set by RoleSwitcher), or null.
// When an MD/super_admin impersonates another user via the Testing Mode panel,
// session storage holds `hstack_role_override_name`. Auto-filled user-name
// fields (inspector, raised by, requested by, etc.) should prefer this over
// the auth profile name so the persona is reflected in created records.
export function getTestingPersonaName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem("hstack_role_override_name");
  } catch {
    return null;
  }
}

export function effectiveDisplayName(
  profileName?: string | null,
  fallback?: string | null,
): string {
  return getTestingPersonaName() || profileName || fallback || "User";
}
