import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { featureFlagForModule } from "@/lib/feature-flags";
import type { ModuleKey } from "@/lib/rbac-matrix";
import { Loader2 } from "lucide-react";

/**
 * Redirects to /dashboard when the current role has NONE access for the given module.
 * Admin Panel routes use `requireAdminPanel` for the explicit allow-list.
 */
export function ModuleGuard({
  module,
  featureFlag,
  requireAdminPanel,
  requireEmployeeManagement,
  requireRoles,
  children,
}: {
  module?: ModuleKey;
  featureFlag?: string;
  requireAdminPanel?: boolean;
  requireEmployeeManagement?: boolean;
  requireRoles?: string[];
  children: ReactNode;
}) {
  const { loading, role, canView, canAccessAdminPanel, canAccessEmployeeManagement } = usePermissions();
  const flags = useFeatureFlags();
  const resolvedFlag = featureFlag ?? (module ? featureFlagForModule(module) : undefined);

  if (loading || (resolvedFlag && flags.isLoading)) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (resolvedFlag && (flags.isError || !flags.isEnabled(resolvedFlag))) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdminPanel && !canAccessAdminPanel()) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireEmployeeManagement && !canAccessEmployeeManagement()) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireRoles && (!role || !requireRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }
  if (module && !canView(module)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
