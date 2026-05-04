import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HSTACK_USERS } from "@/lib/hstack-users";

const OVERRIDE_KEY = "hstack_role_override";
const OVERRIDE_NAME_KEY = "hstack_role_override_name";
const OVERRIDE_EVENT = "hstack:role-override-changed";
const MD_ROLES = ["managing_director", "super_admin"];

export function getRoleOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function getRoleOverrideName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(OVERRIDE_NAME_KEY);
  } catch {
    return null;
  }
}

export function setRoleOverride(role: string | null, name?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) {
      window.sessionStorage.setItem(OVERRIDE_KEY, role);
      if (name) window.sessionStorage.setItem(OVERRIDE_NAME_KEY, name);
      else window.sessionStorage.removeItem(OVERRIDE_NAME_KEY);
    } else {
      window.sessionStorage.removeItem(OVERRIDE_KEY);
      window.sessionStorage.removeItem(OVERRIDE_NAME_KEY);
    }
    window.dispatchEvent(new CustomEvent(OVERRIDE_EVENT));
  } catch {
    /* noop */
  }
}

export function useUserRole() {
  const [actualRole, setActualRole] = useState<string | null>(null);
  const [override, setOverride] = useState<string | null>(getRoleOverride());
  const [overrideName, setOverrideName] = useState<string | null>(getRoleOverrideName());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setActualRole(data as string | null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const sync = () => {
      setOverride(getRoleOverride());
      setOverrideName(getRoleOverrideName());
    };
    window.addEventListener(OVERRIDE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(OVERRIDE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const canImpersonate = actualRole !== null && MD_ROLES.includes(actualRole);
  const effectiveOverride = canImpersonate && override && override !== actualRole ? override : null;
  const role = effectiveOverride ?? actualRole;
  // When impersonating, prefer the explicitly selected persona name; otherwise fall back to first matching user for the role
  const personaName = effectiveOverride
    ? (overrideName || HSTACK_USERS.find((u) => u.role === effectiveOverride)?.name || null)
    : null;

  const setOverrideRole = useCallback((next: string | null, name?: string | null) => {
    setRoleOverride(next, name ?? null);
  }, []);

  return {
    role,
    actualRole,
    isImpersonating: !!effectiveOverride,
    canImpersonate,
    personaName,
    setOverrideRole,
    userId,
    loading,
  };
}

