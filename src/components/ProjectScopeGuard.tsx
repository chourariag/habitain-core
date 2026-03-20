import { useProjectContext } from "@/contexts/ProjectContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Wraps project-contextual pages. If no project is selected,
 * shows a prompt to select one instead of the page content.
 */
export function ProjectScopeGuard({ children }: { children: ReactNode }) {
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();

  if (selectedProjectId) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-4">
      <div className="rounded-full p-4" style={{ backgroundColor: "#E8F2ED" }}>
        <FolderKanban className="h-10 w-10" style={{ color: "#006039" }} />
      </div>
      <div className="text-center space-y-1">
        <h2 className="font-display text-lg font-bold" style={{ color: "#1A1A1A" }}>Select a project to continue</h2>
        <p className="text-sm" style={{ color: "#666666" }}>Choose an active project from the dropdown below</p>
      </div>
      <div className="w-64">
        <Select value="" onValueChange={(v) => setSelectedProjectId(v)}>
          <SelectTrigger style={{ borderColor: "#E0E0E0", color: "#1A1A1A" }}>
            <SelectValue placeholder="— Select Project —" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
