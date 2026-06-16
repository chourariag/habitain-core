import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleKey } from "@/lib/rbac-matrix";

/**
 * Redirects to /dashboard when the current role has NONE access for the given module.
 * Admin Panel routes use `requireAdminPanel` for the explicit allow-list.
 */
export function ModuleGuard({
  module,
  requireAdminPanel,
  children,
}: {
  module?: ModuleKey;
  requireAdminPanel?: boolean;
  children: ReactNode;
}) {
  const { loading, canView, canAccessAdminPanel } = usePermissions();

  if (loading) return <>{children}</>; // don't flicker before role resolves

  if (requireAdminPanel && !canAccessAdminPanel()) {
    return <Navigate to="/dashboard" replace />;
  }
  if (module && !canView(module)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
