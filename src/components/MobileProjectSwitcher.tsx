import { useState } from "react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X } from "lucide-react";

/**
 * Persistent green bar on mobile for project-scoped pages.
 * On desktop (md+) it's hidden — the sidebar handles project selection.
 */
export function MobileProjectSwitcher({ label = "Project" }: { label?: string }) {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId } = useProjectContext();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bar — mobile only */}
      <button
        type="button"
        className="md:hidden flex items-center justify-between w-full h-11 px-4"
        style={{ backgroundColor: "#006039" }}
        onClick={() => setOpen(true)}
      >
        <span className="text-[13px] font-bold text-white truncate">
          {selectedProject ? selectedProject.name : `Tap to select ${label.toLowerCase()} ▾`}
        </span>
        <span className="text-[11px] text-white/80 flex items-center gap-0.5 shrink-0">
          Switch <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative rounded-t-2xl max-h-[60vh] overflow-y-auto"
            style={{ backgroundColor: "#FFFFFF" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#E0E0E0" }}>
              <h3 className="font-bold text-sm" style={{ color: "#1A1A1A" }}>Select {label}</h3>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" style={{ color: "#666666" }} />
              </button>
            </div>
            <div className="py-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: p.id === selectedProjectId ? "#E8F2ED" : "transparent",
                  }}
                  onClick={() => { setSelectedProjectId(p.id); setOpen(false); }}
                >
                  <span className="text-sm font-medium truncate" style={{ color: "#1A1A1A" }}>{p.name}</span>
                </button>
              ))}
              {projects.length === 0 && (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "#999999" }}>No active projects</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
