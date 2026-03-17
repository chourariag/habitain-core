import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MapPin, Calendar, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

interface ProjectCardProps {
  project: Tables<"projects">;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-warning/20 text-warning-foreground border-warning/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-success/20 text-success-foreground border-success/30",
  on_hold: "bg-muted text-muted-foreground border-border",
};

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const statusClass = STATUS_COLORS[project.status ?? "planning"] ?? STATUS_COLORS.planning;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-lg leading-tight">{project.name}</CardTitle>
          <Badge variant="outline" className={statusClass}>
            {(project.status ?? "planning").replace("_", " ")}
          </Badge>
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
