import { useEffect } from "react";

export const PROJECT_IMPORT_EVENT = "hstack-project-setup-imported";

export function dispatchProjectImported(projectId: string) {
  window.dispatchEvent(new CustomEvent(PROJECT_IMPORT_EVENT, { detail: { projectId } }));
}

/**
 * Re-runs `onImport` whenever a Project Setup Template upload finishes for
 * this `projectId`. Use in any tab that consumes setup-uploaded data so the
 * UI refreshes immediately after Karthik uploads.
 */
export function useProjectImportListener(projectId: string | null | undefined, onImport: () => void) {
  useEffect(() => {
    if (!projectId) return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { projectId?: string } | undefined;
      if (!detail?.projectId || detail.projectId === projectId) onImport();
    };
    window.addEventListener(PROJECT_IMPORT_EVENT, handler);
    return () => window.removeEventListener(PROJECT_IMPORT_EVENT, handler);
  }, [projectId, onImport]);
}
