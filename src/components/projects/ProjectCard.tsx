import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MapPin, Calendar, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";

interface ProjectCardProps {
  project: Tables<"projects">;
  modules?: Pick<Tables<"modules">, "current_stage" | "production_status">[];
  hasHandover?: boolean;
}

export function ProjectCard({ project, modules = [], hasHandover = false }: ProjectCardProps) {
  const navigate = useNavigate();
  const status = computeProjectStatus(modules, hasHandover);
  const statusCfg = PROJECT_STATUS_CONFIG[status];

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-lg leading-tight">{project.name}</CardTitle>
          <Badge className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
        </div>
        {project.client_name && (
          <p className="text-sm text-muted-foreground">{project.client_name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {project.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{project.location}</span>
          </div>
        )}
        {project.type && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{project.type}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            {project.start_date ? format(new Date(project.start_date), "MMM yyyy") : "TBD"}
            {" → "}
            {project.est_completion ? format(new Date(project.est_completion), "MMM yyyy") : "TBD"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
