import { useLocation } from "react-router-dom";
import { useProjectContext } from "@/contexts/ProjectContext";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TAB_LABELS: Record<string, string> = {
  "/production": "Production",
  "/site-hub": "Site Hub",
  "/design": "Design",
  "/drawings": "Documents",
};

export function ProjectBreadcrumb() {
  const { selectedProject } = useProjectContext();
  const location = useLocation();

  // Only show on project-context pages
  const currentTab = TAB_LABELS[location.pathname];
  const isProjectDetail = location.pathname.startsWith("/projects/") && location.pathname !== "/projects";

  if (!selectedProject || (!currentTab && !isProjectDetail)) return null;

  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/projects" className="text-xs" style={{ color: "#666666" }}>Projects</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {currentTab ? (
            <BreadcrumbLink href={`/projects/${selectedProject.id}`} className="text-xs" style={{ color: "#006039" }}>
              {selectedProject.name}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="text-xs font-semibold" style={{ color: "#006039" }}>
              {selectedProject.name}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {currentTab && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{currentTab}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
