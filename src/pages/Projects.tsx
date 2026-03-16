import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Projects() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all construction projects</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="bg-card rounded-lg p-8 text-center shadow-sm">
        <p className="text-card-foreground/60 text-sm">No projects yet. Click "New Project" to create one.</p>
      </div>
    </div>
  );
}
