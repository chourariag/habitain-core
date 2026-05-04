import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const OVERRIDE_KEY = "hstack_role_override";
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

export function setRoleOverride(role: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (role) window.sessionStorage.setItem(OVERRIDE_KEY, role);
    else window.sessionStorage.removeItem(OVERRIDE_KEY);
    window.dispatchEvent(new CustomEvent(OVERRIDE_EVENT));
  } catch {
    /* noop */
  }
}

export function useUserRole() {
  const [actualRole, setActualRole] = useState<string | null>(null);
  const [override, setOverride] = useState<string | null>(getRoleOverride());
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

  // Listen for in-tab override changes + cross-tab storage events
  useEffect(() => {
    const sync = () => setOverride(getRoleOverride());
    window.addEventListener(OVERRIDE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(OVERRIDE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Override only honoured when actual role is MD/super_admin
  const canImpersonate = actualRole !== null && MD_ROLES.includes(actualRole);
  const effectiveOverride = canImpersonate && override && override !== actualRole ? override : null;
  const role = effectiveOverride ?? actualRole;

  const setOverrideRole = useCallback((next: string | null) => {
    setRoleOverride(next);
  }, []);

  return {
    role,
    actualRole,
    isImpersonating: !!effectiveOverride,
    canImpersonate,
    setOverrideRole,
    userId,
    loading,
  };
}
